# Contributing to InnerSpace

Thank you for your interest in contributing to InnerSpace! This document explains our contribution process, security policies, and guidelines.

## Overview

InnerSpace is a mobile-first AI personal growth companion. All contributions help make it better for users worldwide.

## Getting Started

1. **Fork the repository** on GitHub
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following our guidelines (see below)
4. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add daily check-in widget"
   ```
5. **Push to your fork** and **create a Pull Request**

## PR Process

### Before Creating a PR
- Ensure your code follows TypeScript/ESLint standards
- Test your changes on Android and iOS if UI-related
- Update docs/README if adding features
- Add comments for complex logic

### Creating a PR
1. Create a PR against the `main` branch
2. **Fill out the PR template completely** — it asks for:
   - PR type (Bug/Feature/Enhancement/etc)
   - Clear description of changes
   - Testing methodology
   - Security considerations
   - Any breaking changes
3. Reference any related issues: `Closes #123`

### PR Review & Merge
- ✅ Code owner (`@amitgaikwad2837`) review is **required**
- ✅ Stale reviews automatically dismissed on new commits
- ✅ All status checks must pass
- ✅ Agent catalog changes must pass validation
- ✅ Security files get extra scrutiny

**Note:** All PRs require owner approval before merge — this applies to everyone, including repo administrators.

## Restricted Files

The following files **can only be modified by the repository owner** (`@amitgaikwad2837`):

### GitHub & CI/CD
- `.github/` (workflows, templates, CODEOWNERS)
- `package.json` & `package-lock.json` (dependencies)
- `tsconfig.json` (TypeScript configuration)
- `.eslintrc.js` (linting rules)

### App Configuration
- `app.json` (Expo configuration)
- `app.config.js` (App config script)
- `eas.json` (EAS build config)

### Security & Core Logic
- `src/services/safety-filter.ts` (Safety rules)
- `src/services/agents-catalog.ts` (Agent verification)
- `src/services/app-lock.ts` (App security)
- `src/constants/agents.ts` (Agent definitions)
- `src/constants/legal-notice.ts` (Legal handling)
- `.github/agents.json` (Agents marketplace)

**Why?** These files affect security, dependencies, and core app behavior. Changes require careful review.

## What You CAN Contribute

✅ **Feature Implementation**
- New screens (Journal, Habits, etc)
- AI chat enhancements
- UI/UX improvements
- Performance optimizations

✅ **Bug Fixes**
- TypeScript errors
- Runtime crashes
- UI layout issues
- i18n translation corrections

✅ **Documentation**
- README improvements
- Code comments
- Guides and setup docs
- Translation additions

✅ **Non-Security Code Changes**
- React components
- Navigation flows
- Styling updates
- Utility functions

## Security & Safety Checks

All PRs are automatically validated:

### 1. **Agent Catalog Validation** (if `.github/agents.json` modified)
- ✅ Valid JSON structure
- ✅ All required fields present
- ✅ No duplicate agent IDs
- ✅ No safety bypass patterns (e.g., "ignore rules", "jailbreak", "DAN")
- ✅ Valid agent categories
- ✅ Expertise text 20–4000 characters
- **❌ Blocks merge if validation fails**

### 2. **Security Files Audit** (if security files modified)
- ⚠️ Extra warning comment posted
- 🏷️ Labeled `security` + `requires-review`
- 🔒 Requires owner approval

### 3. **Owner-Only Enforcement** (if restricted files touched)
- ❌ Rejects PR if non-owner tries to modify restricted files
- ✅ Only `@amitgaikwad2837` can update these

## Coding Guidelines

### TypeScript
- Use strict mode (`strict: true` in `tsconfig.json`)
- Add type annotations for function params & returns
- No `any` types unless absolutely necessary
- Use interfaces over type aliases when possible

### React Native
- Use functional components with hooks
- Keep components under 300 lines
- Extract reusable logic to services/hooks
- Use StyleSheet for performance

### Safety
- Never bypass the safety filter in `src/services/safety-filter.ts`
- Always validate user input
- No hardcoded API keys or secrets
- Use SecureStore for sensitive data

### Local AI Integrations (MediaPipe / Native)
- Keep JS routing and safety checks in `src/services/*`.
- Put native MediaPipe bridge code in a local Expo module (planned path: `modules/mediapipe-llm/`).
- Do not call native inference directly from screens; use service adapters.
- Preserve pre-send and post-response safety filtering for every provider.
- Keep provider fallback behavior unchanged for cloud mode.

### Naming
- Components: PascalCase (`HomeScreen.tsx`)
- Functions/variables: camelCase (`handleSave()`)
- Constants: UPPER_SNAKE_CASE (`STREAK_KEY`)
- Files: Match component/function name

### Commits
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- One logical change per commit
- Write clear, concise messages
- Reference issues when relevant

## Testing

Before submitting a PR:

1. **Manual Testing**
   ```bash
   npm run start
   # Test on Android emulator: npm run android
   # Test on iOS simulator: npm run ios
   ```

2. **Type Checking**
   ```bash
   npm run typecheck
   ```

3. **Linting**
   ```bash
   npm run lint
   ```

## Legal

By contributing to InnerSpace, you agree that your contributions will be licensed under the project's license.

## Questions?

- 📧 Open a GitHub Discussion
- 🐛 Report bugs as Issues
- 💬 Ask questions in PR comments

---

Thank you for making InnerSpace better! 🌱
