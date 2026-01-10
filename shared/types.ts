export interface WebSocketMessage {
  type: string;
  payload?: any;
}

export interface AudioData {
  audio: ArrayBuffer;
  sampleRate: number;
}

export interface ConversationConfig {
  faceId?: string;
  instructions?: string;
}

export interface ServerStatus {
  connected: boolean;
  openAiConnected: boolean;
  simliConnected: boolean;
}

export enum MessageType {
  AUDIO_DATA = 'audio_data',
  START_CONVERSATION = 'start_conversation',
  END_CONVERSATION = 'end_conversation',
  ERROR = 'error',
  STATUS = 'status',
  SIMLI_VIDEO = 'simli_video',
}
