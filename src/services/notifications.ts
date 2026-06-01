/**
 * Notification Service — Weekly Digest
 *
 * Schedules a local push notification every Sunday at 09:00 summarising
 * the user's week: conversation count and top helper.
 *
 * Uses expo-notifications. If the package is not installed or permissions
 * are denied the whole module silently no-ops.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Conversation } from '../types';

const CONVERSATIONS_KEY = '@innerspace:conversations';
const NOTIF_SCHEDULED_KEY = '@innerspace:weekly_notif_scheduled_week';

async function getExpoNotifications() {
  try {
    // Dynamic import so the app still works if expo-notifications is not installed
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function requestPermission(): Promise<boolean> {
  const Notifications = await getExpoNotifications();
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function getISOWeek(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

async function buildDigestBody(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return "You're building something great. Check in this week!";

    const all: Conversation[] = JSON.parse(raw);
    const weekAgo = Date.now() - 7 * 86400000;
    const recent = all.filter((c) => new Date(c.createdAt).getTime() > weekAgo);

    if (recent.length === 0) return "No conversations this week — start a chat today!";

    // Find top agent by frequency
    const counts: Record<string, number> = {};
    for (const c of recent) {
      counts[c.agentId] = (counts[c.agentId] ?? 0) + 1;
    }
    const topAgentId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

    return `You had ${recent.length} conversation${recent.length !== 1 ? 's' : ''} this week${topAgentId ? ` — your top helper was ${topAgentId.replace(/_/g, ' ')}` : ''}. Keep it up! 🌱`;
  } catch {
    return 'Check in with your helpers this week!';
  }
}

/**
 * Call once on app startup. Schedules the weekly Sunday 09:00 digest
 * if it has not already been scheduled this week.
 */
export async function scheduleWeeklyDigest(): Promise<void> {
  try {
    const Notifications = await getExpoNotifications();
    if (!Notifications) return;

    const thisWeek = getISOWeek();
    const scheduled = await AsyncStorage.getItem(NOTIF_SCHEDULED_KEY);
    if (scheduled === thisWeek) return; // already scheduled this week

    const granted = await requestPermission();
    if (!granted) return;

    // Cancel any previously scheduled weekly digest
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      if ((n.content.data as any)?.type === 'weekly_digest') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const body = await buildDigestBody();

    // Schedule next Sunday at 09:00
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const trigger = new Date(now);
    trigger.setDate(now.getDate() + daysUntilSunday);
    trigger.setHours(9, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌱 Your InnerSpace Week',
        body,
        data: { type: 'weekly_digest' },
      },
      trigger,
    });

    await AsyncStorage.setItem(NOTIF_SCHEDULED_KEY, thisWeek);
  } catch {
    // Silently ignore — notifications are non-critical
  }
}
