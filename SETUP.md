# InnerSpace — Developer Setup Guide

## Overview

This guide walks you through setting up a local development environment to build, test, and contribute to InnerSpace. The setup process takes ~30 minutes on a modern machine.

---

## Prerequisites

### Required

- **Node.js** 18+ (LTS recommended)
- **npm** 8+ (comes with Node.js)
- **Git** 2.0+
- **Expo CLI** (`npm install -g expo-cli`)

### For iOS Development (macOS only)
- **Xcode** 14+ (from Mac App Store or [developer.apple.com](https://developer.apple.com))
- **Xcode Command Line Tools** (`xcode-select --install`)
- **CocoaPods** (`sudo gem install cocoapods`)
- **iOS simulator** (comes with Xcode)

### For Android Development (Windows, macOS, Linux)
- **Android Studio** 4.2+ (from [developer.android.com](https://developer.android.com))
- **Android SDK** 23+ (installed via Android Studio)
- **Android emulator** (via Android Studio's AVD Manager)
- **JDK** 11+ (included with Android Studio)

### Optional
- **VSCode** with [React Native Tools](https://marketplace.visualstudio.com/items?itemName=msjsdiag.vscode-react-native) extension
- **Android Device** (any device with Android 6.0+)
- **iPhone/iPad** (any device with iOS 13.4+)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/amitgaikwad2837/InnerSpace.git
cd InnerSpace
```

---

## Step 2: Install Dependencies

```bash
npm install
```

This installs:
- React Native framework
- Expo SDK and tools
- TypeScript compiler
- UI libraries (React Navigation, Ionicons, etc.)
- State management (Zustand)
- Encryption (crypto-js, expo-secure-store)
- i18n (i18next, react-i18next)

**Expected output:**
```
added 1234 packages in 2m 45s
```

---

## Step 3: Verify Installation

```bash
npm run typecheck
```

This should output:
```
tsc 6.0.3
✓ No TypeScript errors
```

If you see errors, run `npm install` again or check Node version: `node --version` (should be 18+)

---

## Step 4: Set Up Your Preferred Platform

### Option A: Expo Go (Fastest — for quick testing)

Expo Go is a mobile app that lets you run InnerSpace without building the native app.

1. **Install Expo Go on your phone:**
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id1054637607)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the dev server:**
   ```bash
   npm run start
   ```

3. **Connect your phone:**
   - Phone and computer must be on the same WiFi
   - Scan the QR code with your phone's camera (iOS) or Expo Go app (Android)
   - App loads in 20–30 seconds

**Limitations:** Some native features (deep linking, app lock) may not work in Expo Go. Use native builds for full testing.

### Option B: iOS Simulator (macOS only)

```bash
npm run ios
```

This builds and launches the app in the Xcode simulator.

**First-time build:** ~5 minutes  
**Subsequent builds:** ~1 minute

**Simulator shortcuts:**
- `Cmd + D` — Open developer menu
- `Cmd + R` — Reload JS
- `Cmd + Shift + C` — Open console

### Option C: Android Emulator

1. **Create an emulator in Android Studio:**
   - Open Android Studio → Device Manager
   - Click "Create Device"
   - Select Pixel 5 (or any device)
   - Select Android 12 or higher
   - Click "Finish"

2. **Start the emulator:**
   - In Android Studio: Device Manager → Your Device → Play button
   - Or via CLI: `emulator -avd Pixel_5_API_31`

3. **Build and run:**
   ```bash
   npm run android
   ```

**First-time build:** ~8 minutes  
**Subsequent builds:** ~3 minutes

### Option D: Real Device (iOS or Android)

#### iOS (via Xcode)
1. Connect iPhone via USB
2. Trust the computer on your phone (pop-up on device)
3. In Xcode: Window → Devices and Simulators → Your Device
4. Run: `npm run ios -- --device`

#### Android (via ADB)
1. Connect Android phone via USB
2. Enable USB Debugging on phone: Settings → Developer Options → USB Debugging
3. Verify connection: `adb devices` (should list your device)
4. Run: `npm run android`

---

## Step 5: Understand the Project Structure

```
InnerSpace/
├── App.tsx                    # Root component — entry point
├── index.ts                   # Expo entry
├── app.json                   # Expo config (bundle ID, version, permissions)
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
│
├── src/
│   ├── screens/               # App screens (11 files)
│   │   ├── HomeScreen.tsx      # Hub — check-in, XP, streak
│   │   ├── ChatScreen.tsx      # AI conversation
│   │   ├── AgentsScreen.tsx    # Helpers marketplace
│   │   ├── JournalScreen.tsx   # Guided journaling
│   │   ├── HabitsScreen.tsx    # Habit tracking
│   │   ├── HistoryScreen.tsx   # Past conversations
│   │   ├── SettingsScreen.tsx  # Preferences, legal, credits
│   │   ├── SetupFlowScreen.tsx # First-run onboarding
│   │   ├── SignInScreen.tsx    # Login/guest access
│   │   ├── CreateAgentScreen.tsx # Custom helper builder
│   │   └── DecisionScreen.tsx  # Two-option analysis
│   │
│   ├── services/              # Business logic (9 files)
│   │   ├── gemini-service.ts   # AI provider calls
│   │   ├── storage-service.ts  # AsyncStorage wrapper
│   │   ├── storage-encryption.ts # AES-256-GCM
│   │   ├── app-lock.ts         # PIN & biometric
│   │   ├── safety-filter.ts    # Content moderation
│   │   ├── backup-service.ts   # Export/import
│   │   ├── agents-catalog.ts   # Helpers marketplace
│   │   ├── local-llm-service.ts # Local model inference
│   │   └── notifications.ts    # Push notifications
│   │
│   ├── context/               # Theme context (dark/light)
│   ├── store/                 # Zustand auth store
│   ├── i18n/                  # Localization (10 languages)
│   ├── constants/             # Config, legal keys
│   ├── types/                 # TypeScript interfaces
│   └── utils/                 # Helper functions
│
├── assets/                    # Icons, splash, app logo
├── docs/                      # Marketing website (HTML)
│   ├── index.html
│   ├── privacy.html
│   └── terms.html
│
├── android/                   # Android native code (auto-generated)
├── ios/                       # iOS native code (auto-generated)
│
└── .github/
    ├── agents.json            # Helpers marketplace catalog
    └── workflows/             # CI/CD pipeline
```

---

## Step 6: Key Development Workflows

### Running the App

```bash
# Start Metro bundler (shows QR code for Expo Go)
npm run start

# Run on iOS simulator (macOS)
npm run ios

# Run on Android emulator/device
npm run android

# Run in browser (limited — designed for mobile)
npm run web

# Run with a specific simulator
npm run ios -- --simulator="iPhone 14"

# Run on specific Android device
npm run android -- --device
```

### TypeScript Checking

```bash
# Type check without building
npm run typecheck

# Or let your IDE do it (VSCode, WebStorm, etc.)
```

### Making Changes

1. Edit a file (e.g., `src/screens/HomeScreen.tsx`)
2. Save the file
3. App hot-reloads automatically (Ctrl+S usually triggers it, or Cmd+R in simulator)
4. See changes instantly

### Debugging

**React Native Debugger** (recommended):
1. Install: https://github.com/jhen0409/react-native-debugger
2. Open RNDebugger on desktop
3. In simulator/emulator: Dev Menu (`Cmd+D` or `Ctrl+M`) → Enable Remote Debugging
4. Redux/Zustand state inspection available in RNDebugger

**Console Logs:**
```typescript
console.log('Debug:', myVar);
```
Visible in Metro console or React Native Debugger.

---

## Step 7: Build for Production

### iOS (requires Apple Developer account — $99/year)

```bash
# Generate a production build
eas build --platform ios --auto-submit

# Or build locally (requires Mac + Xcode)
cd ios
pod install
cd ..
xcodebuild -workspace ios/InnerSpace.xcworkspace -scheme InnerSpace -configuration Release
```

### Android

```bash
# Generate a production APK/AAB
eas build --platform android

# Or build locally
cd android
./gradlew assembleRelease
cd ..
```

---

## Step 8: Configure AI Providers (Optional)

To test AI features, you'll need API keys. Get them from:

- **Google Gemini:** https://makersuite.google.com/app/apikeys
- **OpenAI:** https://platform.openai.com/account/api-keys
- **Anthropic Claude:** https://console.anthropic.com/account/keys
- **Groq:** https://console.groq.com

**Add keys in the app:**
1. Launch app
2. Go to Settings → AI Providers
3. Paste your API key
4. Key is stored securely (never logged or transmitted)

**For local testing only**, you can add a test key in `src/constants/gemini-config.ts`:
```typescript
const TEST_API_KEY = 'your-test-key-here';
```

⚠️ **Never commit API keys to git.** They should only be added via the Settings screen.

---

## Step 9: Localization Testing

To test the app in a different language:

1. Go to Settings → Language
2. Select language (10 options available)
3. App switches language instantly

**To add a new language:**
1. Create new file: `src/i18n/locales/xx.ts` (where `xx` is the language code)
2. Copy English structure from `src/i18n/locales/en.ts`
3. Translate all values
4. Register in `src/i18n/index.ts`

---

## Troubleshooting

### "Command not found: expo"
```bash
npm install -g expo-cli
expo --version  # Should print a version number
```

### "Metro bundler won't start"
```bash
# Kill existing processes
pkill -f "react-native-cli"
pkill -f "metro"

# Clear cache and restart
npm run start -- --reset-cache
```

### iOS simulator won't launch
```bash
# Reset Xcode simulator
xcrun simctl erase all

# Or launch a specific simulator manually
xcrun simctl list devices
xcrun simctl boot <device-uuid>
open -a Simulator
```

### Android emulator crashes
```bash
# Check available emulators
emulator -list-avds

# Launch with more memory
emulator -avd Pixel_5 -memory 2048

# Or create a new one in Android Studio: Device Manager
```

### TypeScript errors in VS Code
- Click VS Code status bar → TypeScript version → Use Workspace Version
- Or run: `npm run typecheck` to see all errors

### App crashes on startup
```bash
# Clear app cache and reinstall
npm run start -- --reset-cache

# iOS simulator: Cmd+D → Reset
# Android: Logcat shows crash details
```

### Deep link not working
- Make sure you're testing on a real device or simulator with deep link support
- Deep links don't work in Expo Go; use a native build
- Test: `xcrun simctl openurl booted innerspace://import-agent?data=...`

---

## Best Practices

### Code Style
- Use TypeScript (no `any` unless justified)
- Follow ESLint rules (run `npm run lint` if available)
- Use functional components with hooks, not class components
- Use named imports over default imports

### Commits
```bash
# Good commit messages
git commit -m "feat: add decision analysis scoring"
git commit -m "fix: prevent deep link DoS with payload size limit"
git commit -m "chore: update i18n keys for accessibility"

# Bad commit messages
git commit -m "updates"
git commit -m "fix stuff"
```

### Testing Changes
Before pushing, test on:
- [ ] iOS simulator (or real device)
- [ ] Android emulator (or real device)
- [ ] Dark and light themes
- [ ] Your language(s) if multilingual testing
- [ ] With and without API keys (fallback to offline mode)

### Debugging i18n Issues
```typescript
import i18n from '../i18n';

// Check available keys
console.log(i18n.language);  // Current language
console.log(i18n.t('screens.home.title'));  // Translate key

// Change language programmatically
i18n.changeLanguage('es');
```

---

## Next Steps

1. **Read the architecture docs:** [ARCHITECTURE.md](ARCHITECTURE.md)
2. **Review the product spec:** [PRODUCT.md](PRODUCT.md)
3. **Check GitHub standards:** [GITHUB_STANDARDS.md](GITHUB_STANDARDS.md)
4. **Pick a task:** https://github.com/amitgaikwad2837/InnerSpace/issues

---

## Getting Help

- **GitHub Issues:** Report bugs or ask questions
- **Discussions:** Ask for setup help
- **Email:** amit.gaikwad37@gmail.com

---

**Document Version:** 1.0  
**Last Updated:** June 2026  
**Author:** Amit Gaikwad
