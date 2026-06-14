import { requireNativeModule } from 'expo';

import type { MediaPipeGenerateOptions, MediaPipeMessage } from './MediaPipeLLM.types';

type NativeMediaPipeLLMModule = {
  isAvailable: () => boolean;
  configureModel: (modelId: string, modelPath?: string) => void;
  setModelPath: (modelPath: string) => void;
  getModelPath: () => string;
  isModelReady: () => boolean;
  getConfiguredModelId: () => string;
  generate: (
    messagesJson: string,
    temperature?: number,
    maxTokens?: number,
  ) => Promise<string>;
};

let cachedModule: NativeMediaPipeLLMModule | null | undefined;

function getNativeModule(): NativeMediaPipeLLMModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    cachedModule = requireNativeModule<NativeMediaPipeLLMModule>('MediaPipeLLM');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export function isNativeModuleLoaded(): boolean {
  return getNativeModule() !== null;
}

export function isAvailable(): boolean {
  return getNativeModule()?.isAvailable() ?? false;
}

export function configureModel(modelId: string): void {
  getNativeModule()?.configureModel(modelId);
}

export function configureModelWithPath(modelId: string, modelPath: string): void {
  getNativeModule()?.configureModel(modelId, modelPath);
}

export function setModelPath(modelPath: string): void {
  getNativeModule()?.setModelPath(modelPath);
}

export function getModelPath(): string {
  return getNativeModule()?.getModelPath() ?? '';
}

export function isModelReady(): boolean {
  return getNativeModule()?.isModelReady() ?? false;
}

export function getConfiguredModelId(): string {
  return getNativeModule()?.getConfiguredModelId() ?? '';
}

export async function generate(
  messages: MediaPipeMessage[],
  options?: MediaPipeGenerateOptions,
): Promise<string> {
  const moduleRef = getNativeModule();
  if (!moduleRef) {
    throw new Error('MediaPipeLLM native module is not loaded. Build a development client with native modules.');
  }

  const payload = JSON.stringify(messages);
  return moduleRef.generate(payload, options?.temperature, options?.maxTokens);
}
