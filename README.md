# InnerSpace

InnerSpace is a mobile-first AI personal growth companion built with Expo React Native.

It helps users:
- Build habits
- Reflect with guided prompts
- Work through decisions
- Talk with supportive AI helpers

## Current Product Direction

- Guest-first: no mandatory app login
- First-run setup flow with:
  - Legal acceptance
  - AI tool setup
  - Language selection
  - Tone selection
  - Helper selection
- App lock support:
  - PIN
  - Biometric (face/fingerprint)
  - Both
- Localization support across 10 languages
- Safety-first behavior with strict guardrails

## Feature Highlights

### AI & Chat
- **Helpers Marketplace** — 33 categorised AI helpers pulled from a GitHub-hosted JSON catalog; no rebuild needed to add helpers
- **Custom Helpers** — users can create their own helpers; safety rules are always injected client-side
- **Share Custom Helpers** — share a helper via a deep link (`innerspace://import-agent?data=...`); recipients can import with one tap
- **Conversation Summaries** — after 3+ AI replies, a summary is generated automatically and shown in the History screen
- **Message Reactions** — thumbs-up / thumbs-down reactions on AI messages stored per conversation
- **Share Message Snippet** — long-press any message to share the text via the OS share sheet
- **Offline Fallback Prompts** — when no AI key is configured, the app shows reflection prompts from the current helper
- **Quota Cooldown Message** — if the AI quota is exhausted, chat shows a friendly cooldown message with expected return time
- **Helper Ready Notification** — on quota cooldown, the app can schedule a local notification when the helper is expected back

### Personal Growth
- **Daily Check-in** — mood selector (5 emoji) + rotating daily reflection question on the Home screen; awards +5 XP and skips for the rest of the day once completed
- **Journal / Reflect Mode** — guided daily prompts with optional AI-generated insight; full entry history with long-press delete
- **Habit Tracker** — add daily or weekly habits; track streaks per habit; progress bar; awards +8 XP on completion
- **XP & Streak** — persistent experience points and daily chat streak stored in AsyncStorage

### Customisation
- **Dark / Light / System Theme** — toggle in Settings; persisted across sessions
- **Pinned Helpers** — heart-icon pin in the Helpers screen; pinned helpers always sort to the top
- **Tone Selection** — Warm, Direct, or Playful AI response tone

### Notifications & Background
- **Weekly Digest Notification** — local push notification every Sunday at 09:00 summarising the week's conversations; uses `expo-notifications` (no server required)

### App Growth
- **Rate InnerSpace** — quick action in Settings to open the app rating page
- **Share InnerSpace** — native share sheet in Settings to share the app link
- **Backup Import** — import an exported backup JSON from Files/Drive in Settings or onboarding

## Tech Stack

- Expo SDK 56
- React Native 0.85
- TypeScript
- React Navigation
- Zustand
- AsyncStorage + SecureStore
- i18next + react-i18next

## Getting Started

### 1. Install dependencies

npm install

### 2. Run the app

npm run start

Then launch on:
- Android emulator/device
- iOS simulator/device (macOS)
- Expo Go

### 3. Platform shortcuts

- npm run android
- npm run ios
- npm run web

## Project Structure

- App entry and navigation: App.tsx
- Screens: src/screens/
- Services: src/services/
- i18n files: src/i18n/locales/
- Legal and region logic: src/constants/legal-notice.ts
- Product docs: docs/

## Helpers Marketplace Catalog (Repo-Pulled)

The helpers marketplace is driven by a JSON catalog file in the repository.
This means you can add, remove, or edit helpers without rebuilding the app.

- Catalog source: .github/agents.json
- Config URL: app.json -> expo.extra.agentsCatalogUrl
- Runtime behavior:
  - On startup the app checks AsyncStorage for a cached catalog (24-hour TTL)
  - If cache is fresh it is used immediately and a background refresh runs
  - If cache is stale or absent the app fetches the catalog from the repo
  - If the fetch fails the app falls back to the bundled helpers list

### Adding a New Helper

Add an object to the `agents` array in .github/agents.json:

```json
{
  "id": "my_helper",
  "name": "My Helper",
  "nameKey": "agent.my_helper.name",
  "descriptionKey": "agent.my_helper.desc",
  "category": "personal_growth",
  "emoji": "🌟",
  "expertise": "You are My Helper. Describe what this helper does and how it behaves.",
  "suggestedQuestions": [
    "First suggested question?",
    "Second suggested question?"
  ],
  "isCustom": false,
  "isPremium": false
}
```

Valid categories: `home_family`, `nature_garden`, `health_wellness`, `career_learning`,
`creative_hobbies`, `tech_digital`, `pets_animals`, `travel_culture`, `personal_growth`.

Safety rules are always injected client-side and cannot be bypassed via the catalog JSON.

## Legal Notice From Markdown (Repo-Pulled)

The app supports loading legal notice content from a Markdown file in the repository.

- Markdown source: docs/legal-notice.md
- Config URL: app.json -> expo.extra.legalNoticeMarkdownUrl
- Runtime behavior:
  - App tries to fetch legal Markdown from the configured URL
  - If fetch fails, app falls back to local in-app legal text

### Placeholders Supported In Markdown

- {{LEGAL_ACK_VERSION}}
- {{REGION_LABEL}}
- {{REGION_CODE}}

## Localization

Supported locales:
- en
- es
- fr
- de
- pt
- hi
- zh
- ja
- ar
- it

Translation files are in src/i18n/locales/.

## Safety Notes

InnerSpace is not a medical, legal, financial, or crisis service.

The app includes safety filtering and redirects users to professional support for sensitive categories.

## Documentation

- Full scope: docs/InnerSpace_Complete_Project_Scope.md
- Legal notice markdown: docs/legal-notice.md
- Helpers marketplace catalog: .github/agents.json
- Verification rules: src/services/agents-catalog.ts

## Contributing

1. Create a branch
2. Make focused changes
3. Run checks and test flows
4. Open a pull request

## License

See LICENSE.
