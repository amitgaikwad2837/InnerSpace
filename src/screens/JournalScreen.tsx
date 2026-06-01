/**
 * JournalScreen — Daily Reflect Mode
 *
 * Daily guided reflection prompts with optional AI-generated insight.
 * Each entry is stored locally in AsyncStorage.
 * Completing an entry awards XP.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { secureGet, secureSet } from '../services/storage-encryption';
import { callAI } from '../services/gemini-service';
import type { JournalEntry } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';

const JOURNAL_KEY = '@innerspace:journal_entries';
const XP_KEY = '@innerspace:xp';

const DAILY_PROMPTS = [
  'What is one thing you are grateful for today?',
  'Describe a moment today that made you feel something.',
  'What is one small win you had today, even if it seems minor?',
  'What is something you wish had gone differently today?',
  'What is one thing you want to focus on tomorrow?',
  'How did your body feel today? What might it be telling you?',
  'What is a belief you hold that you have never really questioned?',
  'If today were a chapter in a book, what would the title be?',
  'What is something you are avoiding, and why?',
  'Who made a positive difference in your life this week?',
  'What are you most proud of right now?',
  'What would you tell your past self from one year ago?',
  'What does your ideal day look like? How close was today?',
  'What is one habit you want to build, and what is stopping you?',
  'How are you really feeling, underneath the surface?',
];

function getTodayPrompt(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];
}

async function addXp(amount: number) {
  try {
    const raw = await AsyncStorage.getItem(XP_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    await AsyncStorage.setItem(XP_KEY, String(Math.min(current + amount, 9999)));
  } catch {
    // Non-critical
  }
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function calDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function JournalScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState('');
  const [insight, setInsight] = useState('');
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'write' | 'history' | 'calendar'>('write');
  // GAP-06: prompt swap
  const [promptIdx, setPromptIdx] = useState(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return dayOfYear % DAILY_PROMPTS.length;
  });
  const [promptSwapCount, setPromptSwapCount] = useState(0);
  // GAP-05: calendar
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarSelected, setCalendarSelected] = useState<string | null>(null);
  const todayPrompt = DAILY_PROMPTS[promptIdx];

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, []),
  );

  async function loadEntries() {
    const raw = await secureGet(JOURNAL_KEY);
    if (raw) {
      const parsed: JournalEntry[] = JSON.parse(raw);
      setEntries(parsed.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()));
    }
  }

  async function handleGenerateInsight() {
    if (!content.trim()) return;
    setGeneratingInsight(true);
    try {
      const response = await callAI(
        `Based on this journal entry, give one warm, non-judgmental insight in 2-3 sentences. Do not give advice unless asked. Just reflect and acknowledge.\n\nPrompt: ${todayPrompt}\n\nEntry: ${content}`,
        'You are a warm and empathetic journal companion. Be gentle, honest, and encouraging.',
        [],
      );
      if (response.error === 'no_key') {
        setInsight('Connect an AI provider in Settings to generate insights.');
      } else if (!response.error && !response.isSafetyRedirect) {
        setInsight(response.text);
      }
    } finally {
      setGeneratingInsight(false);
    }
  }

  // GAP-06: swap to a different prompt
  function handleSwapPrompt() {
    if (promptSwapCount >= 3) return;
    setPromptIdx((prev) => (prev + 1) % DAILY_PROMPTS.length);
    setPromptSwapCount((prev) => prev + 1);
  }

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const entry: JournalEntry = {
        id: Date.now().toString(),
        prompt: todayPrompt,
        content: content.trim(),
        insight: insight || undefined,
        entryDate: new Date(),
      };
      const updated = [entry, ...entries];
      await secureSet(JOURNAL_KEY, JSON.stringify(updated));
      setEntries(updated);
      await addXp(10);
      setContent('');
      setInsight('');
      Alert.alert('Saved ✓', 'Your reflection has been saved. +10 XP');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    Alert.alert('Delete entry', 'Remove this journal entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = entries.filter((e) => e.id !== id);
          setEntries(updated);
          await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(updated));
        },
      },
    ]);
  }

  function renderEntry({ item }: { item: JournalEntry }) {
    const date = new Date(item.entryDate);
    return (
      <TouchableOpacity
        style={styles.entryCard}
        onLongPress={() => deleteEntry(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.entryHeader}>
          <Text style={styles.entryDate}>
            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          {item.insight && (
            <View style={styles.insightBadge}>
              <Ionicons name="sparkles" size={10} color="#A78BFA" />
              <Text style={styles.insightBadgeText}>insight</Text>
            </View>
          )}
        </View>
        <Text style={styles.entryPrompt} numberOfLines={1}>📌 {item.prompt}</Text>
        <Text style={styles.entryContent} numberOfLines={3}>{item.content}</Text>
        {item.insight && (
          <Text style={styles.entryInsight} numberOfLines={2}>✦ {item.insight}</Text>
        )}
      </TouchableOpacity>
    );
  }

  function renderCalendarEntry(selectedDate: string) {
    const entry = entries.find((e) => new Date(e.entryDate).toISOString().slice(0, 10) === selectedDate);
    if (!entry) return <Text style={styles.calNoEntry}>No entry for this day.</Text>;
    return (
      <View style={styles.calEntryPreview}>
        <Text style={styles.calEntryDate}>{new Date(entry.entryDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
        <Text style={styles.calEntryPrompt} numberOfLines={1}>📌 {entry.prompt}</Text>
        <Text style={styles.calEntryContent}>{entry.content}</Text>
        {entry.insight ? <Text style={styles.calEntryInsight}>✦ {entry.insight}</Text> : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="book" size={22} color="#A78BFA" />
          <Text style={styles.headerTitle}>Reflect</Text>
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'write' && styles.tabBtnActive]}
            onPress={() => setView('write')}
          >
            <Ionicons name="create-outline" size={15} color={view === 'write' ? '#A78BFA' : colors.textMuted} />
            <Text style={[styles.tabText, view === 'write' && styles.tabTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'history' && styles.tabBtnActive]}
            onPress={() => setView('history')}
          >
            <Ionicons name="time-outline" size={15} color={view === 'history' ? '#A78BFA' : colors.textMuted} />
            <Text style={[styles.tabText, view === 'history' && styles.tabTextActive]}>
              History {entries.length > 0 ? `(${entries.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'calendar' && styles.tabBtnActive]}
            onPress={() => setView('calendar')}
          >
            <Ionicons name="calendar-outline" size={15} color={view === 'calendar' ? '#A78BFA' : colors.textMuted} />
            <Text style={[styles.tabText, view === 'calendar' && styles.tabTextActive]}>{t('journal.calendar')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'write' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <FlatList
            data={[]}
            renderItem={null}
            ListHeaderComponent={
              <View style={styles.writeContainer}>
                {/* Today's prompt */}
                <View style={styles.promptCard}>
                  <Text style={styles.promptLabel}>
                  <Ionicons name="sparkles" size={11} color="#A78BFA" />{' '}Today's prompt
                </Text>
                  <Text style={styles.promptText}>{todayPrompt}</Text>
                  {/* GAP-06: prompt swap button */}
                  <TouchableOpacity
                    style={[styles.swapPromptBtn, promptSwapCount >= 3 && styles.btnDisabled]}
                    onPress={handleSwapPrompt}
                    disabled={promptSwapCount >= 3}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="shuffle-outline" size={13} color="#A78BFA" />
                    <Text style={styles.swapPromptText}>
                      {promptSwapCount >= 3
                        ? t('journal.try_another_prompt') + ' (0 left)'
                        : `${t('journal.try_another_prompt')} (${3 - promptSwapCount} ${t('journal.swaps_left')})`}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Text entry */}
                <TextInput
                  style={styles.entryInput}
                  placeholder="Write your thoughts here..."
                  placeholderTextColor={colors.textDim}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  textAlignVertical="top"
                  maxLength={3000}
                />

                {/* Insight */}
                {insight ? (
                  <View style={styles.insightCard}>
                    <View style={styles.insightCardHeader}>
                      <Ionicons name="sparkles" size={14} color="#A78BFA" />
                      <Text style={styles.insightCardTitle}>AI Insight</Text>
                    </View>
                    <Text style={styles.insightCardText}>{insight}</Text>
                  </View>
                ) : null}

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.insightBtn, (!content.trim() || generatingInsight) && styles.btnDisabled]}
                    onPress={handleGenerateInsight}
                    disabled={!content.trim() || generatingInsight}
                  >
                    {generatingInsight ? (
                      <ActivityIndicator size="small" color="#A78BFA" />
                    ) : (
                      <Ionicons name="sparkles-outline" size={16} color="#A78BFA" />
                    )}
                    <Text style={styles.insightBtnText}>
                      {generatingInsight ? 'Thinking...' : 'Get Insight'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, (!content.trim() || saving) && styles.btnDisabled]}
                    onPress={handleSave}
                    disabled={!content.trim() || saving}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save +10 XP</Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        </KeyboardAvoidingView>
      ) : view === 'history' ? (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📔</Text>
              <Text style={styles.emptyTitle}>{t('journal.empty_title')}</Text>
              <Text style={styles.emptyBody}>
                {t('journal.empty_body')}
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.calendarContainer}>
          {/* Month nav */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity style={styles.calNavBtn} onPress={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.calTitle}>
              {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity style={styles.calNavBtn} onPress={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          {/* Day labels Mon-Sun */}
          <View style={styles.calDowRow}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <Text key={d} style={styles.calDowText}>{d}</Text>
            ))}
          </View>
          {/* Grid */}
          <View style={styles.calGrid}>
            {getCalendarDays(calendarDate.getFullYear(), calendarDate.getMonth()).map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={styles.calCell} />;
              const ds = calDateStr(calendarDate.getFullYear(), calendarDate.getMonth(), day);
              const todayDs = new Date().toISOString().slice(0, 10);
              const hasEntry = entries.some((e) => new Date(e.entryDate).toISOString().slice(0, 10) === ds);
              const isToday = ds === todayDs;
              const isSelected = ds === calendarSelected;
              return (
                <TouchableOpacity
                  key={ds}
                  style={[styles.calCell, isToday && styles.calCellToday, isSelected && styles.calCellSelected]}
                  onPress={() => setCalendarSelected(isSelected ? null : ds)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.calDayNum, isToday && styles.calDayNumToday]}>{day}</Text>
                  {hasEntry && <View style={styles.calDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Selected day entry */}
          {calendarSelected && renderCalendarEntry(calendarSelected)}
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background, paddingTop: RNStatusBar.currentHeight ?? 0 },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: c.text },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surface },
  tabBtnActive: { backgroundColor: '#2A1A3A', borderWidth: 1, borderColor: '#A78BFA' },
  tabText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
  tabTextActive: { color: '#A78BFA', fontWeight: '700' },
  exportPdfBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surface, borderRadius: 999, borderWidth: 1, borderColor: c.accentBg, paddingHorizontal: 10, paddingVertical: 6 },
  exportPdfText: { color: c.accent, fontSize: 12, fontWeight: '700' },
  writeContainer: { padding: 16, gap: 14 },
  promptCard: { backgroundColor: '#2A1A3A', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#4A2A6A' },
  promptLabel: { fontSize: 11, fontWeight: '600', color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  promptText: { fontSize: 16, fontWeight: '600', color: '#E8D5FF', lineHeight: 24 },
  entryInput: { backgroundColor: c.surface, borderRadius: 14, padding: 16, color: c.text, fontSize: 15, lineHeight: 22, minHeight: 160, borderWidth: 1, borderColor: c.border },
  insightCard: { backgroundColor: '#1A1228', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4A2A6A', gap: 6 },
  insightCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightCardTitle: { fontSize: 12, fontWeight: '700', color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 0.6 },
  insightCardText: { fontSize: 14, color: '#C4B5FD', lineHeight: 21 },
  actionRow: { flexDirection: 'row', gap: 10 },
  insightBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1A1228', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#4A2A6A' },
  insightBtnText: { fontSize: 14, fontWeight: '600', color: '#A78BFA' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2A1A3A', borderRadius: 12, paddingVertical: 12 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: c.text },
  btnDisabled: { opacity: 0.4 },
  historyList: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
  entryCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 6 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { fontSize: 12, color: c.textDim, fontWeight: '600' },
  insightBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1A1228', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  insightBadgeText: { fontSize: 10, color: '#A78BFA', fontWeight: '600' },
  entryPrompt: { fontSize: 12, color: c.textDim, fontStyle: 'italic' },
  entryContent: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  entryInsight: { fontSize: 13, color: '#A78BFA', lineHeight: 19, fontStyle: 'italic' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
  // GAP-06: prompt swap
  swapPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8 },
  swapPromptText: { fontSize: 12, color: '#A78BFA', fontWeight: '600' },
  // GAP-05: calendar
  calendarContainer: { flex: 1, padding: 16, gap: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  calTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  calDowRow: { flexDirection: 'row' },
  calDowText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: c.textDim, paddingVertical: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  calCellToday: { backgroundColor: '#2A1A3A', borderRadius: 8 },
  calCellSelected: { backgroundColor: '#3A1A5A', borderRadius: 8, borderWidth: 1, borderColor: '#A78BFA' },
  calDayNum: { fontSize: 13, color: c.textSecondary, fontWeight: '500' },
  calDayNumToday: { color: '#A78BFA', fontWeight: '700' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#A78BFA' },
  calNoEntry: { fontSize: 13, color: c.textDim, textAlign: 'center', paddingTop: 12 },
  calEntryPreview: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: '#4A2A6A', marginTop: 4 },
  calEntryDate: { fontSize: 12, color: c.textDim, fontWeight: '600' },
  calEntryPrompt: { fontSize: 12, color: c.textDim, fontStyle: 'italic' },
  calEntryContent: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  calEntryInsight: { fontSize: 13, color: '#A78BFA', lineHeight: 19, fontStyle: 'italic' },
  });
}
