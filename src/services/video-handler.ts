import { EventEmitter } from '../utils/event-emitter'

export class VideoHandler extends EventEmitter {
  private videoElement: HTMLVideoElement | null = null
  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private queue: Uint8Array[] = []
  private isAppending = false

  constructor(videoElement?: HTMLVideoElement) {
    super()
    if (videoElement) {
      this.setVideoElement(videoElement)
    }
  }

  setVideoElement(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement
    this.emit('videoElementSet')
  }

  initialize() {
    if (!this.videoElement) {
      throw new Error('Video element not set')
    }

    if ('MediaSource' in window) {
      this.mediaSource = new MediaSource()
      this.videoElement.src = URL.createObjectURL(this.mediaSource)

      this.mediaSource.addEventListener('sourceopen', () => {
        this.emit('ready')
      })

      this.mediaSource.addEventListener('sourceended', () => {
        this.emit('ended')
      })

      this.mediaSource.addEventListener('error', (error) => {
        this.emit('error', error)
      })
    } else {
      this.emit('error', new Error('MediaSource API not supported'))
    }
  }

  handleVideoData(data: unknown) {
    if (!this.videoElement) {
      return
    }

    try {
      if (typeof data === 'string') {
        const binaryString = atob(data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        this.appendVideoData(bytes)
      } else if (data instanceof ArrayBuffer) {
        this.appendVideoData(new Uint8Array(data))
      } else if (data instanceof Uint8Array) {
        this.appendVideoData(data)
      } else {
        this.emit('imageFrame', data)
      }
    } catch (error) {
      this.emit('error', error)
    }
  }

  private appendVideoData(data: Uint8Array) {
    this.queue.push(data)
    this.processQueue()
  }

  private processQueue() {
    if (this.isAppending || this.queue.length === 0) {
      return
    }

    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      return
    }

    this.isAppending = true
    const data = this.queue.shift()

    if (data) {
      try {
        this.sourceBuffer.appendBuffer(data)
      } catch (error) {
        this.emit('error', error)
        this.isAppending = false
      }
    }
  }

  play() {
    if (this.videoElement && this.videoElement.paused) {
      this.videoElement.play().catch(error => {
        this.emit('error', error)
      })
    }
  }

  pause() {
    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause()
    }
  }

  setVolume(volume: number) {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume))
    }
  }

  clear() {
    this.queue = []

    if (this.videoElement) {
      this.videoElement.pause()
      this.videoElement.src = ''
      this.videoElement.load()
    }

    if (this.sourceBuffer && this.mediaSource) {
      try {
        if (this.mediaSource.readyState === 'open') {
          this.mediaSource.removeSourceBuffer(this.sourceBuffer)
        }
      } catch (error) {
        console.error('Error removing source buffer:', error)
      }
    }

    this.sourceBuffer = null
    this.mediaSource = null
    this.isAppending = false
  }

  destroy() {
    this.clear()
    this.removeAllListeners()
    this.videoElement = null
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement
  }

  isReady(): boolean {
    return this.videoElement !== null && this.mediaSource !== null
  }
}
