/**
 * Thin error reporting abstraction.
 *
 * Development: logs to console.
 * Production: replace the bodies below with Sentry calls once a DSN is configured:
 *   import * as Sentry from '@sentry/react-native';
 *   Sentry.init({ dsn: process.env.SENTRY_DSN });
 */

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    console.error('[InnerSpace error]', error, context ?? '');
  }
  // Production (uncomment after configuring Sentry):
  // Sentry.captureException(error, { extra: context });
}

export function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (__DEV__) {
    const log = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    log(`[InnerSpace] ${message}`);
  }
  // Production (uncomment after configuring Sentry):
  // Sentry.captureMessage(message, level);
}
