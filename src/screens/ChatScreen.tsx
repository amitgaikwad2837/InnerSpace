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
  ActivityIndicator,
  SafeAreaView,
  StatusBar as RNStatusBar,
  Share,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAgentById, buildAgentSystemPrompt } from '../constants/agents';
import { AI_MODE_KEY } from '../constants/local-models';
import { callAI } from '../services/gemini-service';
import { checkSafety, containsAdultContent } from '../services/safety-filter';
import { scheduleHelperReadyNotification } from '../services/notifications';
import { useAuthStore } from '../store/auth';
import { getDeviceLanguage } from '../i18n';
import type { Message, Conversation } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';

const CONVERSATIONS_KEY = '@innerspace:conversations';
const TONE_KEY = '@innerspace:tone';
const XP_KEY = '@innerspace:xp';
const STREAK_KEY = '@innerspace:streak';
const STREAK_DATE_KEY = '@innerspace:streak_last_date';

function reactionsStorageKey(convId: string) {
  return `@innerspace:reactions:${convId}`;
}

const TONE_PROMPTS: Record<string, string> = {
  warm: 'Warm, encouraging, and supportive. Use a friendly conversational tone.',
  direct: 'Clear, concise, and direct. Skip pleasantries, get to the point.',
  motivational: 'High-energy and motivating. Use action verbs. Keep the user excited.',
};

// Safety redirect banner colours
const SAFETY_BG = '#3B1A1A';
const SAFETY_BORDER = '#EF4444';

/**
 * Validate AI response for safety violations
 * Returns original response or a safety redirect message if violations detected
 */
function validateResponse(response: string): { text: string; isSafetyRedirect: boolean; safetyCategory: string | null } {
  // Check for adult content in response
  if (containsAdultContent(response)) {
    return {
      text: 'InnerSpace is not designed for adult or explicit content. I cannot provide responses on this topic. Is there something else I can help you with?',
      isSafetyRedirect: true,
      safetyCategory: 'ADULT_CONTENT',
    };
  }

  // Check for other safety violations
  const safety = checkSafety(response);
  if (!safety.isSafe) {
    return {
      text: safety.redirectMessage || 'I cannot help with that topic.',
      isSafetyRedirect: true,
      safetyCategory: safety.category,
    };
  }

  return {
    text: response,
    isSafetyRedirect: false,
    safetyCategory: null,
  };
}

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
  const [tone, setTone] = useState('warm');
  const [reactions, setReactions] = useState<Record<string, 'up' | 'down'>>({});
  const conversationId = useRef(routeConversationId ?? `conv_${Date.now()}`);
  const listRef = useRef<FlatList>(null);

  const language = getDeviceLanguage();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const systemPrompt = agent
    ? buildAgentSystemPrompt(agent, TONE_PROMPTS[tone] ?? TONE_PROMPTS.warm, language)
    : '';

  useEffect(() => {
    AsyncStorage.getItem(TONE_KEY).then((saved) => {
      if (saved) setTone(saved);
    });
    // Load persisted reactions for this conversation
    AsyncStorage.getItem(reactionsStorageKey(conversationId.current)).then((raw) => {
      if (raw) {
        try { setReactions(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
    // GAP-08: resume existing conversation messages from history
    if (routeConversationId) {
      AsyncStorage.getItem(CONVERSATIONS_KEY).then((raw) => {
        if (!raw) return;
        try {
          const all: Conversation[] = JSON.parse(raw);
          const found = all.find((c) => c.id === routeConversationId);
          if (found?.messages?.length) {
            const restored = found.messages.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }));
            setMessages(restored);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
          }
        } catch { /* ignore corrupted data */ }
      });
    }
  }, []);

  useEffect(() => {
    if (!helperCooldownUntil) return;

    const tick = setInterval(() => {
      setCooldownNow(Date.now());
      if (Date.now() >= helperCooldownUntil.getTime()) {
        setHelperCooldownUntil(null);
      }
    }, 30000);

    return () => clearInterval(tick);
  }, [helperCooldownUntil]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  async function saveConversation(updatedMessages: Message[], summary?: string) {
    try {
      const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
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
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all));
    } catch {
      // Non-critical — silently skip
    }
  }

  async function generateSummary(msgs: Message[]) {
    if (msgs.length < 4) return; // not worth summarising very short chats
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
    } catch {
      // Non-critical
    }
  }

  async function handleShareMessage(content: string) {
    try {
      await Share.share({ message: content });
    } catch {
      // User cancelled or share not available
    }
  }

  function toggleReaction(msgId: string, reaction: 'up' | 'down') {
    setReactions((prev) => {
      const next = { ...prev };
      if (prev[msgId] === reaction) {
        delete next[msgId];
      } else {
        next[msgId] = reaction;
      }
      AsyncStorage.setItem(reactionsStorageKey(conversationId.current), JSON.stringify(next)).catch(() => {});
      return next;
    });
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

  async function updateStreak() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = await AsyncStorage.getItem(STREAK_DATE_KEY);
      if (lastDate === today) return; // already counted today
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const streakRaw = await AsyncStorage.getItem(STREAK_KEY);
      const current = streakRaw ? parseInt(streakRaw, 10) : 0;
      const newStreak = lastDate === yesterday ? current + 1 : 1;
      await Promise.all([
        AsyncStorage.setItem(STREAK_KEY, String(newStreak)),
        AsyncStorage.setItem(STREAK_DATE_KEY, today),
      ]);
    } catch {
      // Non-critical
    }
  }

  async function handleSend(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || thinking) return;

    const aiMode = await AsyncStorage.getItem(AI_MODE_KEY);
    if (aiMode === 'local' && agent?.minimumAIMode === 'cloud') {
      Alert.alert(
        t('chat.cloud_only_title'),
        t('chat.cloud_only_body'),
      );
      return;
    }

    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();
    setThinking(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await callAI(userText, systemPrompt, history);
      if (result.error === 'no_key') {
        // No key configured — offer reflection prompts relevant to the agent
        const fallbackPrompts = agent?.suggestedQuestions ?? [];
        const fallbackText = fallbackPrompts.length
          ? `${t('chat.no_ai_tool_configured')}\n\n${t('chat.reflection_prompts_intro')}\n\n${fallbackPrompts.map((q: string) => `• ${q}`).join('\n')}`
          : t('chat.no_ai_tool_configured');
        const setupMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: fallbackText,
          timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMsg, setupMsg];
        setMessages(updatedMessages);
        await saveConversation(updatedMessages);
        return;
      }

      let assistantText = result.text;
      if (result.error === 'quota_exceeded' && result.cooldownUntil) {
        const nextReady = new Date(result.cooldownUntil);
        const friendlyTime = nextReady.toLocaleString([], {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        assistantText = `${t('chat.helper_resting_until', { time: friendlyTime })}\n\n${t('chat.helper_ready_note')}`;
        setHelperCooldownUntil(nextReady);
      }

      // Validate AI response for safety violations
      const validatedResponse = validateResponse(assistantText);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: validatedResponse.text,
        timestamp: new Date(),
        isSafetyRedirect: validatedResponse.isSafetyRedirect || result.isSafetyRedirect,
        safetyCategory: validatedResponse.safetyCategory || result.safetyCategory,
      };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      setMessages(updatedMessages);
      await saveConversation(updatedMessages);
      if (result.error === 'quota_exceeded' && result.cooldownUntil) {
        await scheduleHelperReadyNotification(
          result.cooldownUntil,
          t(agent.nameKey),
          t('notifications.helper_ready_title'),
          t('notifications.helper_ready_body', { helper: t(agent.nameKey) }),
        );
      }

      if (!result.isSafetyRedirect && !result.error) {
        await addXp(5);
        await updateStreak();
        // Generate summary in background after 3+ AI replies
        const aiCount = updatedMessages.filter((m) => m.role === 'assistant' && !m.isSafetyRedirect).length;
        if (aiCount >= 3) {
          generateSummary(updatedMessages);
        }
      }
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('chat.error'),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setThinking(false);
      scrollToBottom();
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    const reaction = reactions[item.id];
    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={() =>
          Alert.alert('Share message', undefined, [
            { text: 'Share', onPress: () => handleShareMessage(item.content) },
            { text: 'Cancel', style: 'cancel' },
          ])
        }
      >
        <View
          style={[
            styles.msgWrapper,
            isUser ? styles.msgWrapperUser : styles.msgWrapperAssistant,
          ]}
        >
          {item.isSafetyRedirect && (
            <View style={styles.safetyBanner}>
              <Ionicons name="shield-checkmark" size={14} color="#EF4444" />
              <Text style={styles.safetyLabel}>{t('chat.safety_blocked')}</Text>
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleAssistant,
              item.isSafetyRedirect && styles.bubbleSafety,
            ]}
          >
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
              {item.content}
            </Text>
          </View>
          <View style={styles.msgFooter}>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {!isUser && (
              <View style={styles.reactionRow}>
                <TouchableOpacity
                  onPress={() => toggleReaction(item.id, 'up')}
                  style={[styles.reactionBtn, reaction === 'up' && styles.reactionBtnActive]}
                >
                  <Ionicons name="thumbs-up" size={13} color={reaction === 'up' ? '#4A9EFF' : '#4A5568'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleReaction(item.id, 'down')}
                  style={[styles.reactionBtn, reaction === 'down' && styles.reactionBtnActive]}
                >
                  <Ionicons name="thumbs-down" size={13} color={reaction === 'down' ? '#EF4444' : '#4A5568'} />
                </TouchableOpacity>
              </View>
            )}
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

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.agentEmoji}>{agent.emoji}</Text>
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.agentName}>{t(agent.nameKey)}</Text>
              <Text style={[styles.headerBadge, agent.minimumAIMode === 'cloud' ? styles.headerBadgeCloud : styles.headerBadgeLocal]}>
                {agent.minimumAIMode === 'cloud' ? t('helpers.badge_cloud') : t('helpers.badge_local')}
              </Text>
            </View>
            <Text style={styles.agentDesc} numberOfLines={1}>{t(agent.descriptionKey)}</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {helperCooldownUntil && remainingMinutes > 0 && (
          <View style={styles.cooldownBanner}>
            <Ionicons name="time-outline" size={14} color="#F59E0B" />
            <Text style={styles.cooldownText}>{t('chat.cooldown_banner', { minutes: remainingMinutes })}</Text>
          </View>
        )}

        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>{t('chat.tap_to_start')}</Text>
              {agent.suggestedQuestions.map((q: string) => (
                <TouchableOpacity
                  key={q}
                  style={styles.suggestionChip}
                  onPress={() => handleSend(q)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        {/* Thinking indicator */}
        {thinking && (
          <View style={styles.thinkingRow}>
            <Text style={styles.agentEmojiSmall}>{agent.emoji}</Text>
            <ActivityIndicator size="small" color="#4A9EFF" style={{ marginLeft: 8 }} />
            <Text style={styles.thinkingText}>{t('chat.thinking')}</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textDim}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1500}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || thinking}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color={input.trim() ? colors.text : '#4A5568'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
    paddingTop: RNStatusBar.currentHeight ?? 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' },
  headerInfo: { alignItems: 'center' },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  headerBadge: { fontSize: 9, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  headerBadgeCloud: { color: '#FBBF24', backgroundColor: '#3A2A0A' },
  headerBadgeLocal: { color: '#34D399', backgroundColor: '#0D2F28' },
  agentEmoji: { fontSize: 28 },
  agentEmojiSmall: { fontSize: 18 },
  agentName: { fontSize: 16, fontWeight: '700', color: c.text },
  agentDesc: { fontSize: 12, color: c.textMuted, maxWidth: 200 },
  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexGrow: 1 },
  cooldownBanner: { marginHorizontal: 16, marginTop: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#7C4A03', backgroundColor: '#2A1A03', flexDirection: 'row', alignItems: 'center', gap: 6 },
  cooldownText: { color: '#FCD34D', fontSize: 12, fontWeight: '600', flex: 1 },
  msgWrapper: { marginBottom: 6 },
  msgWrapperUser: { alignItems: 'flex-end' },
  msgWrapperAssistant: { alignItems: 'flex-start' },
  safetyBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, paddingHorizontal: 4 },
  safetyLabel: { fontSize: 11, color: c.danger, fontWeight: '600' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: c.accentBg, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: c.surface, borderBottomLeftRadius: 4 },
  bubbleSafety: { backgroundColor: SAFETY_BG, borderWidth: 1, borderColor: SAFETY_BORDER },
  bubbleText: { fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  bubbleTextUser: { color: c.text },
  timestamp: { fontSize: 10, color: c.textDim, marginTop: 3, marginHorizontal: 4 },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '82%', marginTop: 2, paddingHorizontal: 2 },
  reactionRow: { flexDirection: 'row', gap: 6 },
  reactionBtn: { padding: 4, borderRadius: 10 },
  reactionBtnActive: { backgroundColor: c.surfaceAlt },
  suggestionsContainer: { flex: 1, paddingTop: 40, alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  suggestionsTitle: { fontSize: 13, color: c.textDim, marginBottom: 8 },
  suggestionChip: { backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'stretch', borderWidth: 1, borderColor: c.border },
  suggestionText: { fontSize: 14, color: c.textMuted, textAlign: 'center' },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 6 },
  thinkingText: { fontSize: 13, color: c.accent, marginLeft: 6 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 10 },
  textInput: { flex: 1, backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: c.text, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: c.surface },
  });
}
