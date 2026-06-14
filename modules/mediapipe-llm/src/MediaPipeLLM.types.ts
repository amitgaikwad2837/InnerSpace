export type Role = 'system' | 'user' | 'assistant';

export interface MediaPipeMessage {
  role: Role;
  content: string;
}

export interface MediaPipeGenerateOptions {
  temperature?: number;
  maxTokens?: number;
}
