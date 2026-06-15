/**
 * DecisionScreen — Structured Decision Coaching Mode
 *
 * Guides the user through a two-option decision using AI-powered analysis.
 * Sessions are persisted locally so users can review past decisions.
 * Implements: GAP-08 (persistence), GAP-09 (history view), GAP-07 (clarity score).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callAI } from '../services/gemini-service';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import type { DecisionSession } from '../types';

const DECISION_SESSIONS_KEY = '@innerspace:decision_sessions';
const DECISION_DRAFT_KEY = '@innerspace:decision_draft';

const DECISION_SYSTEM_PROMPT = `You are a calm, thoughtful life coach helping someone make an important decision. You speak like a trusted friend who thinks clearly — not a consultant, not a chatbot.

RULES:
- Never identify yourself as an AI.
- Speak warmly, directly, and conversationally — short sentences, plain language.
- Do not use hollow phrases like "Great question!" or "Certainly!".
- If the decision involves risk to safety, health, or finances, gently recommend professional advice.
- Structure your analysis clearly but don't be robotic.

FORMAT for your response:
1. Briefly reflect the decision back in your own words (1-2 sentences).
2. Analyse Option A — key upsides, key risks (3-4 bullet points total).
3. Analyse Option B — key upsides, key risks (3-4 bullet points total).
4. A short honest "what I'd think about" section — questions worth sitting with.
5. Close with one grounding sentence.`;

type ScreenView = 'form' | 'result' | 'history' | 'historyDetail';

export default function DecisionScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Form state
  const [decision, setDecision] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // View + session state
  const [view, setView] = useState<ScreenView>('form');
  const [sessions, setSessions] = useState<DecisionSession[]>([]);
  const [currentSession, setCurrentSession] = useState<DecisionSession | null>(null);
  const [selectedSession, setSelectedSession] = useState<DecisionSession | null>(null);

  // Clarity score state
  const [clarityScore, setClarityScore] = useState<number | null>(null);
  const [claritySaved, setClaritySaved] = useState(false);

  const canStart = decision.trim().length > 0 && optionA.trim().length > 0 && optionB.trim().length > 0;

  useFocusEffect(
    useCallback(() => {
      loadSessions();
      AsyncStorage.getItem(DECISION_DRAFT_KEY).then((raw) => {
        if (!raw) return;
        try {
          const draft = JSON.parse(raw);
          if (draft.decision) setDecision(draft.decision);
          if (draft.optionA) setOptionA(draft.optionA);
          if (draft.optionB) setOptionB(draft.optionB);
        } catch { /* ignore */ }
      });
    }, []),
  );

  async function loadSessions() {
    const raw = await AsyncStorage.getItem(DECISION_SESSIONS_KEY);
    if (raw) {
      const parsed: DecisionSession[] = JSON.parse(raw);
      setSessions(parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
  }

  async function saveSession(session: DecisionSession) {
    const raw = await AsyncStorage.getItem(DECISION_SESSIONS_KEY);
    const existing: DecisionSession[] = raw ? JSON.parse(raw) : [];
    const idx = existing.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      existing[idx] = session;
    } else {
      existing.unshift(session);
    }
    await AsyncStorage.setItem(DECISION_SESSIONS_KEY, JSON.stringify(existing));
    setSessions(existing.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }

  async function handleStart() {
    if (!canStart) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `I need help deciding: ${decision.trim()}\n\nOption A: ${optionA.trim()}\nOption B: ${optionB.trim()}`;
      const response = await callAI(prompt, DECISION_SYSTEM_PROMPT, []);
      if (response.error === 'no_key') {
        setError('You\'ll need to set up a helper in Settings before using this feature.');
        return;
      }
      if (response.error || response.isQuotaLimited) {
        setError(response.text);
        return;
      }
      const session: DecisionSession = {
        id: Date.now().toString(),
        decision: decision.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        analysis: response.text,
        createdAt: new Date(),
      };
      await saveSession(session);
      setCurrentSession(session);
      setClarityScore(null);
      setClaritySaved(false);
      setView('result');
    } catch {
      setError('Something didn\'t go as planned. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveClarityScore() {
    if (!currentSession || clarityScore === null) return;
    const updated: DecisionSession = { ...currentSession, clarityScore };
    await saveSession(updated);
    setCurrentSession(updated);
    setClaritySaved(true);
  }

  function saveDraft() {
    AsyncStorage.setItem(DECISION_DRAFT_KEY, JSON.stringify({ decision, optionA, optionB })).catch(() => {});
  }

  function handleReset() {
    setDecision('');
    setOptionA('');
    setOptionB('');
    setCurrentSession(null);
    setClarityScore(null);
    setClaritySaved(false);
    setError('');
    AsyncStorage.removeItem(DECISION_DRAFT_KEY).catch(() => {});
    setView('form');
  }

  function handleViewHistory(session: DecisionSession) {
    setSelectedSession(session);
    setView('historyDetail');
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  function renderHeader() {
    const showBack = view === 'historyDetail';
    const showNew = view === 'result' || view === 'history' || view === 'historyDetail';
    return (
      <View style={styles.header}>
        <TouchableOpacity
          onPress={showBack ? () => setView('history') : () => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityLabel={showBack ? 'Back to history' : 'Go back'}
          accessibilityRole="button"
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('decide.title')}</Text>
        <View style={styles.headerRight}>
          {showNew && (
            <TouchableOpacity onPress={handleReset} style={styles.headerChip} activeOpacity={0.8}>
              <Feather name="plus" size={15} color={colors.accent} />
              <Text style={styles.headerChipText}>{t('decide.new_btn')}</Text>
            </TouchableOpacity>
          )}
          {(view === 'form' || view === 'result') && (
            <TouchableOpacity onPress={() => { if (view === 'form') saveDraft(); setView('history'); }} style={styles.headerChip} activeOpacity={0.8}>
              <Feather name="clock" size={15} color={colors.textMuted} />
              <Text style={[styles.headerChipText, { color: colors.textMuted }]}>{t('decide.history')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Form view ────────────────────────────────────────────────────────────────
  function renderForm() {
    return (
      <>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('decide.what_deciding')}</Text>
          <TextInput
            style={[styles.input, styles.inputLarge]}
            placeholder={t('decide.decision_placeholder')}
            placeholderTextColor={colors.textDim}
            value={decision}
            onChangeText={setDecision}
            multiline
            maxLength={300}
            editable={!loading}
          />
        </View>
        <View style={styles.optionsRow}>
          <View style={[styles.section, styles.optionSection]}>
            <Text style={[styles.sectionLabel, styles.optionLabelA]}>{t('decide.option_a')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('decide.option_placeholder_a')}
              placeholderTextColor={colors.textDim}
              value={optionA}
              onChangeText={setOptionA}
              multiline
              maxLength={150}
              editable={!loading}
            />
          </View>
          <View style={[styles.section, styles.optionSection]}>
            <Text style={[styles.sectionLabel, styles.optionLabelB]}>{t('decide.option_b')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('decide.option_placeholder_b')}
              placeholderTextColor={colors.textDim}
              value={optionB}
              onChangeText={setOptionB}
              multiline
              maxLength={150}
              editable={!loading}
            />
          </View>
        </View>
        {!canStart && !loading && (
          <Text style={styles.hintText}>{t('decide.empty_hint')}</Text>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.startBtn, (!canStart || loading) && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!canStart || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.startBtnText}>{t('decide.thinking')}</Text>
            </>
          ) : (
            <>
              <Feather name="bar-chart-2" size={18} color="#FFFFFF" />
              <Text style={styles.startBtnText}>{t('decide.start')}</Text>
            </>
          )}
        </TouchableOpacity>
      </>
    );
  }

  // ── Result view ──────────────────────────────────────────────────────────────
  function renderResult(session: DecisionSession) {
    return (
      <>
        <View style={styles.decisionSummary}>
          <Text style={styles.decisionSummaryText}>{session.decision}</Text>
          <View style={styles.optionPills}>
            <View style={[styles.pill, styles.pillA]}>
              <Text style={styles.pillTextA}>{t('decide.option_a')}: {session.optionA}</Text>
            </View>
            <View style={[styles.pill, styles.pillB]}>
              <Text style={styles.pillTextB}>{t('decide.option_b')}: {session.optionB}</Text>
            </View>
          </View>
        </View>

        <View style={styles.analysisCard}>
          <View style={styles.analysisHeader}>
            <Feather name="zap" size={16} color={colors.accent} />
            <Text style={styles.analysisLabel}>Here's what I'm thinking</Text>
          </View>
          <Text style={styles.analysisText}>{session.analysis}</Text>
        </View>

        {/* Clarity score — GAP-07 */}
        <View style={styles.clarityCard}>
          <Text style={styles.clarityPrompt}>{t('decide.clarity_prompt')}</Text>
          <View style={styles.clarityRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.clarityBtn, (clarityScore ?? session.clarityScore) === n && styles.clarityBtnActive]}
                onPress={() => { setClarityScore(n); setClaritySaved(false); }}
                activeOpacity={0.8}
              >
                <Text style={[(clarityScore ?? session.clarityScore) === n ? styles.clarityNumActive : styles.clarityNum]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {clarityScore !== null && !claritySaved && (
            <TouchableOpacity style={styles.claritySaveBtn} onPress={handleSaveClarityScore} activeOpacity={0.85}>
              <Feather name="check-circle" size={16} color={colors.accent} />
              <Text style={styles.claritySaveBtnText}>{t('decide.clarity_save')}</Text>
            </TouchableOpacity>
          )}
          {(claritySaved || (session.clarityScore !== undefined && clarityScore === null)) && (
            <View style={styles.claritySavedRow}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={styles.claritySavedText}>{t('decide.clarity_saved')} Â· {session.clarityScore ?? clarityScore}/10</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.resetBtnLarge} onPress={handleReset} activeOpacity={0.8}>
          <Feather name="refresh-cw" size={18} color={colors.accent} />
          <Text style={styles.resetBtnLargeText}>{t('decide.new_decision')}</Text>
        </TouchableOpacity>
      </>
    );
  }

  // ── History list ─────────────────────────────────────────────────────────────
  function renderHistoryItem({ item }: { item: DecisionSession }) {
    const date = new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return (
      <TouchableOpacity style={styles.historyCard} onPress={() => handleViewHistory(item)} activeOpacity={0.85}>
        <View style={styles.historyCardTop}>
          <Text style={styles.historyDate}>{date}</Text>
          {item.clarityScore !== undefined && (() => {
            const score = item.clarityScore!;
            const bg = score >= 8 ? '#052E16' : score >= 5 ? '#2A1A03' : '#1A0A0A';
            const fg = score >= 8 ? '#4ADE80' : score >= 5 ? '#FCD34D' : '#F87171';
            return (
              <View style={[styles.clarityBadge, { backgroundColor: bg }]}>
                <Feather name="compass" size={11} color={fg} />
                <Text style={[styles.clarityBadgeText, { color: fg }]}>{score}/10</Text>
              </View>
            );
          })()}
        </View>
        <Text style={styles.historyDecision} numberOfLines={2}>{item.decision}</Text>
        <View style={styles.historyPills}>
          <View style={[styles.pill, styles.pillA, styles.pillSm]}><Text style={[styles.pillTextA, styles.pillTextSm]}>{item.optionA}</Text></View>
          <View style={[styles.pill, styles.pillB, styles.pillSm]}><Text style={[styles.pillTextB, styles.pillTextSm]}>{item.optionB}</Text></View>
        </View>
        <View style={styles.viewAnalysisRow}>
          <Text style={styles.viewAnalysisText}>{t('decide.view_analysis')}</Text>
          <Feather name="chevron-right" size={14} color={colors.textDim} />
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {renderHeader()}

        {view === 'history' ? (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
            contentContainerStyle={styles.historyList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="compass" size={44} color={colors.textDim} />
                <Text style={styles.emptyTitle}>{t('decide.history_empty')}</Text>
                <Text style={styles.emptyHint}>{t('decide.history_hint')}</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={handleReset} activeOpacity={0.8}>
                  <Feather name="plus-circle" size={16} color={colors.accent} />
                  <Text style={styles.emptyBtnText}>{t('decide.new_decision')}</Text>
                </TouchableOpacity>
              </View>
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {view === 'form' && renderForm()}
            {view === 'result' && currentSession && renderResult(currentSession)}
            {view === 'historyDetail' && selectedSession && renderResult(selectedSession)}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: c.text, marginLeft: 4 },
    headerRight: { flexDirection: 'row', gap: 6 },
    headerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: c.surfaceAlt },
    headerChipText: { fontSize: 12, color: c.accent, fontWeight: '600' },
    scroll: { padding: 20, gap: 16 },
    section: { gap: 8 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.7 },
    optionLabelA: { color: '#4ADE80' },
    optionLabelB: { color: c.accent },
    input: { backgroundColor: c.surface, borderRadius: 12, padding: 14, color: c.text, fontSize: 15, borderWidth: 1, borderColor: c.border, minHeight: 54 },
    inputLarge: { minHeight: 90, paddingTop: 14, textAlignVertical: 'top' },
    optionsRow: { flexDirection: 'row', gap: 12 },
    optionSection: { flex: 1 },
    hintText: { fontSize: 13, color: c.textDim, textAlign: 'center', paddingHorizontal: 16 },
    errorText: { fontSize: 13, color: c.danger, textAlign: 'center', paddingHorizontal: 8 },
    startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16 },
    startBtnDisabled: { opacity: 0.45 },
    startBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    decisionSummary: { backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: c.border },
    decisionSummaryText: { fontSize: 15, fontWeight: '600', color: c.text, lineHeight: 22 },
    optionPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
    pillSm: { paddingHorizontal: 8, paddingVertical: 4 },
    pillA: { backgroundColor: c.surfaceAlt, borderColor: '#4ADE80' },
    pillB: { backgroundColor: c.accentBg, borderColor: c.accent },
    pillTextA: { fontSize: 12, color: '#4ADE80', fontWeight: '600' },
    pillTextB: { fontSize: 12, color: c.accent, fontWeight: '600' },
    pillTextSm: { fontSize: 11 },
    analysisCard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: c.border },
    analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    analysisLabel: { fontSize: 12, fontWeight: '700', color: c.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
    analysisText: { fontSize: 15, color: c.textSecondary, lineHeight: 24 },
    // Clarity score (GAP-07)
    clarityCard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: c.border },
    clarityPrompt: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    clarityRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    clarityBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
    clarityBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
    clarityNum: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    clarityNumActive: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    claritySaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.accentBg, borderRadius: 10, paddingVertical: 10 },
    claritySaveBtnText: { fontSize: 14, fontWeight: '600', color: c.accent },
    claritySavedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    claritySavedText: { fontSize: 13, color: c.success, fontWeight: '600' },
    resetBtnLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.surfaceAlt, borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: c.border },
    resetBtnLargeText: { fontSize: 15, fontWeight: '600', color: c.accent },
    // History list
    historyList: { padding: 16, gap: 12, flexGrow: 1 },
    historyCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: c.border },
    historyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    historyDate: { fontSize: 11, color: c.textDim, fontWeight: '600' },
    clarityBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.accentBg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    clarityBadgeText: { fontSize: 11, color: c.accent, fontWeight: '700' },
    historyDecision: { fontSize: 14, fontWeight: '600', color: c.text, lineHeight: 20 },
    historyPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    viewAnalysisRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
    viewAnalysisText: { fontSize: 12, color: c.textDim, fontWeight: '500' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' },
    emptyHint: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentBg, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
    emptyBtnText: { fontSize: 14, fontWeight: '600', color: c.accent },
  });
}
