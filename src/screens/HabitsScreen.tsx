/**
 * HabitsScreen — Habit Tracker
 *
 * Create daily/weekly habits, mark them complete, track streaks.
 * Completing a habit awards XP.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import { callAI } from '../services/gemini-service';

const HABITS_KEY = '@innerspace:habits';
const XP_KEY = '@innerspace:xp';
const HABITS_SUMMARY_KEY = '@innerspace:habits_last_monday_summary';

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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly'>('daily');
  // GAP-02: missed habit nudge
  const [missedHabits, setMissedHabits] = useState<string[]>([]);
  const [missedDismissed, setMissedDismissed] = useState(false);
  // GAP-01: celebration
  const [celebMsg, setCelebMsg] = useState('');
  const [celebVisible, setCelebVisible] = useState(false);
  // GAP-03: AI suggestions
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState<string[]>([]);
  // GAP-04: weekly summary
  const [weeklySummary, setWeeklySummary] = useState<{ bestHabit: string; doneCount: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadHabits();
    }, []),
  );

  async function loadHabits() {
    const raw = await AsyncStorage.getItem(HABITS_KEY);
    const parsed: Habit[] = raw ? JSON.parse(raw) : [];
    setHabits(parsed);
    // GAP-02: find habits with no completion in 3+ days
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const missed = parsed
      .filter((h) => h.frequency === 'daily' && h.lastCompletedAt && new Date(h.lastCompletedAt) < threeDaysAgo)
      .map((h) => h.name);
    setMissedHabits(missed);
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
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(updated));
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const habit: Habit = {
      id: Date.now().toString(),
      name: newName.trim(),
      frequency: newFreq,
      streak: 0,
      createdAt: new Date(),
    };
    await saveHabits([...habits, habit]);
    setNewName('');
    setNewFreq('daily');
    setModalVisible(false);
  }

  async function handleComplete(habit: Habit) {
    if (isCompletedToday(habit)) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const lastDate = habit.lastCompletedAt
      ? new Date(habit.lastCompletedAt).toISOString().slice(0, 10)
      : null;
    const newStreak =
      habit.frequency === 'daily' && lastDate === yesterday
        ? habit.streak + 1
        : habit.frequency === 'weekly'
        ? habit.streak + 1
        : 1;

    const updated = habits.map((h) =>
      h.id === habit.id
        ? { ...h, streak: newStreak, lastCompletedAt: new Date() }
        : h,
    );
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
    const existing = habits.map((h) => h.name).join(', ');
    const prompt = `My current habits are: ${existing || 'none yet'}. Suggest 5 new daily habits that would complement these.`;
    const response = await callAI(prompt, HABIT_SUGGEST_SYSTEM_PROMPT, []);
    if (!response.error) {
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
    Alert.alert('Delete habit', 'Remove this habit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => saveHabits(habits.filter((h) => h.id !== id)),
      },
    ]);
  }

  const dueToday = habits.filter((h) => isDueToday(h));
  const completedToday = habits.filter((h) => isCompletedToday(h));
  const remaining = dueToday.filter((h) => !isCompletedToday(h));

  function renderHabit({ item }: { item: Habit }) {
    const done = isCompletedToday(item);
    return (
      <TouchableOpacity
        style={[styles.habitCard, done && styles.habitCardDone]}
        onPress={() => handleComplete(item)}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.82}
      >
        <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
          {done && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <View style={styles.habitInfo}>
          <Text style={[styles.habitName, done && styles.habitNameDone]}>{item.name}</Text>
          <Text style={styles.habitMeta}>
            {item.frequency === 'daily' ? t('habits.daily_label') : t('habits.weekly_label')} · {t('habits.streak_label', { count: item.streak })}
          </Text>
        </View>
        {done && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
      </TouchableOpacity>
    );
  }

  const allHabits = [...remaining, ...completedToday, ...habits.filter((h) => !isDueToday(h))];

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.headerTitle}>Habits</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#4A9EFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addBtn, { marginLeft: 6 }]}
          onPress={handleSuggestHabits}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* GAP-04: Weekly summary card */}
      {weeklySummary && (
        <View style={styles.weeklySummaryCard}>
          <View style={styles.weeklySummaryRow}>
            <Ionicons name="trophy-outline" size={18} color={colors.accent} />
            <Text style={styles.weeklySummaryTitle}>{t('habits.weekly_title')}</Text>
            <TouchableOpacity onPress={() => setWeeklySummary(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <Text style={styles.weeklySummaryText}>{t('habits.weekly_done', { count: weeklySummary.doneCount })}</Text>
          <Text style={styles.weeklySummaryBest}>{t('habits.weekly_best', { name: weeklySummary.bestHabit })}</Text>
        </View>
      )}

      {/* GAP-02: Missed habits nudge */}
      {missedHabits.length > 0 && !missedDismissed && (
        <View style={styles.missedBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.missedText}>{t('habits.missed_body', { names: missedHabits.slice(0, 2).join(', ') })}</Text>
          <TouchableOpacity onPress={() => setMissedDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      )}

      {/* Progress summary */}
      {habits.length > 0 && (
        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            {t('habits.progress_text', { done: completedToday.length, total: dueToday.length })}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: dueToday.length > 0 ? `${(completedToday.length / dueToday.length) * 100}%` : '0%' },
              ]}
            />
          </View>
        </View>
      )}

      <FlatList
        data={allHabits}
        keyExtractor={(item) => item.id}
        renderItem={renderHabit}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyBody}>
              Add your first habit. Small consistent actions create big change.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.emptyBtnText}>Add a habit</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add habit modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="add-circle" size={22} color={colors.accent} />
              <Text style={styles.modalTitle}>New Habit</Text>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder={t('habits.add_placeholder')}
              placeholderTextColor={colors.textDim}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={60}
            />
            <Text style={styles.freqLabel}>Frequency</Text>
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
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Ionicons name="close-outline" size={17} color={colors.textMuted} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalBtn, !newName.trim() && styles.btnDisabled]}
                onPress={handleAdd}
                disabled={!newName.trim()}
              >
                <Ionicons name="checkmark" size={17} color={colors.accent} />
                <Text style={styles.saveModalBtnText}>Add Habit</Text>
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

      {/* GAP-03: Habit suggestions modal */}
      <Modal visible={suggestVisible} transparent animationType="slide" onRequestClose={() => setSuggestVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="sparkles" size={22} color={colors.accent} />
              <Text style={styles.modalTitle}>{t('habits.suggest_title')}</Text>
              <TouchableOpacity onPress={() => setSuggestVisible(false)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {suggestLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.freqLabel, { marginTop: 8 }]}>{t('habits.suggest_loading')}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {suggestItems.map((item, idx) => (
                  <View key={idx} style={styles.suggestRow}>
                    <Text style={styles.suggestText}>{item}</Text>
                    <TouchableOpacity onPress={() => handleAddSuggested(item)} style={styles.suggestAddBtn} activeOpacity={0.8}>
                      <Ionicons name="add" size={16} color={colors.accent} />
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
  root: { flex: 1, backgroundColor: c.background, paddingTop: RNStatusBar.currentHeight ?? 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: c.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  progressCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 8 },
  progressText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: c.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: c.success, borderRadius: 3 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
  habitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: 'transparent' },
  habitCardDone: { opacity: 0.7 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: c.success, borderColor: c.success },
  habitInfo: { flex: 1 },
  habitName: { fontSize: 15, fontWeight: '600', color: c.text },
  habitNameDone: { textDecorationLine: 'line-through', color: c.textMuted },
  habitMeta: { fontSize: 12, color: c.textDim, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentBg, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: c.accent },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14 },
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
  // GAP-02
  missedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: c.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: c.danger },
  missedText: { flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  // GAP-04
  weeklySummaryCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: c.accentBg, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: c.accent },
  weeklySummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  weeklySummaryTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: c.accent },
  weeklySummaryText: { fontSize: 13, color: c.textSecondary },
  weeklySummaryBest: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },
  // GAP-01
  celebCard: { alignItems: 'center', gap: 10 },
  celebEmoji: { fontSize: 48 },
  celebTitle: { fontSize: 20, fontWeight: '700', color: c.text },
  celebMsg: { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
  // GAP-03
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, gap: 8 },
  suggestText: { flex: 1, fontSize: 14, color: c.text },
  suggestAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  suggestAddText: { fontSize: 12, color: c.accent, fontWeight: '600' },
  });
}
