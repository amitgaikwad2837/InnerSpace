# InnerSpace — GitHub Standards & Contribution Guidelines

## Overview

This document outlines the standards for contributions, pull requests, code style, and project governance for InnerSpace. All contributors must follow these guidelines.

---

## Governance Model

### Repository Owner
- **Owner:** [@amitgaikwad2837](https://github.com/amitgaikwad2837)
- **Approval required:** YES — all PRs require owner approval before merge
- **This applies to everyone, including repository administrators**

### Contributors
- **Anyone** with a GitHub account can fork, modify, and submit PRs
- **Respectful collaboration** is expected and required
- **Open communication** — ask questions before large features

---

## Pull Request Process

### Before You Start

1. **Check existing issues** — ensure the feature/bug isn't already being worked on
2. **Open an issue first** for anything substantial (features, large refactors)
3. **Fork the repository** and create a feature branch
4. **Read this document** in full

### Creating a PR

1. **Branch naming:**
   ```bash
   # Feature
   git checkout -b feature/add-voice-input

   # Bug fix
   git checkout -b fix/crash-on-habit-delete

   # Chore
   git checkout -b chore/update-dependencies
   ```

2. **Commit messages:**
   ```bash
   # Format: type: description (imperative mood, lowercase)
   git commit -m "feat: add voice input for chat messages"
   git commit -m "fix: prevent memory leak in ChatScreen"
   git commit -m "docs: update SETUP.md with troubleshooting"
   git commit -m "test: add unit tests for safety filter"
   ```

   **Valid types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

3. **Fill out the PR template completely:**
   ```markdown
   ## What does this PR do?
   Brief description of changes.

   ## Type of change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   - [ ] Performance improvement

   ## Testing
   How did you test this? Include steps to reproduce.

   ## Security & Privacy Impact
   Any changes to data handling, encryption, or privacy?

   ## Checklist
   - [ ] Code follows project style guide
   - [ ] TypeScript compiles without errors
   - [ ] Tested on iOS simulator
   - [ ] Tested on Android emulator
   - [ ] No console errors or warnings
   ```

4. **Push your branch:**
   ```bash
   git push origin feature/add-voice-input
   ```

5. **Create the PR on GitHub:**
   - Title: `feat: add voice input for chat messages`
   - Description: fill template completely
   - Link related issues: `Closes #123`

### PR Review & Merge

**Status checks that must pass:**
- ✅ TypeScript compilation (`typecheck.yml`)
- ✅ Security scanning (`security-check.yml`)
- ✅ Agent catalog validation (`validate-agents.yml`)
- ✅ All GitHub branch protections

**Review process:**
1. Repository owner reviews all PRs
2. May request changes, ask questions, or suggest improvements
3. Once approved, owner merges to `main`
4. Stale reviews are automatically dismissed if you push new commits

**Merge strategy:** Squash & merge (keeps history clean)

---

## Restricted Files & Permissions

### Owner-Only Files
**Only [@amitgaikwad2837](https://github.com/amitgaikwad2837) can modify these:**

#### GitHub & CI/CD
- `.github/workflows/` — All workflow files
- `.github/CODEOWNERS` — Ownership file
- `.github/pull_request_template.md` — PR template
- `.github/agents.json` — Helpers catalog (anyone can request additions via issue)

#### Build & Config
- `package.json` — Dependencies
- `package-lock.json` — Lock file
- `tsconfig.json` — TypeScript config
- `.eslintrc.js` — Linting rules (if exists)
- `app.json` — Expo config (bundle ID, version)

#### Core Application Config
- `App.tsx` — Root app component (critical changes only; can suggest improvements)
- `.gitignore` — Repository ignore patterns

#### Website & Legal
- `docs/` — Marketing website files
- `LICENSE` — License file
- `PRODUCT.md` — Product spec
- `ARCHITECTURE.md` — Architecture doc
- `SETUP.md` — Developer setup guide
- `GITHUB_STANDARDS.md` — This file

### Why These Restrictions?

These files are either:
1. **Critical to build/deploy** (changing them could break CI/CD for everyone)
2. **Version/dependency management** (inconsistencies cause conflicts)
3. **Documentation of record** (should reflect owner's intent)
4. **Legal/governance** (only owner can commit on behalf of project)

### What You CAN Modify

✅ **Everything else:**
- Any `.tsx` or `.ts` file in `src/screens/`, `src/services/`, `src/i18n/`, etc.
- Test files
- README.md (clarifications, fixing typos)
- CONTRIBUTING.md (suggestions for contributor guidelines)
- Localization files (`src/i18n/locales/*.ts`)

---

## Code Style & Standards

### TypeScript

**General:**
- Use TypeScript everywhere; avoid `any` unless absolutely necessary
- Use strict mode in `tsconfig.json`
- No `console.log` in production code (use logging service if available)
- Imports: use named imports over default imports

```typescript
// ✅ Good
import { useState } from 'react';
import { useTheme } from './context/ThemeContext';

// ❌ Bad
import React from 'react';
import * as Navigation from '@react-navigation/native';
```

**Comments:**
- Comment "why", not "what"
- Use TSDoc for exported functions

```typescript
// ✅ Good
// Retry up to 3 times because Gemini API can be flaky on first attempt
async function callGeminiWithRetry(prompt: string) { ... }

// ❌ Bad
// Call Gemini API
async function callGeminiWithRetry(prompt: string) { ... }
```

**Naming:**
- camelCase for variables and functions
- PascalCase for components and types
- SCREAMING_SNAKE_CASE for constants

```typescript
// ✅ Good
const MAX_RETRY_ATTEMPTS = 3;
interface UserProfile { ... }
const HomeScreen: React.FC = () => { ... };
const isValidEmail = (email: string) => { ... };

// ❌ Bad
const maxRetryAttempts = 3;
const user_profile = { ... };
const homescreen = () => { ... };
```

### React Native Components

**Use functional components & hooks:**
```typescript
// ✅ Good
const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const { colors } = useTheme();

  return <FlatList data={messages} ... />;
};

// ❌ Bad
class ChatScreen extends React.Component { ... }
```

**Props typing:**
```typescript
// ✅ Good
interface ChatScreenProps {
  agentId: string;
  onClose: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ agentId, onClose }) => { ... };

// ❌ Bad
const ChatScreen = (props: any) => { ... };
```

### File Organization

**Screens:** One file per screen
```
src/screens/ChatScreen.tsx
src/screens/HomeScreen.tsx
```

**Services:** One concern per file (but related utilities together)
```
src/services/gemini-service.ts       // AI calls
src/services/storage-service.ts      // Data storage
src/services/safety-filter.ts        // Content moderation
```

**Constants:** Group by feature
```
src/constants/agents.ts              // Helpers catalog URLs
src/constants/gemini-config.ts       // Gemini API settings
src/constants/legal-notice.ts        // Legal version keys
```

### Imports & Exports

**Order imports logically:**
```typescript
// 1. React & React Native
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 2. Navigation
import { useNavigation } from '@react-navigation/native';

// 3. Third-party libraries
import i18n from 'i18next';
import Zustand from 'zustand';

// 4. Local imports
import { useTheme } from '../context/ThemeContext';
import { checkSafety } from '../services/safety-filter';
import { STORAGE_KEYS } from '../constants/storage';
```

**Use named exports for utilities, default exports for screens:**
```typescript
// ✅ services/storage-service.ts
export async function saveUser(user: User) { ... }
export async function getUser() { ... }

// ✅ screens/ChatScreen.tsx
export default ChatScreen;
```

### Performance

- Use `React.memo` for list items that don't change often
- Memoize callbacks with `useCallback` in complex components
- Lazy-load heavy data (paginate conversations, habits)
- Avoid inline function definitions in render

```typescript
// ✅ Good
const handlePress = useCallback(() => {
  onNavigate('Chat');
}, [onNavigate]);

// ❌ Bad
<Button onPress={() => onNavigate('Chat')} />
```

### Error Handling

- Never silently catch errors; at least log them
- User-friendly error messages; technical errors in console
- Graceful fallbacks (offline mode, API timeout, etc.)

```typescript
// ✅ Good
try {
  const response = await callGemini(message);
  return response;
} catch (error) {
  console.error('Gemini API failed:', error);
  return { text: 'I had trouble responding. Please try again.' };
}

// ❌ Bad
try {
  const response = await callGemini(message);
  return response;
} catch (error) {
  // silently ignore
}
```

### Localization

Always use i18n keys; never hardcode English strings:

```typescript
// ✅ Good
import { useTranslation } from 'react-i18next';
const ChatScreen = () => {
  const { t } = useTranslation();
  return <Text>{t('screens.chat.title')}</Text>;
};

// ❌ Bad
<Text>Chat with {agentName}</Text>
```

### Privacy & Security

**API Keys:**
- Never log API keys, even partially
- Store in SecureStore, not AsyncStorage
- Never commit keys to git

**User Data:**
- Encrypt sensitive data (journal, habits, decisions)
- Handle with care; test edge cases
- Respect the "no tracking" principle

**Validation:**
- Validate user input before sending to AI
- Sanitize deep link payloads
- Set payload size limits (e.g., 65KB max)

---

## Testing Requirements

### Before Pushing

**Minimum checklist:**
- [ ] Code compiles with `npm run typecheck`
- [ ] No console errors (check Metro/Xcode logs)
- [ ] Tested on iOS simulator
- [ ] Tested on Android emulator
- [ ] Feature works in dark theme
- [ ] Feature works in light theme
- [ ] Localization strings all present (no `missing translation` warnings)

### For UI Changes
- [ ] Looks good on small phone (iPhone 12 mini or similar)
- [ ] Looks good on large phone (iPhone 14 Pro Max or similar)
- [ ] Looks good on tablet (if applicable)
- [ ] Tested in dark mode
- [ ] Tested in light mode

### For Data Changes
- [ ] Encryption/decryption works if applicable
- [ ] Data persists after app close/reopen
- [ ] Data exports correctly as JSON
- [ ] Data deletes correctly

### For AI/Safety Changes
- [ ] Safety filter catches intended categories
- [ ] Safety filter doesn't over-block legitimate messages
- [ ] API quota handling works (show cooldown message)
- [ ] Offline mode shows appropriate fallback

---

## Documentation Requirements

### Code Comments
- Explain "why" for non-obvious code
- TSDoc for exported functions and types
- No overcomment obvious logic

### Commit Messages
- Imperative mood: "Add X", not "Added X"
- Reference issues: `Closes #123`
- Keep first line <50 characters

### PR Descriptions
- Clear description of changes
- Link related issues
- Include testing steps
- Mention any breaking changes

### New Features
- Update relevant doc files (ARCHITECTURE.md, PRODUCT.md, etc.)
- Add i18n strings for all user-facing text
- Add comments explaining complex logic

---

## What Will Be Rejected

### ❌ Common Rejection Reasons

1. **TypeScript errors** — code must compile
2. **No description** — explain your changes
3. **Untested** — must test on both platforms
4. **Hardcoded strings** — use i18n
5. **API keys committed** — NEVER commit secrets
6. **Breaking changes without discussion** — open an issue first
7. **Large PRs with no clear scope** — keep PRs focused
8. **Low-quality commits** — squash fixups before pushing

---

## Feature Request & Bug Report Guidelines

### Reporting a Bug

**Title:** Clear, specific
```
❌ "Chat broken"
✅ "ChatScreen crashes when sending message with emoji in Android 7"
```

**Description:**
1. What did you do?
2. What happened?
3. What should have happened?
4. Device/OS/app version
5. Reproducible every time?

### Requesting a Feature

**Title:** Clear, specific
```
❌ "Add more helpers"
✅ "Request: Add financial planning helper to career category"
```

**Description:**
1. Why do you need this?
2. How should it work?
3. Who else might benefit?

---

## Communication & Conduct

### Expected Behavior
- ✅ Respectful, inclusive language
- ✅ Patience with new contributors
- ✅ Constructive feedback on PRs
- ✅ Assume good intent
- ✅ Ask questions before assuming

### Unacceptable Behavior
- ❌ Harassment, discrimination, or abuse
- ❌ Spam or irrelevant comments
- ❌ Trolling or bad-faith engagement
- ❌ Sharing private information without consent

**Violation consequences:**
1. Warning + comment removed
2. Temporary issue/PR lock
3. Permanent ban from repository

### Reporting Misconduct
- Email: amit.gaikwad37@gmail.com
- GitHub will also handle abuse reports directly

---

## License & Attribution

- **License:** MIT
- **Contributing to this repo:** You agree that your contributions are licensed under MIT
- **Attribution:** You'll be acknowledged in commit history and CONTRIBUTORS.md (if maintained)

---

## Resources

- **Code of Conduct:** Standard open-source conduct (respectful, inclusive, no harassment)
- **Setup Guide:** [SETUP.md](SETUP.md)
- **Product Spec:** [PRODUCT.md](PRODUCT.md)
- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Main README:** [README.md](README.md)
- **Contributing Guide:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Questions?

- **GitHub Issues/Discussions:** Ask publicly (help others learning too)
- **Email:** amit.gaikwad37@gmail.com for private matters
- **React Native:** https://reactnative.dev
- **Expo Docs:** https://docs.expo.dev

---

**Document Version:** 1.0  
**Last Updated:** June 2026  
**Author:** Amit Gaikwad  
**Maintainer:** [@amitgaikwad2837](https://github.com/amitgaikwad2837)
