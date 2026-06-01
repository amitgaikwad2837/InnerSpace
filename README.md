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

## Contributing

1. Create a branch
2. Make focused changes
3. Run checks and test flows
4. Open a pull request

## License

See LICENSE.
