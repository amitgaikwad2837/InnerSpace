import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIChatMessage, AIProviderResult } from './ai-provider-adapter';
import {
  configureMediaPipeModelWithPath,
  generateWithMediaPipe,
  getMediaPipeModelPath,
  isMediaPipeAvailable,
  isMediaPipeModelReady,
  setMediaPipeModelPath,
  type MediaPipeMessage,
} from '../../modules/mediapipe-llm';
import {
  DEFAULT_MEDIAPIPE_MODEL_PATH,
  MEDIAPIPE_MODEL_PATH_KEY,
} from '../constants/local-models';

/**
 * React Native (JS) -> Expo local module (Kotlin/Swift) -> MediaPipe runtime.
 */
export async function isMediaPipeGemma2BAvailable(): Promise<boolean> {
  return isMediaPipeAvailable();
}

export async function getMediaPipeGemmaModelPath(): Promise<string> {
  const saved = await AsyncStorage.getItem(MEDIAPIPE_MODEL_PATH_KEY);
  return saved?.trim() || DEFAULT_MEDIAPIPE_MODEL_PATH;
}

export async function setMediaPipeGemmaModelPath(modelPath: string): Promise<void> {
  const normalized = modelPath.trim();
  await AsyncStorage.setItem(MEDIAPIPE_MODEL_PATH_KEY, normalized || DEFAULT_MEDIAPIPE_MODEL_PATH);
}

/**
 * Local provider for Gemma 2B via MediaPipe.
 * Native bridge is live; backend inference linkage can be expanded incrementally.
 */
export async function callMediaPipeGemma2B(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: AIChatMessage[],
): Promise<AIProviderResult> {
  if (!isMediaPipeAvailable()) {
    return {
      text: 'MediaPipe Gemma 2B is not available in this build yet. Use a development build with native modules enabled.',
      isSafetyRedirect: false,
      error: 'mediapipe_unavailable',
    };
  }

  const configuredModelPath = await getMediaPipeGemmaModelPath();
  configureMediaPipeModelWithPath('gemma2b_mediapipe', configuredModelPath);

  if (getMediaPipeModelPath() !== configuredModelPath) {
    setMediaPipeModelPath(configuredModelPath);
  }

  if (!isMediaPipeModelReady()) {
    return {
      text: `MediaPipe model file is not ready at ${configuredModelPath}. Push the model to the device path or update the configured model path in app storage.`,
      isSafetyRedirect: false,
      error: 'mediapipe_model_not_ready',
    };
  }

  const messages: MediaPipeMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    const text = await generateWithMediaPipe(messages, {
      temperature: 0.2,
      maxTokens: 512,
    });
    return {
      text,
      isSafetyRedirect: false,
    };
  } catch (error) {
    return {
      text: 'MediaPipe runtime encountered an error. Please try again or switch local runtime to ExecuTorch.',
      isSafetyRedirect: false,
      error: String(error),
    };
  }
}

export function getMediaPipeGemma2BSetupChecklist(): string[] {
  return [
    'Create Expo local module for Android/iOS MediaPipe bridge.',
    'Expose model load/infer methods through a typed JS API.',
    'Add model download/cache strategy and disk budget checks.',
    'Gate provider availability by runtime capability and model presence.',
    'Integrate provider into callAI local routing after safety checks.',
  ];
}
