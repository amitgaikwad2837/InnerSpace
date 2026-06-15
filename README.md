# InnerSpace

> A private, AI-powered personal growth companion for iOS and Android.

[![TypeScript](https://img.shields.io/badge/TypeScript-~6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2056-black?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.85-61dafb?logo=react)](https://reactnative.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

InnerSpace helps you build habits, journal your thoughts, navigate decisions, and have supportive AI conversations — all without an account, and with all data stored encrypted on your device.

**Website:** [amitgaikwad2837.github.io/InnerSpace](https://amitgaikwad2837.github.io/InnerSpace/)

---

## Features

### Five Interaction Modes
| Mode | Description |
|------|-------------|
| **Just Talk** | Multi-turn AI conversations with 35+ specialist helpers across 9 life categories |
| **My Habits** | Daily/weekly habit tracking with streaks, XP rewards, and AI check-ins |
| **Reflect** | Guided journaling with rotating prompts, mood check-ins, and AI-generated insights |
| **Decide** | Structured two-option decision analysis with a clarity score and session history |
| **Goals** | Set personal goals with target dates and link habits to them for daily progress |

### Privacy-First Design
- All data stored locally via AsyncStorage + expo-secure-store
- Journal entries, habits, and conversations encrypted with **AES-256-GCM**
- API keys kept in the hardware-backed secure enclave — never transmitted
- No backend servers, no analytics, no tracking
- **App lock** — PIN, biometric, or both; auto-locks when the app is backgrounded

### Other Highlights
- **35+ helpers** across career, wellness, relationships, creativity, and more
- **Custom helpers** — build your own and share them via deep link
- **10 languages** — English, Spanish, French, German, Portuguese, Hindi, Japanese, Mandarin, Arabic, Italian
- **Voice input** — tap the mic in chat or journal to speak instead of type (Android speech recognition)
- **Smart habit suggestions** — chat about building a habit and a one-tap chip adds it to My Habits
- **Local AI option** — run Gemma / Phi / Llama on-device with no API key or internet
- **Multi-provider AI** — Gemini (default), OpenAI, Claude, Groq with automatic quota failover
- **Guest-first** — no account required to start

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 56, React Native 0.85 |
| Language | TypeScript ~6.0 |
| Navigation | React Navigation (stack + bottom tabs) |
| State | Zustand |
| Storage | AsyncStorage + expo-secure-store |
| Encryption | AES-256-GCM via Web Crypto API |
| i18n | i18next + react-i18next (10 locales) |
| Local AI | react-native-executorch |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (Android) or Xcode (iOS/macOS)

### Install & Run

```bash
# Install dependencies
npm install

# Start Metro bundler
npm run start
```

Then press `a` for Android, `i` for iOS, or `w` for web.

### Platform shortcuts

```bash
npm run android   # Android emulator/device
npm run ios       # iOS simulator (macOS only)
npm run web       # Browser (limited — designed for mobile)
```

---

## Project Structure

```
InnerSpace/
├── App.tsx                    # Root component — navigation, deep links, app lock
├── index.ts                   # Expo entry point
├── app.json                   # Expo config (bundle ID, version, permissions)
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx     # Dashboard: XP, streak, mood, quick access
│   │   ├── ChatScreen.tsx     # AI conversation with voice input & habit chip
│   │   ├── HabitsScreen.tsx   # Habit tracker with streaks and XP
│   │   ├── GoalsScreen.tsx    # Goal setting with habit linking
│   │   ├── JournalScreen.tsx  # Guided journaling with mood and AI insight
│   │   ├── DecisionScreen.tsx # Two-option decision analysis with clarity score
│   │   ├── AgentsScreen.tsx   # Browse & pin 35+ specialist helpers
│   │   ├── HistoryScreen.tsx  # Past conversations with search
│   │   ├── SettingsScreen.tsx # AI provider, app lock, backup, language
│   │   ├── SetupFlowScreen.tsx # Onboarding: language, AI mode, model download
│   │   ├── CreateAgentScreen.tsx # Custom helper builder
│   │   └── SignInScreen.tsx   # Optional Google OAuth sign-in
│   ├── services/              # Business logic (AI, storage, encryption, safety)
│   ├── constants/             # Shared constants (agents catalog URL, legal keys)
│   ├── context/               # ThemeContext (dark/light/system)
│   ├── store/                 # Zustand auth store
│   ├── i18n/                  # i18next setup + 10 locale files
│   ├── types/                 # Shared TypeScript types
│   ├── components/            # ErrorBoundary, AppTour, InnerSpaceLogo
│   └── utils/                 # Date helpers
├── modules/mediapipe-llm/     # Expo local module for on-device Gemma 2B (scaffolded)
├── assets/                    # App icon, splash screen, Android adaptive icon
├── docs/                      # GitHub Pages marketing website
│   ├── index.html
│   ├── privacy.html
│   └── terms.html
└── .github/
    ├── agents.json            # Live helpers catalog (no rebuild needed to add helpers)
    └── workflows/             # CI: typecheck, security scan, agent validation
```

---

## Adding a Helper

The helpers catalog is a JSON file in the repo — no app rebuild needed to add or update helpers.

Edit `.github/agents.json` and add an object to the `agents` array:

```json
{
  "id": "my_helper",
  "name": "My Helper",
  "nameKey": "agent.my_helper.name",
  "descriptionKey": "agent.my_helper.desc",
  "category": "personal_growth",
  "emoji": "🌟",
  "expertise": "You are My Helper. Describe the helper's role and behaviour in detail.",
  "suggestedQuestions": [
    "What's one thing you'd like to work on today?",
    "How are you feeling right now?"
  ],
  "isCustom": false,
  "isPremium": false
}
```

**Valid categories:** `home_family`, `nature_garden`, `health_wellness`, `career_learning`, `creative_hobbies`, `tech_digital`, `pets_animals`, `travel_culture`, `personal_growth`

> Safety rules are always injected client-side and cannot be bypassed through the catalog.

---

## Localization

Translation files live in `src/i18n/locales/`. Each locale exports a flat key/value object.

Supported locales: `en`, `es`, `fr`, `de`, `pt`, `hi`, `zh`, `ja`, `ar`, `it`

To add a new locale, create a new file in `src/i18n/locales/` and register it in `src/i18n/index.ts`.

---

## Safety

InnerSpace is **not** a medical, legal, financial, or crisis service. A dual-layer safety filter (pre-send + post-response) redirects users to appropriate professional support for sensitive topics. See `src/services/safety-filter.ts` for the ruleset.

If you or someone you know is in crisis: **call 988 (US)** or **116 123 (UK)** — or text HOME to 741741.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR process, restricted files, and code style guide.

---

## License

[MIT](LICENSE) — built and maintained by [Amit Gaikwad](https://github.com/amitgaikwad2837)


