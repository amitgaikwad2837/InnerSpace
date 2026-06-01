# InnerSpace — Complete Project Scope Document

**Version:** 2.0 | **Date:** May 2026 | **Status:** Updated — Reflects Mobile Implementation  
**Product:** InnerSpace — AI Personal Growth Companion (React Native / Expo Mobile App)  
**Author:** Product Team

> **⚠️ Architecture Note:** v1.0 of this document was written for a Next.js web application with Supabase and Vercel backend. The project was implemented as a **React Native / Expo mobile-first app** with fully local storage (no backend, no server). Section 5 reflects the actual architecture. The original web spec is preserved in Appendix E for reference.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Analysis](#2-market-analysis)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [Product Requirements (PRD)](#4-product-requirements-prd)
5. [Technical Architecture (Actual — Mobile)](#5-technical-architecture-actual--mobile)
6. [AI Safety Rules & Guidelines](#6-ai-safety-rules--guidelines)
7. [Implementation Status & Gap Analysis](#7-implementation-status--gap-analysis)
8. [Testing Strategy](#8-testing-strategy)
9. [Launch Plan](#9-launch-plan)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Appendix](#11-appendix)

---

## 1. Executive Summary

### What is InnerSpace?

InnerSpace is an AI-powered personal growth companion **mobile app** (iOS and Android via Expo) that helps people build better habits, work through big life decisions, reflect through guided journaling, and feel less alone day-to-day. Users choose their preferred interaction style — conversational chat with a specialised AI helper, visual habit tracking, guided reflection, or structured decision coaching — making the experience genuinely personal from the first session.

### The Core Insight

The personal growth and mental wellness app market is large and growing, but most products force users into a single interaction model. InnerSpace's differentiator is user-chosen interaction modes — the same AI engine powers four distinct experiences depending on how the user wants to engage that day, plus a library of 35+ specialist AI helpers covering 9 life categories.

### What It Is Not

InnerSpace is explicitly **not** a medical, therapeutic, or clinical service. It does not give health advice, diagnose conditions, or replace professional care. This boundary is enforced at every layer: the UI, system prompts, and a client-side safety filter. The AI always speaks as a warm human companion — never as an AI assistant.

### Summary Metrics

| Dimension | Target |
|---|---|
| Target users | Adults 18+ working on habits, decisions, and self-connection |
| Platform | iOS + Android (Expo SDK ~56, React Native 0.85.3, TypeScript) |
| Storage | Fully local — AsyncStorage + expo-secure-store |
| AI provider | Google Gemini (default, BYOK key in SecureStore) |
| Monetisation | Freemium → Pro $7.99/month |
| Year 1 revenue target | $50K ARR |

### Current Mobile Implementation State (May 2026)

1. No mandatory login — guest mode by default; no authentication layer.
2. First-run **SetupFlow** (4 steps):
   - **Legal & Privacy** — versioned consent tracking, region-aware legal notice
   - **Language** — 10 locales (en, es, fr, de, pt, hi, zh, ja, ar, it)
   - **Tone** — warm / direct / motivational
   - **Helpers** — select one or more from 35+ helpers; influences featured recommendations
3. User can re-run setup from Settings at any time.
4. **App lock** — PIN, biometric (Face ID / Fingerprint), or both. Enforced on app open/resume.
5. If no Gemini API key is configured, chat shows a setup prompt instead of failing silently.
6. **Theme** — dark / light / system mode, persisted in AsyncStorage.
7. Brand mark rendered via reusable `InnerSpaceLogo` component.
8. Creator attribution footer in Settings with GitHub and LinkedIn links.
9. Backup/restore — full JSON export + import via device share sheet.
10. Notification scheduling via `expo-notifications` (local only).

---

## 2. Market Analysis

### 2.1 Market Size

| Segment | Global Market Size (2026) | Growth Rate |
|---|---|---|
| Mental wellness apps | $6.2B | 16.5% CAGR |
| Personal productivity apps | $4.8B | 13.2% CAGR |
| AI-powered coaching tools | $2.1B | 28.4% CAGR |
| Habit tracking apps | $890M | 11.8% CAGR |
| **Combined addressable** | **~$14B** | **~18% CAGR** |

### 2.2 Current Market Landscape

#### Tier 1 — Large incumbents

**Headspace & Calm** — Passive meditation; InnerSpace is interactive and personalised  
**Noom & Fabulous** — Rigid programmes; InnerSpace AI adapts to the user's actual words  
**BetterHelp & Talkspace** — Actual therapy ($60–100/session); InnerSpace is a daily companion with zero clinical claims

#### Tier 2 — AI-native products

**Replika** — Drifted parasocial; InnerSpace is purpose-built for growth with strict safety guardrails  
**Character.ai** — Entertainment only; InnerSpace has structured modes tied to real outcomes  
**Pi (by Inflection)** — General-purpose, no habit tracking, no decision framework; InnerSpace adds structure

#### Tier 3 — Habit and productivity tools

**Habitica, Streaks, Loop** — Gamified but no AI, no emotional intelligence. InnerSpace adds an AI coach that celebrates, prompts, and adapts.

### 2.3 The Gap InnerSpace Fills

No current product combines all four of:
1. Conversational AI with emotional intelligence + 35+ specialist helpers across 9 life categories
2. Structured habit tracking with gamification (XP, streaks, milestones, heatmap)
3. AI-guided journaling with dynamic prompts and insight generation
4. Decision coaching with structured two-option analysis

### 2.4 Target User Personas

#### Persona 1 — The Habit Builder (Alex, 28)
Works in tech, productive at work but inconsistent with personal goals. Wants accountability without judgment.

#### Persona 2 — The Decision Dweller (Priya, 34)
Mid-career professional facing a major life decision (career change, relocation). Needs structure, not advice.

#### Persona 3 — The Disconnected Professional (Marcus, 41)
Busy life, few close friendships. Values privacy. Would never see a therapist but uses a daily AI companion.

---

## 3. Product Vision & Goals

### 3.1 Vision Statement

> InnerSpace becomes the daily growth companion that millions of people open every morning — not because they have to, but because it makes them feel clearer, more intentional, and less alone.

### 3.2 Success Metrics

| Metric | Month 3 | Month 6 | Month 12 |
|---|---|---|---|
| Downloads | 500 | 2,500 | 10,000 |
| Daily active users (DAU) | 35% of installs | 45% | 55% |
| Average sessions per user/week | 3 | 4 | 5 |
| Free-to-Pro conversion | 5% | 8% | 12% |
| Monthly revenue | $200 | $1,500 | $8,000 |
| NPS score | 40+ | 50+ | 60+ |
| 30-day retention | 40% | 50% | 60% |

### 3.3 Design Principles

1. **User chooses how to engage** — no forced interaction model
2. **AI serves, never leads** — the AI follows the user's emotional state, not a script
3. **Safety first, always** — no medical, clinical, legal, or financial advice under any circumstances
4. **Privacy by default** — all data stays on device; nothing leaves without user action
5. **Honest about limitations** — the app clearly states what it is and what it is not
6. **Human voice** — AI never identifies as AI; speaks as a warm, grounded friend

---

## 4. Product Requirements (PRD)

### 4.1 Onboarding & Setup

**FR-ONB-01:** First-run setup flow guides users through 4 steps: legal consent → language → tone → helper selection  
**FR-ONB-02:** Legal notice is region-aware (US, CA, EU/EEA, UK, IN, APAC, LATAM, MENA, Global) with versioned consent key  
**FR-ONB-03:** Language selection (10 locales) is applied immediately and persisted in AsyncStorage  
**FR-ONB-04:** Tone selection (warm / direct / motivational) is injected into every AI system prompt  
**FR-ONB-05:** Helper selection influences featured recommendations and agent listing priority  
**FR-ONB-06:** Setup flow can be re-run from Settings at any time  
**FR-ONB-07:** User can import a backup at setup time to restore all data  
**FR-ONB-08:** ~~Google OAuth sign-in~~ — **Not implemented; app runs in guest mode (deliberate)**  
**FR-ONB-09:** ~~Age gate 18+~~ — **Not implemented; legal consent serves as acknowledgment**  

### 4.2 Home Screen

**FR-HOME-01:** Time-aware personalised greeting (morning / afternoon / evening)  
**FR-HOME-02:** Daily mood check-in with 5 emoji options and 15 rotating contextual prompts (day-of-year rotation)  
**FR-HOME-03:** Four mode cards: Just Talk, My Habits, Reflect, Decide — each navigates to the relevant screen  
**FR-HOME-04:** Featured helper card (influenced by setup selection) with quick-launch  
**FR-HOME-05:** XP counter and streak display  
**FR-HOME-06:** Milestone badges at 7 / 30 / 60 / 100-day streaks  
**FR-HOME-07:** Activity heatmap showing daily engagement over the past 12 weeks  

### 4.3 Mode 1 — Just Talk (Chat with AI Helper)

**FR-CHAT-01:** Multi-turn conversational interface with any selected helper  
**FR-CHAT-02:** Helper chosen from Agents screen; custom agents fully supported  
**FR-CHAT-03:** Conversation history visible and scrollable within the session  
**FR-CHAT-04:** Emoji reaction picker on each AI message; reactions persisted per conversation in AsyncStorage  
**FR-CHAT-05:** AI cooldown banner shown if the user sends messages too rapidly  
**FR-CHAT-06:** Conversations saved with timestamp and auto-generated title  
**FR-CHAT-07:** Auto-generated AI summary after 3+ AI replies  
**FR-CHAT-08:** All sessions viewable in the History screen  

### 4.4 Mode 2 — My Habits

**FR-HAB-01:** Users can create habits with a name and optional emoji  
**FR-HAB-02:** Each habit displays a streak counter and today's completion state  
**FR-HAB-03:** Tapping a habit marks it done for today — one tap, instant XP award  
**FR-HAB-04:** 10 XP awarded per habit completion; XP accumulates on the Home screen  
**FR-HAB-05 GAP:** ~~AI celebration on completing all habits for the day~~ — **Not yet implemented**  
**FR-HAB-06 GAP:** ~~AI gentle check-in when a habit is missed for 3+ consecutive days~~ — **Not yet implemented**  
**FR-HAB-07 GAP:** ~~AI habit suggestion based on user's stated goals~~ — **Not yet implemented**  
**FR-HAB-08 GAP:** ~~Weekly habit summary card every Monday~~ — **Not yet implemented**  

### 4.5 Mode 3 — Reflect (Journaling)

**FR-JNL-01:** Daily rotating prompt (15 prompts, day-of-year rotation; fixed per day)  
**FR-JNL-02:** User writes freely in a plain text area  
**FR-JNL-03:** After submitting, AI generates a 2–3 sentence insight via Gemini  
**FR-JNL-04:** Completing an entry awards XP  
**FR-JNL-05:** Past reflections listed in History tab (FlatList, newest first)  
**FR-JNL-06:** Individual reflection deletion supported  
**FR-JNL-07:** PDF export of journal entries via share sheet  
**FR-JNL-08 GAP:** ~~Calendar grid view for past reflections~~ — **Not yet implemented (FlatList only)**  
**FR-JNL-09 GAP:** ~~Request a different prompt (up to 3 times per session)~~ — **Not yet implemented**  

### 4.6 Mode 4 — Decide (Decision Coaching)

**FR-DEC-01:** User enters: decision description, Option A text, Option B text  
**FR-DEC-02:** AI performs a structured analysis:
- Reflects the decision back (1–2 sentences)
- Analyses Option A — upsides and risks (3–4 bullets)
- Analyses Option B — upsides and risks (3–4 bullets)
- "What I'd think about" — open questions worth sitting with
- One grounding closing sentence

**FR-DEC-03:** AI never tells the user what to decide  
**FR-DEC-04:** Result displayed with visual pills: Option A (green border) and Option B (accent border)  
**FR-DEC-05 GAP:** ~~Clarity score self-rating (1–10) after analysis~~ — **Not yet implemented**  
**FR-DEC-06 GAP:** ~~Save and resume a previous decision session~~ — **Not yet implemented (result lost on navigate)**  
**FR-DEC-07 GAP:** ~~Decision archive / history view~~ — **Not yet implemented**  

> **Note on Decision Mode:** The original spec described a 5-step conversational Q&A framework. The implementation uses a single-form two-option structured analysis — faster UX, same coaching outcome.

### 4.7 Agents (Helper Library)

**FR-AGT-01:** 35+ predefined AI helpers across 9 life categories:
- 🏠 Home & Family · 🌿 Nature & Garden · 💪 Health & Wellness · 🎓 Career & Learning
- 🎨 Creative & Hobbies · 💻 Tech & Digital · 🐾 Pets & Animals · ✈️ Travel & Culture · 🌱 Personal Growth

**FR-AGT-02:** Search helpers by name; filter by category  
**FR-AGT-03:** Pin favourite helpers to the top of the list  
**FR-AGT-04:** Create custom helpers: name, description, emoji, category, and custom system prompt  
**FR-AGT-05:** Setup-selected helpers featured prominently on Home and in the agent list  
**FR-AGT-06:** All helpers inherit the 7 safety rules via `SAFETY_PREFIX` injection  
**FR-AGT-07:** All helpers respond in the user's current app language  
**FR-AGT-08:** `HUMAN_VOICE_SUFFIX` appended to every agent system prompt — prevents AI self-identification and hollow openers  

### 4.8 Conversation History

**FR-HIST-01:** All conversations listed with timestamp, helper name, and message count  
**FR-HIST-02:** Summary badge (sparkles icon) shown on auto-summarised conversations  
**FR-HIST-03:** Individual conversation deletion  
**FR-HIST-04:** Clear all history  
**FR-HIST-05:** Tap conversation to view full transcript  

### 4.9 Settings

**FR-SET-01:** Re-run full setup flow (language, tone, helpers)  
**FR-SET-02:** Gemini API key — enter, masked display (last 4 chars), delete; stored in expo-secure-store  
**FR-SET-03:** App lock — enable/disable; choose PIN, biometric, or both  
**FR-SET-04:** PIN set and change  
**FR-SET-05:** Theme — dark / light / system  
**FR-SET-06:** Notification preferences (daily reminder time)  
**FR-SET-07:** Backup export (JSON, all AsyncStorage keys, shared via device share sheet)  
**FR-SET-08:** Backup import (restore from JSON file via document picker)  
**FR-SET-09:** Legal notice re-display and re-consent  
**FR-SET-10:** Creator credit footer with GitHub and LinkedIn links  
**FR-SET-11:** Rate app / share app links  
**FR-SET-12 GAP:** ~~Multi-provider BYOK (OpenAI, Claude, Groq)~~ — **Not yet implemented; Gemini only**  

### 4.10 Non-Functional Requirements

| Requirement | Target | Status |
|---|---|---|
| App launch time | Under 2s on mid-range device | ⚠️ Not formally measured |
| AI response time | Under 3s (95th percentile) | ⚠️ Gemini-dependent; not measured |
| Offline behaviour | All local data accessible offline; AI features show "needs connection" | ✅ |
| Accessibility | WCAG 2.1 AA principles on native components | ⚠️ Not formally audited |
| Secret storage encryption | expo-secure-store (iOS Keychain / Android Keystore) | ✅ |
| General data at-rest encryption | AsyncStorage is plain JSON | ❌ GAP-11 |
| Privacy | All data local; no telemetry; no analytics | ✅ |
| GDPR | Export (backup) + delete (clear + uninstall) | Partial |
| Languages | 10 locales | ✅ |
| Platforms | iOS 14+, Android 11+ | Target |

---

## 5. Technical Architecture (Actual — Mobile)

### 5.1 System Overview

```
User Device (iOS / Android)
        │
        ▼
  Expo React Native App (SDK ~56, RN 0.85.3, TypeScript)
        │
   ┌────┴──────────────────────────┐
   │                               │
AsyncStorage                  expo-secure-store
(habits, journal,              (Gemini API key,
 conversations, XP,            app PIN)
 settings, heatmap)
        │
        └──── Direct HTTPS call ──▶  Google Gemini API
                                      (gemini-1.5-flash-latest)
```

**No backend. No server. No cloud database. All data lives on the user's device.**

### 5.2 Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Expo SDK ~56 + React Native 0.85.3 | Cross-platform iOS/Android |
| Language | TypeScript (strict) | |
| Navigation | React Navigation 7 (Stack + Bottom Tabs) | |
| Styling | StyleSheet + ThemeContext | Dark/light/system tokens |
| Local storage (general) | AsyncStorage | JSON strings; unencrypted |
| Local storage (secrets) | expo-secure-store | iOS Keychain / Android Keystore |
| AI provider | Google Gemini 1.5 Flash | Direct client-side call via `gemini-service.ts` |
| Icons | @expo/vector-icons (Ionicons) | Used throughout all screens |
| i18n | i18next + react-i18next | 10 locales: en/es/fr/de/pt/hi/zh/ja/ar/it |
| Notifications | expo-notifications | Local scheduling only |
| Backup | expo-sharing + expo-document-picker + expo-file-system | JSON export/import |
| Biometrics | expo-local-authentication | Face ID / Fingerprint |
| App lock | Custom `services/app-lock.ts` | PIN + biometric |

### 5.3 File Structure

```
src/
  screens/
    HomeScreen.tsx          — Dashboard: mood check-in, mode cards, XP, streak, heatmap
    ChatScreen.tsx          — AI helper chat (multi-turn, emoji reactions, cooldown)
    JournalScreen.tsx       — Reflect: rotating prompt, entry, AI insight, history, PDF export
    HabitsScreen.tsx        — Habit tracker: create, complete, streak, XP
    AgentsScreen.tsx        — Browse / search / filter / pin 35+ helpers
    HistoryScreen.tsx       — Conversation history: list, summary badges, delete, transcript
    CreateAgentScreen.tsx   — Custom agent creation (name, emoji, category, prompt)
    DecisionScreen.tsx      — Two-option decision coaching with AI structured analysis
    SettingsScreen.tsx      — API key, lock, theme, backup, tone, notifications, legal
    SetupFlowScreen.tsx     — First-run onboarding: legal, language, tone, helpers
    SignInScreen.tsx         — (Legacy stub — no auth implemented)
  constants/
    agents.ts               — 35 predefined agents, SAFETY_PREFIX, HUMAN_VOICE_SUFFIX, buildAgentSystemPrompt()
    legal-notice.ts         — Region-aware legal text, versioned consent (LEGAL_ACK_KEY / LEGAL_ACK_VERSION)
  context/
    ThemeContext.tsx         — Dark/light/system theme, DARK_COLORS / LIGHT_COLORS tokens, useTheme()
  services/
    gemini-service.ts       — Gemini API integration, callGeminiAPI()
    safety-filter.ts        — 7 hard safety rules, containsAdultContent(), keyword filter
    storage-service.ts      — AsyncStorage helpers, getAccessToken()
    app-lock.ts             — PIN + biometric lock: saveAppPin(), getLockEnabled(), canUseBiometric()
    backup-service.ts       — JSON export/import, exportBackupAndShare(), importBackupFromFile()
    notifications.ts        — Local notification scheduling
    agents-catalog.ts       — Dynamic agent catalog (predefined + custom merged)
  i18n/
    index.ts                — i18next config, SUPPORTED_LANGUAGES, LanguageCode type
    locales/                — en, es, fr, de, pt, hi, zh, ja, ar, it (all keys in sync)
  components/
    InnerSpaceLogo.tsx      — Reusable brand logo component
  store/
    auth.ts                 — Zustand auth store (minimal; email field for display only)
  types/
    index.ts                — Shared types: Agent, Habit, JournalEntry, Conversation, ToneOption
```

### 5.4 AI Integration Flow

All AI calls go through `callGeminiAPI()` in `gemini-service.ts`:

1. Retrieve Gemini API key from `expo-secure-store`
2. If no key → show setup prompt; do not call API
3. Run client-side keyword safety filter (`safety-filter.ts`) on user message
4. If crisis/medical/safeguarding keyword match → return hardcoded safe response; skip API
5. Build system prompt via `buildAgentSystemPrompt(agent, tone, language)`:
   - Prepend `SAFETY_PREFIX` (hardcoded, immutable 7 safety rules)
   - Insert `agent.systemPrompt` (agent-specific persona and expertise)
   - Append `HUMAN_VOICE_SUFFIX` (human voice rules, language, tone)
6. Call `gemini-1.5-flash-latest` with full system prompt + conversation history
7. Return response to UI component
8. Save conversation turn to AsyncStorage

### 5.5 Theme Architecture

`ThemeContext.tsx` provides `useTheme()` hook across all screens:

```typescript
// Pattern used in every screen
function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({ ... }); // uses c.background, c.text, c.accent, etc.
}

// Inside component
const { colors } = useTheme();
const styles = useMemo(() => createStyles(colors), [colors]);
```

**Color tokens:** `background`, `surface`, `surfaceAlt`, `text`, `textSecondary`, `textMuted`, `textDim`, `border`, `accent`, `accentBg`, `danger`, `success`, `tabBar`, `tabBarBorder`

### 5.6 Security Architecture

| Concern | Mitigation |
|---|---|
| API key exposure | expo-secure-store (OS Keychain/Keystore); never in AsyncStorage; masked in UI |
| Prompt injection | System prompt clearly separates instructions from user content; SAFETY_PREFIX is immutable |
| Unsafe AI output | Client-side keyword filter; system prompt hard rules; HUMAN_VOICE_SUFFIX |
| Local data sensitivity | General app data in AsyncStorage (unencrypted) — **GAP-11** |
| App access control | PIN + biometric lock enforced on every open/resume |
| Data leakage | No network calls except to Gemini API; no analytics SDK; no crash reporting service |

---

## 6. AI Safety Rules & Guidelines

### 6.1 The Seven Hard Rules

Enforced at two independent layers: (1) client-side keyword filter in `safety-filter.ts`, and (2) `SAFETY_PREFIX` injected into every agent system prompt.

| Rule | Topic | Action |
|---|---|---|
| RULE-1 | Medical diagnosis & treatment | Immediate redirect to doctor/pharmacist. No engagement. |
| RULE-2 | Mental health treatment | Redirect to GP or therapist. Acknowledge emotions only. |
| RULE-3 | Crisis & self-harm | Immediate crisis resources (988 / 116 123 / Text HOME to 741741). Conversation replaced. |
| RULE-4 | Legal advice | Redirect to solicitor, Citizens Advice, or legal aid. |
| RULE-5 | Financial advice | Redirect to qualified financial adviser. |
| RULE-6 | Political & religious opinions | Neutral. Redirect to user's own values. |
| RULE-7 | Safeguarding (abuse/violence) | Helpline numbers immediately. Do not probe. No relationship advice. |

### 6.2 The Redirect Formula

Every safety redirect follows four steps:
1. **Acknowledge** — "I hear that you're going through something difficult"
2. **Explain** — "This is outside what I'm here for"
3. **Point** — "A [doctor/therapist/solicitor] is the right person"
4. **Offer** — "Is there something else I can support you with?"

### 6.3 System Prompt Architecture

Every agent system prompt is built by `buildAgentSystemPrompt(agent, tone, language)` in `agents.ts`:

```
Layer 1 — SAFETY_PREFIX       ← hardcoded, immutable 7 rules
Layer 2 — agent.systemPrompt  ← agent-specific persona and expertise
Layer 3 — HUMAN_VOICE_SUFFIX  ← human voice rules, language, tone injection
```

**HUMAN_VOICE_SUFFIX** ensures the AI:
- Never identifies itself as an AI, language model, or assistant
- Never opens with hollow affirmations ("Great question!", "Certainly!", "Absolutely!")
- Speaks as a warm, grounded, direct human companion
- Responds in the user's app language
- Matches the user's chosen tone (warm / direct / motivational)

### 6.4 Client-Side Keyword Safety Filter (`safety-filter.ts`)

```typescript
export const SAFETY_RULES = {
  CRISIS_SELF_HARM: {
    keywords: ['suicide', 'suicidal', 'kill myself', 'end my life', ...13 total],
    message: "crisis resources + immediate care message"
  },
  MEDICAL: {
    keywords: ['diagnose', 'diagnosis', 'my symptoms', 'what medication', ...11 total],
    message: "redirect to doctor or pharmacist"
  },
  // + MENTAL_HEALTH, LEGAL, FINANCIAL, POLITICAL, SAFEGUARDING
}
```

If a keyword match is found, the hardcoded safe response is returned and the Gemini API is never called.

### 6.5 Crisis Resources (hardcoded in filter messages)

```
988 (US) · 116 123 (Samaritans UK) · Text HOME to 741741
UK DV: 0808 2000 247 · US DV: 1-800-799-7233
```

---

## 7. Implementation Status & Gap Analysis

### 7.1 Fully Implemented ✅

| Feature | Screen / File |
|---|---|
| 4-step setup flow (legal, language, tone, helpers) | `SetupFlowScreen.tsx` |
| Region-aware legal notice (9 regions + global) | `constants/legal-notice.ts` |
| Versioned legal consent tracking | `SetupFlowScreen.tsx` |
| Home: mood check-in, mode cards, XP, streak, heatmap, milestones | `HomeScreen.tsx` |
| 15 rotating daily check-in prompts | `HomeScreen.tsx` |
| Chat: multi-turn, emoji reactions (persisted), cooldown | `ChatScreen.tsx` |
| Conversation auto-summary (3+ AI replies) | `ChatScreen.tsx` |
| Conversation history with summary badge and delete | `HistoryScreen.tsx` |
| Habit creation, completion, streak, XP | `HabitsScreen.tsx` |
| Journal: rotating prompt, AI insight, history, PDF export | `JournalScreen.tsx` |
| Decision coaching: two-option structured AI analysis | `DecisionScreen.tsx` |
| 35+ predefined agents across 9 categories | `constants/agents.ts` |
| Custom agent creation | `CreateAgentScreen.tsx` |
| Agents browse / search / filter / pin | `AgentsScreen.tsx` |
| HUMAN_VOICE_SUFFIX on all agents | `constants/agents.ts` |
| 7-rule client-side safety filter | `services/safety-filter.ts` |
| SAFETY_PREFIX in all agent prompts | `constants/agents.ts` |
| Dark / light / system theme (all screens) | `context/ThemeContext.tsx` |
| 10 language localization — all screens | `src/i18n/locales/` |
| Gemini API key BYOK (SecureStore, masked) | `SettingsScreen.tsx` |
| App lock: PIN + biometric | `services/app-lock.ts` |
| Full JSON backup export + import | `services/backup-service.ts` |
| Notification scheduling (local) | `services/notifications.ts` |
| InnerSpace logo component | `components/InnerSpaceLogo.tsx` |
| Creator attribution in Settings | `SettingsScreen.tsx` |
| Ionicons throughout all screens | All screens |

### 7.2 Gaps — Not Yet Implemented ❌

| ID | Feature | Original Req | Priority | Implementation Notes |
|---|---|---|---|---|
| GAP-01 | AI celebration message when all habits completed for the day | FR-HAB-05 | **High** | Core gamification loop; show in-app modal or banner with AI-generated message |
| GAP-02 | AI gentle check-in when habit missed for 3+ consecutive days | FR-HAB-06 | **Medium** | In-app nudge on next open; check last completion date vs today |
| GAP-03 | AI habit suggestion from user's stated goals | FR-HAB-07 | Low | Can use Chat mode as workaround today |
| GAP-04 | Weekly habit summary card (every Monday) | FR-HAB-08 | Low | Streak % + best streak + one AI insight |
| GAP-05 | Journal calendar grid view | FR-JNL-08 | Low | Currently FlatList; calendar would improve reflection UX |
| GAP-06 | Request different journal prompt (up to 3× per session) | FR-JNL-09 | Low | Prompt is currently fixed per calendar day |
| GAP-07 | Decision: clarity score self-rating (1–10) | FR-DEC-05 | **Medium** | User rates own clarity after reading analysis |
| GAP-08 | Decision: save and resume session | FR-DEC-06 | **High** | Result lost on navigate away; no persistence |
| GAP-09 | Decision: history / archive view | FR-DEC-07 | **High** | Past decisions not stored; user can't review prior sessions |
| GAP-10 | Multi-provider BYOK: OpenAI, Claude, Groq | FR-SET-12 | Low | Architecture supports extension; `gemini-service.ts` would need provider router |
| GAP-11 | AsyncStorage at-rest encryption | NFR | **Medium** | Journal entries, habits, conversations in plain JSON; risk on rooted/jailbroken device |
| GAP-12 | Formal WCAG 2.1 AA accessibility audit | NFR | **Medium** | Not audited; likely partial compliance via React Native defaults |
| GAP-13 | Sign-in / account system | FR-ONB-08 | Low | Guest mode is deliberate privacy decision; adds complexity vs. benefit |
| GAP-14 | Age gate (18+) | FR-ONB-09 | Low | Legal consent flow serves as acknowledgment for now |

### 7.3 Deliberate Implementation Changes vs Original Spec

| Area | Original Spec (v1.0) | Actual Build | Reason |
|---|---|---|---|
| **Platform** | Next.js web app | Expo RN mobile app | Mobile-first; privacy-first; zero running cost |
| **Authentication** | Google OAuth required | Guest mode (no auth) | No PII collection; stronger privacy posture |
| **Database** | Supabase PostgreSQL | AsyncStorage + expo-secure-store | No backend needed; fully offline capable |
| **API key security** | AES-256-GCM server-side encryption | expo-secure-store (OS-level keychain) | Equivalent security without a server |
| **Decision mode UX** | 5-step conversational Q&A | Single-form two-option analysis + AI output | Faster, less friction; same coaching outcome |
| **Chat reactions** | Thumbs-down feedback button | Full emoji reaction picker (persisted) | More expressive; richer reflection data |
| **AI mode scope** | 4 modes only | 4 modes + 35 specialist agents | Expanded value across 9 life categories |
| **Safety filter** | Server-side | Client-side keyword filter | No server; equivalent protection |
| **Analytics** | PostHog + Sentry | None | Privacy-first; no telemetry |

### 7.4 Priority Order for Remaining Work

**High Priority (before launch):**
1. GAP-08 + GAP-09 — Decision persistence and history (high UX impact; core feature incomplete)
2. GAP-01 — Habit all-done AI celebration (closes the gamification loop)
3. GAP-11 — AsyncStorage at-rest encryption (privacy/security risk)

**Medium Priority (post-launch v1.1):**
4. GAP-07 — Decision clarity score
5. GAP-02 — Habit missed check-in nudge
6. GAP-12 — Accessibility audit

**Low Priority (backlog):**
7. GAP-04 — Weekly habit summary
8. GAP-05 — Journal calendar view
9. GAP-06 — Journal prompt swap
10. GAP-03 — AI habit suggestion
11. GAP-10 — Multi-provider BYOK
12. GAP-13 / GAP-14 — Auth / age gate

---

## 8. Testing Strategy

### 8.1 Testing Layers

| Layer | Type | Tools | Status |
|---|---|---|---|
| TypeScript compilation | Static type checking | tsc | ✅ Zero errors across all screens |
| Component logic | Unit tests | Jest (not yet configured) | ⚠️ Pending setup |
| AI safety red-team | Manual adversarial testing | Manual (5 inputs per category) | ⚠️ Pending formal run |
| Accessibility | WCAG 2.1 AA | React Native accessibility inspector | ⚠️ Pending audit |
| Performance | App launch + AI response timing | Manual / Expo profiler | ⚠️ Pending |
| Device testing | iOS + Android physical | Expo Go + EAS builds | Partial |

### 8.2 Core Test Flows

**Flow 1: First-run onboarding**
- Fresh install → SetupFlow appears
- Accept legal notice (region auto-detected)
- Select language → app locale switches immediately
- Select tone → persisted to AsyncStorage
- Select helpers → Home screen features selected helper
- Land on Home screen

**Flow 2: Complete a habit day**
- Open Habits → create a habit
- Tap to complete → XP +10, streak increments
- Return to Home → XP and streak reflect changes
- Activity heatmap shows today as active

**Flow 3: Chat with safety redirect**
- Select an agent from Agents screen
- Send normal message → response in user's language with human voice
- Type a crisis keyword → hardcoded safe response returned, Gemini API not called
- Type a medical keyword → doctor redirect returned

**Flow 4: Decision coaching**
- Navigate to Decide mode
- Enter decision + Option A + Option B → Analyse
- Structured AI output: reflection, Option A analysis, Option B analysis, open questions, closing sentence
- Visual pills rendered correctly (green/accent borders)

**Flow 5: Backup round-trip**
- Settings → Export Backup → JSON file shared to Files/Drive
- Fresh install → SetupFlow → Import Backup
- All conversations, habits, journal entries, XP, and settings restored

### 8.3 AI Safety Test Matrix

Each category: minimum 5 different phrasing variants. Must pass before launch.

| Category | Filter Layer | Prompt Layer | Status |
|---|---|---|---|
| Crisis / self-harm | ✅ 13 keywords | ✅ SAFETY_PREFIX | ⚠️ Needs formal 5-test run |
| Medical | ✅ 11 keywords | ✅ SAFETY_PREFIX | ⚠️ Needs formal 5-test run |
| Mental health treatment | None (prompt only) | ✅ SAFETY_PREFIX | ⚠️ Needs formal 5-test run |
| Legal advice | None (prompt only) | ✅ SAFETY_PREFIX | ⚠️ Needs formal 5-test run |
| Financial advice | None (prompt only) | ✅ SAFETY_PREFIX | ⚠️ Needs formal 5-test run |
| Political / religious | None (prompt only) | ✅ SAFETY_PREFIX | ⚠️ Needs formal 5-test run |
| Safeguarding | None (prompt only) | ✅ SAFETY_PREFIX | ⚠️ Needs formal 5-test run |

---

## 9. Launch Plan

### 9.1 Pre-Launch Checklist

- [ ] **GAP-08 / GAP-09 resolved** — decision persistence + history (high impact)
- [ ] **GAP-01 resolved** — habit completion AI celebration
- [ ] Full AI safety red-team run (35 tests: 5 per category, all pass)
- [ ] Device testing on iOS 16+ and Android 12+ physical devices
- [ ] App Store / Google Play metadata: screenshots, descriptions, keywords
- [ ] Privacy policy page live (linked from app legal notice)
- [ ] Terms of Service page live
- [ ] Gemini API key quota reviewed for expected launch volume
- [ ] Expo EAS production build configured and tested
- [ ] App icon, splash screen, and adaptive icon assets finalised

### 9.2 Launch Channels

- App Store (iOS) + Google Play (Android)
- Product Hunt submission (Tuesday for best traction)
- Personal LinkedIn post with demo video showing all 4 modes
- Reddit: r/selfimprovement, r/getmotivated, r/habits, r/productivity
- Twitter/X thread showcasing the agent library and safety approach

### 9.3 Post-Launch (Weeks 1–4)

- Monitor for crashes daily (test builds via Expo updates)
- Review flagged/unusual AI responses weekly
- Gather qualitative feedback from first 100 users personally
- Fix P0 bugs within 24h, P1 within 72h

### 9.4 Monetisation Roadmap

| Month | Action |
|---|---|
| Month 1–2 | Free only — establish retention and NPS baseline |
| Month 3 | Pro tier ($7.99/month): unlimited conversations, premium agents, weekly AI digest |
| Month 4 | Annual plan ($59.99/year = 2 months free) |
| Month 6 | B2B exploration: white-label for HR/wellness programmes |

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI gives unsafe response despite safety rules | Medium | High | Two-layer safety (keyword filter + system prompt); monthly safety audit |
| User misunderstands app as therapy | Medium | High | Legal consent at onboarding; "not a medical service" copy in notice |
| Decision data lost between sessions (GAP-08/09) | **High** | **High** | Top priority fix before launch |
| AsyncStorage data unencrypted (GAP-11) | High | Medium | Fix before launch on rooted/jailbroken devices |
| Gemini API latency degrades UX | Medium | Medium | Cooldown banner; loading states |
| Data loss on device wipe | Medium | High | Backup export feature; prompt users to export regularly |
| App Store rejection | Low | High | No controversial content; safety guardrails visible; legal notice at onboarding |
| Low retention after first session | Medium | High | Daily habit loop; streak system; notification reminders |
| GDPR/privacy complaint | Low | Medium | All data local; backup export; uninstall = full deletion |

---

## 11. Appendix

### Appendix A — AI System Prompt Structure

Built by `buildAgentSystemPrompt(agent, tone, language)` in `src/constants/agents.ts`:

```
[SAFETY_PREFIX]
IMPORTANT RULES — ALWAYS FOLLOW — NO EXCEPTIONS:
- Suicidal thoughts/self-harm/crisis → immediate crisis resources
  (988 US / 116 123 UK / Text HOME to 741741). Stop normal conversation.
- No medical diagnosis or treatment advice → redirect to doctor/pharmacist
- No mental health treatment → redirect to therapist/GP
- No legal advice → redirect to solicitor/Citizens Advice
- No financial advice → redirect to qualified financial adviser
- No political or religious opinions → neutral; redirect to user's own values
- Safeguarding (abuse/violence) → helpline numbers immediately; do not probe

[agent.systemPrompt]
<agent-specific persona, expertise, and tone>

[HUMAN_VOICE_SUFFIX]
- Never say you are an AI, language model, or assistant
- Never open with "Great question!", "Certainly!", "Of course!", "Absolutely!"
- Speak as a warm, grounded, direct friend — not a customer service bot
- Ask one question at a time; never a list of questions
- Reflect back what you hear before offering a perspective
- Keep responses concise — 2–4 sentences for most replies
- Plain language — no jargon, no clinical terms
- Respond in the user's language: {language}
- Match tone: {tone}
```

### Appendix B — Crisis Resources Reference

| Country | Service | Number | Method |
|---|---|---|---|
| United States | 988 Suicide & Crisis Lifeline | 988 | Call or text |
| United States | Crisis Text Line | Text HOME to 741741 | Text |
| United States | National DV Hotline | 1-800-799-7233 | Call |
| United Kingdom | Samaritans | 116 123 | Call (free, 24/7) |
| United Kingdom | Crisis Text Line | Text SHOUT to 85258 | Text |
| United Kingdom | National DA Helpline | 0808 2000 247 | Call (free) |
| Ireland | Samaritans | 116 123 | Call |
| Australia | Lifeline | 13 11 14 | Call |
| Canada | Crisis Services Canada | 1-833-456-4566 | Call |

### Appendix C — Glossary

| Term | Definition |
|---|---|
| BYOK | Bring Your Own Key — user supplies their own Gemini API key |
| expo-secure-store | Expo module using iOS Keychain / Android Keystore for encrypted secret storage |
| AsyncStorage | React Native local key-value store; JSON strings; unencrypted at rest |
| HUMAN_VOICE_SUFFIX | System prompt fragment that prevents AI self-identification and hollow phrasing |
| SAFETY_PREFIX | Hardcoded 7-rule block injected at the top of every agent system prompt |
| Agents / Helpers | The 35+ predefined AI personas covering life categories, plus user-created custom agents |
| ThemeContext | React context providing dark/light/system color tokens to all screens via `useTheme()` |
| XP | Experience points — gamification currency earned by completing habits and journal entries |
| Heatmap | 12-week activity calendar grid on the Home screen showing daily engagement |
| SetupFlow | 4-step first-run onboarding screen (legal → language → tone → helpers) |
| Region-aware legal | Legal notice text that adapts based on the user's detected region |
| GAP-xx | Identified gap between original requirements and current implementation (see Section 7.2) |
| DAU | Daily Active Users |

### Appendix D — Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | June 2026 | Initial complete draft — Next.js web app spec |
| 2.0 | May 2026 | Full rewrite to reflect Expo RN mobile implementation; Section 5 replaced with actual mobile architecture; 14 gaps identified and prioritised in Section 7; deliberate spec changes documented in Section 7.3 |

### Appendix E — Original Web Architecture (Not Implemented — Reference Only)

The v1.0 design targeted a Next.js web application. Key components:

| Component | Original Plan |
|---|---|
| Framework | Next.js 14 (App Router) + Tailwind CSS |
| Auth | Supabase Auth + Google OAuth |
| Database | Supabase PostgreSQL with Row Level Security |
| Hosting | Vercel edge functions |
| API key security | AES-256-GCM server-side encryption |
| Analytics | PostHog + Sentry |
| API routes | `/api/chat`, `/api/habits`, `/api/journal/prompt`, `/api/settings/apikey`, etc. |

This architecture was superseded by the privacy-first, fully-local mobile implementation. A future cross-device sync feature could revisit a lightweight backend (likely Supabase with encrypted payloads) to complement the mobile app without compromising the local-first privacy model.
