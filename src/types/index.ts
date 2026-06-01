export interface Agent {
  id: string;
  name: string;
  nameKey: string;
  descriptionKey: string;
  category: string;
  emoji: string;
  systemPrompt: string;
  suggestedQuestions: string[];
  isCustom: boolean;
  isPremium: boolean;
  minimumAIMode?: AIMode;
  description?: string; // legacy compat
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isSafetyRedirect?: boolean;
  safetyCategory?: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  messages: Message[];
  createdAt: Date;
  summary?: string; // Generated after chat ends
}

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  lastCompletedAt?: Date;
  createdAt: Date;
}

export interface JournalEntry {
  id: string;
  prompt: string;
  content: string;
  insight?: string;
  entryDate: Date;
}

export interface User {
  userId: string;
  email: string;
}

export type ToneOption = 'warm' | 'direct' | 'motivational';

export type AIProvider = 'gemini' | 'openai' | 'claude' | 'groq';

export interface UserPreferences {
  language: string;
  tone: ToneOption;
  apiKey?: string;
  aiProvider: AIProvider;
}

export type AgeGroup = 'teen' | 'young_adult' | 'adult' | 'senior';
export type AIMode = 'local' | 'cloud';
export type LocalModel = 'gemma3n' | 'phi3mini' | 'llama321b' | 'qwen251b';

export interface UserProfile {
  name: string;
  age: number | null;          // exact age stored, derived into group for prompts
  ageGroup: AgeGroup | null;
}

export interface LocalModelInfo {
  id: LocalModel;
  label: string;
  description: string;
  sizeGB: number;
  repoId: string;
  supported: boolean;
}

export interface DecisionSession {
  id: string;
  decision: string;
  optionA: string;
  optionB: string;
  analysis: string;
  clarityScore?: number; // 1–10 self-rating
  createdAt: Date;
}
