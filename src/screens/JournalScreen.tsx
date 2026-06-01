/**
 * JournalScreen — Daily Reflect Mode
 *
 * Daily guided reflection prompts with optional AI-generated insight.
 * Each entry is stored locally in AsyncStorage.
 * Completing an entry awards XP.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import { callGeminiAPI } from '../services/gemini-service';
import { getAccessToken } from '../services/storage-service';
import type { JournalEntry } from '../types';

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

export default function JournalScreen() {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState('');
  const [insight, setInsight] = useState('');
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'write' | 'history'>('write');
  const todayPrompt = getTodayPrompt();

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, []),
  );

  async function loadEntries() {
    const raw = await AsyncStorage.getItem(JOURNAL_KEY);
    if (raw) {
      const parsed: JournalEntry[] = JSON.parse(raw);
      setEntries(parsed.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()));
    }
  }

  async function handleGenerateInsight() {
    if (!content.trim()) return;
    setGeneratingInsight(true);
    try {
      const byokKey = await SecureStore.getItemAsync('innerspace_api_key');
      const oauthToken = await getAccessToken();
      const token = byokKey || oauthToken || '';
      if (!token) {
        setInsight('Connect an AI provider in Settings to generate insights.');
        return;
      }
      const result = await callGeminiAPI(
        `Based on this journal entry, give one warm, non-judgmental insight in 2-3 sentences. Do not give advice unless asked. Just reflect and acknowledge.\n\nPrompt: ${todayPrompt}\n\nEntry: ${content}`,
        'You are a warm and empathetic journal companion. Be gentle, honest, and encouraging.',
        [],
        token,
      );
      if (!result.isSafetyRedirect) {
        setInsight(result.text);
      }
    } finally {
      setGeneratingInsight(false);
    }
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
      await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(updated));
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

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✍️ Reflect</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'write' && styles.tabBtnActive]}
            onPress={() => setView('write')}
          >
            <Text style={[styles.tabText, view === 'write' && styles.tabTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, view === 'history' && styles.tabBtnActive]}
            onPress={() => setView('history')}
          >
            <Text style={[styles.tabText, view === 'history' && styles.tabTextActive]}>
              History {entries.length > 0 ? `(${entries.length})` : ''}
            </Text>
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
                  <Text style={styles.promptLabel}>Today's prompt</Text>
                  <Text style={styles.promptText}>{todayPrompt}</Text>
                </View>

                {/* Text entry */}
                <TextInput
                  style={styles.entryInput}
                  placeholder="Write your thoughts here..."
                  placeholderTextColor="#5A6478"
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
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📔</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyBody}>
                Write your first reflection today. Each entry earns 10 XP.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    paddingTop: RNStatusBar.currentHeight ?? 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#111827',
  },
  tabBtnActive: {
    backgroundColor: '#2A1A3A',
    borderWidth: 1,
    borderColor: '#A78BFA',
  },
  tabText: {
    fontSize: 13,
    color: '#8B9CC8',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#A78BFA',
    fontWeight: '700',
  },
  writeContainer: {
    padding: 16,
    gap: 14,
  },
  promptCard: {
    backgroundColor: '#2A1A3A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4A2A6A',
  },
  promptLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A78BFA',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  promptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5FF',
    lineHeight: 24,
  },
  entryInput: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  insightCard: {
    backgroundColor: '#1A1228',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4A2A6A',
    gap: 6,
  },
  insightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  insightCardText: {
    fontSize: 14,
    color: '#C4B5FD',
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  insightBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1A1228',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#4A2A6A',
  },
  insightBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A78BFA',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2A1A3A',
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  historyList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
    flexGrow: 1,
  },
  entryCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryDate: {
    fontSize: 12,
    color: '#5A6478',
    fontWeight: '600',
  },
  insightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1A1228',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  insightBadgeText: {
    fontSize: 10,
    color: '#A78BFA',
    fontWeight: '600',
  },
  entryPrompt: {
    fontSize: 12,
    color: '#5A6478',
    fontStyle: 'italic',
  },
  entryContent: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  entryInsight: {
    fontSize: 13,
    color: '#A78BFA',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#8B9CC8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
