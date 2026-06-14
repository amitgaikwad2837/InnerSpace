import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InnerSpaceLogo from '../components/InnerSpaceLogo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAgentById } from '../constants/agents';
import type { Conversation } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';

const CONVERSATIONS_KEY = '@innerspace:conversations';

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');

  // Reload every time tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, []),
  );

  async function loadConversations() {
    const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    if (raw) {
      const parsed: Conversation[] = JSON.parse(raw);
      // Most recent first
      setConversations(parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } else {
      setConversations([]);
    }
  }

  async function deleteConversation(id: string) {
    Alert.alert('Remove this conversation?', 'This chat will be permanently deleted.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = conversations.filter((c) => c.id !== id);
          setConversations(updated);
          await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
        },
      },
    ]);
  }

  async function clearAll() {
    Alert.alert('Clear everything?', 'All your conversations will be gone for good. This can\'t be undone.', [
      { text: 'Keep them', style: 'cancel' },
      {
        text: 'Yes, clear all',
        style: 'destructive',
        onPress: async () => {
          setConversations([]);
          await AsyncStorage.removeItem(CONVERSATIONS_KEY);
        },
      },
    ]);
  }

  const thisYear = new Date().getFullYear();

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => {
      const agent = getAgentById(c.agentId);
      if (agent?.name?.toLowerCase().includes(q)) return true;
      if (c.summary?.toLowerCase().includes(q)) return true;
      // Task #24: full-text search across all messages
      return c.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [conversations, query]);

  function renderItem({ item }: { item: Conversation }) {
    const agent = getAgentById(item.agentId);
    const lastMsg = item.messages[item.messages.length - 1];
    const date = new Date(item.createdAt);
    const isPriorYear = date.getFullYear() < thisYear;
    const dateStr = date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
      ...(isPriorYear && { year: 'numeric' }),
    });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('Chat', { agentId: item.agentId, conversationId: item.id })}
        onLongPress={() => deleteConversation(item.id)}
      >
        <Text style={styles.cardEmoji}>{agent?.emoji ?? '🤖'}</Text>
        <View style={styles.cardInfo}>
          <View style={styles.cardRow}>
            <Text style={styles.cardName}>{agent?.name ?? item.agentId}</Text>
            <Text style={styles.cardDate}>{dateStr} · {timeStr}</Text>
          </View>
          <Text style={styles.cardPreview} numberOfLines={2}>
            {item.summary ?? lastMsg?.content ?? 'No messages in this conversation yet'}
          </Text>
          {item.summary && (
            <View style={styles.summaryBadge}>
              <Feather name="zap" size={10} color={colors.accent} />
              <Text style={styles.cardSummaryBadge}>summarised</Text>
            </View>
          )}
          <View style={styles.msgCountRow}>
            <Feather name="message-circle" size={11} color={colors.textDim} />
            <Text style={styles.cardCount}>
              {item.messages.length} message{item.messages.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color="#4A5568" />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <InnerSpaceLogo size={26} />
          <Text style={styles.headerTitle}>History</Text>
        </View>
        {conversations.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search bar */}
      {conversations.length > 0 && (
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={colors.textDim} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by helper or message…"
            placeholderTextColor={colors.textDim}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={16} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Your conversations will show up here once you start talking to one of your helpers.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Agents')}
              activeOpacity={0.85}
            >
              <Feather name="grid" size={15} color={colors.accent} />
              <Text style={styles.emptyBtnText}>Meet your helpers</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: c.text },
  clearBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A0A0A', alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, color: c.text },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 12 },
  cardEmoji: { fontSize: 28, width: 40, textAlign: 'center' },
  cardInfo: { flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardName: { fontSize: 15, fontWeight: '600', color: c.text },
  cardDate: { fontSize: 11, color: c.textDim },
  cardPreview: { fontSize: 13, color: c.textMuted, marginBottom: 4 },
  cardCount: { fontSize: 11, color: c.textDim },
  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  msgCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardSummaryBadge: { fontSize: 10, color: c.accent, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.accentBg, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { fontSize: 15, fontWeight: '600', color: c.accent },
  });
}
