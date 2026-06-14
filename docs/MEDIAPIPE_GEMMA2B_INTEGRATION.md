# MediaPipe + Gemma 2B Integration Plan

## Goal
Add a local AI provider based on MediaPipe LLM and Gemma 2B while preserving the existing app behavior and safety guarantees.

## Current Status
- Multi-cloud failover exists (Gemini -> OpenAI -> Claude -> Groq when quota is exhausted).
- Local AI currently uses ExecuTorch (`src/services/local-llm-service.ts`).
- MediaPipe Gemma 2B now has an implemented native module scaffold under `modules/mediapipe-llm` and is callable from JS.
- Current native `generate` methods return a bridge-readiness response; backend model inference wiring is the remaining step.

## Integration Boundaries
- JS routing layer: `src/services/gemini-service.ts` (`callAI`).
- Provider contract: `src/services/ai-provider-adapter.ts`.
- Native bridge entrypoint (to be added): `modules/mediapipe-llm/` (Expo local module).
- Local provider implementation: `src/services/local-mediapipe-service.ts`.

## Proposed Runtime Flow
1. Keep pre-send safety filtering in JS.
2. Resolve AI mode (`local` or `cloud`).
3. In local mode, route by selected local model runtime:
   - ExecuTorch models -> `callLocalLLM`
   - MediaPipe Gemma 2B -> `callMediaPipeGemma2B`
4. Keep post-response safety validation in JS.
5. Reuse existing conversation persistence and XP/streak logic unchanged.

## Native Module Scope
- Android: Kotlin wrapper around MediaPipe LLM inference APIs.
- iOS: Swift wrapper around MediaPipe LLM inference APIs.
- JS API surface should expose:
  - `isAvailable()`
  - `configureModel(modelId)`
  - `getConfiguredModelId()`
  - `generate(messages, config)`

## Implemented Files
- `modules/mediapipe-llm/expo-module.config.json`
- `modules/mediapipe-llm/android/src/main/java/expo/modules/mediapipellm/MediaPipeLLMModule.kt`
- `modules/mediapipe-llm/ios/MediaPipeLLMModule.swift`
- `modules/mediapipe-llm/src/MediaPipeLLMModule.ts`
- `modules/mediapipe-llm/src/index.ts`
- `src/services/local-mediapipe-service.ts`

## Expo Considerations (SDK 56)
- Requires development builds/custom native code path.
- Not available in Expo Go.
- Prefer config plugin + local Expo module for reproducible native setup.

## Safety Requirements
- Keep `src/services/safety-filter.ts` as the source of truth.
- Do not bypass local safety checks for MediaPipe responses.
- Keep refusal messaging aligned with existing UX tone.

## Acceptance Criteria
- App compiles with MediaPipe provider disabled by default.
- Local mode can select MediaPipe Gemma 2B only when runtime capability is present.
- Fallback behavior remains intact for cloud mode.
- No regression in chat/history/journal flows.
