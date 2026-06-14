import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar as RNStatusBar,
  Alert,
  Modal,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/auth';
import { getCatalogAgents } from '../services/agents-catalog';
import { AI_MODE_KEY, USER_PROFILE_KEY } from '../constants/local-models';
import type { Agent, Habit, JournalEntry, Conversation, PinnedInsight } from '../types';
import InnerSpaceLogo from '../components/InnerSpaceLogo';
import AppTour, { TOUR_DONE_KEY } from '../components/AppTour';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import { secureSet } from '../services/storage-encryption';

const FIRST_RUN_BANNER_KEY = '@innerspace:first_run_banner_dismissed';
const OPEN_DATES_KEY = '@innerspace:open_dates';
const STREAK_KEY = '@innerspace:streak';
const XP_KEY = '@innerspace:xp';
const SELECTED_HELPERS_KEY = '@innerspace:selected_helpers';
const CHECKIN_KEY = '@innerspace:checkin_today';
const CONVERSATIONS_KEY = '@innerspace:conversations';
const HABITS_KEY = '@innerspace:habits';
const JOURNAL_KEY = '@innerspace:journal_entries';
const MOOD_HISTORY_KEY = '@innerspace:mood_history';
const LAST_OPEN_KEY = '@innerspace:last_open';
const PINNED_INSIGHTS_KEY = '@innerspace:pinned_insights';

// XP levels
const XP_LEVELS = [
  { min: 0,    title: 'Just getting started',  next: 100  },
  { min: 100,  title: 'Showing up',            next: 300  },
  { min: 300,  title: 'Building momentum',     next: 600  },
  { min: 600,  title: 'Finding my groove',     next: 1000 },
  { min: 1000, title: 'In my stride',          next: 2000 },
  { min: 2000, title: 'Unstoppable',           next: 9999 },
] as const;

function getXpLevel(xp: number) {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].min) return XP_LEVELS[i];
  }
  return XP_LEVELS[0];
}

const MILESTONES = [
  { days: 7,   emoji: '🥉', label: '7 days showing up' },
  { days: 30,  emoji: '🥈', label: '30 days strong' },
  { days: 60,  emoji: '🥇', label: '60 days — wow' },
  { days: 100, emoji: '🏆', label: '100 days. Incredible.' },
] as const;

const CHECKIN_PROMPTS = [
  'What\'s one thing you\'re grateful for right now?',
  'How are you feeling in your body today?',
  'What\'s on your mind most this morning?',
  'What would make today feel like a success?',
  'What are you looking forward to today?',
  'What\'s one thing you want to let go of?',
  'How did yesterday leave you feeling?',
  'What do you need most from yourself today?',
  'What\'s draining your energy lately?',
  'What made you smile recently?',
  'What\'s one small win you can celebrate?',
  'What are you avoiding that needs attention?',
  'How is your stress level today (1-10)?',
  'What would your future self thank you for doing today?',
  'What boundary do you need to protect today?',
];

const MOOD_OPTIONS = ['😔', '😕', '😐', '🙂', '😊'] as const;
type Mood = typeof MOOD_OPTIONS[number];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyPrompt() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return CHECKIN_PROMPTS[dayOfYear % CHECKIN_PROMPTS.length];
}

function getGreetingKey(): 'home.greeting_morning' | 'home.greeting_afternoon' | 'home.greeting_evening' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greeting_morning';
  if (h < 18) return 'home.greeting_afternoon';
  return 'home.greeting_evening';
}

function dayKey(value: Date | string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { email } = useAuthStore();
  const firstName = email?.split('@')[0]?.split('.')[0] ?? 'there';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const xpMax = 500;
  const [crisisVisible, setCrisisVisible] = useState(false);
  const [selectedHelperIds, setSelectedHelperIds] = useState<string[]>([]);
  const [featuredHelperId, setFeaturedHelperId] = useState<string | null>(null);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [activityByDay, setActivityByDay] = useState<Record<string, number>>({});

  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinMood, setCheckinMood] = useState<Mood | null>(null);
  const [firstRunBannerVisible, setFirstRunBannerVisible] = useState(false);
  const [moodHistory, setMoodHistory] = useState<Record<string, number>>({});
  const [reEntryConversation, setReEntryConversation] = useState<Conversation | null>(null);
  const [quickCaptureVisible, setQuickCaptureVisible] = useState(false);
  const [quickCaptureText, setQuickCaptureText] = useState('');
  const [weeklyDigest, setWeeklyDigest] = useState<{ habitsDone: number; journalCount: number; avgMood: number | null } | null>(null);
  const [weeklyDigestDismissed, setWeeklyDigestDismissed] = useState(false);
  const [monthlySnapshot, setMonthlySnapshot] = useState<{ chats: number; habits: number; diary: number; topHelper: string | null } | null>(null);
  const [guidedStep, setGuidedStep] = useState<1 | 2 | 3 | null>(null);
  const [lowDemandMode, setLowDemandMode] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profileInitials, setProfileInitials] = useState('');
  const [tourVisible, setTourVisible] = useState(false);
  const checkinPrompt = getDailyPrompt();

  useEffect(() => {
    async function loadProgressAndPreferences() {
      const [catalog, aiMode, s, x, selectedRaw, conversationsRaw, habitsRaw, journalRaw] = await Promise.all([
        getCatalogAgents(),
        AsyncStorage.getItem(AI_MODE_KEY),
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(XP_KEY),
        AsyncStorage.getItem(SELECTED_HELPERS_KEY),
        AsyncStorage.getItem(CONVERSATIONS_KEY),
        AsyncStorage.getItem(HABITS_KEY),
        AsyncStorage.getItem(JOURNAL_KEY),
      ]);
      const visibleCatalog = aiMode === 'local'
        ? catalog.filter((agent) => agent.minimumAIMode !== 'cloud')
        : catalog;
      setAllAgents(visibleCatalog);
      if (s) setStreak(parseInt(s, 10));
      if (x) setXp(parseInt(x, 10));

      let selected: string[] = [];
      if (selectedRaw) {
        try {
          const parsed = JSON.parse(selectedRaw);
          if (Array.isArray(parsed)) selected = parsed.filter((v) => typeof v === 'string');
        } catch {
          selected = [];
        }
      }

      setSelectedHelperIds(selected);

      // Check if daily check-in is done
      const checkin = await AsyncStorage.getItem(CHECKIN_KEY);
      if (checkin === getTodayKey()) {
        setCheckinDone(true);
        // Restore today's mood emoji from history so done-state shows it correctly
        const moodRawEarly = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
        if (moodRawEarly) {
          try {
            const moods: Record<string, number> = JSON.parse(moodRawEarly);
            const score = moods[getTodayKey()];
            if (score) setCheckinMood(MOOD_OPTIONS[score - 1] as Mood);
          } catch { /* ignore */ }
        }
      }

      // First-run banner — show until dismissed
      const bannerDismissed = await AsyncStorage.getItem(FIRST_RUN_BANNER_KEY);
      if (!bannerDismissed) setFirstRunBannerVisible(true);

      // Mood history
      const moodRaw = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
      if (moodRaw) {
        try { setMoodHistory(JSON.parse(moodRaw)); } catch { /* ignore */ }
      }

      // Re-entry card — show most recent conversation if absent 3+ days
      const lastOpenRaw = await AsyncStorage.getItem(LAST_OPEN_KEY);
      const today = getTodayKey();
      if (lastOpenRaw) {
        const diffDays = Math.floor((Date.now() - new Date(lastOpenRaw).getTime()) / 86400000);
        if (diffDays >= 3 && conversationsRaw) {
          try {
            const convos: Conversation[] = JSON.parse(conversationsRaw);
            if (convos.length) setReEntryConversation(convos[convos.length - 1]);
          } catch { /* ignore */ }
        }
      }
      AsyncStorage.setItem(LAST_OPEN_KEY, today).catch(() => {});

      // Show tour on very first open
      const tourDone = await AsyncStorage.getItem(TOUR_DONE_KEY);
      if (!tourDone) setTourVisible(true);

      // Load profile photo and name initials
      const profileRaw = await AsyncStorage.getItem(USER_PROFILE_KEY);
      if (profileRaw) {
        try {
          const p = JSON.parse(profileRaw);
          if (p.photo) setProfilePhoto(p.photo);
          if (p.name) {
            const parts = p.name.trim().split(/\s+/);
            const initials = parts.length >= 2
              ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
              : parts[0].slice(0, 2).toUpperCase();
            setProfileInitials(initials);
          }
        } catch { /* ignore */ }
      }

      // Task #17: weekly digest — show Sunday/Monday with prior-week stats
      const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon
      if (dayOfWeek <= 1) {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        let habitsDone = 0;
        let journalCount = 0;
        if (habitsRaw) {
          const habits: Habit[] = JSON.parse(habitsRaw);
          habitsDone = habits.filter((h) => {
            if (!h.lastCompletedAt) return false;
            return new Date(h.lastCompletedAt).toISOString().slice(0, 10) >= weekAgo;
          }).length;
        }
        if (journalRaw) {
          const journals: JournalEntry[] = JSON.parse(journalRaw);
          journalCount = journals.filter((j) => new Date(j.entryDate).toISOString().slice(0, 10) >= weekAgo).length;
        }
        const moodRaw2 = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
        let avgMood: number | null = null;
        if (moodRaw2) {
          const moods: Record<string, number> = JSON.parse(moodRaw2);
          const scores = Object.entries(moods)
            .filter(([d]) => d >= weekAgo)
            .map(([, v]) => v);
          if (scores.length > 0) avgMood = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
        setWeeklyDigest({ habitsDone, journalCount, avgMood });
      }

      // ── Monthly snapshot ──────────────────────────────────────────────────────
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartStr = monthStart.toISOString().slice(0, 10);
      let monthChats = 0;
      let monthHabits = 0;
      let monthDiary = 0;
      const helperCounts: Record<string, number> = {};
      if (conversationsRaw) {
        try {
          const convos: Conversation[] = JSON.parse(conversationsRaw);
          convos.forEach((c) => {
            if (new Date(c.createdAt).toISOString().slice(0, 10) >= monthStartStr) {
              monthChats++;
              helperCounts[c.agentId] = (helperCounts[c.agentId] ?? 0) + 1;
            }
          });
        } catch { /* ignore */ }
      }
      if (habitsRaw) {
        try {
          const habits: Habit[] = JSON.parse(habitsRaw);
          habits.forEach((h) => {
            if (h.lastCompletedAt && new Date(h.lastCompletedAt).toISOString().slice(0, 10) >= monthStartStr) monthHabits++;
          });
        } catch { /* ignore */ }
      }
      if (journalRaw) {
        try {
          const journals: JournalEntry[] = JSON.parse(journalRaw);
          journals.forEach((j) => {
            if (new Date(j.entryDate).toISOString().slice(0, 10) >= monthStartStr) monthDiary++;
          });
        } catch { /* ignore */ }
      }
      const topHelper = Object.entries(helperCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      if (monthChats + monthHabits + monthDiary > 0) {
        setMonthlySnapshot({ chats: monthChats, habits: monthHabits, diary: monthDiary, topHelper });
      }

      // ── Guided first 3 days ───────────────────────────────────────────────────
      const openDatesRaw = await AsyncStorage.getItem(OPEN_DATES_KEY);
      const openDates: string[] = openDatesRaw ? JSON.parse(openDatesRaw) : [];
      const todayDate = getTodayKey();
      if (!openDates.includes(todayDate)) openDates.push(todayDate);
      await AsyncStorage.setItem(OPEN_DATES_KEY, JSON.stringify(openDates));
      if (openDates.length <= 3) {
        const step = openDates.length as 1 | 2 | 3;
        const doneStep1 = conversationsRaw ? (JSON.parse(conversationsRaw) as Conversation[]).length > 0 : false;
        const doneStep2 = habitsRaw ? (JSON.parse(habitsRaw) as Habit[]).length > 0 : false;
        const doneStep3 = journalRaw ? (JSON.parse(journalRaw) as JournalEntry[]).length > 0 : false;
        if (step === 1 && !doneStep1) setGuidedStep(1);
        else if (step === 2 && !doneStep2) setGuidedStep(2);
        else if (step === 3 && !doneStep3) setGuidedStep(3);
      }

      // Build 28-day activity map from chat, journal, habits and check-ins
      const counts: Record<string, number> = {};
      const addCount = (k: string | null) => {
        if (!k) return;
        counts[k] = (counts[k] ?? 0) + 1;
      };

      if (conversationsRaw) {
        try {
          const convos: Conversation[] = JSON.parse(conversationsRaw);
          convos.forEach((c) => addCount(dayKey(c.createdAt)));
        } catch {
          // ignore malformed history
        }
      }
      if (journalRaw) {
        try {
          const journals: JournalEntry[] = JSON.parse(journalRaw);
          journals.forEach((j) => addCount(dayKey(j.entryDate)));
        } catch {
          // ignore malformed entries
        }
      }
      if (habitsRaw) {
        try {
          const habits: Habit[] = JSON.parse(habitsRaw);
          habits.forEach((h) => addCount(dayKey(h.lastCompletedAt)));
        } catch {
          // ignore malformed habits
        }
      }
      if (checkin) addCount(checkin);
      setActivityByDay(counts);

      const pool = selected.length
        ? visibleCatalog.filter((agent) => selected.includes(agent.id))
        : visibleCatalog;
      if (pool.length) {
        const picked = pool[Math.floor(Math.random() * pool.length)];
        setFeaturedHelperId(picked.id);
      }
    }
    loadProgressAndPreferences();
  }, []);

  const unlockedMilestones = MILESTONES.filter((m) => streak >= m.days);

  async function handleShareAchievement() {
    try {
      const top = unlockedMilestones[unlockedMilestones.length - 1];
      const badgeText = top ? `${top.emoji} ${top.label}` : `🔥 ${streak}-day streak`;
      await Share.share({
        message: `I just hit a milestone on InnerSpace: ${badgeText}. Small consistent steps really add up.`,
      });
    } catch {
      // User may cancel share sheet
    }
  }

  const heatmapDays = lastNDays(28);

  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleCheckinDone(mood: Mood) {
    setCheckinMood(mood);
    setCheckinDone(true);
    const today = getTodayKey();
    await AsyncStorage.setItem(CHECKIN_KEY, today);
    // Task #21: low-demand mode when mood is very low (1 or 2)
    const score = MOOD_OPTIONS.indexOf(mood) + 1;
    if (score <= 2) setLowDemandMode(true);
    const updatedMoods = { ...moodHistory, [today]: score };
    setMoodHistory(updatedMoods);
    AsyncStorage.setItem(MOOD_HISTORY_KEY, JSON.stringify(updatedMoods)).catch(() => {});
    // Award +5 XP
    const raw = await AsyncStorage.getItem(XP_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = current + 5;
    await AsyncStorage.setItem(XP_KEY, String(next));
    setXp(next);
  }

  // Task #23: lightweight offline probe
  useEffect(() => {
    let cancelled = false;
    async function checkOnline() {
      try {
        await Promise.race([
          fetch('https://clients3.google.com/generate_204', { method: 'HEAD' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
        ]);
        if (!cancelled) setIsOffline(false);
      } catch {
        if (!cancelled) setIsOffline(true);
      }
    }
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      async function reloadProfile() {
        const profileRaw = await AsyncStorage.getItem(USER_PROFILE_KEY);
        if (profileRaw) {
          try {
            const p = JSON.parse(profileRaw);
            if (p.photo) setProfilePhoto(p.photo);
            else setProfilePhoto(null);
            if (p.name) {
              const parts = p.name.trim().split(/\s+/);
              const initials = parts.length >= 2
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : parts[0].slice(0, 2).toUpperCase();
              setProfileInitials(initials);
            }
          } catch { /* ignore */ }
        }
      }
      reloadProfile();
    }, []),
  );

  async function handleExportMood() {
    const lines = Object.entries(moodHistory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, score]) => `${date},${score},${MOOD_OPTIONS[score - 1]}`);
    const csv = `Date,Score,Mood\n${lines.join('\n')}`;
    await Share.share({ message: csv, title: 'InnerSpace Mood Export' });
  }

  function handleQuickCapture() {
    if (!quickCaptureText.trim()) return;
    setQuickCaptureVisible(false);
    const text = quickCaptureText.trim();
    setQuickCaptureText('');
    navigation.navigate('Journal', { prefill: text });
  }

  function handleCheckinSkip() {
    setCheckinDone(true);
    AsyncStorage.setItem(CHECKIN_KEY, getTodayKey());
  }

  function handleDismissBanner() {
    setFirstRunBannerVisible(false);
    AsyncStorage.setItem(FIRST_RUN_BANNER_KEY, 'true').catch(() => {});
  }

  const featuredHelper =
    allAgents.find((agent) => agent.id === featuredHelperId) ?? allAgents[0];

  async function navigateToChat(agentId: string, forceNew?: boolean) {
    if (!forceNew) {
      try {
        const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
        if (raw) {
          const all: Conversation[] = JSON.parse(raw);
          const existing = all.filter((c) => c.agentId === agentId && c.messages.length > 0);
          if (existing.length > 0) {
            const latest = existing.sort((a, b) =>
              new Date(b.messages[b.messages.length - 1]?.timestamp ?? 0).getTime() -
              new Date(a.messages[a.messages.length - 1]?.timestamp ?? 0).getTime()
            )[0];
            Alert.alert(
              'Continue chatting?',
              'You have a previous conversation with this helper.',
              [
                { text: 'Resume last chat', onPress: () => navigation.navigate('Chat', { agentId, conversationId: latest.id }) },
                { text: 'Start fresh', onPress: () => navigation.navigate('Chat', { agentId }) },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
            return;
          }
        }
      } catch { /* ignore — just navigate normally */ }
    }
    navigation.navigate('Chat', { agentId });
  }

  const QUICK_ACTIONS = [
    { icon: '💬', label: t('home.mode_talk_title'),    onPress: () => navigateToChat('confidence') },
    { icon: '✅', label: t('home.mode_habits_title'),  onPress: () => navigation.navigate('Habits') },
    { icon: '✍️', label: t('home.mode_reflect_title'), onPress: () => navigation.navigate('Journal') },
    { icon: '🎯', label: t('home.mode_decide_title'),  onPress: () => navigation.navigate('Decision') },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <View style={styles.logoSlot}>
                <InnerSpaceLogo size={24} />
              </View>
              <Text style={styles.appTitle}>InnerSpace</Text>
            </View>
            <Text style={styles.greeting}>{t(getGreetingKey(), { name: displayName })}</Text>
            <Text style={styles.subGreeting}>{t('home.choose_mode')}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.8}
          >
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatarPhoto} />
            ) : (
              <Text style={styles.avatarText}>
                {profileInitials || displayName.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* First-run banner — only when no helpers picked yet */}
        {firstRunBannerVisible && selectedHelperIds.length === 0 && (
          <View style={styles.firstRunBanner}>
            <View style={styles.firstRunTitleRow}>
              <Text style={styles.firstRunTitle}>Get started with InnerSpace</Text>
              <TouchableOpacity onPress={handleDismissBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            <View style={styles.firstRunSteps}>
              {[
                { step: '1', label: 'Take a check-in below', dest: null },
                { step: '2', label: 'Pick helpers you like', dest: 'Agents' },
                { step: '3', label: 'Start your first chat', dest: 'Chat' },
              ].map(({ step, label, dest }) => (
                <TouchableOpacity
                  key={step}
                  style={styles.firstRunStep}
                  onPress={dest ? () => { navigation.navigate(dest); } : undefined}
                  activeOpacity={dest ? 0.7 : 1}
                >
                  <View style={styles.firstRunStepNum}>
                    <Text style={styles.firstRunStepNumText}>{step}</Text>
                  </View>
                  <Text style={styles.firstRunStepLabel}>{label}</Text>
                  {dest && <Feather name="chevron-right" size={13} color={colors.textDim} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Guided first 3 days */}
        {guidedStep && (
          <View style={styles.guidedBanner}>
            <View style={styles.guidedLeft}>
              <Text style={styles.guidedStepLabel}>Day {guidedStep}</Text>
              <Text style={styles.guidedTitle}>
                {guidedStep === 1 && 'Start your first chat with a helper'}
                {guidedStep === 2 && 'Create a habit to track daily'}
                {guidedStep === 3 && 'Write your first diary entry'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.guidedBtn}
              onPress={() => {
                setGuidedStep(null);
                if (guidedStep === 1) navigation.navigate('Agents');
                else if (guidedStep === 2) navigation.navigate('Habits');
                else navigation.navigate('Journal');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.guidedBtnText}>Go</Text>
              <Feather name="arrow-right" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Daily check-in — always visible, shows done state */}
        <View style={styles.checkinCard}>
          {checkinDone ? (
            <View style={styles.checkinDoneRow}>
              <Text style={styles.checkinDoneEmoji}>{checkinMood ?? '😊'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkinDoneTitle}>How you're feeling today ✓</Text>
                <Text style={styles.checkinDoneSub}>Glad you checked in. See you again tomorrow!</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.checkinTitle}>{t('home.checkin_title')}</Text>
              <Text style={styles.checkinPrompt}>{checkinPrompt}</Text>
              <View style={styles.moodRow}>
                {MOOD_OPTIONS.map((m) => (
                  <TouchableOpacity key={m} style={styles.moodBtn} onPress={() => handleCheckinDone(m)} activeOpacity={0.8}>
                    <Text style={styles.moodEmoji}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={handleCheckinSkip} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>{t('home.checkin_skip')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity key={a.label} style={styles.quickAction} onPress={a.onPress} activeOpacity={0.8}>
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionEmoji}>{a.icon}</Text>
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={1}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* My Helpers / Featured helper */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>
            {selectedHelperIds.length > 0 ? 'YOUR HELPERS' : 'SOMEONE WHO CAN HELP'}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Agents')} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>{selectedHelperIds.length > 0 ? 'See all' : 'Meet more'}</Text>
          </TouchableOpacity>
        </View>

        {selectedHelperIds.length > 0 ? (
          // Show all selected helpers as tappable cards
          allAgents
            .filter((a) => selectedHelperIds.includes(a.id))
            .map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={styles.helperCard}
                onPress={() => navigateToChat(agent.id)}
                activeOpacity={0.85}
              >
                <View style={styles.helperCardLeft}>
                  <Text style={styles.helperCardEmoji}>{agent.emoji}</Text>
                  <View style={styles.helperCardInfo}>
                    <Text style={styles.helperCardName}>{t(agent.nameKey)}</Text>
                    <Text style={styles.helperCardDesc} numberOfLines={1}>{t(agent.descriptionKey)}</Text>
                  </View>
                </View>
                <View style={styles.helperCardCTA}>
                  <Text style={styles.helperCardCTAText}>Chat</Text>
                  <Feather name="chevron-right" size={14} color={colors.accent} />
                </View>
              </TouchableOpacity>
            ))
        ) : (
          // No helpers picked yet — show one featured card
          <TouchableOpacity
            style={styles.featuredCard}
            onPress={() => featuredHelper
              ? navigateToChat(featuredHelper.id)
              : navigation.navigate('Agents')}
            activeOpacity={0.85}
          >
            <Text style={styles.featuredEmoji}>{featuredHelper?.emoji ?? '✨'}</Text>
            <View style={styles.featuredInfo}>
              <Text style={styles.featuredName}>
                {featuredHelper ? t(featuredHelper.nameKey) : 'Pick a helper'}
              </Text>
              <Text style={styles.featuredDesc} numberOfLines={2}>
                {featuredHelper ? t(featuredHelper.descriptionKey) : 'Tap to browse your personal AI helpers'}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.accent} />
          </TouchableOpacity>
        )}

        {/* Offline indicator */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Feather name="cloud-off" size={14} color="#F59E0B" />
            <Text style={styles.offlineBannerText}>You're offline — your helpers are unavailable right now, but everything you've saved is still here.</Text>
          </View>
        )}

        {/* Task #21: Low-demand mode banner */}
        {lowDemandMode && (
          <View style={styles.lowDemandCard}>
            <Text style={styles.lowDemandTitle}>Take it easy today 💙</Text>
            <Text style={styles.lowDemandBody}>You checked in with a low mood. No pressure — rest is productive too. Here when you need it.</Text>
            <View style={styles.lowDemandActions}>
              <TouchableOpacity style={styles.lowDemandBtn} onPress={() => navigateToChat('stress')} activeOpacity={0.8}>
                <Text style={styles.lowDemandBtnText}>Talk to someone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lowDemandBtnSecondary} onPress={() => setLowDemandMode(false)} activeOpacity={0.8}>
                <Text style={styles.lowDemandBtnSecondaryText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Task #17: Weekly review digest (Sunday/Monday) */}
        {weeklyDigest && !weeklyDigestDismissed && (
          <View style={styles.weeklyDigestCard}>
            <View style={styles.weeklyDigestHeader}>
              <Text style={styles.weeklyDigestTitle}>How your week went ✨</Text>
              <TouchableOpacity onPress={() => setWeeklyDigestDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            <View style={styles.weeklyDigestRow}>
              <View style={styles.weeklyDigestStat}>
                <Text style={styles.weeklyDigestStatNum}>{weeklyDigest.habitsDone}</Text>
                <Text style={styles.weeklyDigestStatLabel}>habits done</Text>
              </View>
              <View style={styles.weeklyDigestStat}>
                <Text style={styles.weeklyDigestStatNum}>{weeklyDigest.journalCount}</Text>
                <Text style={styles.weeklyDigestStatLabel}>reflections</Text>
              </View>
              {weeklyDigest.avgMood !== null && (
                <View style={styles.weeklyDigestStat}>
                  <Text style={styles.weeklyDigestStatNum}>{MOOD_OPTIONS[Math.round(weeklyDigest.avgMood) - 1]}</Text>
                  <Text style={styles.weeklyDigestStatLabel}>how you felt</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Re-entry card after 3+ day absence */}
        {reEntryConversation && (
          <TouchableOpacity
            style={styles.reEntryCard}
            onPress={() => {
              setReEntryConversation(null);
              navigation.navigate('Chat', { agentId: reEntryConversation.agentId });
            }}
            activeOpacity={0.85}
          >
            <View style={styles.reEntryLeft}>
              <Text style={styles.reEntryTitle}>Welcome back 👋</Text>
              <Text style={styles.reEntryBody}>Pick up where you left off with your last conversation</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.accent} />
          </TouchableOpacity>
        )}

        {/* Monthly snapshot */}
        {monthlySnapshot && (
          <View style={styles.monthlyCard}>
            <Text style={styles.monthlyTitle}>
              {new Date().toLocaleDateString('en-US', { month: 'long' })} so far
            </Text>
            <View style={styles.monthlyRow}>
              <View style={styles.monthlyStat}>
                <Text style={styles.monthlyNum}>{monthlySnapshot.chats}</Text>
                <Text style={styles.monthlyLabel}>chats</Text>
              </View>
              <View style={styles.monthlyDivider} />
              <View style={styles.monthlyStat}>
                <Text style={styles.monthlyNum}>{monthlySnapshot.habits}</Text>
                <Text style={styles.monthlyLabel}>habits done</Text>
              </View>
              <View style={styles.monthlyDivider} />
              <View style={styles.monthlyStat}>
                <Text style={styles.monthlyNum}>{monthlySnapshot.diary}</Text>
                <Text style={styles.monthlyLabel}>diary entries</Text>
              </View>
            </View>
            {monthlySnapshot.topHelper && (
              <Text style={styles.monthlyTopHelper}>
                Most used: {monthlySnapshot.topHelper.replace(/_/g, ' ')}
              </Text>
            )}
          </View>
        )}

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.streakRow}>
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={styles.streakText}>{t('home.streak', { count: streak })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.xpLevelTitle}>{getXpLevel(xp).title}</Text>
              <Text style={styles.xpText}>{t('home.xp', { current: xp, max: xpMax })}</Text>
            </View>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${Math.min((xp / xpMax) * 100, 100)}%` }]} />
          </View>
          <View style={styles.milestoneWrap}>
            {MILESTONES.map((m) => {
              const unlocked = streak >= m.days;
              return (
                <View key={m.days} style={[styles.milestoneChip, unlocked && styles.milestoneChipOn]}>
                  <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
                  <Text style={[styles.milestoneLabel, unlocked && styles.milestoneLabelOn]}>{m.days}d</Text>
                </View>
              );
            })}
          </View>
          {unlockedMilestones.length > 0 && (
            <TouchableOpacity style={styles.shareMilestoneBtn} onPress={handleShareAchievement} activeOpacity={0.85}>
              <Feather name="share-2" size={14} color="#4A9EFF" />
              <Text style={styles.shareMilestoneText}>{t('home.share_achievement')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.heatmapCard}>
          <Text style={styles.heatmapTitle}>{t('home.heatmap_title')}</Text>
          <View style={styles.heatmapGrid}>
            {heatmapDays.map((d) => {
              const count = activityByDay[d] ?? 0;
              const level = count >= 3 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;
              return <View key={d} style={[styles.heatCell, level === 1 && styles.heat1, level === 2 && styles.heat2, level === 3 && styles.heat3]} />;
            })}
          </View>
          <Text style={styles.heatmapHint}>{t('home.heatmap_hint')}</Text>
        </View>

        {/* Mood trend chart — last 14 days */}
        {Object.keys(moodHistory).length > 0 && (() => {
          const days = lastNDays(14);
          const bars = days.map((d) => moodHistory[d] ?? 0);
          const hasData = bars.some((v) => v > 0);
          if (!hasData) return null;
          return (
            <View style={styles.moodChartCard}>
              <Text style={styles.moodChartTitle}>Mood — last 14 days</Text>
              <View style={styles.moodChartRow}>
                {bars.map((score, i) => (
                  <View key={i} style={styles.moodBarWrap}>
                    <View style={[
                      styles.moodBar,
                      { height: score > 0 ? score * 8 : 2 },
                      score >= 4 ? styles.moodBarHigh : score >= 3 ? styles.moodBarMid : score > 0 ? styles.moodBarLow : styles.moodBarEmpty,
                    ]} />
                  </View>
                ))}
              </View>
              <View style={styles.moodChartLabels}>
                <Text style={styles.moodChartLabel}>14d ago</Text>
                <TouchableOpacity onPress={handleExportMood} style={styles.moodExportBtn} activeOpacity={0.7}>
                  <Feather name="share-2" size={12} color={colors.textDim} />
                  <Text style={styles.moodChartLabel}>Export</Text>
                </TouchableOpacity>
                <Text style={styles.moodChartLabel}>Today</Text>
              </View>
            </View>
          );
        })()}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Quick-capture FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setQuickCaptureVisible(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Quick-capture modal */}
      <Modal
        visible={quickCaptureVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickCaptureVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setQuickCaptureVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.quickCaptureCard} onPress={() => {}}>
            <Text style={styles.quickCaptureTitle}>Quick capture</Text>
            <Text style={styles.quickCaptureHint}>Capture a thought — we'll save it as a journal entry</Text>
            <TextInput
              style={styles.quickCaptureInput}
              value={quickCaptureText}
              onChangeText={setQuickCaptureText}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textDim}
              multiline
              autoFocus
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.quickCaptureBtn, !quickCaptureText.trim() && { opacity: 0.5 }]}
              onPress={handleQuickCapture}
              disabled={!quickCaptureText.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.quickCaptureBtnText}>Save to Journal</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* App tour */}
      <AppTour visible={tourVisible} onDone={() => setTourVisible(false)} />

      {/* Crisis modal */}
      <Modal
        visible={crisisVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCrisisVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('crisis.title')}</Text>
            <Text style={styles.modalBody}>{t('crisis.body')}</Text>

            {[
              { label: t('crisis.us'), number: '988' },
              { label: t('crisis.uk'), number: 'tel:116123' },
              { label: t('crisis.text'), number: 'sms:741741' },
            ].map(({ label, number }) => (
              <TouchableOpacity
                key={label}
                style={styles.crisisLineBtn}
                onPress={() => Linking.openURL(number)}
              >
                <Feather name="phone" size={16} color="#4A9EFF" />
                <Text style={styles.crisisLineText}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setCrisisVisible(false)}
            >
              <Text style={styles.modalCloseTxt}>{t('general.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoSlot: {
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  appTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: c.accent,
    letterSpacing: 1,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
    marginBottom: 2,
  },
  subGreeting: {
    fontSize: 14,
    color: c.textMuted,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.accent,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: c.accent,
  },
  avatarPhoto: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 0.8 },
  sectionLink: { fontSize: 12, color: c.accent, fontWeight: '600' },
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, gap: 8 },
  quickAction: { flex: 1, alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
  quickActionEmoji: { fontSize: 26 },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: c.textSecondary, textAlign: 'center' },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    gap: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: c.border,
  },
  featuredEmoji: { fontSize: 30, width: 40, textAlign: 'center' },
  featuredInfo: { flex: 1 },
  featuredName: { color: c.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  featuredDesc: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  firstRunBanner: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  firstRunTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  firstRunTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  firstRunSteps: { gap: 8 },
  firstRunStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  firstRunStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center' },
  firstRunStepNumText: { fontSize: 11, fontWeight: '700', color: c.accent },
  firstRunStepLabel: { flex: 1, fontSize: 13, color: c.textSecondary },
  checkinCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  checkinDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkinDoneEmoji: { fontSize: 34 },
  checkinDoneTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
  checkinDoneSub: { fontSize: 12, color: c.textMuted, lineHeight: 17 },
  checkinTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginBottom: 8,
  },
  checkinPrompt: {
    fontSize: 14,
    color: c.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  moodBtn: { padding: 12, borderRadius: 12, backgroundColor: c.surfaceAlt },
  moodEmoji: { fontSize: 30 },
  skipBtn: { alignItems: 'center', paddingVertical: 4 },
  skipBtnText: { fontSize: 12, color: c.textDim },
  helperCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  helperCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  helperCardEmoji: { fontSize: 26, width: 36, textAlign: 'center' },
  helperCardInfo: { flex: 1 },
  helperCardName: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
  helperCardDesc: { fontSize: 12, color: c.textMuted },
  helperCardCTA: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: c.accentBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  helperCardCTAText: { fontSize: 12, fontWeight: '700', color: c.accent },
  progressCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fireEmoji: { fontSize: 16 },
  streakText: { fontSize: 14, fontWeight: '600', color: c.text },
  xpText: { fontSize: 13, color: c.textMuted },
  xpBarBg: { height: 6, backgroundColor: c.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  xpBarFill: { height: 6, backgroundColor: c.accent, borderRadius: 3 },
  milestoneWrap: { marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  milestoneChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: c.border },
  milestoneChipOn: { borderColor: c.accent, backgroundColor: c.accentBg },
  milestoneEmoji: { fontSize: 12 },
  milestoneLabel: { fontSize: 11, color: c.textMuted, fontWeight: '600' },
  milestoneLabelOn: { color: c.textSecondary },
  shareMilestoneBtn: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: c.accentBg },
  shareMilestoneText: { color: c.accent, fontSize: 12, fontWeight: '600' },
  heatmapCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 14 },
  heatmapTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatCell: { width: 12, height: 12, borderRadius: 3, backgroundColor: c.surfaceAlt },
  heat1: { backgroundColor: c.accentBg },
  heat2: { backgroundColor: '#2563EB' },
  heat3: { backgroundColor: c.accent },
  heatmapHint: { marginTop: 8, color: c.textDim, fontSize: 11 },
  lowDemandCard: { backgroundColor: '#0F172A', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#1E3A5F', gap: 8 },
  lowDemandTitle: { fontSize: 15, fontWeight: '700', color: '#93C5FD' },
  lowDemandBody: { fontSize: 13, color: '#7FB3E8', lineHeight: 19 },
  lowDemandActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  lowDemandBtn: { flex: 1, backgroundColor: '#1D4ED8', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  lowDemandBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  lowDemandBtnSecondary: { paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  lowDemandBtnSecondaryText: { fontSize: 13, color: '#7FB3E8' },
  weeklyDigestCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  weeklyDigestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  weeklyDigestTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  weeklyDigestRow: { flexDirection: 'row', gap: 12 },
  weeklyDigestStat: { flex: 1, alignItems: 'center', backgroundColor: c.surfaceAlt, borderRadius: 10, paddingVertical: 10 },
  weeklyDigestStatNum: { fontSize: 22, fontWeight: '700', color: c.text },
  weeklyDigestStatLabel: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  // Guided first 3 days
  guidedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.accentBg, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: c.accent, gap: 12 },
  guidedLeft: { flex: 1, gap: 2 },
  guidedStepLabel: { fontSize: 10, fontWeight: '700', color: c.accent, textTransform: 'uppercase', letterSpacing: 1 },
  guidedTitle: { fontSize: 14, fontWeight: '600', color: c.text, lineHeight: 20 },
  guidedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  guidedBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  // Monthly snapshot
  monthlyCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border, gap: 10 },
  monthlyTitle: { fontSize: 13, fontWeight: '700', color: c.text },
  monthlyRow: { flexDirection: 'row', alignItems: 'center' },
  monthlyStat: { flex: 1, alignItems: 'center', gap: 2 },
  monthlyNum: { fontSize: 24, fontWeight: '700', color: c.accent },
  monthlyLabel: { fontSize: 11, color: c.textMuted },
  monthlyDivider: { width: 1, height: 36, backgroundColor: c.border },
  monthlyTopHelper: { fontSize: 12, color: c.textDim, textAlign: 'center', fontStyle: 'italic' },
  reEntryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.accentBg, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: c.accent, gap: 12 },
  reEntryLeft: { flex: 1 },
  reEntryTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
  reEntryBody: { fontSize: 12, color: c.textMuted },
  xpLevelTitle: { fontSize: 11, fontWeight: '700', color: c.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
  moodChartCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 14 },
  moodChartTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 10 },
  moodChartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44 },
  moodBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 44 },
  moodBar: { width: '100%', borderRadius: 2, minHeight: 2 },
  moodBarHigh: { backgroundColor: '#34D399' },
  moodBarMid: { backgroundColor: '#60A5FA' },
  moodBarLow: { backgroundColor: '#F87171' },
  moodBarEmpty: { backgroundColor: c.surfaceAlt },
  moodChartLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  moodChartLabel: { fontSize: 10, color: c.textDim },
  moodExportBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2A1A03', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#7C4A03' },
  offlineBannerText: { fontSize: 12, color: '#FCD34D', flex: 1, lineHeight: 17 },
  fab: { position: 'absolute', bottom: 28, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  quickCaptureCard: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 80 },
  quickCaptureTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
  quickCaptureHint: { fontSize: 13, color: c.textMuted, marginBottom: 14 },
  quickCaptureInput: { backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 14, color: c.text, fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 14 },
  quickCaptureBtn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  quickCaptureBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  crisisBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A0A0A', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#3B1A1A' },
  crisisBtnText: { fontSize: 14, color: c.danger, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 8 },
  modalBody: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 20 },
  crisisLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.accentBg },
  crisisLineText: { fontSize: 14, color: c.textSecondary },
  modalCloseBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 14 },
  modalCloseTxt: { fontSize: 16, fontWeight: '600', color: c.accent },
  });
}
