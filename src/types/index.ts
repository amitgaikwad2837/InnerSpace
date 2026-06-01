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

export interface UserPreferences {
  language: string;
  tone: ToneOption;
  apiKey?: string;
  aiProvider: 'gemini' | 'custom';
}
