# InnerSpace — Architecture & Design

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    InnerSpace Mobile App                    │
│                   (React Native + Expo)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            UI Layer (Screens & Components)           │   │
│  │  HomeScreen | ChatScreen | JournalScreen | etc.     │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │           State Management (Zustand)                 │   │
│  │  • Auth Store (user, session)                         │   │
│  │  • Theme Context (dark/light/system)                 │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │    Business Logic Layer (Services)                    │   │
│  │  • gemini-service (AI calls)                          │   │
│  │  • storage-service (user data)                        │   │
│  │  • safety-filter (content moderation)                 │   │
│  │  • app-lock (PIN/biometric)                           │   │
│  │  • backup-service (export/import)                     │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │          Data Storage Layer (Local Only)              │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │  AsyncStorage (JSON, plaintext or encrypted)   │ │   │
│  │  │  • Conversations, habits, journal, decisions   │ │   │
│  │  │  • Theme, language, preferences                │ │   │
│  │  │  • Custom helpers                              │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │  SecureStore (Hardware-backed encryption)      │ │   │
│  │  │  • API keys (Gemini, OpenAI, Claude, Groq)    │ │   │
│  │  │  • App PIN hash                                │ │   │
│  │  │  • Encryption master key                       │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         External AI Providers (Optional)             │   │
│  │  • Google Gemini API                                  │   │
│  │  • OpenAI API                                         │   │
│  │  • Anthropic Claude API                               │   │
│  │  • Groq API                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Local AI Models (Optional)                   │   │
│  │  • Gemma (Google)                                     │   │
│  │  • Phi (Microsoft)                                    │   │
│  │  • Llama (Meta)                                       │   │
│  │  (via react-native-executorch)                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      External Services (Zero Server Backend)         │   │
│  │  • GitHub (helpers catalog: .github/agents.json)     │   │
│  │  • GitHub Pages (marketing website)                  │   │
│  │  • No backend infrastructure                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Architecture Decisions

### 1. Local-First Storage
- **Why:** Privacy is non-negotiable. No server = no breach surface
- **Implementation:** AsyncStorage + expo-secure-store
- **Tradeoff:** No cloud sync; users cannot access data from multiple devices

### 2. Client-Side Safety Filter
- **Why:** AI moderation happens before leaving the device
- **Implementation:** Dual-layer filter (pre-send + post-response)
- **Location:** `src/services/safety-filter.ts`
- **Tradeoff:** Larger bundle size; no server-side remote updates to rules

### 3. Multi-Provider AI Architecture
- **Why:** No vendor lock-in; user controls which AI provider to use
- **Implementation:** Provider adapters + quota failover for cloud providers; local runtime abstraction for ExecuTorch and planned MediaPipe. All four cloud providers (Gemini, OpenAI, Claude, Groq) are implemented and selectable in Settings.
- **Location:** `src/services/gemini-service.ts`, `src/services/ai-provider-adapter.ts`, `src/services/local-mediapipe-service.ts`
- **Tradeoff:** More code paths to test; user must manage API keys

### 3.1 MediaPipe Gemma 2B Path (Scaffolded)
- **Status:** Planned / scaffolded (not active in runtime yet)
- **Goal:** Run Gemma 2B fully on-device through a native MediaPipe bridge
- **Boundary:** JS routing in services, native inference in a local Expo module (`modules/mediapipe-llm/`)
- **Reference:** `docs/MEDIAPIPE_GEMMA2B_INTEGRATION.md`

### 4. Encryption by Default
- **Why:** Sensitive data (journal, habits) is explicitly encrypted
- **Implementation:** AES-256-GCM via Web Crypto API; key in SecureStore
- **Location:** `src/services/storage-encryption.ts`
- **Tradeoff:** Performance overhead (~100ms per encrypt/decrypt); graceful fallback to plaintext if crypto unavailable

### 5. Catalog-Driven Helpers Marketplace
- **Why:** Add/update helpers without requiring an app rebuild
- **Implementation:** `.github/agents.json` (repo-hosted JSON); cached with 24-hour TTL
- **Location:** `src/services/agents-catalog.ts`
- **Tradeoff:** ~100KB network request; fallback to bundled helpers if fetch fails

### 6. Guest-First Access
- **Why:** No friction to start using the app
- **Implementation:** Optional sign-in; all local data persists even without account
- **Location:** `src/store/auth.ts`
- **Tradeoff:** No cloud backup; no multi-device sync

---

## Component Hierarchy

```
App.tsx (Root)
├── NavigationContainer (React Navigation)
│   └── RootStack.Navigator
│       ├── SetupFlow (if onboarding_done === false)
│       │   └── SetupFlowScreen (legal, AI setup, language, tone, helpers)
│       ├── Main (Bottom Tab Navigator)
│       │   ├── Home → HomeScreen
│       │   ├── Helpers → AgentsScreen
│       │   ├── Journal → JournalScreen
│       │   ├── Habits → HabitsScreen
│       │   ├── History → HistoryScreen
│       │   └── Settings → SettingsScreen
│       ├── Chat (Modal Stack) → ChatScreen
│       ├── Decision (Modal Stack) → DecisionScreen
│       ├── Goals (Stack) → GoalsScreen (navigated from HabitsScreen header)
│       └── CreateAgent (Modal) → CreateAgentScreen
│
└── AppLock (if lockEnabled === true)
    ├── PIN Input Screen
    └── Biometric Prompt

App also handles:
├── Deep link imports (innerspace://import-agent)
├── AppState listeners (app lock on background)
├── i18n initialization (language selection)
├── RTL layout (Arabic, Hebrew)
└── Notifications (weekly digest)
```

---

## Data Flow Diagrams

### Chat Conversation Flow

```
User types message in ChatScreen
    ↓
Message submitted
    ↓
Safety Filter (pre-send)
    ├─ Matches blocked category? → Show redirect message, stop
    └─ Safe? → Continue
    ↓
Save message locally (AsyncStorage)
    ↓
Send to AI provider (or local model)
    ├─ Gemini API? → Call with API key from SecureStore
    ├─ OpenAI API? → Call with API key from SecureStore
    ├─ Claude API? → Call with API key from SecureStore
    ├─ Groq API? → Call with API key from SecureStore
    └─ Local model? → Call react-native-executorch
    ↓
AI response received
    ↓
Safety Filter (post-response)
    ├─ Invalid response? → Show generic fallback, discard
    └─ Valid? → Continue
    ↓
Save AI response locally (AsyncStorage, encrypted)
    ↓
Show response in ChatScreen
    ↓
Auto-generate summary if 3+ replies (separate async task)
    ↓
Update conversation history UI
```

### Habit Completion Flow

```
User taps "Complete" on a habit in HabitsScreen
    ↓
Verify habit exists & not yet completed today
    ↓
Increment streak counter
    ↓
Award +8 XP
    ↓
Save updated habit (AsyncStorage, encrypted)
    ↓
Show completion animation
    ↓
Schedule AI check-in (optional, background)
```

### Journal Entry Flow

```
User writes journal entry in JournalScreen
    ↓
Select mood (5 emoji scale)
    ↓
AI generates insight (optional, optional network call)
    ↓
Encrypt entry with AES-256-GCM
    ↓
Save to AsyncStorage (encrypted)
    ↓
Award +5 XP for check-in (once per day)
    ↓
Add to journal history
    ↓
(Sunday 09:00) Generate weekly digest summary
    ↓
Schedule local notification
```

### Voice Input Flow (ChatScreen / JournalScreen)

```
User taps microphone icon
    ↓
@react-native-voice/voice: Voice.start(locale)
    ├─ Android 11+: requires com.google.android.googlequicksearchbox visible
    │  (declared in AndroidManifest.xml <queries> block)
    └─ Error? → Alert with link to Play Store speech recognition search
    ↓
Voice.onSpeechPartialResults → show interim transcript in input field
    ↓
Voice.onSpeechResults → finalise transcript
    ↓
(ChatScreen only) Text injected into message input; user can edit before sending
```

### Deep Link Import (Custom Helper) Flow

```
User receives link: innerspace://import-agent?data=<base64>
    ↓
Linking.addEventListener catches URL
    ↓
Decode base64 → JSON
    ↓
Validate schema (name, expertise, etc.)
    ↓
Payload size > 65KB? → Reject (DoS prevention)
    ↓
Name < 2 chars OR expertise < 20 chars? → Reject (validation)
    ↓
Fetch existing custom agents from AsyncStorage
    ↓
Append new agent to list
    ↓
Save updated list (AsyncStorage)
    ↓
Show success toast: "Helper imported!"
    ↓
(Optional) Navigate to Chat with new helper selected
```

---

## State Management Architecture

### Global State (Zustand)

**`src/store/auth.ts`** — User authentication
```typescript
interface AuthStore {
  userId: string | null;
  email: string | null;
  setUser(userId: string, email: string): void;
  clearUser(): void;
}
```

**`src/context/ThemeContext.tsx`** — UI theme (dark/light/system)
```typescript
interface ThemeContextType {
  isDark: boolean;
  colors: Record<string, string>;
  toggleTheme(): void;
  setSystemTheme(): void;
}
```

### Local Component State

- Conversation messages: local to ChatScreen
- Habit list: local to HabitsScreen
- Journal entries: local to JournalScreen
- Form inputs: local to screen components

### Persistent Storage

- User profile (name, age group, language, tone)
- Conversations (conversation history, reactions)
- Habits (habit definition, streaks, XP)
- Journal entries (date, mood, content, AI insight)
- Decisions (options, analysis, clarity score)
- Custom helpers (helper definitions)
- Theme preference (dark/light/system)
- App lock (PIN hash, mode, enabled flag)

---

## Encryption Strategy

### AES-256-GCM Implementation

**Location:** `src/services/storage-encryption.ts`

```typescript
// Encrypt sensitive data
await encryptData(journalEntry)
→ Generate random 12-byte IV
→ Encrypt with AES-256-GCM
→ Return base64(IV + ciphertext)

// Decrypt sensitive data
await decryptData(ciphertext)
→ Extract IV (first 12 bytes)
→ Decrypt with AES-256-GCM
→ Return plaintext
```

**Master Key:**
- Generated once on first app launch
- Stored in SecureStore (hardware-backed if available)
- Cached in memory (_cachedKey) for performance
- Fallback to plaintext gracefully if crypto unavailable

**Encrypted Data:**
- Conversations (if enabled by user)
- Habit entries
- Journal entries + moods
- Decisions
- Custom helper expertise descriptions

**Non-Encrypted (by design):**
- Theme, language, tone (non-sensitive preferences)
- Habit names, journal prompts (metadata)
- Custom helper names, emojis (metadata)

---

## AI Service Architecture

### Multi-Provider Abstraction

```
ChatScreen calls: callAI(userMessage, agentPrompt, history)
    ↓
gemini-service.ts:
├── Read AI_PROVIDER_KEY from AsyncStorage
│   ├─ 'gemini' → callGeminiAPI()
│   ├─ 'openai' → callOpenAI()
│   ├─ 'claude' → callClaude()
│   ├─ 'groq'   → callGroq()
│   └─ 'local'  → callLocalLLM() (react-native-executorch)
├── Fetch API key from SecureStore
├── Enrich system prompt with user age/name context
├── Send request with conversation history
├── Parse response
├── Detect quota/rate limit errors → return cooldownUntil
├── Run post-response safety filter
└── Return GeminiResponse object
```

### Quota & Cooldown Handling

When API returns 429 (rate limit):
1. Extract `retry-after` header
2. Calculate cooldown end time
3. Store in AsyncStorage
4. Show user-friendly message: "Helper will be back at 2:30 PM"
5. Schedule local notification for when cooldown expires

---

## Safety Filter Architecture

**Location:** `src/services/safety-filter.ts`

### 7 Hard Rules (No Exceptions)

| Rule | Keywords | Redirect |
|------|----------|----------|
| Crisis & Self-Harm | suicide, self-harm, cutting, overdose | 988 / 116 123 / 741741 |
| Medical | diagnose, symptoms, medication, dosage | "See a doctor" |
| Legal | lawsuit, contract, custody, attorney | "See a solicitor" |
| Financial | stocks, mortgage, crypto, invest | "See a financial adviser" |
| Abuse & Safeguarding | domestic abuse, violence, child hurt | Crisis resources |
| Illegal | drug dealing, theft, fraud | "I can't help" |
| Deception | hidden requests to bypass safety | "I can't help" |

### Implementation

```typescript
// Pre-send filter
checkSafety(userMessage, 'user')
→ Lowercase & tokenize
→ Check against each rule's keywords
→ If match: return { blocked: true, category: 'CRISIS' }
→ If no match: return { blocked: false }

// Post-response filter
checkSafety(aiResponse, 'assistant')
→ Ensure AI doesn't claim to be human
→ Verify no rule violations in response
→ If suspect: return redacted response or fallback
```

---

## Localization (i18n) Architecture

**Location:** `src/i18n/`

### Setup
- i18next + react-i18next
- 10 locale files: `en.ts`, `es.ts`, `fr.ts`, `de.ts`, `pt.ts`, `hi.ts`, `ja.ts`, `zh.ts`, `ar.ts`, `it.ts`
- Flat key/value structure (e.g., `screens.home.title`)

### RTL Support
- Arabic (ar) and Hebrew (he) auto-detected
- `I18nManager.forceRTL(true)` applied on App mount
- All margins/paddings reversed by React Native

### Device Language Detection
- App launches in device's language (if supported)
- User can override in SetupFlow
- Preference saved in AsyncStorage

---

## CI/CD & Quality

### GitHub Actions Workflows

**`.github/workflows/typecheck.yml`**
- Runs on push/PR to main
- Executes `npx tsc --noEmit`
- Blocks merge if TypeScript errors found

**`.github/workflows/security-check.yml`**
- Scans for hardcoded secrets (API keys, etc.)
- Fails if secrets detected

**`.github/workflows/validate-agents.yml`**
- Validates `.github/agents.json` schema
- Ensures all helper IDs are unique
- Runs on any .github/agents.json change

**`.github/workflows/pr-approval.yml`**
- Requires owner (@amitgaikwad2837) approval
- Blocks merge if not approved

---

## Performance Considerations

### Cold Start
- **Target:** <3 seconds from app launch to homescreen
- **Optimizations:** Code splitting, lazy imports, async initialization

### Chat Response
- **Target:** <2 seconds average (depends on AI provider)
- **Optimizations:** Streaming if available, response batching

### Local Model Inference
- **Target:** <5 seconds on mid-range device
- **Baseline:** Pixel 4a, Galaxy S10

### Memory
- **Max heap:** ~100MB (typical)
- **Optimizations:** Conversation history pagination, lazy image loading

### Storage
- **Typical app size:** ~150MB (including assets)
- **Typical data size:** <10MB per user (conversations, habits, journals)

---

## Testing Strategy

### Unit Tests
- Services (AI, storage, encryption, safety filter)
- Utility functions (date helpers, formatters)

### Integration Tests
- Flow: Save conversation → Encrypt → Retrieve → Decrypt
- Flow: Import custom helper via deep link

### E2E Tests
- Complete onboarding flow
- Chat conversation end-to-end
- Habit creation & completion

### Manual Testing Checklist
- [ ] iOS simulator (Xcode)
- [ ] Android emulator (Android Studio)
- [ ] Real device (iOS 13+, Android 6+)
- [ ] App backgrounding & re-lock
- [ ] Deep link handling
- [ ] Offline mode
- [ ] RTL layout (Arabic)
- [ ] All 10 languages
- [ ] Dark/light theme toggle

---

## Future Architecture Improvements

1. **Offline-First Sync** — Queue AI requests when offline, sync when reconnected
2. **Plugin System** — Allow third-party extensions to add custom helpers
3. **Peer-to-Peer Sharing** — Encrypted sharing of decisions/journal entries with trusted users
4. **Local Vector Database** — On-device embedding search for better journal retrieval
5. **Advanced Analytics** — Privacy-preserving on-device analytics dashboard
6. **Voice Output (TTS)** — Text-to-speech playback of AI responses (STT input already implemented via `@react-native-voice/voice`)

---

**Document Version:** 1.0  
**Last Updated:** June 2026  
**Author:** Amit Gaikwad
