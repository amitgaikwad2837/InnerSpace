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
import { AI_MODE_KEY, USER_PROFILE_KEY, AGE_GROUP_PROMPT } from '../constants/local-models';
import { callLocalLLM } from './local-llm-service';
import type { UserProfile } from '../types';

const AI_PROVIDER_KEY = '@innerspace:ai_provider';
const API_KEY_STORE = 'innerspace_api_key';

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

  // Step 2: Build request with system prompt + history
  const messages: GeminiMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    // API keys start with "AIza"; everything else is treated as an OAuth Bearer token
    const isApiKey = accessToken.startsWith('AIza');
    const url = isApiKey
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${accessToken}`
      : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!isApiKey) headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: agentSystemPrompt }] },
        contents: messages.map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })),
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
  if (aiMode === 'local') {
    const localResult = await callLocalLLM(userMessage, enrichedPrompt, conversationHistory);
    return { text: localResult.text, isSafetyRedirect: false, error: localResult.error };
  }

  const [providerRaw, apiKey] = await Promise.all([
    AsyncStorage.getItem(AI_PROVIDER_KEY),
    SecureStore.getItemAsync(API_KEY_STORE),
  ]);

  const provider = (providerRaw as 'gemini' | 'openai' | 'claude' | 'groq') || 'gemini';

  if (!apiKey) {
    return {
      text: 'No AI key configured. Please add your API key in Settings to use AI features.',
      isSafetyRedirect: false,
      error: 'no_key',
    };
  }

  switch (provider) {
    case 'openai':
      return callOpenAI(userMessage, enrichedPrompt, conversationHistory, apiKey);
    case 'claude':
      return callClaude(userMessage, enrichedPrompt, conversationHistory, apiKey);
    case 'groq':
      return callGroq(userMessage, enrichedPrompt, conversationHistory, apiKey);
    default:
      return callGeminiAPI(userMessage, enrichedPrompt, conversationHistory, apiKey);
  }
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1024 }),
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
): Promise<GeminiResponse> {
  const messages = [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: userMessage },
  ];
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1024, system: systemPrompt, messages }),
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
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 1024 }),
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
