import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Share,
  Alert,
  Linking,
  Image,
  Animated,
  Modal,
  Pressable,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useAudioRecorder, requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import Markdown from 'react-native-markdown-display';
import { getAgentById, buildAgentSystemPrompt } from '../constants/agents';
import { AI_MODE_KEY } from '../constants/local-models';
import { callAI, callAIStream, getAICapabilities } from '../services/gemini-service';
import { containsAdultContent } from '../services/safety-filter';
import { scheduleHelperReadyNotification } from '../services/notifications';
import { useAuthStore } from '../store/auth';
import { getDeviceLanguage } from '../i18n';
import type { Message, Conversation, ToneOption, Habit } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import { secureGet, secureSet } from '../services/storage-encryption';

const CONVERSATIONS_KEY = '@innerspace:conversations';
const HABITS_KEY = '@innerspace:habits';
const TONE_KEY = '@innerspace:tone';
const XP_KEY = '@innerspace:xp';
const STREAK_KEY = '@innerspace:streak';
const STREAK_DATE_KEY = '@innerspace:streak_last_date';
const PINNED_INSIGHTS_KEY = '@innerspace:pinned_insights';

const GROUNDING_EXERCISES = [
  { title: '4-7-8 Breathing', desc: 'Inhale 4s · hold 7s · exhale 8s. Repeat 3 times.' },
  { title: '5-4-3-2-1', desc: 'Name 5 things you see, 4 you hear, 3 you can touch, 2 you smell, 1 you taste.' },
  { title: 'Box Breathing', desc: 'Breathe in 4s · hold 4s · out 4s · hold 4s. Repeat.' },
];

const STRESS_KEYWORDS = ['anxious', 'anxiety', 'stressed', 'overwhelmed', 'panic', 'scared', 'worried', 'nervous', "can't cope", 'breaking down'];

function reactionsStorageKey(convId: string) {
  return `@innerspace:reactions:${convId}`;
}

const TONE_PROMPTS: Record<string, string> = {
  warm: 'Warm, encouraging, and supportive. Use a friendly conversational tone.',
  direct: 'Clear, concise, and direct. Skip pleasantries, get to the point.',
  motivational: 'High-energy and motivating. Use action verbs. Keep the user excited.',
};

const TONE_LABELS: Record<string, string> = { warm: '🌸 Warm', direct: '⚡ Direct', motivational: '🔥 Motivated' };
const TONE_ORDER: ToneOption[] = ['warm', 'direct', 'motivational'];

// Speech parameters per tone, tuned separately for each platform's rate scale.
// iOS:    rate 0.0–1.0, default 0.5 (normal pace)
// Android: rate 0.0–2.0, default 1.0 (normal pace)
const SPEECH_TONE_PARAMS: Record<string, { iosRate: number; androidRate: number; pitch: number }> = {
  warm:         { iosRate: 0.44, androidRate: 0.85, pitch: 0.88 }, // unhurried, lower/warmer
  direct:       { iosRate: 0.52, androidRate: 1.00, pitch: 1.00 }, // neutral, efficient
  motivational: { iosRate: 0.58, androidRate: 1.12, pitch: 1.10 }, // energetic, upbeat
};

const SAFETY_BG = '#3B1A1A';
const SAFETY_BORDER = '#EF4444';

function validateResponse(response: string): { text: string; isSafetyRedirect: boolean; safetyCategory: string | null } {
  if (containsAdultContent(response)) {
    return {
      text: 'InnerSpace is not designed for adult or explicit content. I cannot provide responses on this topic. Is there something else I can help you with?',
      isSafetyRedirect: true,
      safetyCategory: 'ADULT_CONTENT',
    };
  }
  return { text: response, isSafetyRedirect: false, safetyCategory: null };
}

interface Attachment {
  type: 'image' | 'document';
  uri?: string;
  base64?: string;
  mimeType?: string;
  name?: string;
  text?: string;
}

// ── Follow-up chip generator ─────────────────────────────────────────────────

// Agent-specific seed chips shown when the AI call times out or fails.
// Each set is scoped to that helper's domain so chips never bleed across helpers.
const AGENT_SEED_CHIPS: Record<string, string[]> = {
  chef:             ['Give me a quick recipe', 'What can I make with leftovers?', 'Meal prep tips?'],
  handyman:         ['What tools do I need?', 'Step-by-step instructions?', 'Safety tips for this?'],
  home_organizer:   ['Where do I start decluttering?', 'Storage ideas?', 'How to stay organised?'],
  parenting:        ['Age-appropriate activities?', 'How to handle tantrums?', 'Building a daily routine?'],
  elder_care:       ['Signs I should watch for?', 'What resources are available?', 'How to start the conversation?'],
  interior_design:  ['What style suits my space?', 'Budget-friendly ideas?', 'Colour palette tips?'],
  botanist:         ['How often should I water?', 'Why are the leaves yellowing?', 'Best plants for indoors?'],
  landscape:        ['Seasonal care tips?', 'Low-maintenance options?', 'How to fix bare patches?'],
  fitness:          ['Which exercises target this?', 'How many reps and sets?', 'When should I rest?'],
  yoga:             ['Guide me through a pose?', 'Best sequence for beginners?', 'Breathing techniques for yoga?'],
  nutrition:        ['What should I eat before a workout?', 'Meal ideas for my goal?', 'How to read food labels?'],
  sleep:            ['What disrupts deep sleep?', 'Wind-down routine ideas?', 'Tips for waking up refreshed?'],
  career:           ['How do I prepare for this?', 'What skill should I build next?', 'How to stand out?'],
  study:            ['How do I retain this better?', 'Study techniques for this?', 'Build a study plan?'],
  resume:           ['How should I phrase this?', 'What should I highlight?', 'Common resume mistakes?'],
  entrepreneur:     ['How do I validate this idea?', 'What is my next step?', 'Pitfalls to avoid?'],
  language_tutor:   ['How do I practise daily?', 'Common phrases for this?', 'Grammar explanation?'],
  crafter:          ['What materials do I need?', 'Step-by-step guide?', 'Beginner projects to try?'],
  photography:      ['Camera settings for this?', 'Composition tips?', 'Editing suggestions?'],
  writing:          ['How do I overcome writer\'s block?', 'Make this more engaging?', '"Show don\'t tell" example?'],
  music:            ['Practice routine for this?', 'Theory behind this?', 'Songs to learn next?'],
  tech_helper:      ['How to troubleshoot this?', 'Explain this in simple terms?', 'Step-by-step fix?'],
  social_media:     ['Content ideas for my niche?', 'Best time to post?', 'Engagement tips?'],
  cyber_safety:     ['How do I check if I\'m safe?', 'What to do if hacked?', 'Strong password tips?'],
  pet_trainer:      ['How long will this take?', 'What if they won\'t respond?', 'Next command to teach?'],
  pet_care:         ['Signs to watch for?', 'What food is safe?', 'Vet visit checklist?'],
  travel:           ['Best time to visit?', 'What to pack?', 'Local tips for this destination?'],
  culture_guide:    ['How do I avoid offending?', 'Food to try there?', 'Cultural etiquette tips?'],
  habit_builder:    ['How do I track this habit?', 'What if I miss a day?', 'Stack this with another habit?'],
  confidence:       ['How do I stop self-doubt?', 'Body language tips?', 'An affirmation for this?'],
  time_management:  ['How do I prioritise this?', 'Productivity system for me?', 'Handle interruptions?'],
  life_goals:       ['How do I break this into steps?', 'Overcome this obstacle?', 'Stay motivated long-term?'],
  budget:           ['Where should I cut back?', 'Savings strategy for this?', 'Emergency fund tips?'],
};

function agentFallbackChips(agentId: string): string[] {
  return AGENT_SEED_CHIPS[agentId] ?? ['Tell me more', 'Give me an example', 'What should I do next?'];
}

async function generateFollowUpChips(
  userMessage: string,
  assistantResponse: string,
  systemPrompt: string,
  agentId: string,
  agentName: string,
): Promise<string[]> {
  const prompt = `You are the ${agentName} helper. The user just said: "${userMessage.slice(0, 200)}"

You replied: "${assistantResponse.slice(0, 500)}"

Suggest 3 short follow-up questions the user might want to ask next, specific to what was just discussed and to your role as ${agentName}. Do NOT use generic wellness or productivity questions.

Return ONLY a JSON array — no other text, no markdown:
["First follow-up?", "Second follow-up?", "Third follow-up?"]`;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
  const aiCall = callAI(prompt, systemPrompt, []);

  const result = await Promise.race([aiCall, timeout]);
  if (!result || result.error || result.isSafetyRedirect) {
    return agentFallbackChips(agentId);
  }

  try {
    const match = result.text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return parsed.slice(0, 3).map((s: unknown) => String(s).trim());
      }
    }
  } catch { /* fall through */ }

  return agentFallbackChips(agentId);
}

// ── Habit extraction ─────────────────────────────────────────────────────────

function extractHabitName(msg: string): string | null {
  const lower = msg.toLowerCase().trim();
  const patterns: RegExp[] = [
    /build (?:a |an )?(.+?) habit/,
    /develop (?:a |an )?(.+?) habit/,
    /form (?:a |an )?(.+?) habit/,
    /create (?:a |an )?(.+?) habit/,
    /start (?:a |an )?(.+?) habit/,
    /make (?:.+? )?habit of (.+?)(?:\?|$)/,
    /habit of (.+?)(?:\?|$)/,
    /how (?:do i |to |can i )?(?:start |begin |do )?(.+?) daily/,
    /how (?:do i |to |can i )?(?:start |begin )?(.+?) every day/,
    /(?:daily|morning|evening|nightly) (.+?) (?:routine|habit|practice)/,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m?.[1]) {
      const name = m[1].replace(/\?.*$/, '').trim();
      if (name.length > 2 && name.length < 60 && !name.includes('do i') && !name.includes('how to')) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
  }
  return null;
}

// ── Animated typing dots ─────────────────────────────────────────────────────

function TypingDots({ color }: { color: string }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(300),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, transform: [{ translateY: dot }] }} />
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const agentId: string = route.params?.agentId ?? 'chef';
  const customAgent = route.params?.customAgent ?? null;
  const routeConversationId: string | undefined = route.params?.conversationId;

  const agent = customAgent ?? getAgentById(agentId);
  const { email } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [helperCooldownUntil, setHelperCooldownUntil] = useState<Date | null>(null);
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const [tone, setTone] = useState<ToneOption>('warm');
  const [reactions, setReactions] = useState<Record<string, 'up' | 'down'>>({});
  const [groundingVisible, setGroundingVisible] = useState(false);
  const [recapBanner, setRecapBanner] = useState<string | null>(null);
  const [localModelError, setLocalModelError] = useState<string | null>(null);
  const [cloudFallbackBanner, setCloudFallbackBanner] = useState(false);

  // Streaming
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const chipGenId = useRef(0);

  // Follow-up chips
  const [followUpChips, setFollowUpChips] = useState<string[]>([]);

  // Habit suggestion chip
  const [suggestedHabitName, setSuggestedHabitName] = useState<string | null>(null);

  // Scroll FAB
  const [showScrollFab, setShowScrollFab] = useState(false);

  // Voice input
  const [isListening, setIsListening] = useState(false);
  const [voicePartial, setVoicePartial] = useState('');

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setVoicePartial('');
  });

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript?.trim();
    if (e.isFinal) {
      if (text) {
        setInput(text);
      }
      setVoicePartial('');
    } else {
      setVoicePartial(text ?? '');
    }
  });

  useSpeechRecognitionEvent('error', (e) => {
    setIsListening(false);
    setVoicePartial('');
    if (e.error && e.error !== 'aborted') {
      const msg = String(e.message ?? '');
      if (!msg.includes('cancel') && !msg.includes('stopped')) {
        Alert.alert('Couldn\'t hear you', 'Try again or type your message.');
      }
    }
  });

  // TTS output
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakPulse = useRef(new Animated.Value(1)).current;

  // Attachment
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);

  // AI capabilities
  const [supportsVision, setSupportsVision] = useState(false);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiMode, setAiMode] = useState<string>('cloud');

  const conversationId = useRef(routeConversationId ?? `conv_${Date.now()}`);
  const listRef = useRef<FlatList>(null);
  const language = getDeviceLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const systemPrompt = agent
    ? buildAgentSystemPrompt(agent, TONE_PROMPTS[tone] ?? TONE_PROMPTS.warm, language)
    : '';

  // Pulse animation while speaking
  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(speakPulse, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(speakPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      speakPulse.stopAnimation();
      speakPulse.setValue(1);
    }
  }, [isSpeaking]);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Clear chips immediately when the user switches to a different helper
  useEffect(() => {
    setFollowUpChips([]);
    chipGenId.current += 1;
  }, [agentId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      Speech.stop();
      abortRef.current?.abort();
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(TONE_KEY).then((saved) => { if (saved) setTone(saved as ToneOption); });
    AsyncStorage.getItem(reactionsStorageKey(conversationId.current)).then((raw) => {
      if (raw) { try { setReactions(JSON.parse(raw)); } catch { } }
    });
    if (routeConversationId) {
      secureGet(CONVERSATIONS_KEY).then((raw) => {
        if (!raw) return;
        try {
          const all: Conversation[] = JSON.parse(raw);
          const found = all.find((c) => c.id === routeConversationId);
          if (found?.messages?.length) {
            const restored = found.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
            setMessages(restored);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
            const lastMsg = found.messages[found.messages.length - 1];
            const diffH = (Date.now() - new Date(lastMsg.timestamp).getTime()) / 3600000;
            if (diffH >= 48) {
              const days = Math.floor(diffH / 24);
              const summary = found.summary ? `Last time: ${found.summary}` : '';
              setRecapBanner(`You're back after ${days} day${days !== 1 ? 's' : ''}. ${summary}`.trim());
            }
          }
        } catch { }
      });
    }
  }, []);

  useEffect(() => {
    if (!helperCooldownUntil) return;
    const tick = setInterval(() => {
      setCooldownNow(Date.now());
      if (Date.now() >= helperCooldownUntil.getTime()) setHelperCooldownUntil(null);
    }, 30000);
    return () => clearInterval(tick);
  }, [helperCooldownUntil]);

  // Session close card — intercept back navigation after a real conversation
  const [sessionCloseVisible, setSessionCloseVisible] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<unknown>(null);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (messagesRef.current.length < 2) return;
      e.preventDefault();
      setPendingNavAction(e.data.action);
      setSessionCloseVisible(true);
    });
    return unsubscribe;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      getAICapabilities().then((caps) => {
        setSupportsVision(caps.supportsVision);
        setAiProvider(caps.provider);
        setAiMode(caps.aiMode);
      });
      setAttachment((prev) => (prev?.type === 'image' ? null : prev));
    }, []),
  );

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  function cycleTone() {
    setTone((prev) => {
      const idx = TONE_ORDER.indexOf(prev);
      const next = TONE_ORDER[(idx + 1) % TONE_ORDER.length];
      AsyncStorage.setItem(TONE_KEY, next).catch(() => {});
      return next;
    });
  }

  async function saveConversation(updatedMessages: Message[], summary?: string) {
    try {
      const raw = await secureGet(CONVERSATIONS_KEY);
      const all: Conversation[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((c) => c.id === conversationId.current);
      const existing = idx >= 0 ? all[idx] : null;
      const convo: Conversation = {
        id: conversationId.current,
        agentId,
        messages: updatedMessages,
        createdAt: existing?.createdAt ?? new Date(),
        summary: summary ?? existing?.summary,
      };
      if (idx >= 0) all[idx] = convo;
      else all.push(convo);
      await secureSet(CONVERSATIONS_KEY, JSON.stringify(all));
    } catch { }
  }

  async function generateSummary(msgs: Message[]) {
    if (msgs.length < 4) return;
    try {
      const transcript = msgs
        .filter((m) => !m.isSafetyRedirect)
        .map((m) => `${m.role === 'user' ? 'User' : 'Helper'}: ${m.content}`)
        .join('\n');
      const result = await callAI(
        `Summarise this conversation in 2-3 concise bullet points (max 20 words each). Start each bullet with •.\n\n${transcript}`,
        'You are a concise summarisation assistant. Reply only with the bullet points, no preamble.',
        [],
      );
      if (!result.error && !result.isSafetyRedirect && result.text) {
        await saveConversation(msgs, result.text);
      }
    } catch { }
  }

  async function handleShareMessage(content: string) {
    try { await Share.share({ message: content }); } catch { }
  }

  async function handlePinInsight(content: string) {
    try {
      const raw = await AsyncStorage.getItem(PINNED_INSIGHTS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      existing.unshift({ id: Date.now().toString(), content, agentId: agent?.id ?? '', agentEmoji: agent?.emoji ?? '💬', pinnedAt: new Date().toISOString() });
      await AsyncStorage.setItem(PINNED_INSIGHTS_KEY, JSON.stringify(existing.slice(0, 20)));
      Alert.alert('Pinned ✓', 'Saved as a pinned insight on your Home screen.');
    } catch { }
  }

  function handleMessageLongPress(item: Message) {
    if (item.role === 'user') {
      Alert.alert('Edit message', undefined, [
        { text: 'Edit & resend', onPress: () => editAndResend(item) },
        { text: 'Share', onPress: () => handleShareMessage(item.content) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Message', undefined, [
        { text: 'Share', onPress: () => handleShareMessage(item.content) },
        { text: 'Pin as insight', onPress: () => handlePinInsight(item.content) },
        { text: 'Read aloud', onPress: () => speakMessage(item.content) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function editAndResend(item: Message) {
    // Remove the message and everything after it, restore content to input
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === item.id);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
    setInput(item.content);
    setFollowUpChips([]);
  }

  function handleRegenerate(afterMessageId: string) {
    // Find the user message just before this assistant message
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === afterMessageId);
      if (idx < 0) return prev;
      const userMsg = prev.slice(0, idx).reverse().find((m) => m.role === 'user');
      if (!userMsg) return prev;
      const trimmed = prev.slice(0, idx); // remove the assistant message
      // Re-send after state update
      setTimeout(() => handleSend(userMsg.content, trimmed), 50);
      return trimmed;
    });
    setFollowUpChips([]);
  }

  function cleanForSpeech(raw: string): string {
    return raw
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/^[-*•]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/---+/g, '')
      // Expand common abbreviations so TTS doesn't read them letter-by-letter
      .replace(/\be\.g\./gi, 'for example')
      .replace(/\bi\.e\./gi, 'that is')
      .replace(/\betc\./gi, 'etcetera')
      .replace(/\bvs\./gi, 'versus')
      .replace(/\bDr\./g, 'Doctor')
      .replace(/\bMr\./g, 'Mister')
      .replace(/\bMrs\./g, 'Missus')
      // Natural pauses: ellipsis and mid-sentence dashes
      .replace(/\.{2,}/g, '. ')
      .replace(/\s—\s/g, ', ')
      // Strip emoji (they get spelled out as "smiling face" etc.)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  const SPEECH_LOCALE: Record<string, string> = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
    pt: 'pt-PT', hi: 'hi-IN', zh: 'zh-CN', ja: 'ja-JP',
    ar: 'ar-SA', it: 'it-IT',
  };

  // Cache the chosen voice identifier per locale so we only query once
  const voiceCache = useRef<Record<string, string | undefined>>({});

  async function selectBestVoice(locale: string): Promise<string | undefined> {
    if (locale in voiceCache.current) return voiceCache.current[locale];
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const lang = locale.split('-')[0];
      const candidates = voices.filter((v) => v.language?.startsWith(lang));
      // Prefer premium → enhanced → default
      const chosen =
        candidates.find((v) => (v as { quality?: string }).quality === 'Premium') ??
        candidates.find((v) => (v as { quality?: string }).quality === 'Enhanced') ??
        candidates.find((v) => v.language === locale) ??
        candidates[0];
      voiceCache.current[locale] = chosen?.identifier;
    } catch {
      voiceCache.current[locale] = undefined;
    }
    return voiceCache.current[locale];
  }

  async function speakMessage(text: string) {
    Speech.stop();
    const clean = cleanForSpeech(text);
    const locale = SPEECH_LOCALE[language] ?? 'en-US';
    const voice = await selectBestVoice(locale);
    const toneParams = SPEECH_TONE_PARAMS[tone] ?? SPEECH_TONE_PARAMS.warm;
    const rate = Platform.OS === 'ios' ? toneParams.iosRate : toneParams.androidRate;
    const pitch = toneParams.pitch;
    Speech.speak(clean, {
      language: locale,
      ...(voice ? { voice } : {}),
      rate,
      pitch,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  function toggleTts() {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    setTtsEnabled((v) => !v);
  }

  function openAppSettings() {
    Linking.openSettings().catch(() => {});
  }

  function showSettingsAlert(title: string, body: string) {
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: openAppSettings },
    ]);
  }

  async function startVoiceInput() {
    if (aiMode === 'local') {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        showSettingsAlert(
          'Microphone & Speech Recognition needed',
          'InnerSpace needs microphone and speech recognition permissions so you can speak to your helper.',
        );
        return;
      }
      try {
        const locale = SPEECH_LOCALE[language] ?? 'en-US';
        await ExpoSpeechRecognitionModule.start({
          lang: locale,
          interimResults: true,
        });
        setIsListening(true);
        setVoicePartial('Listening…');
      } catch (err) {
        console.warn('Speech recognition start error', err);
        Alert.alert(
          'Microphone unavailable',
          'Could not start speech recognition. Please make sure microphone permission is enabled in Settings.',
        );
      }
      return;
    }
    if (aiProvider !== 'gemini') {
      Alert.alert(
        'Voice needs Gemini',
        'Voice transcription is only available when using Gemini as your AI provider. Switch to Gemini in Settings.',
      );
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
            message: 'InnerSpace needs your microphone so you can speak to your helper.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          },
        );
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          showSettingsAlert(
            'Microphone access needed',
            'You\'ve blocked microphone access. Tap "Open Settings" to enable it.',
          );
          return;
        }
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          return; // user tapped "Not now" — silently abort, no error shown
        }
      }
    }
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      showSettingsAlert(
        'Microphone access needed',
        'Allow InnerSpace to use your microphone so you can speak to your helper.',
      );
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsListening(true);
      setVoicePartial('Listening…');
    } catch {
      Alert.alert('Couldn\'t start recording', 'Try again or type your message.');
    }
  }

  async function stopVoiceInput() {
    if (aiMode === 'local') {
      setIsListening(false);
      setVoicePartial('');
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch (err) {
        console.warn('Speech recognition stop error', err);
      }
      return;
    }

    setIsListening(false);
    setVoicePartial('');

    // Always attempt stop — record() is fire-and-forget and may have failed silently.
    // If it never started, stop() is a no-op and uri will be null.
    setIsTranscribing(true);
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
      await setAudioModeAsync({ allowsRecording: false });
      const uri = audioRecorder.uri;

      if (!uri) {
        Alert.alert('Microphone error', 'No audio was captured. Please check microphone permissions and try again.');
        return;
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize: number = (fileInfo as { size?: number }).size ?? 0;
      if (!fileInfo.exists || fileSize < 1000) {
        Alert.alert('Recording too short', 'Please tap the mic, speak your message, then tap the stop button.');
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = uri.endsWith('.3gp') ? 'audio/3gpp' : 'audio/mp4';
      const result = await callAI(
        'Transcribe this audio recording exactly as spoken. Return only the transcribed text, nothing else.',
        'You are a transcription assistant. Transcribe spoken audio accurately. Return only the spoken words.',
        [],
        base64,
        mimeType,
      );
      if (!result.error && result.text?.trim()) {
        setInput(result.text.trim());
      } else {
        Alert.alert('Couldn\'t transcribe', 'Tap the mic and try speaking clearly, or type your message.');
      }
    } catch {
      Alert.alert('Couldn\'t transcribe', 'Something went wrong. Try again or type your message.');
    } finally {
      setIsTranscribing(false);
    }
  }

  // ── Attachment pickers ───────────────────────────────────────────────────────

  async function pickFromCamera() {
    setAttachMenuVisible(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showSettingsAlert(
        'Camera access needed',
        perm.canAskAgain
          ? 'InnerSpace needs camera access to take a photo for your helper.'
          : 'Camera access was denied. You can enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAttachment({ type: 'image', uri: asset.uri, base64: asset.base64 ?? undefined, mimeType: 'image/jpeg' });
    }
  }

  async function pickFromLibrary() {
    setAttachMenuVisible(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showSettingsAlert(
        'Photo access needed',
        perm.canAskAgain
          ? 'InnerSpace needs access to your photos to share an image with your helper.'
          : 'Photo access was denied. You can enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAttachment({ type: 'image', uri: asset.uri, base64: asset.base64 ?? undefined, mimeType: 'image/jpeg' });
    }
  }

  async function pickDocument() {
    setAttachMenuVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['text/*', 'application/json', 'application/pdf', '*/*'] });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let text: string | undefined;
        try {
          const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
          const isPdfBinary = raw.startsWith('%PDF');
          text = isPdfBinary
            ? `[PDF document attached: ${asset.name}. Note: PDF content cannot be read — please paste the key text instead.]`
            : raw.slice(0, 12000);
        } catch {
          text = `[File attached: ${asset.name}. Content could not be read as text.]`;
        }
        setAttachment({ type: 'document', name: asset.name, uri: asset.uri, text });
      }
    } catch { }
  }

  // ── Send ────────────────────────────────────────────────────────────────────

  async function handleSend(text?: string, overrideHistory?: Message[]) {
    const userText = (text ?? input).trim();
    if ((!userText && !attachment) || thinking || streamingId) return;

    const aiMode = await AsyncStorage.getItem(AI_MODE_KEY);
    if (aiMode === 'local' && agent?.minimumAIMode === 'cloud') {
      Alert.alert(t('chat.cloud_only_title'), t('chat.cloud_only_body'));
      return;
    }
    if (attachment?.type === 'image' && aiMode === 'local') {
      Alert.alert('Vision not available', 'Photo analysis requires a cloud AI provider. Switch to Gemini in Settings.');
      return;
    }

    setInput('');
    const pendingAttachment = attachment;
    setAttachment(null);
    setFollowUpChips([]);
    setSuggestedHabitName(null);

    const lower = userText.toLowerCase();
    if (STRESS_KEYWORDS.some((kw) => lower.includes(kw))) setGroundingVisible(true);

    const docContext = pendingAttachment?.type === 'document' && pendingAttachment.text
      ? `--- Document: ${pendingAttachment.name} ---\n${pendingAttachment.text}\n--- End of document ---`
      : null;
    const messageText = docContext ? (userText ? `${docContext}\n\n${userText}` : docContext) : userText;
    const displayContent = pendingAttachment?.type === 'document' ? (userText || '') : messageText;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: displayContent,
      timestamp: new Date(),
      imageUri: pendingAttachment?.type === 'image' ? pendingAttachment.uri : undefined,
      fileName: pendingAttachment?.type === 'document' ? pendingAttachment.name : undefined,
    };

    const baseMessages = overrideHistory ?? messages;
    setMessages([...baseMessages, userMsg]);
    scrollToBottom();
    setThinking(true);
    let accumulatedText = '';

    const placeholderId = `stream_${Date.now()}`;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = baseMessages.map((m) => ({ role: m.role, content: m.content }));
      const aiMessage = pendingAttachment?.type === 'image'
        ? (userText || 'Please describe and analyze what you see in this image.')
        : messageText;

      // Start streaming placeholder
      setStreamingId(placeholderId);
      setStreamingText('');
      setThinking(false);

      const result = await callAIStream(
        aiMessage,
        systemPrompt,
        history,
        (chunk) => {
          if (!isMountedRef.current) return;
          accumulatedText += chunk;
          setStreamingText(accumulatedText);
          scrollToBottom();
        },
        controller.signal,
        pendingAttachment?.type === 'image' ? pendingAttachment.base64 : undefined,
        pendingAttachment?.type === 'image' ? (pendingAttachment.mimeType ?? 'image/jpeg') : undefined,
      );

      if (!isMountedRef.current) return;
      setStreamingId(null);
      setStreamingText('');

      if (result.error === 'aborted') return;

      const LOCAL_ERRORS = ['executorch_unavailable', 'mediapipe_unavailable', 'model_not_downloaded',
        'mediapipe_model_not_ready', 'unsupported_model', 'no_model', 'local_model_error', 'model_downloading'];
      if (result.providerUsed === 'local' && result.error && LOCAL_ERRORS.includes(result.error)) {
        setLocalModelError(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        return;
      }

      if (result.error === 'local_used_cloud_fallback') {
        setCloudFallbackBanner(true);
        setTimeout(() => setCloudFallbackBanner(false), 5000);
      }

      if (result.error === 'no_key') {
        const fallbackPrompts = agent?.suggestedQuestions ?? [];
        const fallbackText = fallbackPrompts.length
          ? `${t('chat.no_ai_tool_configured')}\n\n${t('chat.reflection_prompts_intro')}\n\n${fallbackPrompts.map((q: string) => `• ${q}`).join('\n')}`
          : t('chat.no_ai_tool_configured');
        const setupMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: fallbackText, timestamp: new Date() };
        const updatedMessages = [...baseMessages, userMsg, setupMsg];
        setMessages(updatedMessages);
        await saveConversation(updatedMessages);
        return;
      }

      let assistantText = result.text?.trim() ? result.text : null;
      if (!assistantText && !result.isSafetyRedirect && !result.error) assistantText = t('chat.error');
      if (!assistantText) assistantText = result.text;

      if (result.error === 'quota_exceeded' && result.cooldownUntil) {
        const nextReady = new Date(result.cooldownUntil);
        const friendlyTime = nextReady.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        assistantText = `${t('chat.helper_resting_until', { time: friendlyTime })}\n\n${t('chat.helper_ready_note')}`;
        setHelperCooldownUntil(nextReady);
      }

      const validatedResponse = validateResponse(assistantText);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: validatedResponse.text,
        timestamp: new Date(),
        isSafetyRedirect: validatedResponse.isSafetyRedirect || result.isSafetyRedirect,
        safetyCategory: validatedResponse.safetyCategory || result.safetyCategory,
      };
      const updatedMessages = [...baseMessages, userMsg, assistantMsg];
      setMessages(updatedMessages);
      await saveConversation(updatedMessages);

      if (ttsEnabled && !assistantMsg.isSafetyRedirect && assistantMsg.content) {
        speakMessage(assistantMsg.content);
      }

      if (!assistantMsg.isSafetyRedirect && assistantMsg.content) {
        setFollowUpChips([]);
        const genId = ++chipGenId.current;
        generateFollowUpChips(userText, assistantMsg.content, systemPrompt, agentId, agent?.name ?? agentId).then((chips) => {
          if (chipGenId.current === genId) setFollowUpChips(chips);
        });
        const habitName = extractHabitName(userText);
        setSuggestedHabitName(habitName);
      }

      if (result.error === 'quota_exceeded' && result.cooldownUntil) {
        await scheduleHelperReadyNotification(
          result.cooldownUntil, t(agent.nameKey),
          t('notifications.helper_ready_title'),
          t('notifications.helper_ready_body', { helper: t(agent.nameKey) }),
        );
      }

      if (!result.isSafetyRedirect && !result.error) {
        await addXp(5);
        await updateStreak();
        const aiCount = updatedMessages.filter((m) => m.role === 'assistant' && !m.isSafetyRedirect).length;
        if (aiCount >= 3) generateSummary(updatedMessages);
      }
    } catch {
      setStreamingId(null);
      setStreamingText('');
      const partialText = accumulatedText.trim();
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: partialText || t('chat.error'),
        timestamp: new Date(),
        isIncomplete: partialText.length > 0,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setThinking(false);
      scrollToBottom();
    }
  }

  async function addXp(amount: number) {
    try {
      const raw = await AsyncStorage.getItem(XP_KEY);
      const current = raw ? parseInt(raw, 10) : 0;
      await AsyncStorage.setItem(XP_KEY, String(Math.min(current + amount, 9999)));
    } catch { }
  }

  async function updateStreak() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = await AsyncStorage.getItem(STREAK_DATE_KEY);
      if (lastDate === today) return;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const streakRaw = await AsyncStorage.getItem(STREAK_KEY);
      const current = streakRaw ? parseInt(streakRaw, 10) : 0;
      const newStreak = lastDate === yesterday ? current + 1 : 1;
      await Promise.all([AsyncStorage.setItem(STREAK_KEY, String(newStreak)), AsyncStorage.setItem(STREAK_DATE_KEY, today)]);
    } catch { }
  }

  async function handleAddSuggestedHabit(name: string) {
    try {
      const raw = await secureGet(HABITS_KEY);
      const habits: Habit[] = raw ? JSON.parse(raw) : [];
      const alreadyExists = habits.some((h) => h.name.toLowerCase() === name.toLowerCase());
      if (alreadyExists) {
        Alert.alert('Already tracked', `"${name}" is already in your habits list.`);
        setSuggestedHabitName(null);
        return;
      }
      const newHabit: Habit = {
        id: `habit_${Date.now()}`,
        name,
        frequency: 'daily',
        streak: 0,
        createdAt: new Date(),
      };
      await secureSet(HABITS_KEY, JSON.stringify([...habits, newHabit]));
      setSuggestedHabitName(null);
      Alert.alert('Added!', `"${name}" has been added to your Habits. Keep it up! 🎯`);
    } catch {
      Alert.alert('Error', 'Could not add habit. Please try again.');
    }
  }

  function toggleReaction(msgId: string, reaction: 'up' | 'down') {
    setReactions((prev) => {
      const next = { ...prev };
      if (prev[msgId] === reaction) delete next[msgId];
      else next[msgId] = reaction;
      AsyncStorage.setItem(reactionsStorageKey(conversationId.current), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const markdownStyles = useMemo(() => ({
    body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
    strong: { color: colors.text, fontWeight: '700' as const },
    em: { color: colors.textSecondary, fontStyle: 'italic' as const },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
    code_inline: { backgroundColor: colors.surface, color: colors.accent, borderRadius: 4, paddingHorizontal: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    fence: { backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, marginVertical: 6 },
    code_block: { color: colors.textSecondary, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    heading1: { color: colors.text, fontSize: 17, fontWeight: '700' as const, marginVertical: 4 },
    heading2: { color: colors.text, fontSize: 15, fontWeight: '700' as const, marginVertical: 3 },
    paragraph: { marginVertical: 2 },
  }), [colors]);

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    const reaction = reactions[item.id];
    const isStreaming = item.id === streamingId;
    const displayText = isStreaming ? streamingText : item.content;

    return (
      <TouchableOpacity activeOpacity={0.95} onLongPress={() => handleMessageLongPress(item)}>
        <View style={[styles.msgWrapper, isUser ? styles.msgWrapperUser : styles.msgWrapperAssistant]}>
          {item.isSafetyRedirect ? (
            <View style={styles.safetyContainer}>
              <View style={styles.safetyBanner}>
                <Feather name="shield" size={14} color="#EF4444" />
                <Text style={styles.safetyLabel}>{t('chat.safety_blocked')}</Text>
              </View>
              <View style={[styles.bubble, styles.bubbleSafety]}>
                <Text style={styles.bubbleTextSafety}>{item.content}</Text>
              </View>
            </View>
          ) : (
            <View
              style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
              accessibilityLiveRegion={isStreaming ? 'polite' : undefined}
            >
              {item.imageUri && (
                <Image source={{ uri: item.imageUri }} style={styles.attachedImage} resizeMode="cover" />
              )}
              {item.fileName && (
                <View style={styles.fileChip}>
                  <Feather name="file-text" size={13} color={colors.textMuted} />
                  <Text style={styles.fileChipText} numberOfLines={1}>{item.fileName}</Text>
                </View>
              )}
              {isUser ? (
                !!displayText && <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{displayText}</Text>
              ) : (
                isStreaming && !displayText ? (
                  <TypingDots color={colors.accent} />
                ) : (
                  !!displayText && <Markdown style={markdownStyles}>{displayText}</Markdown>
                )
              )}
            </View>
          )}

          {/* Action row for assistant messages */}
          {!isUser && !item.isSafetyRedirect && !isStreaming && (
            <View style={styles.msgActions}>
              <TouchableOpacity
                onPress={() => toggleReaction(item.id, 'up')}
                style={[styles.msgActionBtn, reaction === 'up' && styles.msgActionBtnActive]}
                accessibilityLabel="Mark as helpful"
                accessibilityRole="button"
              >
                <Feather name="thumbs-up" size={13} color={reaction === 'up' ? '#4A9EFF' : colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleReaction(item.id, 'down')}
                style={[styles.msgActionBtn, reaction === 'down' && styles.msgActionBtnActive]}
                accessibilityLabel="Mark as not helpful"
                accessibilityRole="button"
              >
                <Feather name="thumbs-down" size={13} color={reaction === 'down' ? '#EF4444' : colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => speakMessage(item.content)} style={styles.msgActionBtn} accessibilityLabel="Read aloud" accessibilityRole="button">
                <Feather name="volume-2" size={13} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { Clipboard.setString(item.content); }} style={styles.msgActionBtn} accessibilityLabel="Copy message" accessibilityRole="button">
                <Feather name="copy" size={13} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRegenerate(item.id)} style={styles.msgActionBtn} accessibilityLabel="Regenerate response" accessibilityRole="button">
                <Feather name="refresh-cw" size={13} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          )}

          {item.isIncomplete && (
            <TouchableOpacity
              style={styles.retryChip}
              onPress={() => handleRegenerate(item.id)}
              accessibilityLabel="Retry incomplete response"
              accessibilityRole="button"
            >
              <Feather name="refresh-cw" size={12} color="#F5A623" />
              <Text style={styles.retryChipText}>Response cut short — tap to retry</Text>
            </TouchableOpacity>
          )}

          <View style={styles.msgFooter}>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (!agent) {
    return (
      <View style={styles.root}>
        <Text style={{ color: '#FFF' }}>Agent not found</Text>
      </View>
    );
  }

  const remainingMs = helperCooldownUntil ? Math.max(0, helperCooldownUntil.getTime() - cooldownNow) : 0;
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const charCount = input.length;
  const showCharWarning = charCount > 1000;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Animated.Text style={[styles.agentEmoji, isSpeaking && { transform: [{ scale: speakPulse }] }]}>
            {agent.emoji}
          </Animated.Text>
          <View style={styles.headerInfo}>
            <Text style={styles.agentName}>{t(agent.nameKey)}</Text>
            <Text style={styles.agentDesc} numberOfLines={1}>{t(agent.descriptionKey)}</Text>
            {isSpeaking && <Text style={styles.speakingLabel}>Speaking…</Text>}
          </View>
        </View>

        {/* TTS toggle */}
        <TouchableOpacity
          onPress={toggleTts}
          style={[styles.headerBtn, ttsEnabled && styles.headerBtnActive]}
          accessibilityLabel={ttsEnabled ? 'Disable read-aloud' : 'Enable read-aloud'}
          accessibilityRole="button"
        >
          <Feather name={isSpeaking ? 'volume-x' : 'volume-2'} size={18} color={ttsEnabled ? colors.accent : colors.textDim} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {recapBanner && (
          <View style={styles.recapBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recapBannerText}>{recapBanner}</Text>
            </View>
            <TouchableOpacity onPress={() => setRecapBanner(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        )}

        {helperCooldownUntil && remainingMinutes > 0 && (
          <View style={styles.cooldownBanner}>
            <Feather name="clock" size={14} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cooldownText}>{t('chat.cooldown_banner', { minutes: remainingMinutes })}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
                <Text style={styles.cooldownActionLink}>{t('chat.cooldown_settings_link')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={streamingId
              ? [...messages, { id: streamingId, role: 'assistant' as const, content: streamingText, timestamp: new Date() }]
              : messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
              setShowScrollFab(distFromBottom > 120);
            }}
            scrollEventThrottle={100}
            ListEmptyComponent={
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>{t('chat.tap_to_start')}</Text>
                {agent.suggestedQuestions.map((q: string) => (
                  <TouchableOpacity key={q} style={styles.suggestionChip} onPress={() => handleSend(q)} activeOpacity={0.8}>
                    <Text style={styles.suggestionText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
            ListFooterComponent={
              (suggestedHabitName && !thinking && !streamingId) || (followUpChips.length > 0 && !thinking && !streamingId) ? (
                <View style={styles.chipsContainer}>
                  {suggestedHabitName && !thinking && !streamingId && (
                    <TouchableOpacity
                      style={styles.habitChip}
                      onPress={() => handleAddSuggestedHabit(suggestedHabitName)}
                      activeOpacity={0.8}
                    >
                      <Feather name="plus-circle" size={14} color="#34D399" />
                      <Text style={styles.habitChipText}>Add "{suggestedHabitName}" to Habits</Text>
                    </TouchableOpacity>
                  )}
                  {followUpChips.length > 0 && !thinking && !streamingId && (
                    <View style={styles.chipsRow}>
                      {followUpChips.map((chip) => (
                        <TouchableOpacity key={chip} style={styles.chip} onPress={() => handleSend(chip)} activeOpacity={0.8}>
                          <Text style={styles.chipText}>{chip}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : null
            }
          />

          {/* Scroll-to-bottom FAB */}
          {showScrollFab && (
            <TouchableOpacity style={styles.scrollFab} onPress={scrollToBottom} activeOpacity={0.8}>
              <Feather name="chevrons-down" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {thinking && (
          <View style={styles.thinkingRow}>
            <Text style={styles.agentEmojiSmall}>{agent.emoji}</Text>
            <TypingDots color={colors.accent} />
          </View>
        )}

        {groundingVisible && (
          <View style={styles.groundingCard}>
            <View style={styles.groundingHeader}>
              <Text style={styles.groundingTitle}>Take a moment 🌿</Text>
              <TouchableOpacity onPress={() => setGroundingVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            {GROUNDING_EXERCISES.map((ex) => (
              <View key={ex.title} style={styles.groundingEx}>
                <Text style={styles.groundingExTitle}>{ex.title}</Text>
                <Text style={styles.groundingExDesc}>{ex.desc}</Text>
              </View>
            ))}
          </View>
        )}

        {cloudFallbackBanner && (
          <View style={styles.fallbackBanner}>
            <Feather name="cloud" size={13} color="#60A5FA" />
            <Text style={styles.fallbackBannerText}>Offline helper unavailable — responded via cloud AI</Text>
          </View>
        )}

        {localModelError && (
          localModelError === 'model_downloading' ? (
            <View style={styles.localDownloadingCard}>
              <View style={styles.localErrorHeader}>
                <Feather name="download" size={16} color="#4A9EFF" />
                <Text style={styles.localDownloadingTitle}>Setting up your AI helper…</Text>
                <TouchableOpacity onPress={() => setLocalModelError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={15} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              <Text style={styles.localErrorBody}>
                Your offline AI is downloading. Please keep the app open — the download will pause if you switch away.
              </Text>
              <View style={styles.localErrorActions}>
                <TouchableOpacity style={[styles.localErrorBtn, styles.localErrorBtnSecondary]} onPress={() => setLocalModelError(null)} activeOpacity={0.8}>
                  <Text style={styles.localErrorBtnSecondaryText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.localErrorCard}>
              <View style={styles.localErrorHeader}>
                <Feather name="cpu" size={16} color="#F87171" />
                <Text style={styles.localErrorTitle}>Offline helper not ready</Text>
                <TouchableOpacity onPress={() => setLocalModelError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={15} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              <Text style={styles.localErrorBody}>
                {localModelError === 'model_not_downloaded'
                  ? "The AI model hasn't been downloaded yet. Download it in Settings → Local AI."
                  : localModelError === 'executorch_unavailable'
                  ? "On-device AI runtime isn't available on this device. Switch to cloud AI to continue."
                  : 'Your offline helper encountered a problem and couldn\'t respond.'}
              </Text>
              <View style={styles.localErrorActions}>
                <TouchableOpacity style={styles.localErrorBtn} onPress={() => { setLocalModelError(null); navigation.navigate('Settings', { expandSection: 'ai' }); }} activeOpacity={0.8}>
                  <Feather name="settings" size={13} color="#4A9EFF" />
                  <Text style={styles.localErrorBtnText}>Open Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.localErrorBtn, styles.localErrorBtnSecondary]} onPress={() => setLocalModelError(null)} activeOpacity={0.8}>
                  <Text style={styles.localErrorBtnSecondaryText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        )}

        {/* Attachment preview */}
        {attachment && (
          <View style={styles.attachPreview}>
            {attachment.type === 'image' && attachment.uri ? (
              <Image source={{ uri: attachment.uri }} style={styles.attachPreviewImage} resizeMode="cover" />
            ) : (
              <View style={styles.attachPreviewFile}>
                <Feather name="file-text" size={16} color={colors.textMuted} />
                <Text style={styles.attachPreviewFileName} numberOfLines={1}>{attachment.name}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setAttachment(null)} style={styles.attachPreviewRemove}>
              <Feather name="x" size={14} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        )}

        {/* Voice listening indicator */}
        {isListening && (
          <View style={styles.listeningBar}>
            <Feather name="mic" size={14} color="#EF4444" />
            <Text style={styles.listeningText}>{voicePartial || 'Listening…'}</Text>
            <TouchableOpacity onPress={stopVoiceInput} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="square" size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Character counter */}
        {showCharWarning && (
          <View style={styles.charCounter}>
            <View style={[styles.charBar, { width: `${Math.min((charCount / 1500) * 100, 100)}%` as `${number}%` }]} />
            <Text style={styles.charCountText}>{charCount}/1500</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.inputIconBtn} onPress={() => setAttachMenuVisible(true)} activeOpacity={0.7} accessibilityLabel="Attach file or photo" accessibilityRole="button">
            <Feather name="paperclip" size={20} color={colors.textDim} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={isListening ? 'Listening…' : t('chat.placeholder')}
            placeholderTextColor={colors.textDim}
            value={isListening ? voicePartial : input}
            onChangeText={setInput}
            multiline
            maxLength={1500}
            editable={!isListening}
            onSubmitEditing={() => handleSend()}
          />

          <TouchableOpacity
            style={[styles.inputIconBtn, isListening && styles.inputIconBtnActive]}
            onPress={isListening ? stopVoiceInput : startVoiceInput}
            activeOpacity={0.7}
            accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
            accessibilityRole="button"
          >
            <Feather name={isListening ? 'mic-off' : 'mic'} size={20} color={isListening ? '#EF4444' : colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() && !attachment) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={(!input.trim() && !attachment) || thinking || !!streamingId}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Feather name="send" size={18} color={(input.trim() || attachment) ? colors.text : '#4A5568'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment picker modal */}
      <Modal visible={attachMenuVisible} transparent animationType="fade" onRequestClose={() => setAttachMenuVisible(false)}>
        <Pressable style={styles.attachModalOverlay} onPress={() => setAttachMenuVisible(false)}>
          <View style={styles.attachMenu}>
            <Text style={styles.attachMenuTitle}>Attach</Text>

            <TouchableOpacity
              style={[styles.attachMenuItem, !supportsVision && styles.attachMenuItemDisabled]}
              onPress={supportsVision ? pickFromCamera : undefined}
              activeOpacity={supportsVision ? 0.8 : 1}
            >
              <View style={[styles.attachMenuIcon, { backgroundColor: supportsVision ? '#1A2A4A' : '#1A1A1A' }]}>
                <Feather name="camera" size={20} color={supportsVision ? '#4A9EFF' : '#4A5568'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.attachMenuLabel, !supportsVision && styles.attachMenuLabelDisabled]}>Camera</Text>
                <Text style={styles.attachMenuSub}>{supportsVision ? 'Take a photo for analysis' : `Not supported by ${aiProvider === 'groq' ? 'Groq' : 'offline helper'}`}</Text>
              </View>
              {!supportsVision && (
                <View style={styles.attachMenuBadge}>
                  <Text style={styles.attachMenuBadgeText}>{aiProvider === 'groq' ? 'Groq' : 'Offline only'}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.attachMenuItem, !supportsVision && styles.attachMenuItemDisabled]}
              onPress={supportsVision ? pickFromLibrary : undefined}
              activeOpacity={supportsVision ? 0.8 : 1}
            >
              <View style={[styles.attachMenuIcon, { backgroundColor: supportsVision ? '#1A2F1A' : '#1A1A1A' }]}>
                <Feather name="image" size={20} color={supportsVision ? '#34D399' : '#4A5568'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.attachMenuLabel, !supportsVision && styles.attachMenuLabelDisabled]}>Photo Library</Text>
                <Text style={styles.attachMenuSub}>{supportsVision ? 'Upload an image' : 'Switch to Gemini, OpenAI, or Claude'}</Text>
              </View>
              {!supportsVision && (
                <View style={styles.attachMenuBadge}>
                  <Text style={styles.attachMenuBadgeText}>Cloud only</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachMenuItem} onPress={pickDocument} activeOpacity={0.8}>
              <View style={[styles.attachMenuIcon, { backgroundColor: '#2A1A0A' }]}>
                <Feather name="file-text" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachMenuLabel}>Document</Text>
                <Text style={styles.attachMenuSub}>Text files work with all AI providers</Text>
              </View>
              <View style={[styles.attachMenuBadge, styles.attachMenuBadgeGreen]}>
                <Text style={[styles.attachMenuBadgeText, { color: '#34D399' }]}>All</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachMenuCancel} onPress={() => setAttachMenuVisible(false)} activeOpacity={0.7}>
              <Text style={styles.attachMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Session close card */}
      <Modal
        visible={sessionCloseVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setSessionCloseVisible(false); if (pendingNavAction) navigation.dispatch(pendingNavAction); }}
      >
        <View style={styles.sessionOverlay}>
          <View style={styles.sessionCard}>
            <Text style={styles.sessionEmoji}>{agent?.emoji ?? '✨'}</Text>
            <Text style={styles.sessionTitle}>
              Good session with {agent ? t(agent.nameKey) : 'your helper'}
            </Text>
            {(() => {
              const lastAI = [...messagesRef.current].reverse().find((m) => m.role === 'assistant');
              return lastAI ? (
                <Text style={styles.sessionPreview} numberOfLines={3}>
                  "{lastAI.content.replace(/[#*`]/g, '').slice(0, 160)}{lastAI.content.length > 160 ? '…' : ''}"
                </Text>
              ) : null;
            })()}
            <View style={styles.sessionActions}>
              <TouchableOpacity
                style={styles.sessionDiaryBtn}
                activeOpacity={0.8}
                onPress={() => {
                  const lastAI = [...messagesRef.current].reverse().find((m) => m.role === 'assistant');
                  const agentName = agent ? t(agent.nameKey) : 'my helper';
                  const prefill = lastAI
                    ? `After talking with ${agentName} today, I realised: "${lastAI.content.replace(/[#*`]/g, '').slice(0, 300)}"`
                    : '';
                  setSessionCloseVisible(false);
                  if (pendingNavAction) navigation.dispatch(pendingNavAction);
                  setTimeout(() => navigation.navigate('Journal', { prefill }), 150);
                }}
              >
                <Feather name="feather" size={15} color={colors.accent} />
                <Text style={styles.sessionDiaryBtnText}>Write in diary</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sessionDoneBtn}
                activeOpacity={0.8}
                onPress={() => { setSessionCloseVisible(false); if (pendingNavAction) navigation.dispatch(pendingNavAction); }}
              >
                <Text style={styles.sessionDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, gap: 4 },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
    headerBtnActive: { backgroundColor: c.accentBg },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    headerInfo: { flex: 1 },
    headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    headerBadge: { fontSize: 9, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
    headerBadgeCloud: { color: '#FBBF24', backgroundColor: '#3A2A0A' },
    headerBadgeLocal: { color: '#34D399', backgroundColor: '#0D2F28' },
    agentEmoji: { fontSize: 26 },
    agentEmojiSmall: { fontSize: 18 },
    agentName: { fontSize: 15, fontWeight: '700', color: c.text },
    agentDesc: { fontSize: 11, color: c.textMuted },
    speakingLabel: { fontSize: 10, color: c.accent, marginTop: 2 },
    toneBadge: { backgroundColor: c.surfaceAlt, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: c.border },
    toneBadgeText: { fontSize: 10, fontWeight: '700', color: c.textMuted },
    listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexGrow: 1 },
    cooldownBanner: { marginHorizontal: 16, marginTop: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#7C4A03', backgroundColor: '#2A1A03', flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    cooldownText: { color: '#FCD34D', fontSize: 12, fontWeight: '600' },
    cooldownActionLink: { color: '#F59E0B', fontSize: 11, marginTop: 3, textDecorationLine: 'underline' },
    msgWrapper: { marginBottom: 4 },
    msgWrapperUser: { alignItems: 'flex-end' },
    msgWrapperAssistant: { alignItems: 'flex-start' },
    safetyContainer: { maxWidth: '82%', borderRadius: 16, borderWidth: 1, borderColor: SAFETY_BORDER, backgroundColor: SAFETY_BG, overflow: 'hidden' },
    safetyBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#4B1C1C' },
    safetyLabel: { fontSize: 11, color: '#FCA5A5', fontWeight: '700' },
    bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { backgroundColor: c.accentBg, borderBottomRightRadius: 4 },
    bubbleAssistant: { backgroundColor: c.surface, borderBottomLeftRadius: 4 },
    bubbleSafety: { backgroundColor: SAFETY_BG, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10 },
    bubbleText: { fontSize: 15, color: c.textSecondary, lineHeight: 22 },
    bubbleTextSafety: { fontSize: 15, color: '#FEE2E2', lineHeight: 22 },
    bubbleTextUser: { color: c.text },
    attachedImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 6 },
    fileChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, maxWidth: 200 },
    fileChipText: { fontSize: 12, color: c.textMuted, flex: 1 },
    msgActions: { flexDirection: 'row', gap: 2, marginTop: 4, marginLeft: 4 },
    msgActionBtn: { padding: 6, borderRadius: 10 },
    msgActionBtnActive: { backgroundColor: c.surfaceAlt },
    retryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, marginLeft: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, backgroundColor: '#2A1A03', borderColor: '#7C4A03' },
    retryChipText: { fontSize: 12, color: '#F5A623' },
    timestamp: { fontSize: 10, color: c.textDim, marginTop: 2, marginHorizontal: 4 },
    msgFooter: { flexDirection: 'row', alignItems: 'center' },
    chipsContainer: { paddingHorizontal: 4 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
    chip: { backgroundColor: c.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.border },
    chipText: { fontSize: 13, color: c.textMuted },
    habitChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#0D2F28', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#34D399', marginTop: 10, marginHorizontal: 4 },
    habitChipText: { fontSize: 13, fontWeight: '600', color: '#34D399' },
    scrollFab: { position: 'absolute', bottom: 12, right: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', elevation: 4 },
    suggestionsContainer: { flex: 1, paddingTop: 40, alignItems: 'center', paddingHorizontal: 16, gap: 10 },
    suggestionsTitle: { fontSize: 13, color: c.textDim, marginBottom: 8 },
    suggestionChip: { backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'stretch', borderWidth: 1, borderColor: c.border },
    suggestionText: { fontSize: 14, color: c.textMuted, textAlign: 'center' },
    thinkingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 4, gap: 8 },
    charCounter: { marginHorizontal: 12, marginBottom: 2, height: 16, backgroundColor: c.surface, borderRadius: 4, overflow: 'hidden', justifyContent: 'center' },
    charBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#F59E0B', opacity: 0.3, borderRadius: 4 },
    charCountText: { fontSize: 10, color: '#F59E0B', textAlign: 'right', paddingRight: 6 },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border, gap: 6 },
    inputIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
    inputIconBtnActive: { backgroundColor: '#3B1A1A' },
    textInput: { flex: 1, backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, color: c.text, fontSize: 15, maxHeight: 120 },
    sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { backgroundColor: c.surface },
    recapBanner: { marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accent, flexDirection: 'row', alignItems: 'center', gap: 8 },
    recapBannerText: { fontSize: 12, color: c.textSecondary, flex: 1, lineHeight: 18 },
    fallbackBanner: { marginHorizontal: 16, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#172847', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#1E3A6B' },
    fallbackBannerText: { fontSize: 12, color: '#93C5FD', flex: 1 },
    localErrorCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1A0A0A', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#3B1A1A', gap: 8 },
    localDownloadingCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#0A1628', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1A3A6B', gap: 8 },
    localDownloadingTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#4A9EFF' },
    localErrorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    localErrorTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#F87171' },
    localErrorBody: { fontSize: 13, color: '#FBBF24', lineHeight: 19 },
    localErrorActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    localErrorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#172847', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#1E3A6B' },
    localErrorBtnText: { fontSize: 13, fontWeight: '600', color: '#4A9EFF' },
    localErrorBtnSecondary: { backgroundColor: 'transparent', borderColor: '#2A1A1A' },
    localErrorBtnSecondaryText: { fontSize: 13, color: c.textMuted },
    groundingCard: { marginHorizontal: 16, marginBottom: 6, padding: 12, borderRadius: 14, backgroundColor: '#0D2F28', borderWidth: 1, borderColor: '#134E4A', gap: 8 },
    groundingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    groundingTitle: { fontSize: 13, fontWeight: '700', color: '#34D399' },
    groundingEx: { gap: 2 },
    groundingExTitle: { fontSize: 12, fontWeight: '700', color: '#6EE7B7' },
    groundingExDesc: { fontSize: 12, color: '#A7F3D0', lineHeight: 17 },
    attachPreview: { marginHorizontal: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: c.border, gap: 8 },
    attachPreviewImage: { width: 48, height: 48, borderRadius: 8 },
    attachPreviewFile: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    attachPreviewFileName: { fontSize: 13, color: c.textMuted, flex: 1 },
    attachPreviewRemove: { padding: 4 },
    listeningBar: { marginHorizontal: 12, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3B0A0A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#7F1D1D' },
    listeningText: { flex: 1, fontSize: 13, color: '#FCA5A5', fontStyle: 'italic' },
    attachModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    attachMenu: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 4 },
    attachMenuTitle: { fontSize: 13, fontWeight: '700', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    attachMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
    attachMenuIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    attachMenuLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    attachMenuSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    attachMenuCancel: { marginTop: 8, alignItems: 'center', paddingVertical: 12 },
    attachMenuCancelText: { fontSize: 15, color: c.textDim },
    attachMenuItemDisabled: { opacity: 0.55 },
    attachMenuLabelDisabled: { color: c.textDim },
    attachMenuBadge: { backgroundColor: '#1A1A2E', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    attachMenuBadgeGreen: { backgroundColor: '#0D2F28' },
    attachMenuBadgeText: { fontSize: 10, fontWeight: '700', color: '#4A5568' },
    // Session close card
    sessionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sessionCard: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, alignItems: 'center', gap: 10 },
    sessionEmoji: { fontSize: 44, marginBottom: 2 },
    sessionTitle: { fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center' },
    sessionPreview: { fontSize: 14, color: c.textMuted, fontStyle: 'italic', lineHeight: 21, textAlign: 'center', paddingHorizontal: 4 },
    sessionActions: { flexDirection: 'row', gap: 10, marginTop: 6, width: '100%' },
    sessionDiaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 13, backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accent },
    sessionDiaryBtnText: { fontSize: 14, fontWeight: '700', color: c.accent },
    sessionDoneBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, backgroundColor: c.surfaceAlt },
    sessionDoneBtnText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  });
}
