/**
 * AI Service — Multi-provider support
 *
 * Supports Gemini (default), OpenAI, Claude, Groq.
 * Use callAI() for new code — provider + key resolved internally.
 * callGeminiAPI() kept for backwards compatibility.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { checkSafety } from './safety-filter';
import { AI_MODE_KEY, LOCAL_RUNTIME_KEY, DEFAULT_LOCAL_RUNTIME, USER_PROFILE_KEY, AGE_GROUP_PROMPT } from '../constants/local-models';
import { callLocalLLM } from './local-llm-service';
import { callMediaPipeGemma2B } from './local-mediapipe-service';
import type { UserProfile } from '../types';

const AI_PROVIDER_KEY = '@innerspace:ai_provider';
const API_KEY_STORE = 'innerspace_api_key';
const ALL_PROVIDERS = ['gemini', 'openai', 'claude', 'groq'] as const;
type AIProvider = (typeof ALL_PROVIDERS)[number];

function providerApiKeyStore(provider: AIProvider): string {
  return `${API_KEY_STORE}_${provider}`;
}

// In-memory key cache — avoids a SecureStore (hardware disk I/O) read on every request.
// Cleared on logout via clearApiKeyCache().
const apiKeyCache = new Map<AIProvider, string>();

export function clearApiKeyCache(): void {
  apiKeyCache.clear();
}

async function getProviderApiKey(provider: AIProvider): Promise<string | null> {
  const cached = apiKeyCache.get(provider);
  if (cached) return cached;

  const providerSpecificKey = await SecureStore.getItemAsync(providerApiKeyStore(provider));
  if (providerSpecificKey?.trim()) {
    apiKeyCache.set(provider, providerSpecificKey.trim());
    return providerSpecificKey.trim();
  }

  // Backwards compatibility with historical single-key storage.
  const legacyKey = await SecureStore.getItemAsync(API_KEY_STORE);
  if (legacyKey?.trim()) {
    apiKeyCache.set(provider, legacyKey.trim());
    return legacyKey.trim();
  }

  return null;
}

const MAX_HISTORY_MESSAGES = 20;

/** Keep only the most recent messages to avoid exceeding provider token limits. */
function trimHistory(history: GeminiMessage[]): GeminiMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  return history.slice(history.length - MAX_HISTORY_MESSAGES);
}

function getProviderFailoverOrder(primaryProvider: AIProvider): AIProvider[] {
  return [primaryProvider, ...ALL_PROVIDERS.filter((provider) => provider !== primaryProvider)];
}

/** Build a system prompt enriched with the user's age-group and name context */
async function enrichSystemPrompt(base: string): Promise<string> {
  try {
    const profileRaw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    if (!profileRaw) return base;
    const profile: UserProfile = JSON.parse(profileRaw);
    const parts: string[] = [];
    if (profile.name) parts.push(`The user's name is ${profile.name}.`);
    if (profile.ageGroup) parts.push(AGE_GROUP_PROMPT[profile.ageGroup]);
    if (!parts.length) return base;
    return `${parts.join(' ')}\n\n${base}`;
  } catch {
    return base;
  }
}

interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeminiResponse {
  text: string;
  isSafetyRedirect: boolean;
  safetyCategory?: string;
  error?: string;
  isQuotaLimited?: boolean;
  cooldownUntil?: string;
  providerUsed?: AIProvider | 'local';
  fallbackTried?: AIProvider[];
}

function getNextQuotaResetAt(response?: Response): string {
  const retryAfter = response?.headers.get('retry-after');
  if (retryAfter) {
    const asNumber = Number(retryAfter);
    if (!Number.isNaN(asNumber) && asNumber > 0) {
      return new Date(Date.now() + asNumber * 1000).toISOString();
    }
    const asDate = new Date(retryAfter);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString();
    }
  }

  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 5, 0, 0);
  return next.toISOString();
}

function isLikelyQuotaError(status: number, bodyText: string): boolean {
  if (status === 429) return true;
  const lower = bodyText.toLowerCase();
  return lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted');
}

export async function callGeminiAPI(
  userMessage: string,
  agentSystemPrompt: string,
  conversationHistory: GeminiMessage[],
  accessToken: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<GeminiResponse> {
  // Step 1: Safety check
  const safety = checkSafety(userMessage);
  if (!safety.isSafe) {
    return {
      text: safety.redirectMessage ?? 'I cannot help with that topic. Please seek appropriate professional support.',
      isSafetyRedirect: true,
      safetyCategory: safety.category ?? undefined,
    };
  }

  const enrichedPrompt = await enrichSystemPrompt(agentSystemPrompt);

  // Step 2: Build request with system prompt + trimmed history
  const messages: GeminiMessage[] = [
    ...trimHistory(conversationHistory),
    { role: 'user', content: userMessage },
  ];

  try {
    // API keys start with "AIza"; everything else is treated as an OAuth Bearer token
    const isApiKey = accessToken.startsWith('AIza');
    const base = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const url = isApiKey ? `${base}?key=${accessToken}` : base;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!isApiKey) headers['Authorization'] = `Bearer ${accessToken}`;

    const contents = messages.map((msg, idx) => {
      const isLastUser = idx === messages.length - 1 && msg.role === 'user';
      const parts: object[] = [{ text: msg.content }];
      if (isLastUser && imageBase64) {
        parts.push({ inline_data: { mime_type: imageMimeType ?? 'image/jpeg', data: imageBase64 } });
      }
      return { role: msg.role === 'user' ? 'user' : 'model', parts };
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: enrichedPrompt }] },
        contents,
      }),
    });

    if (response.status === 401) {
      return {
        text: 'I lost connection for a moment. Please sign in again and we can continue right away.',
        isSafetyRedirect: false,
        error: 'auth_expired',
      };
    }

    if (response.status === 403) {
      return {
        text: 'I am not ready to respond from this account just yet. Please open Settings and connect your helper there, then come back to chat.',
        isSafetyRedirect: false,
        error: 'gemini_not_enabled',
      };
    }

    if (!response.ok) {
      const bodyText = await response.text();
      if (isLikelyQuotaError(response.status, bodyText)) {
        const cooldownUntil = getNextQuotaResetAt(response);
        const friendlyTime = new Date(cooldownUntil).toLocaleString([], {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          text: `I am feeling tired now, so I am going to take rest and will be up again on ${friendlyTime}.`,
          isSafetyRedirect: false,
          error: 'quota_exceeded',
          isQuotaLimited: true,
          cooldownUntil,
        };
      }

      return {
        text: 'I hit a small snag just now. Please try again in a moment.',
        isSafetyRedirect: false,
        error: `Gemini API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const assistantMessage =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      'No response received.';

    return {
      text: assistantMessage,
      isSafetyRedirect: false,
    };
  } catch (error) {
    return {
      text: 'I could not respond right now. Please try again in a little while.',
      isSafetyRedirect: false,
      error: `Failed to call Gemini API: ${error}`,
    };
  }
}

// ── Multi-provider callAI ─────────────────────────────────────────────────────

/**
 * Universal AI call that reads provider and API key from device storage.
 * Prefer this over callGeminiAPI for all new code.
 */
export async function callAI(
  userMessage: string,
  agentSystemPrompt: string,
  conversationHistory: GeminiMessage[],
  imageBase64?: string,
  imageMimeType?: string,
): Promise<GeminiResponse> {
  const safety = checkSafety(userMessage);
  if (!safety.isSafe) {
    return {
      text: safety.redirectMessage ?? 'I cannot help with that topic. Please seek appropriate professional support.',
      isSafetyRedirect: true,
      safetyCategory: safety.category ?? undefined,
    };
  }

  const enrichedPrompt = await enrichSystemPrompt(agentSystemPrompt);

  // Check if user has chosen local (on-device) mode
  const aiMode = await AsyncStorage.getItem(AI_MODE_KEY);

  const providerRaw = await AsyncStorage.getItem(AI_PROVIDER_KEY);
  const provider = (providerRaw as AIProvider) || 'gemini';

  const trimmedHistory = trimHistory(conversationHistory);

  const callProvider = async (targetProvider: AIProvider, apiKey: string): Promise<GeminiResponse> => {
    switch (targetProvider) {
      case 'openai':
        return callOpenAI(userMessage, enrichedPrompt, trimmedHistory, apiKey, imageBase64, imageMimeType);
      case 'claude':
        return callClaude(userMessage, enrichedPrompt, trimmedHistory, apiKey, imageBase64, imageMimeType);
      case 'groq':
        // Groq's llama-3.1-8b-instant is text-only — images are silently dropped
        return callGroq(userMessage, enrichedPrompt, trimmedHistory, apiKey);
      default:
        return callGeminiAPI(userMessage, enrichedPrompt, trimmedHistory, apiKey, imageBase64, imageMimeType);
    }
  };

  // ── Local model path ────────────────────────────────────────────────────────
  if (aiMode === 'local') {
    const localRuntime = (await AsyncStorage.getItem(LOCAL_RUNTIME_KEY)) ?? DEFAULT_LOCAL_RUNTIME;
    const localResult = localRuntime === 'mediapipe'
      ? await callMediaPipeGemma2B(userMessage, enrichedPrompt, conversationHistory)
      : await callLocalLLM(userMessage, enrichedPrompt, conversationHistory);

    // Local succeeded — return immediately (guard against empty text with no error)
    if (!localResult.error) {
      if (!localResult.text?.trim()) {
        return { text: '', isSafetyRedirect: false, error: 'local_model_error', providerUsed: 'local' };
      }
      return { text: localResult.text, isSafetyRedirect: false, providerUsed: 'local' };
    }

    // Local failed — silently try cloud fallback if a key exists
    const fallbackKey = await getProviderApiKey(provider);
    if (fallbackKey) {
      try {
        const cloudResult = await callProvider(provider, fallbackKey);
        if (!cloudResult.error) {
          return { ...cloudResult, providerUsed: provider, error: 'local_used_cloud_fallback' };
        }
      } catch {
        // ignore cloud error — fall through to local error response
      }
    }

    // No cloud fallback available — return structured error so ChatScreen can show recovery UI
    return {
      text: '',
      isSafetyRedirect: false,
      error: localResult.error ?? 'local_model_error',
      providerUsed: 'local',
    };
  }

  // ── Cloud path ───────────────────────────────────────────────────────────────
  const providerOrder = getProviderFailoverOrder(provider);

  const providerKeys = await Promise.all(
    providerOrder.map(async (currentProvider) => {
      const key = await getProviderApiKey(currentProvider);
      return [currentProvider, key] as const;
    }),
  );

  const configuredProviders = providerKeys.filter(([, key]) => Boolean(key));

  if (!configuredProviders.length) {
    return {
      text: 'No AI key configured. Please add your API key in Settings to use AI features.',
      isSafetyRedirect: false,
      error: 'no_key',
    };
  }

  const triedProviders: AIProvider[] = [];
  let lastQuotaResult: GeminiResponse | null = null;

  for (const [currentProvider, currentKey] of configuredProviders) {
    const apiKey = currentKey as string;
    triedProviders.push(currentProvider);

    const result = await callProvider(currentProvider, apiKey);
    if (!result.error || result.error !== 'quota_exceeded') {
      return {
        ...result,
        providerUsed: currentProvider,
        fallbackTried: triedProviders,
      };
    }

    lastQuotaResult = result;
  }

  if (lastQuotaResult) {
    return {
      ...lastQuotaResult,
      text: 'All configured AI providers have reached quota right now. Please try again later or update quota in provider settings.',
      fallbackTried: triedProviders,
    };
  }

  return {
    text: 'I could not respond right now. Please try again shortly.',
    isSafetyRedirect: false,
    error: 'provider_fallback_failed',
  };
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(
  userMessage: string,
  systemPrompt: string,
  history: GeminiMessage[],
  apiKey: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<GeminiResponse> {
  // Build the last user content — array form when image is attached, string otherwise
  const lastUserContent: string | object[] = imageBase64
    ? [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: `data:${imageMimeType ?? 'image/jpeg'};base64,${imageBase64}` } },
      ]
    : userMessage;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: lastUserContent },
  ];
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 4096 }),
    });
    if (!response.ok) {
      const bodyText = await response.text();
      if (isLikelyQuotaError(response.status, bodyText)) {
        return { text: 'Usage limit reached on your OpenAI account. Please check your quota.', isSafetyRedirect: false, error: 'quota_exceeded', isQuotaLimited: true };
      }
      if (response.status === 401) return { text: 'Invalid OpenAI API key. Please check Settings.', isSafetyRedirect: false, error: 'auth_expired' };
      return { text: 'Something went wrong. Please try again.', isSafetyRedirect: false, error: `OpenAI error: ${response.status}` };
    }
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content ?? 'No response received.', isSafetyRedirect: false };
  } catch (error) {
    return { text: 'Could not reach OpenAI. Please try again.', isSafetyRedirect: false, error: String(error) };
  }
}

// ── Claude (Anthropic) ───────────────────────────────────────────────────────

async function callClaude(
  userMessage: string,
  systemPrompt: string,
  history: GeminiMessage[],
  apiKey: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<GeminiResponse> {
  const lastUserContent: string | object[] = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageMimeType ?? 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: userMessage },
      ]
    : userMessage;

  const messages = [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: lastUserContent },
  ];
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, system: systemPrompt, messages }),
    });
    if (!response.ok) {
      const bodyText = await response.text();
      if (isLikelyQuotaError(response.status, bodyText)) {
        return { text: 'Usage limit reached on your Claude account. Please check your quota.', isSafetyRedirect: false, error: 'quota_exceeded', isQuotaLimited: true };
      }
      if (response.status === 401) return { text: 'Invalid Claude API key. Please check Settings.', isSafetyRedirect: false, error: 'auth_expired' };
      return { text: 'Something went wrong. Please try again.', isSafetyRedirect: false, error: `Claude error: ${response.status}` };
    }
    const data = await response.json();
    return { text: data.content?.[0]?.text ?? 'No response received.', isSafetyRedirect: false };
  } catch (error) {
    return { text: 'Could not reach Claude. Please try again.', isSafetyRedirect: false, error: String(error) };
  }
}

// ── Groq ─────────────────────────────────────────────────────────────────────

async function callGroq(
  userMessage: string,
  systemPrompt: string,
  history: GeminiMessage[],
  apiKey: string,
): Promise<GeminiResponse> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: userMessage },
  ];
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 4096 }),
    });
    if (!response.ok) {
      const bodyText = await response.text();
      if (isLikelyQuotaError(response.status, bodyText)) {
        return { text: 'Usage limit reached on your Groq account. Please check your quota.', isSafetyRedirect: false, error: 'quota_exceeded', isQuotaLimited: true };
      }
      if (response.status === 401) return { text: 'Invalid Groq API key. Please check Settings.', isSafetyRedirect: false, error: 'auth_expired' };
      return { text: 'Something went wrong. Please try again.', isSafetyRedirect: false, error: `Groq error: ${response.status}` };
    }
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content ?? 'No response received.', isSafetyRedirect: false };
  } catch (error) {
    return { text: 'Could not reach Groq. Please try again.', isSafetyRedirect: false, error: String(error) };
  }
}

// ── Provider capability queries ───────────────────────────────────────────────

// ── Streaming ─────────────────────────────────────────────────────────────────

async function readSSE(
  response: Response,
  onChunk: (text: string) => void,
  extractText: (parsed: unknown) => string | null,
  signal?: AbortSignal,
): Promise<string> {
  if (!response.body) {
    // No readable stream support — parse body as JSON and return whole response
    const data = await response.json();
    const text = extractText(data) ?? '';
    onChunk(text);
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const raw = trimmed.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const chunk = extractText(JSON.parse(raw));
          if (chunk) { fullText += chunk; onChunk(chunk); }
        } catch { /* skip malformed chunk */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return fullText;
}

async function streamGemini(
  userMessage: string, systemPrompt: string, history: GeminiMessage[],
  apiKey: string, onChunk: (c: string) => void, signal?: AbortSignal,
  imageBase64?: string, imageMimeType?: string,
): Promise<GeminiResponse> {
  const isApiKey = apiKey.startsWith('AIza');
  const base = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';
  const url = isApiKey ? `${base}?key=${apiKey}&alt=sse` : `${base}?alt=sse`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isApiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const messages = [...history, { role: 'user' as const, content: userMessage }];
  const contents = messages.map((msg, idx) => {
    const isLast = idx === messages.length - 1 && msg.role === 'user';
    const parts: object[] = [{ text: msg.content }];
    if (isLast && imageBase64) parts.push({ inline_data: { mime_type: imageMimeType ?? 'image/jpeg', data: imageBase64 } });
    return { role: msg.role === 'user' ? 'user' : 'model', parts };
  });

  try {
    const response = await fetch(url, {
      method: 'POST', headers, signal,
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents }),
    });
    if (!response.ok) {
      const bodyText = await response.text();
      if (response.status === 401) return { text: '', isSafetyRedirect: false, error: 'auth_expired' };
      if (isLikelyQuotaError(response.status, bodyText)) {
        const cooldownUntil = getNextQuotaResetAt(response);
        return { text: '', isSafetyRedirect: false, error: 'quota_exceeded', isQuotaLimited: true, cooldownUntil };
      }
      return { text: '', isSafetyRedirect: false, error: `gemini_stream_${response.status}` };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullText = await readSSE(response, onChunk, (d) => (d as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? null, signal);
    return { text: fullText, isSafetyRedirect: false };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { text: '', isSafetyRedirect: false, error: 'aborted' };
    return { text: '', isSafetyRedirect: false, error: String(err) };
  }
}

async function streamOpenAI(
  userMessage: string, systemPrompt: string, history: GeminiMessage[],
  apiKey: string, onChunk: (c: string) => void, signal?: AbortSignal,
  imageBase64?: string, imageMimeType?: string,
): Promise<GeminiResponse> {
  const lastContent: string | object[] = imageBase64
    ? [{ type: 'text', text: userMessage }, { type: 'image_url', image_url: { url: `data:${imageMimeType ?? 'image/jpeg'};base64,${imageBase64}` } }]
    : userMessage;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: lastContent },
  ];
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 4096, stream: true }),
    });
    if (!response.ok) {
      const body = await response.text();
      if (isLikelyQuotaError(response.status, body)) return { text: '', isSafetyRedirect: false, error: 'quota_exceeded', isQuotaLimited: true };
      return { text: '', isSafetyRedirect: false, error: `openai_stream_${response.status}` };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullText = await readSSE(response, onChunk, (d) => (d as any)?.choices?.[0]?.delta?.content ?? null, signal);
    return { text: fullText, isSafetyRedirect: false };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { text: '', isSafetyRedirect: false, error: 'aborted' };
    return { text: '', isSafetyRedirect: false, error: String(err) };
  }
}

async function streamClaude(
  userMessage: string, systemPrompt: string, history: GeminiMessage[],
  apiKey: string, onChunk: (c: string) => void, signal?: AbortSignal,
  imageBase64?: string, imageMimeType?: string,
): Promise<GeminiResponse> {
  const lastContent: string | object[] = imageBase64
    ? [{ type: 'image', source: { type: 'base64', media_type: imageMimeType ?? 'image/jpeg', data: imageBase64 } }, { type: 'text', text: userMessage }]
    : userMessage;
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: lastContent },
  ];
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1024, system: systemPrompt, messages, stream: true }),
    });
    if (!response.ok) {
      const body = await response.text();
      if (isLikelyQuotaError(response.status, body)) return { text: '', isSafetyRedirect: false, error: 'quota_exceeded', isQuotaLimited: true };
      return { text: '', isSafetyRedirect: false, error: `claude_stream_${response.status}` };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullText = await readSSE(response, onChunk, (d) => (d as any)?.type === 'content_block_delta' ? ((d as any)?.delta?.text ?? null) : null, signal);
    return { text: fullText, isSafetyRedirect: false };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { text: '', isSafetyRedirect: false, error: 'aborted' };
    return { text: '', isSafetyRedirect: false, error: String(err) };
  }
}

async function streamGroq(
  userMessage: string, systemPrompt: string, history: GeminiMessage[],
  apiKey: string, onChunk: (c: string) => void, signal?: AbortSignal,
): Promise<GeminiResponse> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 4096, stream: true }),
    });
    if (!response.ok) {
      const body = await response.text();
      if (isLikelyQuotaError(response.status, body)) return { text: '', isSafetyRedirect: false, error: 'quota_exceeded', isQuotaLimited: true };
      return { text: '', isSafetyRedirect: false, error: `groq_stream_${response.status}` };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullText = await readSSE(response, onChunk, (d) => (d as any)?.choices?.[0]?.delta?.content ?? null, signal);
    return { text: fullText, isSafetyRedirect: false };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { text: '', isSafetyRedirect: false, error: 'aborted' };
    return { text: '', isSafetyRedirect: false, error: String(err) };
  }
}

/**
 * Streaming AI call. Delivers text chunks as they arrive for cloud providers.
 * Local model: no streaming — onChunk called once with full response when done.
 * Returns final GeminiResponse for error/safety/quota handling.
 */
export async function callAIStream(
  userMessage: string,
  agentSystemPrompt: string,
  conversationHistory: GeminiMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<GeminiResponse> {
  const safety = checkSafety(userMessage);
  if (!safety.isSafe) {
    return { text: safety.redirectMessage ?? 'I cannot help with that.', isSafetyRedirect: true, safetyCategory: safety.category ?? undefined };
  }

  const enrichedPrompt = await enrichSystemPrompt(agentSystemPrompt);
  const aiMode = await AsyncStorage.getItem(AI_MODE_KEY);
  const providerRaw = await AsyncStorage.getItem(AI_PROVIDER_KEY);
  const provider = (providerRaw as AIProvider) || 'gemini';

  // Local model — no streaming capability, call normally and emit once
  if (aiMode === 'local') {
    const result = await callAI(userMessage, agentSystemPrompt, conversationHistory, imageBase64, imageMimeType);
    if (!result.error && result.text) onChunk(result.text);
    return { ...result, providerUsed: 'local' };
  }

  const providerOrder = getProviderFailoverOrder(provider);
  const providerKeys = await Promise.all(providerOrder.map(async (p) => [p, await getProviderApiKey(p)] as const));
  const configured = providerKeys.filter(([, k]) => Boolean(k));

  if (!configured.length) {
    return { text: 'No AI key configured. Please add your API key in Settings.', isSafetyRedirect: false, error: 'no_key' };
  }

  const trimmedHistory = trimHistory(conversationHistory);
  let lastResult: GeminiResponse | null = null;

  for (const [currentProvider, currentKey] of configured) {
    const key = currentKey as string;
    let result: GeminiResponse;

    switch (currentProvider) {
      case 'openai': result = await streamOpenAI(userMessage, enrichedPrompt, trimmedHistory, key, onChunk, signal, imageBase64, imageMimeType); break;
      case 'claude': result = await streamClaude(userMessage, enrichedPrompt, trimmedHistory, key, onChunk, signal, imageBase64, imageMimeType); break;
      case 'groq':   result = await streamGroq(userMessage, enrichedPrompt, trimmedHistory, key, onChunk, signal); break;
      default:       result = await streamGemini(userMessage, enrichedPrompt, trimmedHistory, key, onChunk, signal, imageBase64, imageMimeType);
    }

    if (result.error === 'aborted') return result;
    // Auth expiry should not trigger failover — propagate immediately so UI can re-prompt login
    if (result.error === 'auth_expired') return { ...result, providerUsed: currentProvider };
    if (!result.error || result.error !== 'quota_exceeded') return { ...result, providerUsed: currentProvider };
    lastResult = result;
  }

  return lastResult ?? { text: '', isSafetyRedirect: false, error: 'provider_fallback_failed' };
}

/** Providers that support sending an image with the message */
const VISION_PROVIDERS = new Set<string>(['gemini', 'openai', 'claude']);

/**
 * Returns the current AI capabilities based on stored settings.
 * Call this on screen mount / focus to drive conditional UI.
 */
export async function getAICapabilities(): Promise<{
  supportsVision: boolean;
  supportsVoice: boolean;   // always true — voice I/O is device-side
  supportsDocuments: boolean; // always true — text embedding works everywhere
  aiMode: string;
  provider: string;
}> {
  const aiMode = (await AsyncStorage.getItem(AI_MODE_KEY)) ?? 'cloud';
  const provider = (await AsyncStorage.getItem(AI_PROVIDER_KEY)) ?? 'gemini';
  return {
    supportsVision: aiMode !== 'local' && VISION_PROVIDERS.has(provider),
    supportsVoice: true,
    supportsDocuments: true,
    aiMode,
    provider,
  };
}
