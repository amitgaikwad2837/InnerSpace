import type { MediaPipeGenerateOptions, MediaPipeMessage } from './MediaPipeLLM.types';
import {
  configureModel as configureModelNative,
  configureModelWithPath as configureModelWithPathNative,
  generate as generateNative,
  getModelPath as getModelPathNative,
  getConfiguredModelId as getConfiguredModelIdNative,
  isAvailable as isAvailableNative,
  isModelReady as isModelReadyNative,
  isNativeModuleLoaded,
  setModelPath as setModelPathNative,
} from './MediaPipeLLMModule';

export type { MediaPipeGenerateOptions, MediaPipeMessage } from './MediaPipeLLM.types';

export function isMediaPipeAvailable(): boolean {
  return isNativeModuleLoaded() && isAvailableNative();
}

export function configureMediaPipeModel(modelId: string): void {
  configureModelNative(modelId);
}

export function configureMediaPipeModelWithPath(modelId: string, modelPath: string): void {
  configureModelWithPathNative(modelId, modelPath);
}

export function setMediaPipeModelPath(modelPath: string): void {
  setModelPathNative(modelPath);
}

export function getMediaPipeModelPath(): string {
  return getModelPathNative();
}

export function isMediaPipeModelReady(): boolean {
  return isModelReadyNative();
}

export function getConfiguredMediaPipeModelId(): string {
  return getConfiguredModelIdNative();
}

export function generateWithMediaPipe(
  messages: MediaPipeMessage[],
  options?: MediaPipeGenerateOptions,
): Promise<string> {
  return generateNative(messages, options);
}
