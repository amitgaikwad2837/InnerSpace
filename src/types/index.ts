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
  imageUri?: string;   // local URI for display in bubble
  fileName?: string;   // document name for display
  isIncomplete?: boolean; // stream was cut short; a retry button is shown
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
  afterHabitId?: string;       // habit stacking: cue habit id
  savedStreak?: number;        // catch-up: streak before it broke
  catchUpProgress?: number;    // catch-up: consecutive completions toward recovery (0-3)
  reminderTime?: string;       // "HH:MM" 24hr — e.g. "08:00"
  reminderId?: string;         // expo-notifications identifier, needed to cancel/reschedule
}

export interface JournalEntry {
  id: string;
  prompt: string;
  content: string;
  insight?: string;
  entryDate: Date;
  tags?: string[];             // emotion tags e.g. ['anxious', 'grateful']
}

export interface Goal {
  id: string;
  title: string;
  targetDate?: string;         // ISO date string, optional
  habitIds: string[];          // linked habit ids
  createdAt: string;
}

export interface PinnedInsight {
  id: string;
  content: string;
  agentId: string;
  agentEmoji: string;
  pinnedAt: string;            // ISO timestamp
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
export type LocalRuntime = 'executorch' | 'mediapipe';
export type LocalModel = 'gemma2b_mediapipe' | 'gemma3n' | 'phi3mini' | 'llama321b' | 'qwen251b';

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
