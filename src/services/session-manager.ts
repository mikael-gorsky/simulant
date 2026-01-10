import { EventEmitter } from '../utils/event-emitter'
import { AudioCapture } from './audio-capture'
import { VideoHandler } from './video-handler'
import { OpenAIRealtimeClient } from './openai-realtime'
import { SimliClient } from './simli-client'
import { supabase } from '../lib/supabase'
import { createAudioResampler } from '../utils/audio-resampler'
import type { ConnectionState, StatusUpdateMessage } from '../types/websocket'

export interface SessionConfig {
  faceId?: string
  characterInstructions?: string
}

export class SessionManager extends EventEmitter {
  private openaiClient: OpenAIRealtimeClient | null = null
  private simliClient: SimliClient | null = null
  private audioCapture: AudioCapture
  private videoHandler: VideoHandler
  private sessionId: string | null = null
  private state: ConnectionState = 'idle'
  private config: SessionConfig
  private openaiApiKey: string | null = null
  private simliApiKey: string | null = null
  private previewTimeout: number | null = null
  private audioResampler = createAudioResampler(24000, 16000)

  constructor(config: SessionConfig = {}) {
    super()
    this.config = {
      faceId: config.faceId || '6ebf0aa7-6fed-443d-a4c6-fd1e3080b215',
      ...config
    }
    this.audioCapture = new AudioCapture()
    this.videoHandler = new VideoHandler()

    this.setupAudioCaptureListeners()
  }

  private audioChunksSent = 0
  private lastAudioLogTime = 0

  private setupAudioCaptureListeners() {
    this.audioCapture.on('audio', ({ data, voiceActivity }) => {
      if (this.state === 'active') {
        if (this.openaiClient) {
          this.openaiClient.sendAudioData(data)
          this.audioChunksSent++

          const now = Date.now()
          if (now - this.lastAudioLogTime > 2000) {
            console.log(`[SessionManager] 📤 Sent ${this.audioChunksSent} audio chunks to OpenAI in last 2s`)
            this.lastAudioLogTime = now
            this.audioChunksSent = 0
          }
        }
      }

      this.emit('audioLevel', voiceActivity ? 0.8 : 0.1)

      if (voiceActivity) {
        this.emitStatus({
          category: 'user',
          message: 'speaking detected',
          level: 'info'
        })
      }
    })

    this.audioCapture.on('started', () => {
      this.emitStatus({
        category: 'audio',
        message: 'microphone capture started',
        level: 'success'
      })
    })

    this.audioCapture.on('error', (error) => {
      this.emitStatus({
        category: 'error',
        message: `microphone error: ${error.message}`,
        level: 'error'
      })
    })
  }

  async startPreview(): Promise<void> {
    try {
      this.emitStatus({
        category: 'connection',
        message: 'loading avatar preview',
        level: 'info'
      })

      await this.loadApiKeys()
      await this.connectSimliPreview()

      this.emitStatus({
        category: 'connection',
        message: 'avatar preview loaded',
        level: 'success'
      })

      this.previewTimeout = window.setTimeout(() => {
        if (this.simliClient && this.state === 'connected') {
          this.emitStatus({
            category: 'connection',
            message: 'preview timeout, disconnecting to save bandwidth',
            level: 'info'
          })
          this.stopPreview()
        }
      }, 5 * 60 * 1000)
    } catch (error) {
      console.error('[Preview] Failed to start preview:', error)
      this.emitStatus({
        category: 'error',
        message: 'avatar preview unavailable',
        level: 'warning'
      })
    }
  }

  stopPreview(keepConnectionAlive = false): void {
    console.log('[SessionManager] Stopping preview mode, keepConnectionAlive:', keepConnectionAlive)

    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout)
      this.previewTimeout = null
    }

    if (this.simliClient && this.state !== 'active') {
      if (keepConnectionAlive) {
        // Just stop audio but keep the client alive for reuse
        console.log('[SessionManager] Pausing preview audio (keeping connection alive for upgrade)')
        this.simliClient.stopAudio()
        this.simliClient.clearBuffer()
      } else {
        // Fully close the connection
        console.log('[SessionManager] Fully closing preview Simli client')
        this.simliClient.stopAudio()
        this.simliClient.clearBuffer()
        this.simliClient.close()
        this.simliClient = null
      }

      console.log('[SessionManager] Preview cleanup complete')
    }

    this.emitStatus({
      category: 'connection',
      message: keepConnectionAlive ? 'preview paused for upgrade' : 'preview mode stopped',
      level: 'info'
    })
  }

  async initialize(): Promise<void> {
    this.setState('connecting')

    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout)
      this.previewTimeout = null
    }

    this.emitStatus({
      category: 'connection',
      message: 'retrieving API keys from Supabase',
      level: 'info'
    })

    await this.loadApiKeys()

    this.emitStatus({
      category: 'connection',
      message: 'connecting to OpenAI Realtime API',
      level: 'info'
    })

    await this.connectOpenAI()

    this.emitStatus({
      category: 'connection',
      message: 'connecting to Simli Avatar API',
      level: 'info'
    })

    if (this.simliClient) {
      console.log('[SessionManager] Found existing Simli client from preview - cleaning up audio')

      // Stop any preview audio before upgrading to full session
      this.simliClient.stopAudio()
      this.simliClient.clearBuffer()

      this.emitStatus({
        category: 'simli',
        message: 'upgrading preview connection to full session',
        level: 'info'
      })

      // The client is already connected, just ensure audio is ready for full session
      console.log('[SessionManager] Preview client upgraded successfully')
    } else {
      await this.connectSimli()
    }

    this.setState('connected')
  }

  private async loadApiKeys(): Promise<void> {
    try {
      const { data: openaiData, error: openaiError } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('key_name', 'openai')
        .maybeSingle()

      if (openaiError) throw openaiError
      if (!openaiData?.key_value) {
        throw new Error('OpenAI API key not found in database')
      }
      this.openaiApiKey = openaiData.key_value

      const { data: simliData, error: simliError } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('key_name', 'simli')
        .maybeSingle()

      if (simliError) throw simliError
      if (!simliData?.key_value) {
        throw new Error('Simli API key not found in database')
      }
      this.simliApiKey = simliData.key_value

      this.emitStatus({
        category: 'connection',
        message: 'API keys loaded successfully',
        level: 'success'
      })
    } catch (error) {
      throw new Error(`Failed to load API keys: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  private async loadCharacterFile(): Promise<string | undefined> {
    try {
      const { data: metadata, error: metadataError } = await supabase
        .from('character_files')
        .select('filename, storage_path')
        .eq('is_active', true)
        .maybeSingle()

      if (metadataError) throw metadataError
      if (!metadata) return undefined

      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('character-files')
        .download(metadata.storage_path)

      if (downloadError) throw downloadError

      const content = await fileData.text()

      this.emitStatus({
        category: 'openai',
        message: `character file loaded: ${metadata.filename}`,
        level: 'success'
      })

      return content
    } catch (error) {
      console.error('Failed to load character file:', error)
      return undefined
    }
  }

  private async connectOpenAI(): Promise<void> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not available')
    }

    const characterInstructions = await this.loadCharacterFile()

    this.openaiClient = new OpenAIRealtimeClient({
      apiKey: this.openaiApiKey,
      instructions: characterInstructions || this.config.characterInstructions
    })

    this.openaiClient.on('status', (status) => {
      this.emit('status', status)
    })

    this.openaiClient.on('sessionCreated', () => {
      this.sessionId = this.openaiClient!.getSessionId()
      this.emit('connected', { sessionId: this.sessionId })
    })

    this.openaiClient.on('audioResponse', ({ delta }) => {
      if (this.simliClient && delta) {
        try {
          const resampledAudio = this.audioResampler.resampleFromBase64(delta)
          console.log('[SessionManager] 🔄 Resampled audio: 24kHz → 16kHz, size:', resampledAudio.length, 'bytes')
          this.simliClient.sendAudioData(resampledAudio)
        } catch (error) {
          console.error('[SessionManager] Error resampling/sending audio to Simli:', error)
        }
      }
    })

    this.openaiClient.on('transcript', (transcript) => {
      this.emit('transcript', transcript)
    })

    this.openaiClient.on('error', (error) => {
      console.error('[OpenAI] Error:', error)
    })

    this.openaiClient.on('disconnected', () => {
      this.emitStatus({
        category: 'error',
        message: 'OpenAI disconnected',
        level: 'error'
      })
      this.emit('disconnected')
    })

    await this.openaiClient.connect()

    if (characterInstructions || this.config.characterInstructions) {
      this.openaiClient.updateSession(characterInstructions || this.config.characterInstructions)
    }
  }

  private async connectSimliPreview(): Promise<void> {
    if (!this.simliApiKey) {
      throw new Error('Simli API key not available')
    }

    const videoElement = this.videoHandler.getVideoElement()
    if (!videoElement) {
      throw new Error('Video element not set')
    }

    this.simliClient = new SimliClient({
      apiKey: this.simliApiKey,
      faceId: this.config.faceId!,
      handleSilence: true,
      videoElement: videoElement
    })

    this.setupSimliListeners()
    await this.simliClient.initializePreview()
  }

  private setupSimliListeners(): void {
    if (!this.simliClient) return

    this.simliClient.on('status', (status) => {
      this.emit('status', status)
    })
  }

  private async connectSimli(): Promise<void> {
    if (!this.simliApiKey) {
      throw new Error('Simli API key not available')
    }

    if (!this.simliClient) {
      const videoElement = this.videoHandler.getVideoElement()
      if (!videoElement) {
        throw new Error('Video element not set')
      }

      this.simliClient = new SimliClient({
        apiKey: this.simliApiKey,
        faceId: this.config.faceId!,
        handleSilence: true,
        videoElement: videoElement
      })

      this.setupSimliListeners()
      await this.simliClient.initialize()
    }
  }

  async startSession(): Promise<void> {
    if (this.state !== 'connected' && this.state !== 'ready') {
      throw new Error('Not connected to services')
    }

    this.emitStatus({
      category: 'connection',
      message: 'requesting microphone access',
      level: 'info'
    })

    try {
      await this.audioCapture.start()

      this.emitStatus({
        category: 'connection',
        message: 'microphone access granted',
        level: 'success'
      })

      this.setState('active')

      // Resume audio playback for full session
      if (this.simliClient) {
        console.log('[SessionManager] Resuming audio for active session')
        this.simliClient.resumeAudio()
      }

      this.emitStatus({
        category: 'connection',
        message: 'session active, listening for input',
        level: 'success'
      })

      this.emit('sessionReady', {
        openaiConnected: true,
        simliConnected: true
      })
    } catch (error) {
      this.emitStatus({
        category: 'error',
        message: `failed to start audio capture: ${error instanceof Error ? error.message : 'unknown error'}`,
        level: 'error'
      })
      throw error
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  async endSession() {
    this.setState('ending')

    this.emitStatus({
      category: 'connection',
      message: 'ending session',
      level: 'info'
    })

    if (this.audioCapture.isActive()) {
      this.audioCapture.stop()
    }

    if (this.openaiClient) {
      this.openaiClient.disconnect()
      this.openaiClient = null
    }

    if (this.simliClient) {
      this.simliClient.disconnect()
      this.simliClient = null
    }

    this.videoHandler.clear()
    this.sessionId = null
    this.setState('idle')

    this.emitStatus({
      category: 'connection',
      message: 'session ended',
      level: 'info'
    })

    this.emit('ended')
  }

  private setState(newState: ConnectionState) {
    const oldState = this.state
    this.state = newState
    this.emit('stateChange', { oldState, newState })
  }

  private emitStatus(status: Omit<StatusUpdateMessage, 'timestamp'>) {
    const fullStatus: StatusUpdateMessage = {
      timestamp: Date.now(),
      ...status
    }
    this.emit('status', fullStatus)
  }

  getState(): ConnectionState {
    return this.state
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  getVideoHandler(): VideoHandler {
    return this.videoHandler
  }

  isConnected(): boolean {
    return this.openaiClient !== null && this.simliClient !== null
  }

  isActive(): boolean {
    return this.state === 'active'
  }

  setMicrophoneMuted(muted: boolean): void {
    this.audioCapture.setMuted(muted)
    this.emitStatus({
      category: 'audio',
      message: `microphone ${muted ? 'muted' : 'unmuted'}`,
      level: 'info'
    })
  }

  isMicrophoneMuted(): boolean {
    return this.audioCapture.isMicrophoneMuted()
  }

  destroy() {
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout)
      this.previewTimeout = null
    }
    this.endSession()
    this.audioCapture.removeAllListeners()
    this.videoHandler.destroy()
    this.removeAllListeners()
  }
}
