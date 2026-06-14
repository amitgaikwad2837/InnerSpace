# MediaPipe Gemma 2B Integration — Implementation Test Guide

## Overview
InnerSpace now supports **local AI inference** via Google MediaPipe + Gemma 2B, alongside the existing cloud providers (Gemini, OpenAI, Claude, Groq). The implementation includes:

- **Native Module:** Expo local module at `modules/mediapipe-llm` with Android (Kotlin) + iOS (Swift) bridges
- **Service Layer:** `src/services/local-mediapipe-service.ts` wires the native API to the app
- **UI Integration:** Settings and SetupFlow now allow users to select MediaPipe as the local runtime
- **Failover:** Cloud providers automatically fall back to next provider if quota is exceeded
- **Per-Provider Keys:** Each cloud provider can have independent API keys

## Architecture

### File Structure
```
modules/mediapipe-llm/
  ├─ expo-module.config.json           (declares module for both platforms)
  ├─ index.ts                          (root export)
  ├─ mediapipe_llm.podspec             (iOS pod specification)
  ├─ android/
  │  └─ src/main/java/expo/modules/mediapipellm/
  │     └─ MediaPipeLLMModule.kt        (Android native bridge)
  ├─ ios/
  │  ├─ MediaPipeLLMModule.swift        (iOS native bridge)
  │  └─ mediapipe_llm.podspec           (iOS-specific pod config)
  └─ src/
     ├─ index.ts                       (public API wrappers)
     ├─ MediaPipeLLMModule.ts          (native module loader)
     └─ MediaPipeLLM.types.ts          (TypeScript types)

src/services/
  ├─ local-mediapipe-service.ts        (service layer integration)
  ├─ gemini-service.ts                 (main AI router; includes MediaPipe routing)
  └─ local-llm-service.ts              (ExecuTorch fallback)

src/screens/
  ├─ SettingsScreen.tsx                (MediaPipe runtime selector + model path config)
  └─ SetupFlowScreen.tsx               (onboarding: select runtime, verify model)

src/constants/
  └─ local-models.ts                   (LOCAL_RUNTIME_KEY, MEDIAPIPE_MODEL_PATH_KEY, etc.)

android/app/build.gradle
  └─ dependency: com.google.mediapipe:tasks-genai:0.10.27
```

### Data Flow
```
User Message
  ↓
ChatScreen → callAI()
  ↓
gemini-service.callAI()
  ↓
[Determine AI Mode]
  ├─ Cloud Mode → Try providers in order (Gemini → OpenAI → Claude → Groq)
  │  └─ If quota_exceeded → fallback to next provider
  │
  └─ Local Mode → Check LOCAL_RUNTIME_KEY
     ├─ "executorch" → callLocalLLM() → ExecuTorch inference
     └─ "mediapipe" → callMediaPipeGemma2B()
        └─ native MediaPipeLLM module → LlmInference.generateResponse()
           ↓
           Response
```

## Setup & Testing

### 1. Android Testing

#### Prerequisites
- Device or emulator with **Android 7.0+** (API 24+)
- Model file: `gemma2b.task` (approx. 2.5 GB — download from [MediaPipe Models](https://developers.google.com/mediapipe/solutions/generative_ai/llm_inference/web#models))

#### Steps

**1.1 Build the dev app**
```bash
# Create expo development build for Android
expo build --android --dev-client
# Or use local CLI:
eas build --platform android --profile=development
```

**1.2 Push model to device**
```bash
# Create directory
adb shell mkdir -p /data/local/tmp/llm

# Copy model file (from downloaded gemma2b.task)
adb push gemma2b.task /data/local/tmp/llm/

# Verify
adb shell ls -lh /data/local/tmp/llm/gemma2b.task
```

**1.3 Test in the app**
1. Open app → Settings → "AI Mode"
2. Select "On-Device" mode
3. Tap "Local Runtime" and choose "MediaPipe (Gemma 2B)"
4. Verify status shows "✓ MediaPipe available"
5. Go to Chat → start conversation
6. Response should come from local MediaPipe inference (no internet required)
7. Check logcat for native inference logs: `adb logcat | grep MediaPipeLLM`

#### Expected Behavior
- **First message:** Slight delay (100-500ms) as model loads into memory
- **Subsequent messages:** Faster responses as model stays cached in `llmInference`
- **Temperature & max tokens:** Configurable (default: temp=0.2, maxTokens=512)
- **Fallback:** If model file missing, error message shows path expected

#### Debugging
```bash
# View Kotlin module logs
adb logcat | grep -i "MediaPipeLLM\|LlmInference\|GenerativeAI"

# Check file existence
adb shell test -f /data/local/tmp/llm/gemma2b.task && echo "Found" || echo "Not found"

# Validate model format
adb shell file /data/local/tmp/llm/gemma2b.task
```

---

### 2. iOS Testing

#### Prerequisites
- macOS with Xcode 15+
- Device or simulator with **iOS 14.4+**
- CocoaPods 1.11+ (for MediaPipe pod resolution)
- Model file: `gemma2b.task`

#### Steps

**2.1 Install MediaPipe pods**
```bash
# After cloning, ensure pods are available
cd ios
pod install --repo-update

# Expected pods:
# - MediaPipeTasksGenAI (v0.10.0+)
# - MediaPipeTasksGenAIC (v0.10.0+)
```

**2.2 Prebuild the app**
```bash
# Generate native project with Expo autolinking
expo prebuild --clean --platform ios

# This will:
# 1. Auto-link mediapipe-llm module
# 2. Install iOS pods (including MediaPipeTasksGenai)
# 3. Generate Xcode project
```

**2.3 Copy model to device**
```bash
# For device testing, push via Xcode (File → Add Files to...)
# Or use libimobiledevice:
idevice_app_push <app-bundle-id> gemma2b.task /Documents/

# For simulator, copy directly to app sandbox:
# /Users/<user>/Library/Developer/CoreSimulator/Devices/<device-id>/data/Containers/Data/Application/<app-uuid>/Documents/gemma2b.task
```

**2.4 Update SettingsScreen model path**
In SettingsScreen.tsx or Settings UI, set model path to:
- Device: `/var/mobile/Containers/Data/Application/<uuid>/Documents/gemma2b.task`
- Simulator: `/Users/.../CoreSimulator/.../Documents/gemma2b.task`

**2.5 Test in the app**
1. Open app → Settings → "AI Mode"
2. Select "On-Device" mode
3. Tap "Local Runtime" and choose "MediaPipe (Gemma 2B)"
4. Verify "MediaPipe available" status
5. Go to Chat and test inference

#### Expected Behavior
- Same as Android (first message slower, subsequent fast)
- Model loads into shared LlmInference instance
- Responses are deterministic (same seed=101 as Android)

#### Debugging
```bash
# View iOS logs (in Xcode console or via CLI)
log stream --device --predicate 'process contains "MediaPipe"'

# Check module availability
# In Swift REPL or app logs, `MediaPipeLLMModule.isAvailable()` should return true if pods installed
```

---

### 3. Cloud Provider Failover Testing

**3.1 Multi-Provider Setup**
1. Settings → "AI Mode" → "Cloud"
2. Save API keys for 2+ providers:
   - e.g., Gemini + OpenAI
3. Set primary to Gemini

**3.2 Trigger Quota Failover**
1. Send many messages to exhaust Gemini quota
2. Next message should:
   - Try Gemini → receive `quota_exceeded` error
   - **Automatically** try OpenAI
   - Return response from OpenAI
3. App should show no error to user (transparent failover)

**Expected Log Output**
```
[callAI] Trying provider: gemini
[callAI] Gemini returned: quota_exceeded
[callAI] Failover to provider: openai
[callAI] OpenAI response: "Hello! How can I help..."
```

---

### 4. Integration Test Checklist

- [ ] **Local Runtime Selection**
  - [ ] Settings shows "MediaPipe (Gemma 2B)" as option
  - [ ] Setup flow allows selecting MediaPipe
  - [ ] Selection persists to AsyncStorage (`@innerspace:local_runtime`)

- [ ] **Model Path**
  - [ ] Default path is `/data/local/tmp/llm/gemma2b.task` (Android) or Documents (iOS)
  - [ ] Model path can be configured in Settings
  - [ ] App validates file exists before attempting generation

- [ ] **Native Module**
  - [ ] `MediaPipeLLMModule.isAvailable()` returns true on device
  - [ ] `setModelPath()` updates model path
  - [ ] `generate()` returns string response
  - [ ] Multiple concurrent generations handled gracefully

- [ ] **Service Layer**
  - [ ] `callMediaPipeGemma2B()` in local-mediapipe-service works end-to-end
  - [ ] Temperature and maxTokens are passed to native module
  - [ ] Errors are caught and friendly messages shown to user

- [ ] **UI/UX**
  - [ ] Local mode shows MediaPipe as option (not default if unavailable)
  - [ ] Chat works in local mode (no internet required)
  - [ ] Settings show MediaPipe status (✓ available or ✗ not available)
  - [ ] Model file is ready indicator matches actual file presence

- [ ] **Failover**
  - [ ] Cloud providers cycle through on quota exhaustion
  - [ ] Per-provider keys are stored/retrieved correctly
  - [ ] Legacy single API key still works for backward compatibility

---

## Known Limitations & TODOs

### Android
- [ ] Model file must be manually pushed via adb; no in-app download yet
- [ ] No background inference (main thread only)
- [ ] Memory constraints on older devices (tested on API 28+)

### iOS
- [ ] Requires successful `pod install` of MediaPipeTasksGenAI (v0.10+)
- [ ] Model path setup is manual (no UI picker yet for document selection)
- [ ] Simulator support depends on arm64 architecture

### General
- [ ] No custom model support yet (hardcoded to Gemma 2B)
- [ ] No quantization options (full fp32 model required)
- [ ] No streaming inference (full response buffered)

---

## Rollback Plan

If MediaPipe integration causes issues:

1. **Disable Runtime Selection**
   - Comment out `LOCAL_RUNTIME_KEY` check in `src/services/gemini-service.ts`
   - Set `DEFAULT_LOCAL_RUNTIME` to `'executorch'` only
   - Users will default to ExecuTorch if in local mode

2. **Disable Native Module**
   - Comment out MediaPipe service layer calls
   - Remove `mediapipe-llm` from `modules/` directory
   - Rebuild app

3. **Remove Dependencies**
   - Android: Remove `com.google.mediapipe:tasks-genai` from `android/app/build.gradle`
   - iOS: Remove MediaPipe pod from `Podfile` (if manually specified)
   - Expo autolinking will clean up on next prebuild

---

## References

- [MediaPipe LLM Inference Guide](https://ai.google.dev/edge/mediapipe/solutions/generative_ai/llm_inference)
- [MediaPipe Gemma 2B Model](https://developers.google.com/mediapipe/solutions/generative_ai/llm_inference/web#models)
- [Expo Modules Documentation](https://docs.expo.dev/modules/)
- [InnerSpace ARCHITECTURE.md](../ARCHITECTURE.md)
