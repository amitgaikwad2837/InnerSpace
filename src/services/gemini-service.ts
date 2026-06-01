/**
 * Gemini API Service
 * 
 * Direct integration with Gemini API.
 * Handles authentication, API calls, and error handling.
 */

import { checkSafety } from './safety-filter';

interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeminiResponse {
  text: string;
  isSafetyRedirect: boolean;
  safetyCategory?: string;
  error?: string;
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
      safetyCategory: safety.category,
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
        text: 'Your Google session has expired. Please sign out and sign in again to continue.',
        isSafetyRedirect: false,
        error: 'auth_expired',
      };
    }

    if (response.status === 403) {
      return {
        text: 'Gemini is not enabled on your Google account yet. Visit Settings → Enable Gemini to activate it.',
        isSafetyRedirect: false,
        error: 'gemini_not_enabled',
      };
    }

    if (!response.ok) {
      return {
        text: 'Something went wrong. Please try again.',
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
      text: 'Something went wrong. Please check your connection and try again.',
      isSafetyRedirect: false,
      error: `Failed to call Gemini API: ${error}`,
    };
  }
}
