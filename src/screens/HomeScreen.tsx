import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar as RNStatusBar,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/auth';
import { getCatalogAgents } from '../services/agents-catalog';
import type { Agent } from '../types';
import InnerSpaceLogo from '../components/InnerSpaceLogo';

const STREAK_KEY = '@innerspace:streak';
const XP_KEY = '@innerspace:xp';
const SELECTED_HELPERS_KEY = '@innerspace:selected_helpers';
const XP_STORE_KEY = '@innerspace:xp';
const CHECKIN_KEY = '@innerspace:checkin_today';

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

export default function HomeScreen() {
  const { t } = useTranslation();
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

  // Daily check-in
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinMood, setCheckinMood] = useState<Mood | null>(null);
  const checkinPrompt = getDailyPrompt();

  useEffect(() => {
    async function loadProgressAndPreferences() {
      const [catalog, s, x, selectedRaw] = await Promise.all([
        getCatalogAgents(),
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(XP_KEY),
        AsyncStorage.getItem(SELECTED_HELPERS_KEY),
      ]);
      setAllAgents(catalog);
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
      if (checkin === getTodayKey()) setCheckinDone(true);

      const pool = selected.length
        ? catalog.filter((agent) => selected.includes(agent.id))
        : catalog;
      if (pool.length) {
        const picked = pool[Math.floor(Math.random() * pool.length)];
        setFeaturedHelperId(picked.id);
      }
    }
    loadProgressAndPreferences();
  }, []);

  async function handleCheckinDone(mood: Mood) {
    setCheckinMood(mood);
    setCheckinDone(true);
    await AsyncStorage.setItem(CHECKIN_KEY, getTodayKey());
    // Award +5 XP
    const raw = await AsyncStorage.getItem(XP_STORE_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = current + 5;
    await AsyncStorage.setItem(XP_STORE_KEY, String(next));
    setXp(next);
  }

  function handleCheckinSkip() {
    setCheckinDone(true);
    AsyncStorage.setItem(CHECKIN_KEY, getTodayKey());
  }

  const featuredHelper =
    allAgents.find((agent) => agent.id === featuredHelperId) ?? allAgents[0];

  const MODE_CARDS = [
    {
      icon: '💬',
      title: t('home.mode_talk_title'),
      desc: t('home.mode_talk_desc'),
      onPress: () => navigation.navigate('Chat', { agentId: 'confidence' }),
      color: '#1A3A6B',
    },
    {
      icon: '✅',
      title: t('home.mode_habits_title'),
      desc: t('home.mode_habits_desc'),
      onPress: () => navigation.navigate('History'),
      color: '#1A3A2A',
    },
    {
      icon: '✍️',
      title: t('home.mode_reflect_title'),
      desc: t('home.mode_reflect_desc'),
      onPress: () => navigation.navigate('Chat', { agentId: 'life_goals' }),
      color: '#2A1A3A',
    },
    {
      icon: '🎯',
      title: t('home.mode_decide_title'),
      desc: t('home.mode_decide_desc'),
      onPress: () => navigation.navigate('Chat', { agentId: 'time_management' }),
      color: '#2A2A1A',
    },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <InnerSpaceLogo size={30} />
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
            <Text style={styles.avatarText}>
              {displayName.slice(0, 2).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Daily check-in widget */}
        {!checkinDone && (
          <View style={styles.checkinCard}>
            <Text style={styles.checkinTitle}>Daily Check-in ☀️</Text>
            <Text style={styles.checkinPrompt}>{checkinPrompt}</Text>
            <View style={styles.moodRow}>
              {MOOD_OPTIONS.map((m) => (
                <TouchableOpacity key={m} style={styles.moodBtn} onPress={() => handleCheckinDone(m)} activeOpacity={0.8}>
                  <Text style={styles.moodEmoji}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={handleCheckinSkip} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>Skip for today</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode cards grid */}
        <Text style={styles.sectionLabel}>{t('home.choose_mode_label')}</Text>
        <View style={styles.grid}>
          {MODE_CARDS.map((card) => (
            <TouchableOpacity
              key={card.title}
              style={[styles.modeCard, { backgroundColor: card.color }]}
              onPress={card.onPress}
              activeOpacity={0.82}
            >
              <Text style={styles.modeIcon}>{card.icon}</Text>
              <Text style={styles.modeName}>{card.title}</Text>
              <Text style={styles.modeDesc}>{card.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Featured agent */}
        <Text style={styles.sectionLabel}>{t('home.choose_agent')}</Text>
        <TouchableOpacity
          style={styles.featuredCard}
          onPress={() => navigation.navigate('Chat', { agentId: featuredHelper.id })}
          activeOpacity={0.85}
        >
          <Text style={styles.featuredEmoji}>{featuredHelper.emoji}</Text>
          <View style={styles.featuredInfo}>
            <Text style={styles.featuredName}>{t(featuredHelper.nameKey)}</Text>
            <Text style={styles.featuredDesc} numberOfLines={2}>{t(featuredHelper.descriptionKey)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#4A9EFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => navigation.navigate('Agents')}
          activeOpacity={0.85}
        >
          <Ionicons name="grid-outline" size={16} color="#4A9EFF" />
          <Text style={styles.browseBtnText}>
            {selectedHelperIds.length
              ? t('home.browse_selected_helpers', { count: selectedHelperIds.length })
              : t('home.browse_all_helpers')}
          </Text>
        </TouchableOpacity>

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.streakRow}>
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={styles.streakText}>{t('home.streak', { count: streak })}</Text>
            </View>
            <Text style={styles.xpText}>{t('home.xp', { current: xp, max: xpMax })}</Text>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${Math.min((xp / xpMax) * 100, 100)}%` }]} />
          </View>
        </View>

        {/* Crisis link */}
        <TouchableOpacity
          style={styles.crisisBtn}
          onPress={() => setCrisisVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="heart-outline" size={16} color="#EF4444" />
          <Text style={styles.crisisBtnText}>{t('home.urgent_help')}</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

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
                <Ionicons name="call-outline" size={16} color="#4A9EFF" />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1E',
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
    gap: 8,
  },
  appTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A9EFF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subGreeting: {
    fontSize: 14,
    color: '#8B9CC8',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1A3A6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A9EFF',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A9EFF',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A6478',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  modeCard: {
    width: '47.5%',
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
  },
  modeIcon: {
    fontSize: 26,
    marginBottom: 8,
  },
  modeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    gap: 14,
    marginBottom: 10,
  },
  featuredEmoji: {
    fontSize: 32,
    width: 44,
    textAlign: 'center',
  },
  featuredInfo: {
    flex: 1,
  },
  featuredName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  featuredDesc: {
    fontSize: 13,
    color: '#8B9CC8',
    lineHeight: 18,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  browseBtnText: {
    fontSize: 14,
    color: '#4A9EFF',
    fontWeight: '600',
  },
  checkinCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A3A5A',
  },
  checkinTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  checkinPrompt: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  moodBtn: {
    padding: 6,
  },
  moodEmoji: {
    fontSize: 30,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipBtnText: {
    fontSize: 12,
    color: '#5A6478',
  },
  progressCard: {
    backgroundColor: '#111827',
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
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fireEmoji: {
    fontSize: 16,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  xpText: {
    fontSize: 13,
    color: '#8B9CC8',
  },
  xpBarBg: {
    height: 6,
    backgroundColor: '#1F2937',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: 6,
    backgroundColor: '#4A9EFF',
    borderRadius: 3,
  },
  crisisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A0A0A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3B1A1A',
  },
  crisisBtnText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    color: '#8B9CC8',
    lineHeight: 20,
    marginBottom: 20,
  },
  crisisLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D1B30',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A3A6B',
  },
  crisisLineText: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  modalCloseBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  modalCloseTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A9EFF',
  },
});
