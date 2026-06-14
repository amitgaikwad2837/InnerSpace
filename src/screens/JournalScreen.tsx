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
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InnerSpaceLogo from '../components/InnerSpaceLogo';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import Voice, { type SpeechResultsEvent, type SpeechErrorEvent } from '@react-native-voice/voice';
import { secureGet, secureSet } from '../services/storage-encryption';
import { callAI } from '../services/gemini-service';
import type { JournalEntry, Habit } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';

const JOURNAL_KEY = '@innerspace:journal_entries';
const HABITS_KEY = '@innerspace:habits';
const XP_KEY = '@innerspace:xp';
const LINE_HEIGHT = 28;

const SUGGEST_AGENTS: Record<string, { name: string; emoji: string }> = {
  yoga:            { name: 'Yoga & Mindfulness', emoji: '🧘' },
  fitness:         { name: 'Fitness Coach',       emoji: '🏋️' },
  nutrition:       { name: 'Nutrition Guide',     emoji: '🥗' },
  sleep:           { name: 'Sleep Coach',         emoji: '😴' },
  career:          { name: 'Career Coach',        emoji: '💼' },
  study:           { name: 'Study Buddy',         emoji: '📚' },
  habit_builder:   { name: 'Habit Builder',       emoji: '🔁' },
  confidence:      { name: 'Confidence Coach',    emoji: '⭐' },
  time_management: { name: 'Time Manager',        emoji: '⏰' },
  life_goals:      { name: 'Life Goals Coach',    emoji: '🎯' },
  budget:          { name: 'Budget Awareness',    emoji: '💰' },
  writing:         { name: 'Writing Coach',       emoji: '✍️' },
  entrepreneur:    { name: 'Business Starter',    emoji: '🚀' },
};

const EMOTION_TAGS = ['grateful', 'hopeful', 'calm', 'excited', 'anxious', 'sad', 'frustrated', 'overwhelmed'] as const;
type EmotionTag = typeof EMOTION_TAGS[number];

const DIFFICULT_KEYWORDS = ['anxious', 'overwhelmed', 'hopeless', 'depressed', 'sad', 'exhausted', 'worthless', 'despair', 'crying', 'empty'];
function isDifficultEntry(text: string): boolean {
  const lower = text.toLowerCase();
  return DIFFICULT_KEYWORDS.some((w) => lower.includes(w));
}

interface JournalAnalysis {
  summary: string;
  habitSuggestions: Array<{ name: string; reason: string }>;
  helperSuggestion: { agentId: string; reason: string } | null;
}

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
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState(route.params?.prefill ?? '');
  const [insight, setInsight] = useState('');
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voicePartial, setVoicePartial] = useState('');
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [analysis, setAnalysis] = useState<JournalAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [view, setView] = useState<'write' | 'history' | 'calendar'>('write');
  const [selectedTags, setSelectedTags] = useState<EmotionTag[]>([]);
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

  useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0]?.trim();
      if (text) {
        setContent((prev: string) => {
          const sep = prev && !prev.endsWith('\n') && !prev.endsWith(' ') ? ' ' : '';
          return prev + sep + text;
        });
      }
      setVoicePartial('');
    };
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      setVoicePartial(e.value?.[0] ?? '');
    };
    Voice.onSpeechEnd = () => { setIsListening(false); setVoicePartial(''); };
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setIsListening(false);
      setVoicePartial('');
      const msg = String((e.error as any)?.message ?? '');
      if (msg && !msg.includes('cancel') && !msg.includes('stopped')) {
        Alert.alert('Voice error', 'Could not recognise speech. Please try again.');
      }
    };
    return () => { Voice.destroy().catch(() => {}); };
  }, []);

  async function toggleVoice() {
    if (isListening) {
      try { await Voice.stop(); } catch { /* ignore */ }
      setIsListening(false);
      setVoicePartial('');
      return;
    }
    if (Platform.OS === 'android') {
      const { PermissionsAndroid } = require('react-native');
      const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (!already) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone access',
            message: 'InnerSpace needs your microphone to record diary entries by voice.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          },
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
    }
    try {
      setIsListening(true);
      await Voice.start('en-US');
    } catch (err: any) {
      setIsListening(false);
      const msg: string = err?.message ?? '';
      const isNullModule = msg.includes('null') || msg.includes('NativeModule') || msg.includes('RNVoice');
      Alert.alert(
        'Microphone unavailable',
        isNullModule
          ? 'Speech recognition service could not be reached. Try installing a speech recognition app.'
          : 'Could not start voice input. Check that microphone permission is granted in Settings.',
        isNullModule
          ? [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Find in Play Store',
                onPress: () =>
                  Linking.openURL('market://search?q=speech+recognition&c=apps').catch(() =>
                    Linking.openURL('https://play.google.com/store/search?q=speech+recognition&c=apps'),
                  ),
              },
            ]
          : [{ text: 'OK' }],
      );
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
        setInsight('Connect a helper in Settings to get a reflection on your entry.');
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
        tags: selectedTags.length > 0 ? [...selectedTags] : undefined,
      };
      const updated = [entry, ...entries];
      await secureSet(JOURNAL_KEY, JSON.stringify(updated));
      setEntries(updated);
      await addXp(10);
      const savedContent = content.trim();
      const savedPrompt = todayPrompt;
      setContent('');
      setInsight('');
      setSelectedTags([]);
      runJournalAnalysis(savedContent, savedPrompt);
    } finally {
      setSaving(false);
    }
  }

  async function runJournalAnalysis(entryContent: string, entryPrompt: string) {
    const difficult = isDifficultEntry(entryContent);
    setAnalysis(null);
    setAnalysisLoading(true);
    setAnalysisVisible(true);
    try {
      const habitsRaw = await secureGet(HABITS_KEY);
      const existingHabits: Habit[] = habitsRaw ? JSON.parse(habitsRaw) : [];
      const existingNames = existingHabits.map((h) => h.name).join(', ');
      const agentIds = Object.keys(SUGGEST_AGENTS).join(', ');

      const userMsg = `Journal prompt: "${entryPrompt}"
Journal entry: "${entryContent.slice(0, 800)}"
${existingNames ? `User already tracks these habits (do not suggest them): ${existingNames}` : ''}

Suggest 1 or 2 short daily habits directly inspired by what the user wrote. Pick one InnerSpace helper from: ${agentIds}.

Return exactly this JSON (no markdown):
{
  "summary": "One warm sentence about what this entry reveals",
  "habitSuggestions": [
    { "name": "Habit name under 6 words", "reason": "Why this helps, one sentence" }
  ],
  "helperSuggestion": { "agentId": "one_id_from_the_list", "reason": "Why this helper, one sentence" }
}`;

      const aiCall = callAI(userMsg, 'You are a wellness analyst. Return only valid JSON. No markdown fences.', []);
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
      const response = await Promise.race([aiCall, timeout]);

      if (!response || response.error || response.isSafetyRedirect) {
        setAnalysisVisible(false);
        fallbackAlert(difficult);
        return;
      }

      const jsonMatch = response.text.trim().match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        setAnalysisVisible(false);
        fallbackAlert(difficult);
        return;
      }

      const parsed: JournalAnalysis = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.habitSuggestions)) parsed.habitSuggestions = [];
      if (parsed.helperSuggestion && !SUGGEST_AGENTS[parsed.helperSuggestion.agentId]) {
        parsed.helperSuggestion = null;
      }
      if (difficult && !parsed.helperSuggestion) {
        parsed.helperSuggestion = { agentId: 'yoga', reason: 'Mindfulness can help when feelings are heavy.' };
      }
      setAnalysis(parsed);
    } catch {
      setAnalysisVisible(false);
      fallbackAlert(difficult);
    } finally {
      setAnalysisLoading(false);
    }
  }

  function fallbackAlert(difficult: boolean) {
    if (difficult) {
      Alert.alert(
        "You're not alone 💙",
        'It sounds like today has been heavy. Would you like to talk to a supportive helper?',
        [
          { text: 'Not now', style: 'cancel', onPress: () => Alert.alert('Saved ✓', 'Your reflection has been saved. +10 XP') },
          { text: 'Talk to someone', onPress: () => navigation.navigate('Chat', { agentId: 'yoga' }) },
        ],
      );
    } else {
      Alert.alert('Saved ✓', 'Your reflection has been saved. +10 XP');
    }
  }

  async function handleAddSuggestedHabit(name: string) {
    try {
      const raw = await secureGet(HABITS_KEY);
      const existing: Habit[] = raw ? JSON.parse(raw) : [];
      const newHabit: Habit = {
        id: Date.now().toString(),
        name,
        frequency: 'daily',
        streak: 0,
        createdAt: new Date(),
      };
      await secureSet(HABITS_KEY, JSON.stringify([...existing, newHabit]));
      setAnalysis((prev) =>
        prev ? { ...prev, habitSuggestions: prev.habitSuggestions.filter((h) => h.name !== name) } : prev,
      );
      Alert.alert('Added ✓', `"${name}" has been added to your habits.`);
    } catch {
      Alert.alert('Error', 'Could not add habit. Please try again.');
    }
  }

  async function deleteEntry(id: string) {
    Alert.alert('Remove this entry?', 'This reflection will be gone for good.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
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
              <Feather name="zap" size={10} color={colors.accent} />
              <Text style={styles.insightBadgeText}>insight</Text>
            </View>
          )}
        </View>
        <Text style={styles.entryPrompt} numberOfLines={1}>📌 {item.prompt}</Text>
        <Text style={styles.entryContent} numberOfLines={3}>{item.content}</Text>
        {item.tags && item.tags.length > 0 && (
          <View style={styles.entryTagRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={styles.entryTagChip}>
                <Text style={styles.entryTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
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
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <InnerSpaceLogo size={26} />
          <Text style={styles.headerTitle}>My Diary</Text>
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'write' && styles.tabBtnActive]}
            onPress={() => setView('write')}
          >
            <Feather name="edit-3" size={15} color={view === 'write' ? '#A78BFA' : colors.textMuted} />
            <Text style={[styles.tabText, view === 'write' && styles.tabTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'history' && styles.tabBtnActive]}
            onPress={() => setView('history')}
          >
            <Feather name="clock" size={15} color={view === 'history' ? '#A78BFA' : colors.textMuted} />
            <Text style={[styles.tabText, view === 'history' && styles.tabTextActive]}>
              Entries {entries.length > 0 ? `(${entries.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'calendar' && styles.tabBtnActive]}
            onPress={() => setView('calendar')}
          >
            <Feather name="calendar" size={15} color={view === 'calendar' ? '#A78BFA' : colors.textMuted} />
            <Text style={[styles.tabText, view === 'calendar' && styles.tabTextActive]}>{t('journal.calendar')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'write' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Date header */}
            <View style={styles.diaryDateRow}>
              <Text style={styles.diaryDayName}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              <Text style={styles.diaryDateLabel}>
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>

            {/* Prompt pill */}
            <TouchableOpacity
              style={[styles.promptPill, promptSwapCount >= 3 && { opacity: 0.5 }]}
              onPress={handleSwapPrompt}
              disabled={promptSwapCount >= 3}
              activeOpacity={0.75}
            >
              <Feather name="feather" size={11} color={colors.accent} />
              <Text style={styles.promptPillText} numberOfLines={2}>{todayPrompt}</Text>
              {promptSwapCount < 3 && <Feather name="refresh-cw" size={11} color={colors.textDim} />}
            </TouchableOpacity>

            {/* Lined diary page */}
            <View style={styles.linedPage}>
              {Array.from({ length: 60 }).map((_, i) => (
                <View key={`l${i}`} style={[styles.ruleLine, { top: i * LINE_HEIGHT }]} />
              ))}
              <View style={styles.pageMarginLine} />
              <Text style={styles.dearDiaryText}>Dear Diary,</Text>
              <TextInput
                style={styles.diaryInput}
                value={content}
                onChangeText={setContent}
                placeholder="Start writing..."
                placeholderTextColor={colors.textDim}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
              {isListening && voicePartial ? (
                <Text style={styles.voicePartialText}>✦ {voicePartial}…</Text>
              ) : null}
            </View>

            {/* Emotion tags — horizontal scroll */}
            <View style={styles.tagSection}>
              <Text style={styles.tagLabel}>How are you feeling?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              >
                {EMOTION_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, active && styles.tagChipActive]}
                      onPress={() =>
                        setSelectedTags((prev) =>
                          active ? prev.filter((tt) => tt !== tag) : [...prev, tag],
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Insight card */}
            {insight ? (
              <View style={[styles.insightCard, { marginHorizontal: 16, marginTop: 8 }]}>
                <View style={styles.insightCardHeader}>
                  <Feather name="zap" size={14} color={colors.accent} />
                  <Text style={styles.insightCardTitle}>A thought on this</Text>
                </View>
                <Text style={styles.insightCardText}>{insight}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Floating action bar */}
          <View style={styles.diaryFabRow}>
            <TouchableOpacity
              style={[styles.insightFab, (!content.trim() || generatingInsight) && { opacity: 0.45 }]}
              onPress={handleGenerateInsight}
              disabled={!content.trim() || generatingInsight}
              activeOpacity={0.8}
            >
              {generatingInsight
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Feather name="zap" size={18} color={colors.accent} />}
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.micFab, isListening && styles.micFabActive]}
              onPress={toggleVoice}
              activeOpacity={0.8}
            >
              <Feather name={isListening ? 'mic-off' : 'mic'} size={21} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveFab, (!content.trim() || saving) && { opacity: 0.45 }]}
              onPress={handleSave}
              disabled={!content.trim() || saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="check" size={18} color="#fff" />}
              <Text style={styles.saveFabText}>Save</Text>
            </TouchableOpacity>
          </View>
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
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>
                Your reflections will show up here. Start with today's prompt — it only takes a few minutes.
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.calendarContainer}>
          {/* Month nav */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity style={styles.calNavBtn} onPress={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <Feather name="chevron-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.calTitle}>
              {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity style={styles.calNavBtn} onPress={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <Feather name="chevron-right" size={20} color={colors.text} />
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
              const entry = entries.find((e) => new Date(e.entryDate).toISOString().slice(0, 10) === ds);
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
                  {entry && (
                    entry.insight
                      ? <View style={styles.calDot} />
                      : <View style={styles.calDotRing} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Selected day entry */}
          {calendarSelected && renderCalendarEntry(calendarSelected)}
        </View>
      )}

      {/* Journal AI Analysis Modal */}
      <Modal visible={analysisVisible} transparent animationType="slide" onRequestClose={() => setAnalysisVisible(false)}>
        <View style={styles.analysisOverlay}>
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeader}>
              <Text style={styles.analysisTitle}>✦ Reflection insights</Text>
              <TouchableOpacity onPress={() => setAnalysisVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {analysisLoading ? (
              <View style={styles.analysisLoadingBox}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.analysisLoadingText}>Analysing your entry…</Text>
              </View>
            ) : analysis ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.analysisBody}>
                <Text style={styles.analysisSummary}>"{analysis.summary}"</Text>

                {analysis.habitSuggestions.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisSectionTitle}>Suggested habits</Text>
                    {analysis.habitSuggestions.map((h) => (
                      <View key={h.name} style={styles.analysisSuggestionCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.analysisSuggestionName}>{h.name}</Text>
                          <Text style={styles.analysisSuggestionReason}>{h.reason}</Text>
                        </View>
                        <TouchableOpacity style={styles.analysisAddBtn} onPress={() => handleAddSuggestedHabit(h.name)}>
                          <Feather name="plus" size={15} color={colors.accent} />
                          <Text style={styles.analysisAddBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {analysis.helperSuggestion && SUGGEST_AGENTS[analysis.helperSuggestion.agentId] && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisSectionTitle}>Try talking to</Text>
                    <View style={styles.analysisHelperCard}>
                      <Text style={styles.analysisHelperEmoji}>
                        {SUGGEST_AGENTS[analysis.helperSuggestion.agentId].emoji}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.analysisHelperName}>
                          {SUGGEST_AGENTS[analysis.helperSuggestion.agentId].name}
                        </Text>
                        <Text style={styles.analysisHelperReason}>{analysis.helperSuggestion.reason}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.analysisChatBtn}
                        onPress={() => {
                          setAnalysisVisible(false);
                          navigation.navigate('Chat', { agentId: analysis!.helperSuggestion!.agentId });
                        }}
                      >
                        <Text style={styles.analysisChatBtnText}>Chat</Text>
                        <Feather name="arrow-right" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.analysisDismissBtn} onPress={() => setAnalysisVisible(false)}>
                  <Text style={styles.analysisDismissText}>Maybe later</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: c.text },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surface },
  tabBtnActive: { backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accent },
  tabText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
  tabTextActive: { color: c.accent, fontWeight: '700' },
  exportPdfBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surface, borderRadius: 999, borderWidth: 1, borderColor: c.accentBg, paddingHorizontal: 10, paddingVertical: 6 },
  exportPdfText: { color: c.accent, fontSize: 12, fontWeight: '700' },
  writeContainer: { padding: 16, gap: 14 },
  promptCard: { backgroundColor: c.accentBg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
  promptLabel: { fontSize: 11, fontWeight: '600', color: c.accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  promptText: { fontSize: 16, fontWeight: '600', color: c.text, lineHeight: 24 },
  entryInput: { backgroundColor: c.surface, borderRadius: 14, padding: 16, color: c.text, fontSize: 15, lineHeight: 22, minHeight: 160, borderWidth: 1, borderColor: c.border },
  insightCard: { backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border, gap: 6 },
  insightCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightCardTitle: { fontSize: 12, fontWeight: '700', color: c.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
  insightCardText: { fontSize: 14, color: c.textSecondary, lineHeight: 21 },
  actionRow: { flexDirection: 'row', gap: 10 },
  insightBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.surfaceAlt, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: c.accent },
  insightBtnText: { fontSize: 13, fontWeight: '600', color: c.accent, flexShrink: 1 },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },
  btnDisabled: { opacity: 0.4 },
  tagSection: { gap: 8 },
  tagLabel: { fontSize: 12, fontWeight: '600', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  tagChipActive: { backgroundColor: c.accentBg, borderColor: c.accent },
  tagChipText: { fontSize: 13, color: c.textMuted },
  tagChipTextActive: { color: c.accent, fontWeight: '600' },
  entryTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  entryTagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.border },
  entryTagText: { fontSize: 11, color: c.accent, fontWeight: '500' },
  historyList: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
  entryCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 6 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { fontSize: 12, color: c.textDim, fontWeight: '600' },
  insightBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.accentBg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  insightBadgeText: { fontSize: 10, color: c.accent, fontWeight: '600' },
  entryPrompt: { fontSize: 12, color: c.textDim, fontStyle: 'italic' },
  entryContent: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  entryInsight: { fontSize: 13, color: c.accent, lineHeight: 19, fontStyle: 'italic' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
  swapPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8 },
  swapPromptText: { fontSize: 12, color: c.accent, fontWeight: '600' },
  calendarContainer: { flex: 1, padding: 16, gap: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  calTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  calDowRow: { flexDirection: 'row' },
  calDowText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: c.textDim, paddingVertical: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  calCellToday: { backgroundColor: c.accentBg, borderRadius: 8 },
  calCellSelected: { backgroundColor: c.accentBg, borderRadius: 8, borderWidth: 1.5, borderColor: c.accent },
  calDayNum: { fontSize: 13, color: c.textSecondary, fontWeight: '500' },
  calDayNumToday: { color: c.accent, fontWeight: '700' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent },
  calDotRing: { width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: c.accent },
  charCount: { fontSize: 11, color: c.textDim, textAlign: 'right', marginTop: -8 },
  charCountWarning: { color: '#EF4444' },
  calNoEntry: { fontSize: 13, color: c.textDim, textAlign: 'center', paddingTop: 12 },
  calEntryPreview: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: c.border, marginTop: 4 },
  calEntryDate: { fontSize: 12, color: c.textDim, fontWeight: '600' },
  calEntryPrompt: { fontSize: 12, color: c.textDim, fontStyle: 'italic' },
  calEntryContent: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  calEntryInsight: { fontSize: 13, color: c.accent, lineHeight: 19, fontStyle: 'italic' },
  // Diary write view
  diaryDateRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 3 },
  diaryDayName: { fontSize: 28, fontWeight: '700', color: c.text, letterSpacing: -0.5 },
  diaryDateLabel: { fontSize: 13, color: c.textDim, fontWeight: '500' },
  promptPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 10, backgroundColor: c.accentBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  promptPillText: { fontSize: 12, color: c.accent, lineHeight: 17, maxWidth: 220 },
  linedPage: { minHeight: LINE_HEIGHT * 60, position: 'relative', backgroundColor: c.surface },
  ruleLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border, opacity: 0.7 },
  pageMarginLine: { position: 'absolute', left: 22, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(167,139,250,0.18)' },
  dearDiaryText: { paddingLeft: 36, paddingRight: 20, paddingTop: 10, paddingBottom: 2, fontSize: 17, fontStyle: 'italic', fontWeight: '600', color: c.accent, lineHeight: LINE_HEIGHT },
  diaryInput: { paddingLeft: 36, paddingRight: 20, paddingBottom: 60, fontSize: 16, lineHeight: LINE_HEIGHT, color: c.text, backgroundColor: 'transparent' },
  voicePartialText: { paddingLeft: 36, paddingRight: 20, paddingBottom: 12, fontSize: 15, lineHeight: LINE_HEIGHT, color: c.textDim, fontStyle: 'italic' },
  diaryFabRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  insightFab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.accent },
  micFab: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
  micFabActive: { backgroundColor: '#EF4444' },
  saveFab: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accent, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11 },
  saveFabText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Analysis modal
  analysisOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  analysisCard: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 36, maxHeight: '85%' },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  analysisTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  analysisLoadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 14 },
  analysisLoadingText: { fontSize: 14, color: c.textMuted },
  analysisBody: { gap: 20, paddingBottom: 8 },
  analysisSummary: { fontSize: 15, color: c.textSecondary, lineHeight: 23, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 4 },
  analysisSection: { gap: 10 },
  analysisSectionTitle: { fontSize: 11, fontWeight: '700', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.8 },
  analysisSuggestionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
  analysisSuggestionName: { fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 2 },
  analysisSuggestionReason: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
  analysisAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.accent },
  analysisAddBtnText: { fontSize: 13, fontWeight: '700', color: c.accent },
  analysisHelperCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.accentBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.accent },
  analysisHelperEmoji: { fontSize: 28 },
  analysisHelperName: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
  analysisHelperReason: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
  analysisChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  analysisChatBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  analysisDismissBtn: { alignSelf: 'center', paddingVertical: 10 },
  analysisDismissText: { fontSize: 14, color: c.textDim },
  });
}
