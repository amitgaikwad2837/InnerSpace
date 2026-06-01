# InnerSpace Implementation Blueprint

Version: 1.0  
Date: 2026-05-31

## 1. Scope Analysis Summary

### 1.1 What is fully specified
- Product vision, personas, and mode-based UX are clear.
- Functional requirements are comprehensive across auth, onboarding, 4 modes, settings, and account lifecycle.
- Safety strategy is strong and multi-layered (UI + prompt + server filter).
- Baseline architecture and stack choices are coherent for low-cost launch.
- Data model is detailed enough to begin migrations immediately.

### 1.2 Gaps to resolve before implementation lock
- Contradiction: executive summary targets 4-week MVP, phase plan describes 13-week launch.
- No explicit premium gating logic despite monetization roadmap.
- No concrete retry/fallback behavior for AI provider outages.
- Data retention policy and deletion SLA exist, but no technical deletion workflow details (jobs, audit logs).
- Notification preference is required, but push/email transport is not selected.
- No explicit API contract format (request/response schemas, error codes).

### 1.3 Delivery decision
- Build in one continuous flow with two milestones:
  - Milestone A (MVP in 4 weeks): Auth, onboarding, Just Talk, Habits core, Safety stack, basic settings.
  - Milestone B (Full v1 by week 12): Reflect, Decide, BYOK multi-provider, export/delete hardening, launch polish.

## 2. Build Strategy (How we deliver in one go)

### 2.1 Vertical slice approach
Each slice ships end-to-end (UI + API + DB + tests + analytics + safety) before moving on:
1. Platform slice: auth, profile, layout, safety link, DB/RLS.
2. Conversation slice: chat API, streaming UI, memory context, summaries.
3. Habit slice: CRUD + completion + XP/levels + weekly summaries.
4. Reflection slice: prompt generation + entry + insight + calendar history.
5. Decision slice: 5-step framework + save/resume + clarity scoring.
6. Settings slice: provider selection + encrypted BYOK + export/delete.

### 2.2 Non-negotiable engineering constraints
- Server-side AI proxy only. Never expose provider keys in browser.
- Safety filter runs before model invocation for every AI request.
- RLS enabled on every user-data table before feature UI is considered done.
- Observability baseline from day 1: Sentry, structured API logs, PostHog events.
- Every feature includes accessibility checks and mobile responsiveness checks.

## 3. Repository Implementation Plan

## Phase 0: Project bootstrap (Day 1-2)
Deliverables:
- Next.js 14 app initialized with App Router and Tailwind.
- Supabase connected (Auth + DB + local SQL migrations).
- Environment variable management for dev/stage/prod.
- CI pipeline for lint, typecheck, tests.
- Sentry + PostHog base wiring.

Tasks:
- Set up folder architecture:
  - app/(auth), app/(app), app/api
  - components, lib, services, hooks, types
  - supabase/migrations, tests/unit, tests/integration, tests/e2e
- Add shared config:
  - ESLint, Prettier, strict TypeScript, path aliases.
- Add core libraries:
  - @supabase/supabase-js
  - zod
  - react-hook-form
  - date-fns
  - @sentry/nextjs
  - posthog-js + posthog-node

Exit criteria:
- CI green on main.
- Local dev and preview deploy working.

## Phase 1: Auth + onboarding + shell (Day 3-6)
Deliverables:
- Google OAuth sign-in, disclaimer acknowledgment, age gate, onboarding questions.
- Home screen shell with 4 mode cards and crisis resources component.

Tasks:
- Implement protected route middleware.
- Create tables: users, user_profiles.
- Persist onboarding answers and inject into profile.
- Add settings shell with profile edit baseline.
- Add account deletion entry point (actual deletion job in later phase).

Exit criteria:
- New user can sign in, pass gate/disclaimer, complete onboarding, land on home.

## Phase 2: Safety + chat core (Day 7-12)
Deliverables:
- Unified /api/chat endpoint.
- Keyword safety filter (crisis and redirect categories).
- Streamed chat responses in Just Talk mode.
- Conversation + messages persistence and summaries.

Tasks:
- Build system prompt composer with profile and last 10 check-ins.
- Implement provider adapter interface (Gemini first).
- Add thumbs-down feedback capture event.
- Add history screen showing conversation summaries.

Exit criteria:
- 95% normal responses start in under 3s in staging.
- Safety redirect/care behavior passes first red-team set.

## Phase 3: Habits + XP loop (Day 13-18)
Deliverables:
- Habit CRUD (max 10), one-tap completion, streaks, XP/level progress.
- AI celebration on all habits complete.
- Gentle check-in if missed 3 consecutive days.
- Monday weekly summary generation.

Tasks:
- Tables: habits, habit_completions.
- XP engine with deterministic calculation and idempotent awarding.
- Home widgets: streak, XP bar, weekly progress.
- Add summary generator job triggered weekly.

Exit criteria:
- Habit completion is reliable and duplicate-safe.
- XP and streak math validated with tests.

## Phase 4: Reflect mode (Day 19-22)
Deliverables:
- Context-aware prompt generation with regenerate limit (max 3).
- Journal editor + submit + AI insight generation.
- Journal history calendar + entry deletion.

Tasks:
- Table: journal_entries.
- Prompt and insight APIs with safety guardrails.
- Calendar view with date grouping and empty states.

Exit criteria:
- User can create, view, and delete journal entries with insights.

## Phase 5: Decide mode (Day 23-26)
Deliverables:
- 5-step decision framework experience.
- Save, resume, archive decisions with clarity score.

Tasks:
- Extend conversations metadata for decision progression.
- State machine for step progression and prompt framing.
- Archive and resume UI flows.

Exit criteria:
- Full decision journey works across sessions.

## Phase 6: BYOK + account operations + hardening (Day 27-32)
Deliverables:
- Provider switcher (Gemini/OpenAI/Claude/Groq).
- BYOK validation, encryption, masked display, key deletion.
- Data export JSON endpoint.
- Account deletion pipeline (immediate logical delete + cleanup completion <=24h).

Tasks:
- Implement AES-256-GCM key utility with rotation-ready format.
- Add provider adapters and fallback behavior.
- Add background cleanup workflow for full data purge.

Exit criteria:
- BYOK works end-to-end for all supported providers.
- Export and deletion pass compliance test checklist.

## Phase 7: Quality gate + launch readiness (Day 33-36)
Deliverables:
- Full safety red-team suite and fixes.
- Accessibility and performance targets met.
- Beta feedback loop and P0/P1 fix pass.

Tasks:
- Run 35+ safety prompts and document pass/fail outcomes.
- Run Lighthouse and Playwright matrices.
- Verify browser and mobile support envelope.

Exit criteria:
- All launch gates pass and deployment checklist is complete.

## 4. Parallel Workstreams

While one slice is in active development, run these in parallel:
- Workstream A: Product/UX polish and copy (tone, disclaimers, empty states).
- Workstream B: Safety matrix authoring and test automation.
- Workstream C: Analytics schema (events and funnel dashboards).
- Workstream D: Privacy, Terms, and legal page preparation.

## 5. Data and API Contracts (must define before coding each slice)

For each endpoint, define:
- zod request schema
- zod response schema
- typed error envelope: { code, message, details? }
- auth requirement and rate-limit policy
- audit event emission

Minimum APIs for MVP:
- POST /api/chat
- GET/POST /api/habits
- POST /api/habits/[id]/complete
- GET /api/journal/prompt
- POST /api/journal/insight
- PUT /api/settings/provider
- PUT/DELETE /api/settings/apikey
- GET /api/account/export
- DELETE /api/account/delete

## 6. Test Plan Embedded in Delivery

Definition of done per feature:
- Unit tests for core logic and edge cases.
- Integration tests for API and DB interactions.
- E2E happy path and one failure path.
- Accessibility pass for new screens.
- Analytics events verified.

Release gates:
- Coverage target: unit >= 70% for touched modules.
- Core integration path coverage >= 80%.
- E2E core flows all green.
- Safety matrix 100% pass across 7 categories.

## 7. Risk Controls During Build

Top controls:
- Safety regressions: block release if any red-team case fails.
- Performance drift: enforce budget checks in CI.
- Data leakage: RLS tests mandatory for each table.
- AI outage: provider timeout + fallback copy, never silent failure.

## 8. What we implement first (next execution order)

Immediate next tasks for this repository:
1. Scaffold Next.js project and baseline folder layout.
2. Add Supabase schema migrations and RLS policies for users + profiles.
3. Implement auth flow (Google OAuth), disclaimer, age gate, onboarding.
4. Build home shell and global crisis resources component.
5. Implement /api/chat with Gemini + safety filter + streaming.

This order minimizes integration risk and unlocks the first usable user journey quickly.

## 9. Agent Operating Checklist (for continuous execution)

Before starting each phase:
- Confirm dependencies and environment variables are present.
- Confirm migrations are applied and RLS policies validated.
- Confirm monitoring and analytics are active in target environment.

Before marking phase complete:
- Run lint, typecheck, unit/integration tests, E2E slice tests.
- Run safety checks relevant to changed features.
- Verify mobile and accessibility basics for touched screens.
- Update implementation status log in docs.

## 10. Success Criteria

MVP is successful when:
- A new user can sign in, onboard, chat safely, create/complete habits, and see XP/streak progress.
- Safety constraints prevent unsafe guidance across all required categories.
- Data export and account deletion pathways are functional.
- App is responsive, accessible, monitored, and stable for beta release.
