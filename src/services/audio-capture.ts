import { EventEmitter } from '../utils/event-emitter'

export interface AudioCaptureConfig {
  sampleRate?: number
  channelCount?: number
  chunkSize?: number
  voiceActivityThreshold?: number
}

export class AudioCapture extends EventEmitter {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private analyser: AnalyserNode | null = null
  private config: Required<AudioCaptureConfig>
  private isCapturing = false
  private isMuted = false

  constructor(config: AudioCaptureConfig = {}) {
    super()
    this.config = {
      sampleRate: config.sampleRate || 24000,
      channelCount: config.channelCount || 1,
      chunkSize: config.chunkSize || 4096,
      voiceActivityThreshold: config.voiceActivityThreshold || 0.01
    }
  }

  async start(): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Audio capture is already running')
    }

    try {
      console.log('[AudioCapture] Requesting microphone access...')

      const mediaStreamPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Microphone access timeout after 10 seconds')), 10000)
      })

      this.mediaStream = await Promise.race([mediaStreamPromise, timeoutPromise])
      console.log('[AudioCapture] Microphone access granted')

      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      })

      console.log('[AudioCapture] ✅ AudioContext created with sample rate:', this.audioContext.sampleRate, 'Hz')
      if (this.audioContext.sampleRate !== this.config.sampleRate) {
        console.warn(`[AudioCapture] ⚠️ Browser resampled: requested ${this.config.sampleRate}Hz, got ${this.audioContext.sampleRate}Hz`)
      }

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream)

      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8

      this.processor = this.audioContext.createScriptProcessor(
        this.config.chunkSize,
        this.config.channelCount,
        this.config.channelCount
      )

      this.mediaStreamSource.connect(this.analyser)
      this.analyser.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      this.processor.onaudioprocess = (event) => {
        this.processAudio(event)
      }

      this.isCapturing = true
      console.log('[AudioCapture] Audio capture started successfully')
      this.emit('started')

    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error)
      this.emit('error', error)
      throw error
    }
  }

  private lastVoiceLogTime = 0
  private voiceDetectionCount = 0

  private processAudio(event: AudioProcessingEvent) {
    if (!this.isCapturing || !this.analyser) return

    const inputData = event.inputBuffer.getChannelData(0)

    const voiceActivity = this.detectVoiceActivity(inputData)

    const pcmData = this.convertToPCM16(inputData)

    if (!this.isMuted) {
      this.emit('audio', {
        data: pcmData,
        timestamp: Date.now(),
        voiceActivity
      })
    }

    if (voiceActivity && !this.isMuted) {
      this.voiceDetectionCount++
      const now = Date.now()
      if (now - this.lastVoiceLogTime > 1000) {
        console.log(`[AudioCapture] 🎤 Voice detected (${this.voiceDetectionCount} chunks in last second)`)
        this.lastVoiceLogTime = now
        this.voiceDetectionCount = 0
      }
      this.emit('voiceDetected')
    }
  }

  private detectVoiceActivity(audioData: Float32Array): boolean {
    if (!this.analyser) return false

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteTimeDomainData(dataArray)

    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128
      sum += normalized * normalized
    }

    const rms = Math.sqrt(sum / bufferLength)
    return rms > this.config.voiceActivityThreshold
  }

  private convertToPCM16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)

    for (let i = 0; i < float32Array.length; i++) {
      let sample = float32Array[i]

      sample = Math.max(-1, Math.min(1, sample))

      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      view.setInt16(i * 2, int16, true)
    }

    return buffer
  }

  stop() {
    this.isCapturing = false

    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect()
      this.mediaStreamSource = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.emit('stopped')
  }

  getState(): 'idle' | 'capturing' {
    return this.isCapturing ? 'capturing' : 'idle'
  }

  isActive(): boolean {
    return this.isCapturing
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    console.log(`[AudioCapture] Microphone ${muted ? 'muted' : 'unmuted'}`)
  }

  isMicrophoneMuted(): boolean {
    return this.isMuted
  }

  static async checkMicrophonePermission(): Promise<PermissionState> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      return result.state
    } catch (error) {
      return 'prompt'
    }
  }

  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      return false
    }
  }
}
