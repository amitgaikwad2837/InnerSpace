/**
 * local-models.ts
 *
 * Metadata for supported on-device LLM models powered by react-native-executorch.
 * These models run fully offline — no API key required.
 *
 * Integration notes:
 *  - Install: npx expo install react-native-executorch
 *  - Requires a custom dev client (Expo Go does NOT support native modules).
 *  - Models are downloaded once from HuggingFace and cached on device.
 *  - Engine wrapper lives in src/services/local-llm-service.ts
 */

import type { LocalModel, LocalModelInfo } from '../types';

export const LOCAL_MODELS: LocalModelInfo[] = [
  {
    id: 'gemma2b_mediapipe',
    label: 'Gemma 2B (Google, MediaPipe)',
    description: 'Coming soon. Planned native MediaPipe runtime integration for Gemma 2B in a development build.',
    sizeGB: 1.8,
    repoId: 'google/gemma-2b-it',
    supported: false,
  },
  {
    id: 'gemma3n',
    label: 'Gemma 3n (Google)',
    description: 'Coming soon. This build does not include a packaged ExecuTorch export for Gemma 3n yet.',
    sizeGB: 0.9,
    repoId: 'google/gemma-3n-E2B-it-GGUF',
    supported: false,
  },
  {
    id: 'phi3mini',
    label: 'Phi-3 Mini (Microsoft)',
    description: 'Coming soon. This build does not include a packaged ExecuTorch export for Phi-3 Mini yet.',
    sizeGB: 2.4,
    repoId: 'microsoft/Phi-3-mini-4k-instruct-gguf',
    supported: false,
  },
  {
    id: 'llama321b',
    label: 'Llama 3.2 1B (Meta)',
    description: 'Working in this build via ExecuTorch. Good default for fast on-device chat.',
    sizeGB: 1.2,
    repoId: 'meta-llama/Llama-3.2-1B-Instruct-GGUF',
    supported: true,
  },
  {
    id: 'qwen251b',
    label: 'Qwen 2.5 1.5B (Alibaba)',
    description: 'Working in this build via ExecuTorch. Strong multilingual on-device option.',
    sizeGB: 1.5,
    repoId: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    supported: true,
  },
];

export function getLocalModelById(id: LocalModel): LocalModelInfo | undefined {
  return LOCAL_MODELS.find((m) => m.id === id);
}

/** Storage keys */
export const AI_MODE_KEY = '@innerspace:ai_mode';             // 'local' | 'cloud'
export const LOCAL_RUNTIME_KEY = '@innerspace:local_runtime'; // 'executorch' | 'mediapipe'
export const LOCAL_MODEL_KEY = '@innerspace:local_model';    // LocalModel id
export const MEDIAPIPE_MODEL_PATH_KEY = '@innerspace:mediapipe_model_path';
export const USER_PROFILE_KEY = '@innerspace:user_profile';  // UserProfile JSON
export const DEFAULT_LOCAL_RUNTIME: import('../types').LocalRuntime = 'executorch';
export const DEFAULT_MEDIAPIPE_MODEL_PATH = '/data/local/tmp/llm/gemma2b.task';

/** Derive age group from a numeric age */
export function getAgeGroup(age: number | null): import('../types').AgeGroup | null {
  if (age === null) return null;
  if (age < 13) return null;   // under 13 not supported
  if (age <= 17) return 'teen';
  if (age <= 30) return 'young_adult';
  if (age <= 55) return 'adult';
  return 'senior';
}

/** Human-readable description of each age group used in prompts */
export const AGE_GROUP_PROMPT: Record<import('../types').AgeGroup, string> = {
  teen:        'The user is a teenager (13–17). Use encouraging, simple language. Avoid jargon.',
  young_adult: 'The user is a young adult (18–30). Be direct, modern, and peer-like in tone.',
  adult:       'The user is an adult (31–55). Be professional, thorough, and pragmatic.',
  senior:      'The user is a senior (56+). Be patient, clear, and respectful. Avoid slang.',
};

/**
 * Cloud AI tools — shown when user chooses the Advanced / Cloud path.
 * Each entry has a help URL so users know how to get an API key.
 */
export const CLOUD_AI_TOOLS = [
  {
    id: 'gemini',
    label: 'Gemini (Google)',
    emoji: '✨',
    description: 'Google\'s flagship AI. Free tier available.',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    apiKeyHelp: 'Go to Google AI Studio → Sign in with Google → Click "Get API key" → Create API key in new project.',
    supportsOAuth: false,
  },
  {
    id: 'openai',
    label: 'ChatGPT / OpenAI',
    emoji: '🤖',
    description: 'GPT-4o and more. Paid usage, reliable quality.',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyHelp: 'Go to platform.openai.com → Sign in → Click your profile → API keys → Create new secret key.',
    supportsOAuth: false,
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    emoji: '🧠',
    description: 'Anthropic\'s thoughtful, safe model.',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyHelp: 'Go to console.anthropic.com → Sign in → Settings → API Keys → Create Key.',
    supportsOAuth: false,
  },
  {
    id: 'groq',
    label: 'Groq (Ultra-fast)',
    emoji: '⚡',
    description: 'Blazing fast inference. Free tier included.',
    apiKeyUrl: 'https://console.groq.com/keys',
    apiKeyHelp: 'Go to console.groq.com → Sign in → API Keys → Create API Key. Free tier available.',
    supportsOAuth: false,
  },
] as const;
