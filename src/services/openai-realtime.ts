import { EventEmitter } from '../utils/event-emitter'
import { supabase } from '../lib/supabase'
import type { StatusUpdateMessage } from '../types/websocket'

export interface OpenAIRealtimeConfig {
  apiKey: string
  model?: string
  instructions?: string
}

export class OpenAIRealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null
  private config: OpenAIRealtimeConfig
  private isConnected = false
  private sessionId: string | null = null

  constructor(config: OpenAIRealtimeConfig) {
    super()
    this.config = {
      model: 'gpt-4o-realtime-preview-2024-10-01',
      ...config
    }
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get auth session for the Edge Function (using anon key if no session)
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Connect through the Edge Function proxy
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('VITE_SUPABASE_URL not configured');
        }

        this.emitStatus({
          category: 'openai',
          message: 'validating authentication and API keys...',
          level: 'info'
        })

        // Pre-flight check: validate token and API key configuration
        try {
          const checkUrl = `${supabaseUrl}/functions/v1/openai-realtime-proxy?check=true&token=${encodeURIComponent(token)}`;
          const checkResponse = await fetch(checkUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!checkResponse.ok) {
            const errorText = await checkResponse.text();
            throw new Error(`Pre-flight check failed (${checkResponse.status}): ${errorText}`);
          }
        } catch (checkError) {
          this.emitStatus({
            category: 'error',
            message: checkError instanceof Error ? checkError.message : 'pre-flight validation failed',
            level: 'error'
          })
          throw checkError;
        }

        this.emitStatus({
          category: 'openai',
          message: 'establishing WebSocket connection...',
          level: 'info'
        })

        // Convert https:// to wss:// for WebSocket connection
        // Pass token as query parameter since browsers cannot send custom headers in WebSocket handshake
        const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        const url = `${wsUrl}/functions/v1/openai-realtime-proxy?model=${encodeURIComponent(this.config.model)}&token=${encodeURIComponent(token)}`;

        this.ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close()
            reject(new Error('OpenAI connection timeout'))
          }
        }, 10000)

        this.ws.onopen = () => {
          clearTimeout(timeout)
          this.isConnected = true
          this.emitStatus({
            category: 'openai',
            message: 'connected to OpenAI Realtime API via proxy',
            level: 'success'
          })
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          clearTimeout(timeout)
          console.error('[OpenAI WebSocket Error]', error)
          this.emitStatus({
            category: 'error',
            message: `WebSocket error: ${error instanceof Error ? error.message : 'connection failed'}`,
            level: 'error'
          })
          if (!this.isConnected) {
            reject(error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('[OpenAI WebSocket Closed]', event.code, event.reason)
          this.isConnected = false

          const reason = event.reason || 'unknown reason'
          const message = event.code === 1006
            ? `connection closed abnormally (code ${event.code}): check Edge Function logs`
            : event.code !== 1000
            ? `connection closed (code ${event.code}): ${reason}`
            : 'disconnected from OpenAI'

          this.emitStatus({
            category: 'openai',
            message,
            level: event.code === 1000 ? 'warning' : 'error'
          })
          this.emit('disconnected')

          if (!this.isConnected && event.code !== 1000) {
            reject(new Error(`WebSocket closed with code ${event.code}: ${reason}`))
          }
        }
      } catch (error) {
        console.error('[OpenAI Connect Error]', error)
        reject(error)
      }
    })
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data)

      // Log ALL events for debugging
      console.log('[OpenAI Event]', message.type, message)

      switch (message.type) {
        case 'session.created':
          this.sessionId = message.session.id
          this.emit('sessionCreated', message.session)
          this.emitStatus({
            category: 'openai',
            message: 'session initialized',
            level: 'success'
          })
          break

        case 'session.updated':
          console.log('[OpenAI] ✅ Session updated successfully')
          this.emitStatus({
            category: 'openai',
            message: 'session configuration updated',
            level: 'success'
          })
          break

        case 'conversation.item.created':
          if (message.item?.type === 'message' && message.item?.role === 'user') {
            this.emit('userMessageCreated', message.item)
          }
          break

        case 'input_audio_buffer.speech_started':
          console.log('[OpenAI] 🎤 User started speaking')
          this.emitStatus({
            category: 'user',
            message: 'speech detected',
            level: 'info'
          })
          break

        case 'input_audio_buffer.speech_stopped':
          console.log('[OpenAI] 🎤 User stopped speaking')
          this.emitStatus({
            category: 'user',
            message: 'speech ended',
            level: 'info'
          })
          break

        case 'response.audio.delta':
          console.log('[OpenAI] 🔊 Received audio delta, size:', message.delta?.length || 0)
          this.emit('audioResponse', {
            delta: message.delta,
            timestamp: Date.now()
          })
          break

        case 'response.audio.done':
          console.log('[OpenAI] ✅ Audio output complete')
          this.emit('audioResponseComplete')
          break

        case 'conversation.item.input_audio_transcription.completed':
          console.log('[OpenAI] 📝 User transcript:', message.transcript)
          this.emit('transcript', {
            text: message.transcript,
            speaker: 'user'
          })
          this.emitStatus({
            category: 'user',
            message: `transcript: "${message.transcript}"`,
            level: 'info'
          })
          break

        case 'response.output_text.delta':
          console.log('[OpenAI] 📄 Text delta:', message.delta)
          this.emit('textDelta', message.delta)
          break

        case 'response.done':
          console.log('[OpenAI] ✅ Response complete. Output:', message.response?.output || 'No output')
          console.log('[OpenAI] Response status:', message.response?.status)
          if (message.response?.status_details) {
            console.log('[OpenAI] Status details:', JSON.stringify(message.response.status_details, null, 2))
            if (message.response.status_details.error) {
              console.error('[OpenAI] ❌ ERROR:', message.response.status_details.error)
            }
          }
          this.emit('responseComplete', message.response)
          break

        case 'response.created':
          console.log('[OpenAI] 🎯 Response started')
          break

        case 'error':
          console.error('[OpenAI] ❌ Error event:', message.error)
          this.emitStatus({
            category: 'error',
            message: `OpenAI error: ${message.error?.message || 'unknown error'}`,
            level: 'error'
          })
          this.emit('error', message.error)
          break

        default:
          console.log('[OpenAI] ⚠️ Unhandled message type:', message.type, message)
      }
    } catch (error) {
      console.error('[OpenAI] Failed to parse message:', error)
    }
  }

  sendAudioData(audioData: ArrayBuffer): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    const base64Audio = this.arrayBufferToBase64(audioData)

    this.sendMessage({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    })
  }

  commitAudio(): void {
    this.sendMessage({
      type: 'input_audio_buffer.commit'
    })
  }

  createResponse(): void {
    this.sendMessage({
      type: 'response.create'
    })
  }

  updateSession(instructions?: string): void {
    const sessionConfig = {
      type: 'session.update',
      session: {
        type: 'realtime',
        model: this.config.model,
        output_modalities: ['text', 'audio'],
        instructions: instructions || this.config.instructions,
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              rate: 24000
            },
            turn_detection: {
              type: 'semantic_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            }
          },
          output: {
            format: {
              type: 'audio/pcm'
            },
            voice: 'echo'
          }
        },
        transcription: {
          model: 'whisper-1'
        }
      }
    }

    console.log('[OpenAI] Sending session.update:', JSON.stringify(sessionConfig, null, 2))
    this.sendMessage(sessionConfig)
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private emitStatus(status: Omit<StatusUpdateMessage, 'timestamp'>) {
    const message: StatusUpdateMessage = {
      timestamp: Date.now(),
      ...status
    }
    this.emit('status', message)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.sessionId = null
  }

  isActive(): boolean {
    return this.isConnected
  }

  getSessionId(): string | null {
    return this.sessionId
  }
}
