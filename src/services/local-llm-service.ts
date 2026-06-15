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
  bytesWritten: number;
  supported: boolean;
  available: boolean;
  error?: string;
}

// AsyncStorage key prefix used to clear any resume data left by older builds
const DOWNLOAD_RESUME_PREFIX = '@innerspace:dl_resume:';

let executorchInitialized = false;
let activeModelId: LocalModel | null = null;
let activeModule: LLMModule | null = null;
const downloadProgress = new Map<LocalModel, number>();
const downloadBytesWritten = new Map<LocalModel, number>();
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
  cumulativeBytesWritten = 0;
  private _completedFilesBytes = 0;
  private currentTask: FileSystem.DownloadResumable | null = null;

  async pauseCurrentTask(): Promise<void> {
    if (this.currentTask) {
      try { await this.currentTask.pauseAsync(); } catch {}
      this.currentTask = null;
    }
  }

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

    this.cumulativeBytesWritten = 0;
    this._completedFilesBytes = 0;

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
      const destPath = stripFileScheme(targetUri);
      const existing = await FileSystem.getInfoAsync(targetUri);
      if (existing.exists && !existing.isDirectory) {
        this._completedFilesBytes += (existing as any).size ?? 0;
        paths.push(destPath);
        wasDownloaded.push(false);
        callback?.((index + 1) / total);
        continue;
      }

      const completedAtStart = this._completedFilesBytes;

      const task = FileSystem.createDownloadResumable(
        source,
        targetUri,
        {},
        (progress) => {
          this.cumulativeBytesWritten = completedAtStart + progress.totalBytesWritten;
          const fileProgress = progress.totalBytesExpectedToWrite > 0
            ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
            : 0;
          callback?.((index + fileProgress) / total);
        },
      );

      this.currentTask = task;
      try {
        await task.downloadAsync();
      } finally {
        this.currentTask = null;
      }

      const doneInfo = await FileSystem.getInfoAsync(targetUri);
      this._completedFilesBytes += (doneInfo as any).size ?? 0;
      this.cumulativeBytesWritten = this._completedFilesBytes;
      paths.push(destPath);
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

function getModelResumeKeys(modelId: LocalModel): string[] {
  const config = getSupportedModelConfig(modelId);
  if (!config) return [];
  return [config.modelSource, config.tokenizerSource, config.tokenizerConfigSource].map(
    (s) => `${DOWNLOAD_RESUME_PREFIX}innerspace_model_${getFileNameForRemote(s)}`,
  );
}

async function isModelDownloadingInBackground(modelId: LocalModel): Promise<boolean> {
  return inFlightDownloads.has(modelId);
}

async function areModelResourcesDownloaded(modelId: LocalModel): Promise<boolean> {
  const uris = getModelResourceUris(modelId);
  if (!uris.length) return false;
  const fileInfo = await Promise.all(uris.map((uri) => FileSystem.getInfoAsync(uri)));
  return fileInfo.every((info) => info.exists && !info.isDirectory && ((info as any).size ?? 0) > 0);
}

export async function getLocalModelDownloadStatus(modelId: LocalModel): Promise<LocalModelDownloadStatus> {
  const modelInfo = getLocalModelById(modelId);
  const downloading = await isModelDownloadingInBackground(modelId);
  const downloaded = modelInfo?.supported ? await areModelResourcesDownloaded(modelId) : false;
  const progress = downloaded ? 1 : (downloadProgress.get(modelId) ?? 0);
  return {
    downloaded,
    downloading,
    progress,
    bytesWritten: downloadBytesWritten.get(modelId) ?? 0,
    supported: Boolean(modelInfo?.supported),
    available: isAvailable,
    error: downloadErrors.get(modelId),
  };
}

export async function cancelModelDownload(modelId: LocalModel): Promise<void> {
  await executorchFetcher.pauseCurrentTask();
  inFlightDownloads.delete(modelId);
  downloadProgress.delete(modelId);
  downloadBytesWritten.delete(modelId);
  downloadErrors.delete(modelId);
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
  if (!modelInfo) throw new Error('No offline helper selected.');
  if (!modelInfo.supported) throw new Error(`${modelInfo.label} is not available in this build yet.`);
  if (!isAvailable) throw new Error('The ExecuTorch runtime is not available on this device or build.');

  const config = getSupportedModelConfig(modelId);
  if (!config) throw new Error('No offline helper configured.');

  ensureExecutorchInitialized();
  downloadErrors.delete(modelId);

  // Always start fresh: clear stale resume data and delete any existing model files.
  const resumeKeys = getModelResumeKeys(modelId);
  await Promise.all(resumeKeys.map((k) => AsyncStorage.removeItem(k)));
  const uris = getModelResourceUris(modelId);
  await Promise.all(uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));

  const expectedTotalBytes = (modelInfo.sizeGB ?? 0) * 1e9;

  const promise = executorchFetcher.fetch(
    (rawProgress) => {
      const bytes = executorchFetcher.cumulativeBytesWritten;
      downloadBytesWritten.set(modelId, bytes);
      const bytesProgress = expectedTotalBytes > 0 ? Math.min(bytes / expectedTotalBytes, 0.99) : 0;
      const progress = Math.max(rawProgress, bytesProgress);
      downloadProgress.set(modelId, progress);
      onProgress?.(progress);
    },
    config.modelSource,
    config.tokenizerSource,
    config.tokenizerConfigSource,
  ).then(() => {
    const actual = executorchFetcher.cumulativeBytesWritten;
    // Validate file size: must be at least 80% of expected to catch truncated downloads
    if (expectedTotalBytes > 0 && actual < expectedTotalBytes * 0.8) {
      throw new Error(
        `model_size_mismatch: expected ~${(expectedTotalBytes / 1e9).toFixed(1)} GB but only received ${(actual / 1e9).toFixed(2)} GB — the download may be incomplete`,
      );
    }
    downloadBytesWritten.set(modelId, actual);
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

  if (activeModule && activeModelId === modelId) return activeModule;

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
      return { text: 'No offline helper selected.', error: 'no_model', isLocalModel: true };
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
      if (await isModelDownloadingInBackground(modelId)) {
        return {
          text: 'Your offline AI assistant is still downloading. Please try again in a few minutes.',
          error: 'model_downloading',
          isLocalModel: true,
        };
      }
      return {
        text: `Your offline helper isn't set up yet. Please set it up from onboarding or Settings before going offline.`,
        error: 'model_not_downloaded',
        isLocalModel: true,
      };
    }

    const llm = await getOrLoadModule(modelId);
    if (!llm) {
      return {
        text: 'No offline helper is configured. Please choose a supported model in Settings.',
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
    const msg = String(err?.message ?? err);
    if (msg.includes('Failed to load model') || msg.includes('file_size_') || msg.includes('offset')) {
      const modelIdRaw = await AsyncStorage.getItem(LOCAL_MODEL_KEY);
      const mid = (modelIdRaw as LocalModel | null) ?? 'llama321b';
      const uris = getModelResourceUris(mid);
      await Promise.all([
        ...getModelResumeKeys(mid).map((k) => AsyncStorage.removeItem(k)),
        ...uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })),
      ]);
      return {
        text: 'The model file appears to be incomplete. Please re-download it from Settings → Local AI.',
        error: 'model_not_downloaded',
        isLocalModel: true,
      };
    }
    return {
      text: 'Your offline helper encountered an error. Please try again or switch to a cloud provider in Settings.',
      error: 'local_model_error',
      isLocalModel: true,
    };
  }
}

/** Check if a local model has been downloaded and is ready */
export async function isLocalModelReady(): Promise<boolean> {
  try {
    const modelId = await AsyncStorage.getItem(LOCAL_MODEL_KEY);
    const selectedModel = LOCAL_MODELS.find((item) => item.id === modelId);
    if (!selectedModel?.supported || !isAvailable) return false;
    return areModelResourcesDownloaded(selectedModel.id);
  } catch {
    return false;
  }
}
