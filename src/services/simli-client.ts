import { SimliClient as OfficialSimliClient } from 'simli-client'
import { EventEmitter } from '../utils/event-emitter'
import type { StatusUpdateMessage } from '../types/websocket'

export interface SimliConfig {
  apiKey: string
  faceId: string
  handleSilence?: boolean
  maxSessionLength?: number
  maxIdleTime?: number
  videoElement: HTMLVideoElement
  audioElement?: HTMLAudioElement
}

// Global counter to track all SimliClient instances
let simliClientInstanceCounter = 0

export class SimliClient extends EventEmitter {
  private client: OfficialSimliClient | null = null
  private config: SimliConfig
  private isConnectedFlag = false
  private audioElement: HTMLAudioElement | null = null
  private audioElementCreatedByUs = false
  private instanceId: number

  constructor(config: SimliConfig) {
    super()
    this.instanceId = ++simliClientInstanceCounter
    this.config = {
      handleSilence: true,
      maxSessionLength: 3600,
      maxIdleTime: 600,
      ...config
    }

    console.log(`[SimliClient #${this.instanceId}] 🆕 NEW INSTANCE CREATED - Total instances created: ${simliClientInstanceCounter}`)
    console.log(`[SimliClient #${this.instanceId}] Created with config:`, {
      faceId: this.config.faceId,
      handleSilence: this.config.handleSilence,
      maxSessionLength: this.config.maxSessionLength,
      maxIdleTime: this.config.maxIdleTime,
      hasVideoElement: !!this.config.videoElement,
      hasAudioElement: !!this.config.audioElement
    })
  }

  async initializePreview(): Promise<void> {
    console.log(`[SimliClient #${this.instanceId}] Starting preview initialization`)
    await this.start()
  }

  async initialize(): Promise<void> {
    console.log(`[SimliClient #${this.instanceId}] Starting full initialization`)
    await this.start()
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      console.log(`[SimliClient #${this.instanceId}] Initializing official Simli client`)

      if (!this.config.videoElement) {
        reject(new Error('Video element is required'))
        return
      }

      // Create audio element if not provided
      let audioElement = this.config.audioElement
      if (!audioElement) {
        audioElement = document.createElement('audio')
        audioElement.autoplay = true
        this.audioElementCreatedByUs = true
        console.log(`[SimliClient #${this.instanceId}] 🔊 Created NEW audio element`)
      } else {
        this.audioElementCreatedByUs = false
        console.log(`[SimliClient #${this.instanceId}] Using provided audio element`)
      }
      this.audioElement = audioElement

      try {
        this.client = new OfficialSimliClient()

        this.client.on('connected', () => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
          console.log(`[SimliClient #${this.instanceId}] ✓ Connected after ${elapsed}s`)
          this.isConnectedFlag = true

          this.emitStatus({
            category: 'simli',
            message: 'connected to Simli',
            level: 'success'
          })

          resolve()
        })

        this.client.on('disconnected', () => {
          console.log('[SimliClient] Disconnected')
          this.isConnectedFlag = false

          this.emitStatus({
            category: 'simli',
            message: 'disconnected from Simli',
            level: 'warning'
          })
        })

        this.client.on('failed', (error) => {
          console.error('[SimliClient] Connection failed:', error)
          this.isConnectedFlag = false

          this.emitStatus({
            category: 'error',
            message: `Simli connection failed: ${error}`,
            level: 'error'
          })

          reject(new Error(`Simli connection failed: ${error}`))
        })

        this.client.on('speaking', () => {
          console.log('[SimliClient] Avatar started speaking')
          this.emitStatus({
            category: 'simli',
            message: 'avatar speaking',
            level: 'info'
          })
        })

        this.client.on('silent', () => {
          console.log('[SimliClient] Avatar stopped speaking')
          this.emitStatus({
            category: 'simli',
            message: 'avatar silent',
            level: 'info'
          })
        })

        const simliConfig = {
          apiKey: this.config.apiKey,
          faceID: this.config.faceId,
          handleSilence: this.config.handleSilence!,
          maxSessionLength: this.config.maxSessionLength!,
          maxIdleTime: this.config.maxIdleTime!,
          videoRef: this.config.videoElement,
          audioRef: audioElement,
          enableConsoleLogs: true,
          session_token: '',
          SimliURL: '',
          maxRetryAttempts: 100,
          retryDelay_ms: 2000,
          videoReceivedTimeout: 15000,
          enableSFU: true,
          model: '' as any
        }

        console.log('[SimliClient] Calling Initialize with config:', {
          faceID: simliConfig.faceID,
          handleSilence: simliConfig.handleSilence,
          maxSessionLength: simliConfig.maxSessionLength,
          maxIdleTime: simliConfig.maxIdleTime,
          hasVideoRef: !!simliConfig.videoRef,
          hasAudioRef: !!simliConfig.audioRef
        })

        this.client.Initialize(simliConfig)
        console.log('[SimliClient] Initialize called')

        this.emitStatus({
          category: 'simli',
          message: 'initializing connection',
          level: 'info'
        })

        console.log('[SimliClient] Calling start()')
        this.client.start()
        console.log('[SimliClient] start() called, waiting for connected event')

        setTimeout(() => {
          if (!this.isConnectedFlag) {
            console.error('[SimliClient] Timeout waiting for connection')
            reject(new Error('Simli connection timeout'))
          }
        }, 30000)

      } catch (error) {
        console.error('[SimliClient] Error during initialization:', error)
        reject(error)
      }
    })
  }

  sendAudioData(audioData: Uint8Array): void {
    if (!this.client) {
      console.error(`[SimliClient #${this.instanceId}] Cannot send audio: client not initialized`)
      return
    }

    if (!this.isConnectedFlag) {
      console.warn(`[SimliClient #${this.instanceId}] Cannot send audio: not connected`)
      return
    }

    try {
      this.client.sendAudioData(audioData)
    } catch (error) {
      console.error('[SimliClient] Error sending audio data:', error)
    }
  }

  clearBuffer(): void {
    if (!this.client) {
      console.error('[SimliClient] Cannot clear buffer: client not initialized')
      return
    }

    try {
      console.log('[SimliClient] Clearing audio buffer')
      this.client.ClearBuffer()
    } catch (error) {
      console.error('[SimliClient] Error clearing buffer:', error)
    }
  }

  stopAudio(): void {
    if (this.audioElement) {
      console.log(`[SimliClient #${this.instanceId}] 🔇 Stopping audio playback`)
      try {
        this.audioElement.pause()
        this.audioElement.currentTime = 0
        this.audioElement.muted = true
      } catch (error) {
        console.error('[SimliClient] Error stopping audio:', error)
      }
    }
  }

  resumeAudio(): void {
    if (this.audioElement) {
      console.log(`[SimliClient #${this.instanceId}] 🔊 Resuming audio playback`)
      try {
        this.audioElement.muted = false
      } catch (error) {
        console.error('[SimliClient] Error resuming audio:', error)
      }
    }
  }

  isConnected(): boolean {
    return this.isConnectedFlag
  }

  disconnect(): void {
    this.close()
  }

  close(): void {
    console.log(`[SimliClient #${this.instanceId}] 🔴 Closing connection`)

    // Stop audio before closing
    this.stopAudio()

    if (this.client) {
      try {
        this.client.close()
      } catch (error) {
        console.error('[SimliClient] Error closing client:', error)
      }
      this.client = null
    }

    // Clean up audio element if we created it
    if (this.audioElement && this.audioElementCreatedByUs) {
      console.log(`[SimliClient #${this.instanceId}] 🗑️ Removing audio element from DOM`)
      try {
        this.audioElement.pause()
        this.audioElement.srcObject = null
        this.audioElement.src = ''
        if (this.audioElement.parentNode) {
          this.audioElement.parentNode.removeChild(this.audioElement)
        }
      } catch (error) {
        console.error('[SimliClient] Error removing audio element:', error)
      }
    }

    this.audioElement = null
    this.audioElementCreatedByUs = false
    this.isConnectedFlag = false

    this.emitStatus({
      category: 'simli',
      message: 'connection closed',
      level: 'info'
    })
  }

  private emitStatus(status: StatusUpdateMessage): void {
    this.emit('status', status)
  }
}
