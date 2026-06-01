import React, { useState, useRef, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getAgentById, buildAgentSystemPrompt } from '../constants/agents';
import { callGeminiAPI } from '../services/gemini-service';
import { getAccessToken } from '../services/storage-service';
import { useAuthStore } from '../store/auth';
import { getDeviceLanguage } from '../i18n';
import type { Message, Conversation } from '../types';

const CONVERSATIONS_KEY = '@innerspace:conversations';
const TONE_KEY = '@innerspace:tone';
const XP_KEY = '@innerspace:xp';

const TONE_PROMPTS: Record<string, string> = {
  warm: 'Warm, encouraging, and supportive. Use a friendly conversational tone.',
  direct: 'Clear, concise, and direct. Skip pleasantries, get to the point.',
  motivational: 'High-energy and motivating. Use action verbs. Keep the user excited.',
};

// Safety redirect banner colours
const SAFETY_BG = '#3B1A1A';
const SAFETY_BORDER = '#EF4444';

export default function ChatScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const agentId: string = route.params?.agentId ?? 'chef';
  const customAgent = route.params?.customAgent ?? null;

  const agent = customAgent ?? getAgentById(agentId);
  const { email } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [tone, setTone] = useState('warm');
  const conversationId = useRef(`conv_${Date.now()}`);
  const listRef = useRef<FlatList>(null);

  const language = getDeviceLanguage();

  const systemPrompt = agent
    ? buildAgentSystemPrompt(agent, TONE_PROMPTS[tone] ?? TONE_PROMPTS.warm, language)
    : '';

  useEffect(() => {
    AsyncStorage.getItem(TONE_KEY).then((saved) => {
      if (saved) setTone(saved);
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  async function saveConversation(updatedMessages: Message[]) {
    try {
      const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
      const all: Conversation[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((c) => c.id === conversationId.current);
      const convo: Conversation = {
        id: conversationId.current,
        agentId,
        messages: updatedMessages,
        createdAt: idx >= 0 ? all[idx].createdAt : new Date(),
      };
      if (idx >= 0) all[idx] = convo;
      else all.push(convo);
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all));
    } catch {
      // Non-critical — silently skip
    }
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

  async function handleSend(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || thinking) return;
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
      // BYOK key takes priority; fall back to Google OAuth token
      const byokKey = await SecureStore.getItemAsync('innerspace_api_key');
      const oauthToken = await getAccessToken();
      const token = byokKey || oauthToken || '';
      if (!token) {
        const setupMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: t('chat.no_ai_tool_configured'),
          timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMsg, setupMsg];
        setMessages(updatedMessages);
        await saveConversation(updatedMessages);
        return;
      }
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await callGeminiAPI(userText, systemPrompt, history, token);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text,
        timestamp: new Date(),
        isSafetyRedirect: result.isSafetyRedirect,
        safetyCategory: result.safetyCategory,
      };
      const updatedMessages = [...messages, userMsg, assistantMsg];
      setMessages(updatedMessages);
      await saveConversation(updatedMessages);
      if (!result.isSafetyRedirect) await addXp(5);
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
    return (
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
        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }

  if (!agent) {
    return (
      <View style={styles.root}>
        <Text style={{ color: '#FFF' }}>Agent not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.agentEmoji}>{agent.emoji}</Text>
          <View>
            <Text style={styles.agentName}>{t(agent.nameKey)}</Text>
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
              {agent.suggestedQuestions.map((q) => (
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
            placeholderTextColor="#5A6478"
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
            <Ionicons name="send" size={18} color={input.trim() ? '#FFFFFF' : '#4A5568'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'center',
  },
  agentEmoji: {
    fontSize: 28,
  },
  agentEmojiSmall: {
    fontSize: 18,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  agentDesc: {
    fontSize: 12,
    color: '#8B9CC8',
    maxWidth: 200,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexGrow: 1,
  },
  msgWrapper: {
    marginBottom: 6,
  },
  msgWrapperUser: {
    alignItems: 'flex-end',
  },
  msgWrapperAssistant: {
    alignItems: 'flex-start',
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  safetyLabel: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#1A3A6B',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#111827',
    borderBottomLeftRadius: 4,
  },
  bubbleSafety: {
    backgroundColor: SAFETY_BG,
    borderWidth: 1,
    borderColor: SAFETY_BORDER,
  },
  bubbleText: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#E8F0FE',
  },
  timestamp: {
    fontSize: 10,
    color: '#3A4560',
    marginTop: 3,
    marginHorizontal: 4,
  },
  suggestionsContainer: {
    flex: 1,
    paddingTop: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  suggestionsTitle: {
    fontSize: 13,
    color: '#5A6478',
    marginBottom: 8,
  },
  suggestionChip: {
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  suggestionText: {
    fontSize: 14,
    color: '#8B9CC8',
    textAlign: 'center',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  thinkingText: {
    fontSize: 13,
    color: '#4A9EFF',
    marginLeft: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1A3A6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#111827',
  },
});
