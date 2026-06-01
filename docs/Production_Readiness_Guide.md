# Production Readiness Guide

## 1. Environment Strategy
Use three environments:
- Development: local iteration and schema prototyping.
- Staging: release candidate validation with production-like settings.
- Production: customer traffic and operational SLOs.

Environment variable groups:
- App: NEXT_PUBLIC_APP_URL, NODE_ENV
- Supabase: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- AI providers: GEMINI_API_KEY, OPENAI_API_KEY (optional), ANTHROPIC_API_KEY (optional), GROQ_API_KEY (optional)
- Encryption: ENCRYPTION_MASTER_KEY
- Observability: SENTRY_DSN, POSTHOG_KEY, POSTHOG_HOST

Rules:
- No secrets in client-side variables except public keys intended for browser use.
- Separate keys for staging and production.
- Rotate ENCRYPTION_MASTER_KEY using key versioning strategy.

## 2. Security Baseline
- Enforce HTTPS and HSTS.
- Use Row Level Security on all user-owned tables.
- Encrypt stored BYOK secrets with AES-256-GCM server-side only.
- Rate limit critical API routes.
- Add CSRF and origin checks for state-changing endpoints.
- Log security-relevant events with minimal PII.

## 3. Data and Compliance
- Implement account deletion workflow with completion SLA <= 24 hours.
- Provide export endpoint returning user data JSON.
- Keep audit trail for deletion and export requests.
- Document retention windows for logs and analytics.

## 4. Reliability and SLOs
Service-level targets:
- Availability: 99.5% monthly.
- Initial page load: < 2 seconds on 4G.
- AI response completion (p95): < 3 seconds.

Required controls:
- Health checks for API and database connectivity.
- Graceful degradation when AI provider is unavailable.
- Timeouts and retry policies for external calls.

## 5. CI/CD Requirements
Minimum required checks per pull request:
- Lint
- Typecheck
- Unit tests
- Integration tests for touched routes

Pre-deploy gates:
- Safety test matrix pass.
- Accessibility checks for new screens.
- Performance budget check.

Deployment practices:
- Trunk-based flow with short-lived branches.
- Staging deployment before production promotion.
- Rollback plan documented for each production release.

## 6. Observability
- Sentry for error and exception tracking.
- PostHog for product analytics and funnel monitoring.
- Structured server logs with request identifiers.
- Alerting for elevated error rate and latency regressions.

## 7. Operations Runbooks
Maintain these runbooks in docs:
- Incident response (P0/P1 handling)
- Data deletion verification
- AI provider outage playbook
- Security key rotation

## 8. Launch Checklist
- Privacy policy and terms published.
- OAuth app verification complete.
- Domain and TLS configuration verified.
- Monitoring and alerts active.
- Safety matrix fully passed.
- Beta feedback triaged and P0/P1 fixed.
