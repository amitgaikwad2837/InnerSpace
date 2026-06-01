# Setup and Recovery Runbook

> **Status: Archived — Web Era**
> This runbook was written for the abandoned Next.js/Supabase web pivot.
> For the current Expo React Native app, use: `npm install` → `npm run start`.
> See docs/Mobile_Checkpoint_2026-05-31.md for the current recovery procedure.

## Purpose
This runbook ensures development can resume quickly after interruptions, failed commands, or environment issues.

## Baseline Commands
Run from repository root.

```powershell
npx create-next-app@latest . --typescript --tailwind --eslint --app --use-npm --yes --no-src-dir --import-alias "@/*"
```

If the command fails due to a non-empty directory conflict, use:

```powershell
npx create-next-app@latest web --typescript --tailwind --eslint --app --use-npm --yes --no-src-dir --import-alias "@/*"
```

Then move project files to root once verified.

## Recovery Steps After Failure
1. Capture terminal error output and timestamp in docs/Execution_Checkpoints.md.
2. Run a minimal diagnostics pass:
   - node -v
   - npm -v
   - npx --version
3. Verify repository state:
   - git status
   - git branch --show-current
4. Retry the failed command once with explicit flags.
5. If retry fails, use fallback approach (scaffold in temporary subfolder, then migrate).

## Continuation Protocol
After every major milestone:
1. Update docs/Execution_Checkpoints.md.
2. Update repository memory note.
3. Commit checkpoint changes with message format:
   - checkpoint: phase-X milestone-Y

## Minimum Milestone Definition
A milestone is complete only if:
- Code compiles.
- Lint passes.
- Tests pass for changed scope.
- Relevant documentation and checkpoint file are updated.

## Standard Validation Commands
```powershell
npm run lint
npm run typecheck
npm run test
```

## Incident Notes
- If package install/network issue blocks progress, document exact error and switch to retry strategy with npm cache clean.
- Never proceed to next phase without updating checkpoint artifacts.
