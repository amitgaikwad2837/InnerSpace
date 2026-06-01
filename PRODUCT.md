# InnerSpace — Product Overview

## Vision

InnerSpace is a personal growth companion that meets users where they are — whether they need to talk through a problem, build better habits, reflect on their day, or navigate a tough decision. Built with privacy-first principles, it provides intelligent support without requiring an account, an internet connection, or sacrificing personal data.

The core belief: **Personal growth should be private, accessible, and supportive.**

---

## What is InnerSpace?

InnerSpace is a mobile-first iOS and Android app powered by conversational AI. It helps users across four distinct modes of engagement:

### Core Modes

| Mode | Use Case | Key Features |
|------|----------|--------------|
| **Just Talk** | Daily conversations, advice-seeking, brainstorming | 35+ specialist helpers, conversation history, reactions, sharing |
| **My Habits** | Habit formation, streak tracking, progress visualization | Daily/weekly habits, XP rewards, streak counters, AI nudges |
| **Reflect** | Guided journaling, mood tracking, self-discovery | Rotating daily prompts, AI-generated insights, full journal history |
| **Decide** | Decision analysis, pro/con breakdown, clarity scoring | Two-option framework, structured analysis, decision history |

### What It Is NOT

- **Not medical care** — AI does not diagnose or prescribe; clear boundaries exist for health topics
- **Not therapy** — complements but does not replace professional mental health support
- **Not a data collector** — no tracking, analytics, or server-side profiling
- **Not always-online dependent** — core features work offline; local models available

---

## Target Users

**Primary:** Self-aware individuals aged 18–45 seeking growth without surveillance
- Early professionals navigating career transitions
- Remote workers managing work-life balance
- Lifelong learners exploring creativity and wellness
- People exploring mental health with privacy concerns

**Secondary:** Anyone looking for a non-judgmental sounding board
- Parents balancing multiple roles
- Entrepreneurs managing stress and decisions
- Wellness enthusiasts building sustainable habits

---

## Key Differentiators

### Privacy-First Architecture
- **All data stays on-device** — encrypted at rest with AES-256-GCM
- **No servers** — no backend infrastructure means nothing to breach, sell, or harvest
- **User controls API keys** — stored in hardware-backed secure enclave, never transmitted
- **Full data export** — users can export everything as JSON or delete it all with one tap
- **No tracking** — zero analytics, no session profiling, no advertising pipeline

### AI Flexibility
- **Multi-provider support** — Gemini (default), OpenAI, Claude, Groq — user's choice
- **Local models** — run Gemma, Phi, or Llama entirely on-device with no API key or internet
- **Custom helpers** — users create their own AI helpers and share via deep links
- **Safety always injected** — dual-layer safety filter (pre-send + post-response); no exceptions

### Accessibility & Localization
- **10 languages** — English, Spanish, French, German, Portuguese, Hindi, Japanese, Mandarin, Arabic, Italian
- **RTL support** — Arabic and other right-to-left languages fully supported
- **No account friction** — guest access; optional sign-in; no paywalls or feature gating
- **App lock** — PIN, biometric, or both for privacy-conscious users

### Personal Customization
- **Tone selection** — choose warm, direct, or playful AI voice
- **Helper marketplace** — 35+ pre-built helpers across 9 life categories; sort by favorite
- **Theme customization** — dark, light, or system-default UI theme
- **Mod ability** — full source code available for custom builds

---

## Feature Breakdown

### Chat & Helpers

**Specialist Helpers** — 35+ pre-built AI personalities across:
- Career & Learning (5 helpers)
- Health & Wellness (6 helpers)
- Relationships & Social (6 helpers)
- Creative & Hobbies (5 helpers)
- Personal Growth (4 helpers)
- Tech & Digital (2 helpers)
- Nature & Gardening (2 helpers)
- Home & Family (2 helpers)
- Pets & Animals (3 helpers)

**Custom Helpers** — Users can create their own AI helpers by:
1. Entering a name, emoji, and expertise description
2. Sharing via deep link (`innerspace://import-agent?data=<base64>`)
3. Recipients import with one tap

**Conversation Features**
- Multi-turn chat with full conversation history
- Auto-generated summaries after 3+ AI replies
- Thumbs-up/thumbs-down message reactions
- Long-press to share individual messages
- Quota cooldown messaging when API limits hit

### Habit Tracking

**Habit Management**
- Create daily or weekly habits
- Visual progress bars per habit
- Streak counters with achievement milestones
- XP rewards (+8 XP per completion, +5 XP for daily check-in)
- AI gentle nudges on missed days

**Habit History**
- Full historical data preserved
- Exportable habit data as JSON
- Streaks and XP tracked per habit lifetime

### Journal & Reflect

**Guided Journaling**
- Daily rotating prompts curated by AI
- Optional AI-generated insights based on entry content
- Mood selector (5 emoji scale) with each entry
- Full entry history with long-press delete
- Search and filter by date, mood, or keywords

**Weekly Digest**
- Local push notification every Sunday at 09:00
- Summarizes the week's conversations and journal themes
- No server required — scheduled locally

### Decision Support

**Structured Analysis**
- Two-option framework: "Option A vs Option B"
- Guided pro/con breakdown for each option
- Clarity score (0–100) based on analysis depth
- Decision history for past choices

**Export & Review**
- All decisions exportable as JSON
- Review past decisions and outcomes
- Learn from historical choice patterns

### Authentication & App Lock

**Login Options**
- Guest access (no account required)
- PIN-based app lock (4–6 digits)
- Biometric lock (Face ID / Touch ID)
- Combination (PIN + biometric)

**Session Management**
- Auto-lock on app backgrounding
- Persistent sessions across app restarts
- Clear session on sign-out

---

## User Data Model

### Stored Locally (AsyncStorage + SecureStore)

| Data | Storage | Encryption | Retention |
|------|---------|------------|-----------|
| User profile (name, age group) | AsyncStorage | Plaintext* | User manually deletes |
| Conversations | AsyncStorage | AES-256-GCM | User manually deletes |
| Habits + streaks | AsyncStorage | AES-256-GCM | User manually deletes |
| Journal entries + mood | AsyncStorage | AES-256-GCM | User manually deletes |
| Decisions | AsyncStorage | AES-256-GCM | User manually deletes |
| Custom helpers | AsyncStorage | Plaintext | User manually deletes |
| Theme & language preference | AsyncStorage | Plaintext | Persistent |
| API keys (Gemini, OpenAI, etc.) | SecureStore | Hardware-backed | User manually deletes |
| App PIN hash | SecureStore | Hardware-backed | User manually clears |

*Plaintext data is non-sensitive (preferences, theme). Sensitive data (journal, habits) is always encrypted.

### Never Collected
- Location data
- Device identifiers (IDFA, GAID, AAID)
- Contacts or phone numbers
- Browsing history
- Behavioral analytics
- Advertising identifiers

---

## Safety & Boundaries

### Dual-Layer Safety Filter

**Pre-send filter** — catches sensitive topics before they reach the AI
**Post-response filter** — validates AI output before showing to user

### Blocked Categories

1. **Crisis & Self-Harm** → Redirect to 988 (US), 116 123 (UK), 741741 (text HOME)
2. **Medical** → "See a doctor or pharmacist"
3. **Legal** → "See a solicitor or Citizens Advice"
4. **Financial** → "See a financial adviser"
5. **Abuse/Safeguarding** → Provide crisis resources
6. **Illegal Activities** → Decline engagement
7. **Deception** → "I can't help with that"

AI is never presented as human; limitations are always explicit.

---

## Technical Specifications

### Platform Support
- **iOS** — 13.4+
- **Android** — 6.0+ (API 23)
- **Web** — Limited (designed for mobile)

### Performance Requirements
- **Cold start** — <3 seconds to splash screen
- **Chat response** — <2 seconds average (depends on AI provider)
- **Local model inference** — <5 seconds on mid-range device

### Offline Capability
- Core UI fully functional offline
- Conversations cached locally; sync when connection returns
- Local models run without any internet
- Cloud AI providers require internet connection

---

## Monetization & Distribution

### Distribution
- Free on App Store (iOS)
- Free on Google Play (Android)
- No in-app purchases
- No premium tiers
- No ads

### Revenue Model
- **Open source** — users can fork, modify, and self-host
- **No revenue** — independent project by Amit Gaikwad
- **Maintenance** — funded by creator's time investment

---

## Roadmap & Future Priorities

### Q2 2026 (Current)
- ✅ Core 4 modes stable and tested
- ✅ 35+ helpers catalog live
- ✅ Privacy & encryption fully implemented
- ✅ 10-language i18n complete
- ⏳ App store submissions (iOS/Android)

### Q3 2026 (Planned)
- Community-contributed helpers
- Expanded local model support (Llama 2, Mistral)
- Habit reminders with custom schedules
- Export to calendar / habit stacking integrations

### Q4 2026+ (Roadmap)
- Web-based helper marketplace
- Collaborative helpers (shared with friends)
- Advanced analytics dashboard (on-device only)
- Voice input/output (speech-to-text, text-to-speech)
- Dark mode micro-animations

---

## Competitive Landscape

### vs. Traditional Journaling Apps
- AI-powered (not just note storage)
- Encrypted by default
- Multi-mode support

### vs. Therapy/Counseling
- Complements, never replaces
- Available 24/7
- No judgment; no licensing limits

### vs. Other AI Assistants
- Privacy-first (no data harvesting)
- Localized (no cloud dependency for core features)
- Customizable (users control tone, helpers, API keys)
- Safety-strict (clear boundaries on sensitive topics)

---

## Success Metrics

### User Engagement
- Daily active users (DAU)
- Average session length
- Feature adoption rate (% using each of 4 modes)
- Habit completion streaks

### Privacy & Trust
- User trust score (NPS)
- Data export requests / deletes (should be low)
- Privacy policy reads (measure via URL clicks)

### Technical Health
- Crash rate <0.5%
- AI response latency <2s (average)
- App cold start <3s
- Offline feature success rate >99%

### Community
- GitHub stars
- Contributor commits
- Custom helper shares (deep link imports)
- Localization contributions

---

## Contact & Support

- **GitHub Issues:** Report bugs or request features
- **Email:** amit.gaikwad37@gmail.com
- **Website:** https://amitgaikwad2837.github.io/InnerSpace/

---

**License:** MIT — Built by Amit Gaikwad
