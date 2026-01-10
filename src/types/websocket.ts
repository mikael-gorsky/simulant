export interface AudioChunkMessage {
  type: 'audio_data'
  data: string
  timestamp: number
}

export interface StartSessionMessage {
  type: 'start_session'
  characterFileId?: string
  settings?: Record<string, unknown>
}

export interface EndSessionMessage {
  type: 'end_session'
}

export interface PingMessage {
  type: 'ping'
}

export interface StatusUpdateMessage {
  type: 'status'
  message: {
    timestamp: number
    category: 'connection' | 'audio' | 'openai' | 'simli' | 'error' | 'user'
    message: string
    level: 'info' | 'success' | 'warning' | 'error'
    details?: Record<string, unknown>
  }
}

export interface VideoDataMessage {
  type: 'video_data'
  data: unknown
}

export interface ConnectedMessage {
  type: 'connected'
  sessionId: string
  message: string
}

export interface SessionReadyMessage {
  type: 'session_ready'
  openaiConnected: boolean
  simliConnected: boolean
  characterLoaded: boolean
}

export interface ErrorMessage {
  type: 'error'
  message: string
  error?: string
}

export interface PongMessage {
  type: 'pong'
}

export type ClientMessage =
  | AudioChunkMessage
  | StartSessionMessage
  | EndSessionMessage
  | PingMessage

export type ServerMessage =
  | StatusUpdateMessage
  | VideoDataMessage
  | ConnectedMessage
  | SessionReadyMessage
  | ErrorMessage
  | PongMessage

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'ready'
  | 'active'
  | 'ending'
  | 'error'
  | 'closed'
