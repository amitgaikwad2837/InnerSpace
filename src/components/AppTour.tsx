import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export const TOUR_DONE_KEY = '@innerspace:tour_done';
const { width } = Dimensions.get('window');
const DEMO_W = width - 80;

// ─── Slide demos ───────────────────────────────────────────────────────────

function ChatDemo({ accent }: { accent: string }) {
  const msg1 = useRef(new Animated.Value(0)).current;
  const msg2 = useRef(new Animated.Value(0)).current;
  const msg3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function run() {
      msg1.setValue(0); msg2.setValue(0); msg3.setValue(0);
      Animated.sequence([
        Animated.timing(msg1, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(msg2, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(msg3, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(1200),
      ]).start(() => run());
    }
    run();
  }, []);

  const bubble = (anim: Animated.Value, text: string, isUser: boolean) => (
    <Animated.View style={[
      styles.bubble,
      isUser ? styles.bubbleUser : styles.bubbleAI,
      { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      isUser ? { backgroundColor: accent } : { backgroundColor: '#1C2236' },
    ]}>
      <Text style={[styles.bubbleText, isUser ? { color: '#FFF' } : { color: '#C8D5F0' }]}>{text}</Text>
    </Animated.View>
  );

  return (
    <View style={styles.demoBox}>
      {bubble(msg1, "I'm feeling overwhelmed today 😔", true)}
      {bubble(msg2, "That's completely valid. Let's work through it together. What's weighing on you most?", false)}
      {bubble(msg3, "I have too much to do and don't know where to start", true)}
    </View>
  );
}

function HabitsDemo({ accent }: { accent: string }) {
  const checks = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const bars = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const HABITS = ['Morning meditation', 'Evening walk', 'Read 20 minutes'];

  useEffect(() => {
    function run() {
      checks.forEach(c => c.setValue(0));
      bars.forEach(b => b.setValue(0));
      Animated.stagger(500, checks.map((c, i) =>
        Animated.parallel([
          Animated.timing(c, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(bars[i], { toValue: 1, duration: 500, useNativeDriver: false }),
        ])
      )).start(() => { setTimeout(run, 1400); });
    }
    run();
  }, []);

  return (
    <View style={styles.demoBox}>
      {HABITS.map((h, i) => (
        <View key={h} style={styles.habitRow}>
          <Animated.View style={[styles.habitCheck, { backgroundColor: accent, opacity: checks[i], transform: [{ scale: checks[i].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
            <Feather name="check" size={12} color="#FFF" />
          </Animated.View>
          <Text style={styles.habitLabel}>{h}</Text>
          <View style={styles.habitBarBg}>
            <Animated.View style={[styles.habitBarFill, { backgroundColor: accent, width: bars[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function JournalDemo({ accent }: { accent: string }) {
  const lines = ["Today I felt a shift in my energy...", "I realized that I've been putting", "others before myself too often."];
  const [visibleChars, setVisibleChars] = useState(0);
  const fullText = lines.join('\n');
  const cursor = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(cursor, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(cursor, { toValue: 1, duration: 500, useNativeDriver: true }),
    ])).start();

    let count = 0;
    let dir = 1;
    const tick = setInterval(() => {
      count += dir;
      if (count >= fullText.length) { dir = -1; setTimeout(() => { dir = 1; }, 800); }
      if (count <= 0) { dir = 1; }
      setVisibleChars(Math.max(0, count));
    }, 40);
    return () => clearInterval(tick);
  }, []);

  return (
    <View style={styles.demoBox}>
      <View style={styles.journalCard}>
        <Text style={styles.journalDate}>Today · Personal</Text>
        <Text style={styles.journalText}>{fullText.slice(0, visibleChars)}<Animated.Text style={{ opacity: cursor, color: accent }}>|</Animated.Text></Text>
      </View>
      <View style={[styles.insightPill, { borderColor: accent }]}>
        <Feather name="zap" size={11} color={accent} />
        <Text style={[styles.insightText, { color: accent }]}>AI insight ready</Text>
      </View>
    </View>
  );
}

function DecisionDemo({ accent }: { accent: string }) {
  const pros = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const cons = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const clarity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function run() {
      [...pros, ...cons, clarity].forEach(a => a.setValue(0));
      Animated.sequence([
        Animated.stagger(300, pros.map(p => Animated.timing(p, { toValue: 1, duration: 300, useNativeDriver: true }))),
        Animated.stagger(300, cons.map(c => Animated.timing(c, { toValue: 1, duration: 300, useNativeDriver: true }))),
        Animated.timing(clarity, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.delay(1000),
      ]).start(() => run());
    }
    run();
  }, []);

  const item = (anim: Animated.Value, text: string, isGood: boolean) => (
    <Animated.View style={[styles.decideItem, { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [isGood ? -10 : 10, 0] }) }] }]}>
      <View style={[styles.decideIcon, { backgroundColor: isGood ? '#0D2F1A' : '#2A0D0D' }]}>
        <Feather name={isGood ? 'plus' : 'minus'} size={10} color={isGood ? '#34D399' : '#F87171'} />
      </View>
      <Text style={styles.decideText}>{text}</Text>
    </Animated.View>
  );

  return (
    <View style={styles.demoBox}>
      <View style={styles.decideCols}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.decideColHead}>✅ Pros</Text>
          {item(pros[0], 'More flexibility', true)}
          {item(pros[1], 'Better pay', true)}
        </View>
        <View style={styles.decideDivider} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.decideColHead}>⚠️ Cons</Text>
          {item(cons[0], 'Less stability', false)}
          {item(cons[1], 'New team', false)}
        </View>
      </View>
      <View style={styles.clarityRow}>
        <Text style={styles.clarityLabel}>Clarity score</Text>
        <View style={styles.clarityBarBg}>
          <Animated.View style={[styles.clarityBarFill, { backgroundColor: accent, width: clarity.interpolate({ inputRange: [0, 1], outputRange: ['0%', '72%'] }) }]} />
        </View>
        <Animated.Text style={[styles.clarityNum, { color: accent }]}>
          72%
        </Animated.Text>
      </View>
    </View>
  );
}

function ProgressDemo({ accent }: { accent: string }) {
  const xp = useRef(new Animated.Value(0)).current;
  const streak = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function run() {
      xp.setValue(0); streak.setValue(0);
      Animated.sequence([
        Animated.timing(xp, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(streak, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.delay(800),
      ]).start(() => run());
    }
    run();
  }, []);

  const CELLS = Array.from({ length: 28 }, (_, i) => (i % 4 !== 0 && i < 22 ? Math.floor(Math.random() * 3) + 1 : 0));

  return (
    <View style={styles.demoBox}>
      <View style={styles.progressDemoRow}>
        <Text style={styles.progressDemoFire}>🔥</Text>
        <Animated.Text style={[styles.progressDemoStreak, { color: accent }]}>
          {streak.interpolate({ inputRange: [0, 1], outputRange: ['0 days', '14 days'] }) as any}
        </Animated.Text>
        <Text style={styles.progressDemoLevel}>Committed</Text>
      </View>
      <View style={styles.xpBarBg}>
        <Animated.View style={[styles.xpBarFill, { backgroundColor: accent, width: xp.interpolate({ inputRange: [0, 1], outputRange: ['0%', '68%'] }) }]} />
      </View>
      <View style={styles.heatGrid}>
        {CELLS.map((level, i) => (
          <View key={i} style={[styles.heatCell, level === 1 && { backgroundColor: '#172847' }, level === 2 && { backgroundColor: '#2563EB' }, level === 3 && { backgroundColor: accent }]} />
        ))}
      </View>
    </View>
  );
}

// ─── Slide config ──────────────────────────────────────────────────────────

const SLIDES = [
  { key: 'chat',     emoji: '💬', title: 'Talk to an AI Helper',    sub: 'Have real conversations with specialized helpers for confidence, stress, habits & more.', accent: '#4A9EFF', Demo: ChatDemo },
  { key: 'habits',   emoji: '✅', title: 'Build Better Habits',     sub: 'Track daily habits, build streaks, and stay consistent with gentle AI nudges.', accent: '#34D399', Demo: HabitsDemo },
  { key: 'journal',  emoji: '✍️', title: 'Reflect & Journal',       sub: 'Write freely, get AI insights on your entries, and see emotional patterns over time.', accent: '#A78BFA', Demo: JournalDemo },
  { key: 'decision', emoji: '🎯', title: 'Make Clearer Decisions',  sub: 'Use a structured framework to weigh options and gain clarity on tough choices.', accent: '#FBBF24', Demo: DecisionDemo },
  { key: 'progress', emoji: '📈', title: 'Track Your Growth',       sub: 'Earn XP, build streaks, and watch your mood and activity trends improve over time.', accent: '#C084FC', Demo: ProgressDemo },
] as const;

// ─── Main component ────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onDone: () => void;
}

export default function AppTour({ visible, onDone }: Props) {
  const { colors } = useTheme();
  const [slide, setSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = useCallback((next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setSlide(next);
  }, [fadeAnim]);

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem(TOUR_DONE_KEY, 'true');
    onDone();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Skip */}
          <TouchableOpacity style={styles.skipBtn} onPress={finish} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          {/* Slide content */}
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {/* Demo area */}
            <View style={[styles.demoArea, { backgroundColor: current.accent + '18' }]}>
              <current.Demo accent={current.accent} />
            </View>

            {/* Emoji badge */}
            <View style={[styles.emojiBadge, { backgroundColor: current.accent + '22', borderColor: current.accent + '55' }]}>
              <Text style={styles.slideEmoji}>{current.emoji}</Text>
            </View>

            {/* Text */}
            <Text style={[styles.slideTitle, { color: colors.text }]}>{current.title}</Text>
            <Text style={[styles.slideSub, { color: colors.textMuted }]}>{current.sub}</Text>
          </Animated.View>

          {/* Dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={[styles.dot, i === slide && { backgroundColor: current.accent, width: 20 }]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Navigation */}
          <View style={styles.navRow}>
            {slide > 0 ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => goTo(slide - 1)} activeOpacity={0.7}>
                <Feather name="chevron-left" size={18} color={colors.textMuted} />
                <Text style={[styles.backText, { color: colors.textMuted }]}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: current.accent }]}
              onPress={isLast ? finish : () => goTo(slide + 1)}
              activeOpacity={0.85}
            >
              <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
              {!isLast && <Feather name="chevron-right" size={16} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', backgroundColor: '#0F1526', borderRadius: 28, padding: 24, overflow: 'hidden', minHeight: 520 },
  skipBtn: { alignSelf: 'flex-end', paddingHorizontal: 4, paddingVertical: 2, marginBottom: 8 },
  skipText: { fontSize: 13, color: '#556080', fontWeight: '600' },
  demoArea: { borderRadius: 16, marginBottom: 20, height: 188, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  emojiBadge: { alignSelf: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14 },
  slideEmoji: { fontSize: 28 },
  slideTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  slideSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2A3A56' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 },
  backText: { fontSize: 14, fontWeight: '600' },
  nextBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 14 },
  nextText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Demo shared
  demoBox: { width: DEMO_W, gap: 8, paddingHorizontal: 12, paddingVertical: 8 },

  // Chat demo
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '82%' },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAI: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 12, lineHeight: 17 },

  // Habits demo
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#131929', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  habitCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  habitLabel: { flex: 1, fontSize: 12, color: '#C8D5F0' },
  habitBarBg: { width: 40, height: 4, backgroundColor: '#1C2236', borderRadius: 2, overflow: 'hidden' },
  habitBarFill: { height: 4, borderRadius: 2 },

  // Journal demo
  journalCard: { backgroundColor: '#131929', borderRadius: 12, padding: 12 },
  journalDate: { fontSize: 10, color: '#556080', marginBottom: 6, fontWeight: '600' },
  journalText: { fontSize: 12, color: '#C8D5F0', lineHeight: 19 },
  insightPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  insightText: { fontSize: 11, fontWeight: '700' },

  // Decision demo
  decideCols: { flexDirection: 'row', gap: 10 },
  decideDivider: { width: 1, backgroundColor: '#1E2A40' },
  decideColHead: { fontSize: 11, fontWeight: '700', color: '#8B9CC8', marginBottom: 2 },
  decideItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  decideIcon: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  decideText: { fontSize: 11, color: '#C8D5F0', flex: 1 },
  clarityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#131929', borderRadius: 10, padding: 10 },
  clarityLabel: { fontSize: 11, color: '#556080', fontWeight: '600' },
  clarityBarBg: { flex: 1, height: 6, backgroundColor: '#1C2236', borderRadius: 3, overflow: 'hidden' },
  clarityBarFill: { height: 6, borderRadius: 3 },
  clarityNum: { fontSize: 12, fontWeight: '700', width: 32 },

  // Progress demo
  progressDemoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressDemoFire: { fontSize: 18 },
  progressDemoStreak: { fontSize: 14, fontWeight: '700', flex: 1 },
  progressDemoLevel: { fontSize: 11, color: '#8B9CC8', fontWeight: '600' },
  xpBarBg: { height: 6, backgroundColor: '#1C2236', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  xpBarFill: { height: 6, borderRadius: 3 },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#1C2236' },
});
