/**
 * Provider adapter contracts for routing chat to cloud or local AI backends.
 *
 * This file is intentionally framework-agnostic so new providers (for example,
 * MediaPipe Gemma 2B) can be added without rewriting screen logic.
 */

export type AIProviderId =
  | 'gemini'
  | 'openai'
  | 'claude'
  | 'groq'
  | 'local_executorch'
  | 'local_mediapipe';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatContext {
  userMessage: string;
  systemPrompt: string;
  history: AIChatMessage[];
}

export interface AIProviderResult {
  text: string;
  isSafetyRedirect: boolean;
  safetyCategory?: string;
  error?: string;
  isQuotaLimited?: boolean;
  cooldownUntil?: string;
}

export interface AIProviderAdapter {
  id: AIProviderId;
  isAvailable(): Promise<boolean>;
  chat(context: AIChatContext): Promise<AIProviderResult>;
}
