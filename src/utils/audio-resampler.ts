export interface ResamplerConfig {
  sourceSampleRate: number
  targetSampleRate: number
}

export class AudioResampler {
  private config: ResamplerConfig

  constructor(config: ResamplerConfig) {
    this.config = config
  }

  base64ToPCM16(base64: string): Int16Array {
    try {
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return new Int16Array(bytes.buffer)
    } catch (error) {
      console.error('[AudioResampler] Error decoding base64:', error)
      throw error
    }
  }

  resample(samples: Int16Array): Int16Array {
    const { sourceSampleRate, targetSampleRate } = this.config

    if (sourceSampleRate === targetSampleRate) {
      return samples
    }

    const ratio = sourceSampleRate / targetSampleRate
    const outputLength = Math.floor(samples.length / ratio)
    const resampled = new Int16Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio
      const index1 = Math.floor(sourceIndex)
      const index2 = Math.min(index1 + 1, samples.length - 1)
      const fraction = sourceIndex - index1

      resampled[i] = Math.round(
        samples[index1] * (1 - fraction) + samples[index2] * fraction
      )
    }

    return resampled
  }

  pcm16ToUint8Array(samples: Int16Array): Uint8Array {
    const buffer = new ArrayBuffer(samples.length * 2)
    const view = new DataView(buffer)

    for (let i = 0; i < samples.length; i++) {
      view.setInt16(i * 2, samples[i], true)
    }

    return new Uint8Array(buffer)
  }

  resampleFromBase64(base64Audio: string): Uint8Array {
    const pcm16Samples = this.base64ToPCM16(base64Audio)
    const resampled = this.resample(pcm16Samples)
    return this.pcm16ToUint8Array(resampled)
  }
}

export function createAudioResampler(sourceSampleRate: number, targetSampleRate: number): AudioResampler {
  return new AudioResampler({ sourceSampleRate, targetSampleRate })
}
