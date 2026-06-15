/**
 * HabitsScreen — Habit Tracker
 *
 * Create daily/weekly habits, mark them complete, track streaks.
 * Completing a habit awards XP.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InnerSpaceLogo from '../components/InnerSpaceLogo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGet, secureSet } from '../services/storage-encryption';
import type { Habit } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import { callAI } from '../services/gemini-service';
import { scheduleHabitReminder, cancelHabitReminder } from '../services/notifications';

const HABITS_KEY = '@innerspace:habits';
const XP_KEY = '@innerspace:xp';
const HABITS_SUMMARY_KEY = '@innerspace:habits_last_monday_summary';

const STREAK_MILESTONES = [
  { days: 7, emoji: '🥉', label: '1wk' },
  { days: 30, emoji: '🥈', label: '30d' },
  { days: 60, emoji: '🥇', label: '60d' },
  { days: 100, emoji: '🏆', label: '100d' },
];

function getProgressMessage(done: number, total: number): string {
  if (total === 0) return 'Add your first habit below';
  if (done === 0) return "Let's get started — pick one to complete";
  if (done === total) return 'All done today! Outstanding work 🎉';
  const left = total - done;
  return `${left} more to go — you're doing great!`;
}

const HABIT_SUGGEST_SYSTEM_PROMPT = `You are a helpful wellness coach. When asked for habit suggestions, respond ONLY with a plain numbered list of 5 habit ideas, one per line, no extra commentary. Format: "1. Habit name" etc. Keep each habit under 50 characters.`;

const HABIT_CELEB_SYSTEM_PROMPT = `You are an upbeat but brief wellness coach. The user just completed all their habits for today. Give a single short celebratory message (1-2 sentences max). Be warm, direct, no hollow phrases like "Great job!" or "Awesome!". Vary your response.`;

async function addXp(amount: number) {
  try {
    const raw = await AsyncStorage.getItem(XP_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    await AsyncStorage.setItem(XP_KEY, String(Math.min(current + amount, 9999)));
  } catch {
    // Non-critical
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDueToday(habit: Habit): boolean {
  if (habit.frequency === 'daily') return true;
  // Weekly: due if not completed this week (Mon-based)
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const mondayStr = monday.toISOString().slice(0, 10);
  if (!habit.lastCompletedAt) return true;
  return new Date(habit.lastCompletedAt).toISOString().slice(0, 10) < mondayStr;
}

function isCompletedToday(habit: Habit): boolean {
  if (!habit.lastCompletedAt) return false;
  if (habit.frequency === 'daily') {
    return new Date(habit.lastCompletedAt).toISOString().slice(0, 10) === todayStr();
  }
  // Weekly: completed this week
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return new Date(habit.lastCompletedAt) >= monday;
}

export default function HabitsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly'>('daily');
  const [newStackAfter, setNewStackAfter] = useState<string | null>(null);
  // GAP-02: missed habit nudge
  const [missedHabits, setMissedHabits] = useState<string[]>([]);
  const [missedDismissed, setMissedDismissed] = useState(false);
  const [missedAiMsg, setMissedAiMsg] = useState('');
  // GAP-01: celebration
  const [celebMsg, setCelebMsg] = useState('');
  const [celebVisible, setCelebVisible] = useState(false);
  // Reminders
  const [reminderPickerHabit, setReminderPickerHabit] = useState<Habit | null>(null);
  const [newReminderTime, setNewReminderTime] = useState<string | null>(null);
  // GAP-03: AI suggestions
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState<string[]>([]);
  const [suggestTimedOut, setSuggestTimedOut] = useState(false);
  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  // GAP-04: weekly summary
  const [weeklySummary, setWeeklySummary] = useState<{ bestHabit: string; doneCount: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadHabits();
    }, []),
  );

  async function loadHabits() {
    const raw = await secureGet(HABITS_KEY);
    const parsed: Habit[] = raw ? JSON.parse(raw) : [];
    setHabits(parsed);
    // GAP-02: find habits with no completion in 3+ days
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const missed = parsed
      .filter((h) => h.frequency === 'daily' && h.lastCompletedAt && new Date(h.lastCompletedAt) < threeDaysAgo)
      .map((h) => h.name);
    setMissedHabits(missed);
    if (missed.length > 0) {
      // GAP-02: generate gentle AI check-in message in background
      const prompt = `I have ${missed.length} habit${missed.length > 1 ? 's' : ''} I haven't done in 3+ days: ${missed.join(', ')}. Give me a single warm, non-judgmental sentence to gently encourage me to get back on track. No greeting, no advice, just one kind nudge.`;
      callAI(prompt, 'You are a warm and supportive wellness coach. Reply with exactly one gentle encouraging sentence, no more.', [])
        .then((res) => { if (!res.error && !res.isSafetyRedirect && res.text) setMissedAiMsg(res.text); })
        .catch(() => {});
    }
    // GAP-04: show weekly summary on Mondays
    const today = new Date();
    if (today.getDay() === 1) {
      const mondayStr = today.toISOString().slice(0, 10);
      const lastSummary = await AsyncStorage.getItem(HABITS_SUMMARY_KEY);
      if (lastSummary !== mondayStr && parsed.length > 0) {
        const best = parsed.reduce((a, b) => (b.streak > a.streak ? b : a));
        const doneCount = parsed.filter((h) => isCompletedToday(h) || (h.lastCompletedAt && new Date(h.lastCompletedAt).toISOString().slice(0, 10) >= mondayStr)).length;
        setWeeklySummary({ bestHabit: best.name, doneCount });
        await AsyncStorage.setItem(HABITS_SUMMARY_KEY, mondayStr);
      }
    }
  }

  async function saveHabits(updated: Habit[]) {
    setHabits(updated);
    await secureSet(HABITS_KEY, JSON.stringify(updated));
  }

  const REMINDER_TIMES = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
    '09:00', '10:00', '12:00', '14:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00',
  ];

  function formatReminderTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  async function handleSetReminder(habit: Habit, time: string | null) {
    if (habit.reminderId) await cancelHabitReminder(habit.reminderId);
    let reminderId: string | undefined;
    if (time) {
      const id = await scheduleHabitReminder(habit.id, habit.name, habit.frequency, time);
      reminderId = id ?? undefined;
    }
    await saveHabits(habits.map((h) =>
      h.id === habit.id ? { ...h, reminderTime: time ?? undefined, reminderId } : h,
    ));
    setReminderPickerHabit(null);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const habitId = Date.now().toString();
    let reminderId: string | undefined;
    if (newReminderTime) {
      const id = await scheduleHabitReminder(habitId, newName.trim(), newFreq, newReminderTime);
      reminderId = id ?? undefined;
    }
    const habit: Habit = {
      id: habitId,
      name: newName.trim(),
      frequency: newFreq,
      streak: 0,
      createdAt: new Date(),
      afterHabitId: newStackAfter ?? undefined,
      reminderTime: newReminderTime ?? undefined,
      reminderId,
    };
    await saveHabits([...habits, habit]);
    setNewName('');
    setNewFreq('daily');
    setNewStackAfter(null);
    setNewReminderTime(null);
    setModalVisible(false);
  }

  async function handleComplete(habit: Habit) {
    if (isCompletedToday(habit)) return;
    // Grace day: streak continues if last completion was within 48h (yesterday or the day before)
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const lastDate = habit.lastCompletedAt
      ? new Date(habit.lastCompletedAt).toISOString().slice(0, 10)
      : null;
    const streakContinues =
      (habit.frequency === 'daily' && lastDate && lastDate >= twoDaysAgo) ||
      habit.frequency === 'weekly';
    // Task #22: save old streak for catch-up if streak breaks
    const savedStreak = !streakContinues && habit.streak >= 3 ? habit.streak : habit.savedStreak;
    const catchUpProgress = !streakContinues && habit.streak >= 3
      ? 1
      : habit.catchUpProgress !== undefined && !streakContinues
      ? undefined
      : habit.catchUpProgress !== undefined
      ? habit.catchUpProgress + 1
      : undefined;
    const newStreak = streakContinues
      ? habit.streak + 1
      : (savedStreak !== undefined && (catchUpProgress ?? 0) >= 3)
      ? savedStreak + 1
      : 1;

    const updated = habits.map((h) =>
      h.id === habit.id
        ? {
            ...h,
            streak: newStreak,
            lastCompletedAt: new Date(),
            savedStreak: (catchUpProgress ?? 0) >= 3 ? undefined : savedStreak,
            catchUpProgress: (catchUpProgress ?? 0) >= 3 ? undefined : catchUpProgress,
          }
        : h,
    );
    // Task #18: if another habit stacks after this one, nudge user
    const stackedOn = updated.find((h) => h.afterHabitId === habit.id && !isCompletedToday(h));
    if (stackedOn) {
      setTimeout(() => Alert.alert('Up next 🔗', `You said you'd do "${stackedOn.name}" after this one. Ready?`), 600);
    }
    await saveHabits(updated);
    await addXp(8);
    // GAP-01: celebrate when all due habits are completed
    const allDue = updated.filter((h) => isDueToday(h));
    const allNowDone = allDue.every((h) => isCompletedToday(h));
    if (allNowDone && allDue.length > 0) {
      const prompt = `I just completed all ${allDue.length} of my habits for today! Give me a short celebration message.`;
      const response = await callAI(prompt, HABIT_CELEB_SYSTEM_PROMPT, []);
      const msg = response.error ? t('habits.celeb_title') : response.text;
      setCelebMsg(msg);
      setCelebVisible(true);
    } else {
      Alert.alert(t('habits.done_alert_title'), t('habits.done_alert_body', { name: habit.name, streak: newStreak }));
    }
  }

  // GAP-03: AI habit suggestion
  async function handleSuggestHabits() {
    setSuggestVisible(true);
    setSuggestLoading(true);
    setSuggestItems([]);
    setSuggestTimedOut(false);
    const existing = habits.map((h) => h.name).join(', ');
    const prompt = `My current habits are: ${existing || 'none yet'}. Suggest 5 new daily habits that would complement these.`;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));
    const response = await Promise.race([callAI(prompt, HABIT_SUGGEST_SYSTEM_PROMPT, []), timeout]);
    if (response === null) {
      setSuggestTimedOut(true);
    } else if (!response.error) {
      const lines = response.text
        .split('\n')
        .map((l) => l.replace(/^\d+\.\s*/, '').trim())
        .filter((l) => l.length > 0)
        .slice(0, 5);
      setSuggestItems(lines);
    }
    setSuggestLoading(false);
  }

  async function handleAddSuggested(name: string) {
    const habit: Habit = {
      id: Date.now().toString(),
      name,
      frequency: 'daily',
      streak: 0,
      createdAt: new Date(),
    };
    await saveHabits([...habits, habit]);
    setSuggestItems((prev) => prev.filter((i) => i !== name));
  }

  async function handleDelete(id: string) {
    const habit = habits.find((h) => h.id === id);
    Alert.alert('Remove this habit?', 'Your streak and progress for this one will be gone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (habit?.reminderId) await cancelHabitReminder(habit.reminderId);
          await saveHabits(habits.filter((h) => h.id !== id));
        },
      },
    ]);
  }

  const dueToday = habits.filter((h) => isDueToday(h));
  const completedToday = habits.filter((h) => isCompletedToday(h));
  const remaining = dueToday.filter((h) => !isCompletedToday(h));

  const progressRatio = dueToday.length > 0 ? completedToday.length / dueToday.length : 0;
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progressRatio, duration: 500, useNativeDriver: false }).start();
  }, [progressRatio]);

  function renderHabit({ item }: { item: Habit }) {
    const done = isCompletedToday(item);
    const milestone = STREAK_MILESTONES.slice().reverse().find((m) => item.streak >= m.days);
    return (
      <View style={[styles.habitCard, done && styles.habitCardDone]}>
        <TouchableOpacity
          style={styles.habitCardTouchable}
          onPress={() => handleComplete(item)}
          onLongPress={() => handleDelete(item.id)}
          activeOpacity={0.82}
          accessibilityLabel={`${done ? 'Completed' : 'Mark complete'}: ${item.name}`}
          accessibilityRole="button"
        >
          <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
            {done && <Feather name="check" size={18} color="#FFFFFF" />}
          </View>
          <View style={styles.habitInfo}>
            <View style={styles.habitNameRow}>
              <Text style={[styles.habitName, done && styles.habitNameDone]} numberOfLines={1}>
                {item.name}
              </Text>
              {milestone && (
                <View style={styles.milestoneBadge}>
                  <Text style={styles.milestoneBadgeText}>{milestone.emoji} {milestone.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.habitMeta}>
              {item.frequency === 'daily' ? t('habits.daily_label') : t('habits.weekly_label')}
              {item.reminderTime ? ` · 🔔 ${formatReminderTime(item.reminderTime)}` : ''}
              {item.afterHabitId && (() => {
                const cue = habits.find((h) => h.id === item.afterHabitId);
                return cue ? ` · 🔗 after ${cue.name}` : '';
              })()}
            </Text>
            {item.savedStreak !== undefined && item.catchUpProgress !== undefined && (
              <View style={styles.catchUpBadge}>
                <Text style={styles.catchUpText}>🔄 Catch-up: {item.catchUpProgress}/3 to restore {item.savedStreak}-day streak</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.habitRight}>
          {item.streak > 0 && (
            <View style={[styles.streakBadge, done && styles.streakBadgeDone]}>
              <Text style={styles.streakBadgeText}>🔥 {item.streak}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setReminderPickerHabit(item)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={styles.bellBtn}
            accessibilityLabel={item.reminderTime ? `Change reminder for ${item.name}` : `Set reminder for ${item.name}`}
            accessibilityRole="button"
          >
            <Feather
              name={item.reminderTime ? 'bell' : 'bell-off'}
              size={15}
              color={item.reminderTime ? colors.accent : colors.textDim}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  type ListRow = Habit | { __header: string; __key: string };
  const notDueToday = habits.filter((h) => !isDueToday(h));
  const listData: ListRow[] = [];
  if (remaining.length > 0) {
    listData.push({ __header: 'Today', __key: '__hdr_today' });
    listData.push(...remaining);
  }
  if (completedToday.length > 0) {
    listData.push({ __header: `Done today ✓  (${completedToday.length})`, __key: '__hdr_done' });
    listData.push(...completedToday);
  }
  if (notDueToday.length > 0) {
    listData.push({ __header: 'Not due today', __key: '__hdr_notdue' });
    listData.push(...notDueToday);
  }
  function renderListRow({ item }: { item: ListRow }) {
    if ('__header' in item) {
      return <Text style={styles.sectionHeader}>{item.__header}</Text>;
    }
    return renderHabit({ item });
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <InnerSpaceLogo size={26} />
          <Text style={styles.headerTitle}>Habits</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('Goals')}
            activeOpacity={0.8}
            accessibilityLabel="View Goals"
            accessibilityRole="button"
          >
            <Feather name="flag" size={18} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleSuggestHabits}
            activeOpacity={0.8}
            accessibilityLabel="Get AI habit suggestions"
            accessibilityRole="button"
          >
            <Feather name="zap" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* GAP-04: Weekly summary card */}
      {weeklySummary && (
        <View style={styles.weeklySummaryCard}>
          <View style={styles.weeklySummaryRow}>
            <Feather name="award" size={18} color={colors.accent} />
            <Text style={styles.weeklySummaryTitle}>{t('habits.weekly_title')}</Text>
            <TouchableOpacity onPress={() => setWeeklySummary(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Dismiss weekly summary" accessibilityRole="button">
              <Feather name="x" size={16} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <Text style={styles.weeklySummaryText}>{t('habits.weekly_done', { count: weeklySummary.doneCount })}</Text>
          <Text style={styles.weeklySummaryBest}>{t('habits.weekly_best', { name: weeklySummary.bestHabit })}</Text>
        </View>
      )}

      {/* GAP-02: Missed habits nudge */}
      {missedHabits.length > 0 && !missedDismissed && (
        <View style={styles.missedBanner}>
          <Text style={styles.missedEmoji}>💙</Text>
          <View style={styles.missedContent}>
            <Text style={styles.missedText}>
              {t('habits.missed_body', { names: missedHabits.slice(0, 2).join(', ') })}
            </Text>
            {!!missedAiMsg && (
              <Text style={styles.missedAiText}>{missedAiMsg}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setMissedDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Dismiss" accessibilityRole="button">
            <Feather name="x" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      )}

      {/* Stats header */}
      {habits.length > 0 && (
        <View style={styles.statsCard}>
          <View style={styles.statsDateRow}>
            <Text style={styles.statsDateDay}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
            </Text>
            <Text style={styles.statsDateLabel}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.statsCountRow}>
            <Text style={styles.statsBigNum}>{completedToday.length}</Text>
            <Text style={styles.statsSlash}> / </Text>
            <Text style={styles.statsTotalNum}>{dueToday.length}</Text>
            <Text style={styles.statsDoneLabel}>  done today</Text>
          </View>
          <View style={styles.statsBarTrack}>
            <Animated.View
              style={[
                styles.statsBarFill,
                { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
          <Text style={styles.statsMotivation}>{getProgressMessage(completedToday.length, dueToday.length)}</Text>
        </View>
      )}

      <FlatList
        data={listData as ListRow[]}
        keyExtractor={(item) => ('__key' in item ? item.__key : (item as Habit).id)}
        renderItem={renderListRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Add your first habit. Small things done consistently make a real difference.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Feather name="plus-circle" size={16} color={colors.accent} />
              <Text style={styles.emptyBtnText}>Add something</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add habit modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Feather name="plus-circle" size={22} color={colors.accent} />
              <Text style={styles.modalTitle}>Track something new</Text>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Morning walk, drink water, meditate..."
              placeholderTextColor={colors.textDim}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={60}
            />
            <Text style={styles.freqLabel}>How often?</Text>
            <View style={styles.freqRow}>
              {(['daily', 'weekly'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.freqChip, newFreq === f && styles.freqChipActive]}
                  onPress={() => setNewFreq(f)}
                >
                  <Text style={[styles.freqText, newFreq === f && styles.freqTextActive]}>
                    {f === 'daily' ? '📅 Daily' : '📆 Weekly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {habits.length > 0 && (
              <>
                <Text style={styles.freqLabel}>Do this right after (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[styles.freqChip, newStackAfter === null && styles.freqChipActive]}
                    onPress={() => setNewStackAfter(null)}
                  >
                    <Text style={[styles.freqText, newStackAfter === null && styles.freqTextActive]}>None</Text>
                  </TouchableOpacity>
                  {habits.map((h) => (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.freqChip, { marginLeft: 6 }, newStackAfter === h.id && styles.freqChipActive]}
                      onPress={() => setNewStackAfter(h.id)}
                    >
                      <Text style={[styles.freqText, newStackAfter === h.id && styles.freqTextActive]}>🔗 {h.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            <Text style={styles.freqLabel}>Remind me at (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <TouchableOpacity
                style={[styles.timeChip, newReminderTime === null && styles.timeChipActive]}
                onPress={() => setNewReminderTime(null)}
              >
                <Text style={[styles.timeChipText, newReminderTime === null && styles.timeChipTextActive]}>No reminder</Text>
              </TouchableOpacity>
              {REMINDER_TIMES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeChip, { marginLeft: 6 }, newReminderTime === t && styles.timeChipActive]}
                  onPress={() => setNewReminderTime(t)}
                >
                  <Text style={[styles.timeChipText, newReminderTime === t && styles.timeChipTextActive]}>{formatReminderTime(t)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); setNewReminderTime(null); }}>
                <Feather name="x" size={17} color={colors.textMuted} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalBtn, !newName.trim() && styles.btnDisabled]}
                onPress={handleAdd}
                disabled={!newName.trim()}
              >
                <Feather name="check" size={17} color={colors.accent} />
                <Text style={styles.saveModalBtnText}>Add it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* GAP-01: Celebration modal */}
      <Modal visible={celebVisible} transparent animationType="fade" onRequestClose={() => setCelebVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.celebCard]}>
            <Text style={styles.celebEmoji}>🎉</Text>
            <Text style={styles.celebTitle}>{t('habits.celeb_title')}</Text>
            <Text style={styles.celebMsg}>{celebMsg}</Text>
            <TouchableOpacity style={styles.saveModalBtn} onPress={() => setCelebVisible(false)} activeOpacity={0.8}>
              <Text style={styles.saveModalBtnText}>Thanks!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reminder picker modal */}
      <Modal
        visible={!!reminderPickerHabit}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderPickerHabit(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Feather name="bell" size={20} color={colors.accent} />
              <Text style={styles.modalTitle}>Set reminder</Text>
              <TouchableOpacity onPress={() => setReminderPickerHabit(null)} style={{ marginLeft: 'auto' }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {!!reminderPickerHabit && (
              <Text style={styles.freqLabel}>{reminderPickerHabit.name}</Text>
            )}
            <View style={styles.timeGrid}>
              {REMINDER_TIMES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeChip, reminderPickerHabit?.reminderTime === t && styles.timeChipActive]}
                  onPress={() => reminderPickerHabit && handleSetReminder(reminderPickerHabit, t)}
                >
                  <Text style={[styles.timeChipText, reminderPickerHabit?.reminderTime === t && styles.timeChipTextActive]}>
                    {formatReminderTime(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {reminderPickerHabit?.reminderTime && (
              <TouchableOpacity
                style={styles.removeReminderBtn}
                onPress={() => reminderPickerHabit && handleSetReminder(reminderPickerHabit, null)}
              >
                <Feather name="bell-off" size={15} color={colors.danger} />
                <Text style={styles.removeReminderText}>Remove reminder</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* FAB — add new habit */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        accessibilityLabel="Add new habit"
        accessibilityRole="button"
      >
        <Feather name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* GAP-03: Habit suggestions modal */}
      <Modal visible={suggestVisible} transparent animationType="slide" onRequestClose={() => setSuggestVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Feather name="zap" size={22} color={colors.accent} />
              <Text style={styles.modalTitle}>{t('habits.suggest_title')}</Text>
              <TouchableOpacity onPress={() => setSuggestVisible(false)} style={{ marginLeft: 'auto' }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {suggestLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.freqLabel, { marginTop: 8 }]}>{t('habits.suggest_loading')}</Text>
              </View>
            ) : suggestTimedOut ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                <Feather name="clock" size={28} color={colors.textDim} />
                <Text style={styles.suggestText}>{t('habits.suggest_timeout')}</Text>
                <TouchableOpacity style={styles.saveModalBtn} onPress={handleSuggestHabits} activeOpacity={0.8}>
                  <Feather name="refresh-cw" size={16} color={colors.accent} />
                  <Text style={styles.saveModalBtnText}>{t('habits.suggest_retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {suggestItems.map((item, idx) => (
                  <View key={idx} style={styles.suggestRow}>
                    <Text style={styles.suggestText}>{item}</Text>
                    <TouchableOpacity onPress={() => handleAddSuggested(item)} style={styles.suggestAddBtn} activeOpacity={0.8}>
                      <Feather name="plus" size={16} color={colors.accent} />
                      <Text style={styles.suggestAddText}>{t('habits.suggest_add')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: c.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  // Stats header (replaces old progressCard)
  statsCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 10 },
  statsDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsDateDay: { fontSize: 16, fontWeight: '700', color: c.text },
  statsDateLabel: { fontSize: 13, color: c.textMuted },
  statsCountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  statsBigNum: { fontSize: 44, fontWeight: '800', color: c.accent, lineHeight: 50 },
  statsSlash: { fontSize: 28, fontWeight: '300', color: c.textDim, marginBottom: 4 },
  statsTotalNum: { fontSize: 28, fontWeight: '600', color: c.textSecondary, marginBottom: 4 },
  statsDoneLabel: { fontSize: 14, color: c.textMuted, fontWeight: '500', marginBottom: 6 },
  statsBarTrack: { height: 8, backgroundColor: c.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  statsBarFill: { height: '100%', backgroundColor: c.accent, borderRadius: 4 },
  statsMotivation: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },
  // Section headers
  sectionHeader: { fontSize: 11, fontWeight: '700', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.8, paddingTop: 8, paddingBottom: 4, paddingHorizontal: 2 },
  listContent: { paddingHorizontal: 16, paddingBottom: 88, gap: 8, flexGrow: 1 },
  // Habit cards
  habitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  habitCardDone: { borderLeftWidth: 3, borderLeftColor: c.success },
  habitCardTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, paddingRight: 10, gap: 12 },
  habitRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 8 },
  bellBtn: { padding: 6 },
  checkCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: c.success, borderColor: c.success },
  habitInfo: { flex: 1, gap: 3 },
  habitNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  habitName: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
  habitNameDone: { textDecorationLine: 'line-through', color: c.textMuted },
  habitMeta: { fontSize: 12, color: c.textDim },
  // Streak badge
  streakBadge: { backgroundColor: '#2C1810', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#7C3E1A' },
  streakBadgeDone: { backgroundColor: '#162A10', borderColor: '#365A1A' },
  streakBadgeText: { fontSize: 12, fontWeight: '700', color: '#F97316' },
  // Milestone badge
  milestoneBadge: { backgroundColor: c.surfaceAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  milestoneBadgeText: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  // FAB
  fab: { position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentBg, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: c.accent },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: c.surface, borderRadius: 20, padding: 24, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.text },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalInput: { backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 14, color: c.text, fontSize: 15 },
  freqLabel: { fontSize: 12, color: c.textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  freqRow: { flexDirection: 'row', gap: 10 },
  freqChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  freqChipActive: { borderColor: c.accent, backgroundColor: c.accentBg },
  freqText: { fontSize: 14, color: c.textMuted, fontWeight: '500' },
  freqTextActive: { color: c.accent, fontWeight: '700' },
  modalBtnRow: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: c.surfaceAlt },
  cancelBtnText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
  saveModalBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: c.accentBg },
  saveModalBtnText: { color: c.accent, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  catchUpBadge: { marginTop: 4, backgroundColor: '#1C1A03', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#3D3A05' },
  catchUpText: { fontSize: 11, color: '#FCD34D', fontWeight: '600' },
  // Missed nudge — warm accent (not danger)
  missedBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: c.accentBg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: c.accent },
  missedEmoji: { fontSize: 20, lineHeight: 24 },
  missedContent: { flex: 1 },
  missedText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  missedAiText: { fontSize: 13, color: c.textMuted, lineHeight: 18, marginTop: 4, fontStyle: 'italic' },
  // Weekly summary
  weeklySummaryCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: c.accentBg, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: c.accent },
  weeklySummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  weeklySummaryTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: c.accent },
  weeklySummaryText: { fontSize: 13, color: c.textSecondary },
  weeklySummaryBest: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },
  // Celebration
  celebCard: { alignItems: 'center', gap: 10 },
  celebEmoji: { fontSize: 48 },
  celebTitle: { fontSize: 20, fontWeight: '700', color: c.text },
  celebMsg: { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
  // Reminder time chips
  timeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  timeChipActive: { borderColor: c.accent, backgroundColor: c.accentBg },
  timeChipText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
  timeChipTextActive: { color: c.accent, fontWeight: '700' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  removeReminderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, justifyContent: 'center' },
  removeReminderText: { fontSize: 14, color: c.danger, fontWeight: '600' },
  // AI suggestions
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, gap: 8 },
  suggestText: { flex: 1, fontSize: 14, color: c.text },
  suggestAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  suggestAddText: { fontSize: 12, color: c.accent, fontWeight: '600' },
  });
}
