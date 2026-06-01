import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  initExecutorch,
  isAvailable,
  LLMModule,
  LLAMA3_2_1B_SPINQUANT,
  QWEN2_5_1_5B_QUANTIZED,
  type ResourceFetcherAdapter,
} from 'react-native-executorch';
import { LOCAL_MODEL_KEY, LOCAL_MODELS, getLocalModelById } from '../constants/local-models';
import type { LocalModel } from '../types';

/** Mirrors GeminiResponse so screens can use a single pattern */
export interface LocalLLMResponse {
  text: string;
  error?: string;
  isLocalModel: true;
}

export interface LocalModelDownloadStatus {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  supported: boolean;
  available: boolean;
  error?: string;
}

let executorchInitialized = false;
let activeModelId: LocalModel | null = null;
let activeModule: LLMModule | null = null;
const downloadProgress = new Map<LocalModel, number>();
const downloadErrors = new Map<LocalModel, string>();
const inFlightDownloads = new Map<LocalModel, Promise<void>>();

function stripFileScheme(path: string): string {
  return path.startsWith('file://') ? path.slice('file://'.length) : path;
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function hashString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getCacheDir(): string {
  const baseDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory;
  return `${baseDir}executorch/`;
}

function getFileNameForRemote(source: string): string {
  const safeName = source.split('?')[0].split('/').filter(Boolean).pop() ?? 'resource.bin';
  return `${hashString(source)}_${safeName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

class ExpoExecutorchFetcher implements ResourceFetcherAdapter {
  private async ensureDir(): Promise<void> {
    const dir = getCacheDir();
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }

  async fetch(
    callback: ((downloadProgress: number) => void) | undefined,
    ...sources: Array<string | number | object>
  ): Promise<{ paths: string[]; wasDownloaded: boolean[] }> {
    await this.ensureDir();

    const paths: string[] = [];
    const wasDownloaded: boolean[] = [];
    const total = Math.max(sources.length, 1);

    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      if (typeof source !== 'string') {
        throw new Error('This app currently supports only string-based ExecuTorch resources.');
      }

      if (!/^https?:\/\//i.test(source)) {
        paths.push(stripFileScheme(source));
        wasDownloaded.push(false);
        callback?.((index + 1) / total);
        continue;
      }

      const targetUri = `${getCacheDir()}${getFileNameForRemote(source)}`;
      const existing = await FileSystem.getInfoAsync(targetUri);
      if (existing.exists) {
        paths.push(stripFileScheme(targetUri));
        wasDownloaded.push(false);
        callback?.((index + 1) / total);
        continue;
      }

      const task = FileSystem.createDownloadResumable(
        source,
        targetUri,
        {},
        (progress) => {
          const fileProgress = progress.totalBytesExpectedToWrite > 0
            ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
            : 0;
          callback?.((index + fileProgress) / total);
        },
      );

      const result = await task.downloadAsync();
      const localUri = result?.uri ?? targetUri;
      paths.push(stripFileScheme(localUri));
      wasDownloaded.push(true);
      callback?.((index + 1) / total);
    }

    return { paths, wasDownloaded };
  }

  async readAsString(path: string): Promise<string> {
    return FileSystem.readAsStringAsync(toFileUri(path));
  }
}

const executorchFetcher = new ExpoExecutorchFetcher();

function ensureExecutorchInitialized(): void {
  if (executorchInitialized) return;
  initExecutorch({ resourceFetcher: executorchFetcher });
  executorchInitialized = true;
}

function getSupportedModelConfig(modelId: LocalModel) {
  switch (modelId) {
    case 'llama321b':
      return LLAMA3_2_1B_SPINQUANT;
    case 'qwen251b':
      return QWEN2_5_1_5B_QUANTIZED;
    default:
      return null;
  }
}

function getModelResourceUris(modelId: LocalModel): string[] {
  const config = getSupportedModelConfig(modelId);
  if (!config) return [];
  return [config.modelSource, config.tokenizerSource, config.tokenizerConfigSource].map(
    (source) => `${getCacheDir()}${getFileNameForRemote(source)}`,
  );
}

async function areModelResourcesDownloaded(modelId: LocalModel): Promise<boolean> {
  const uris = getModelResourceUris(modelId);
  if (!uris.length) return false;
  const fileInfo = await Promise.all(uris.map((uri) => FileSystem.getInfoAsync(uri)));
  return fileInfo.every((info) => info.exists);
}

export async function getLocalModelDownloadStatus(modelId: LocalModel): Promise<LocalModelDownloadStatus> {
  const modelInfo = getLocalModelById(modelId);
  const downloading = inFlightDownloads.has(modelId);
  const downloaded = modelInfo?.supported ? await areModelResourcesDownloaded(modelId) : false;
  const progress = downloaded ? 1 : (downloadProgress.get(modelId) ?? 0);
  return {
    downloaded,
    downloading,
    progress,
    supported: Boolean(modelInfo?.supported),
    available: isAvailable,
    error: downloadErrors.get(modelId),
  };
}

export async function downloadLocalModel(
  modelId: LocalModel,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const existingDownload = inFlightDownloads.get(modelId);
  if (existingDownload) {
    await existingDownload;
    return;
  }

  const modelInfo = getLocalModelById(modelId);
  if (!modelInfo) {
    throw new Error('No local model selected.');
  }
  if (!modelInfo.supported) {
    throw new Error(`${modelInfo.label} is not available in this build yet.`);
  }
  if (!isAvailable) {
    throw new Error('The ExecuTorch runtime is not available on this device or build.');
  }

  const config = getSupportedModelConfig(modelId);
  if (!config) {
    throw new Error('No supported local model is configured.');
  }

  ensureExecutorchInitialized();
  downloadErrors.delete(modelId);

  const promise = executorchFetcher.fetch(
    (progress) => {
      downloadProgress.set(modelId, progress);
      onProgress?.(progress);
    },
    config.modelSource,
    config.tokenizerSource,
    config.tokenizerConfigSource,
  ).then(() => {
    downloadProgress.set(modelId, 1);
    onProgress?.(1);
  }).catch((error: unknown) => {
    const message = String((error as { message?: string })?.message ?? error);
    downloadErrors.set(modelId, message);
    downloadProgress.set(modelId, 0);
    throw error;
  }).finally(() => {
    inFlightDownloads.delete(modelId);
  });

  inFlightDownloads.set(modelId, promise);
  await promise;
}

async function getOrLoadModule(modelId: LocalModel): Promise<LLMModule | null> {
  const config = getSupportedModelConfig(modelId);
  if (!config) return null;

  ensureExecutorchInitialized();

  if (activeModule && activeModelId === modelId) {
    return activeModule;
  }

  if (activeModule) {
    activeModule.delete();
    activeModule = null;
    activeModelId = null;
  }

  const moduleInstance = await LLMModule.fromModelName(config);
  activeModule = moduleInstance;
  activeModelId = modelId;
  return moduleInstance;
}

/**
 * Call the on-device LLM.
 * Falls back gracefully when react-native-executorch is not yet installed.
 */
export async function callLocalLLM(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<LocalLLMResponse> {
  try {
    const modelIdRaw = await AsyncStorage.getItem(LOCAL_MODEL_KEY);
    const modelId = (modelIdRaw as LocalModel | null) ?? 'llama321b';
    const modelInfo = getLocalModelById(modelId);

    if (!modelInfo) {
      return { text: 'No local model selected.', error: 'no_model', isLocalModel: true };
    }

    if (!modelInfo.supported) {
      return {
        text: `${modelInfo.label} is not available in this build yet. Please choose Llama 3.2 1B or Qwen 2.5 1.5B in Settings for local AI.`,
        error: 'unsupported_model',
        isLocalModel: true,
      };
    }

    if (!isAvailable) {
      return {
        text: 'The ExecuTorch runtime is not available on this device or build. Please switch to a cloud AI provider in Settings.',
        error: 'executorch_unavailable',
        isLocalModel: true,
      };
    }

    const isDownloaded = await areModelResourcesDownloaded(modelId);
    if (!isDownloaded) {
      return {
        text: `The selected local model is not downloaded yet. Please download ${modelInfo.label} from onboarding or Settings before starting a local chat.`,
        error: 'model_not_downloaded',
        isLocalModel: true,
      };
    }

    const llm = await getOrLoadModule(modelId);
    if (!llm) {
      return {
        text: 'No supported local model is configured. Please choose a supported local model in Settings.',
        error: 'unsupported_model',
        isLocalModel: true,
      };
    }

    const response = await llm.generate([
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ]);
    return { text: response, isLocalModel: true };
  } catch (err: any) {
    return {
      text: 'Local model encountered an error. Please try again or switch to a cloud provider in Settings.',
      error: String(err?.message ?? err),
      isLocalModel: true,
    };
  }
}

/** Check if a local model has been downloaded and is ready */
export async function isLocalModelReady(): Promise<boolean> {
  try {
    const modelId = await AsyncStorage.getItem(LOCAL_MODEL_KEY);
    const selectedModel = LOCAL_MODELS.find((item) => item.id === modelId);
    if (!selectedModel?.supported || !isAvailable) {
      return false;
    }
    return areModelResourcesDownloaded(selectedModel.id);
  } catch {
    return false;
  }
}
