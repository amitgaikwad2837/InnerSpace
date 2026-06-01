import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAgentById } from '../constants/agents';
import type { Conversation } from '../types';

const CONVERSATIONS_KEY = '@innerspace:conversations';

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const [conversations, setConversations] = useState<Conversation[]>([]);

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
    Alert.alert('Delete conversation', 'Remove this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
    Alert.alert('Clear all history', 'This will delete all conversations. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          setConversations([]);
          await AsyncStorage.removeItem(CONVERSATIONS_KEY);
        },
      },
    ]);
  }

  function renderItem({ item }: { item: Conversation }) {
    const agent = getAgentById(item.agentId);
    const lastMsg = item.messages[item.messages.length - 1];
    const date = new Date(item.createdAt);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
            {item.summary ?? lastMsg?.content ?? 'No messages yet'}
          </Text>
          {item.summary && (
            <Text style={styles.cardSummaryBadge}>✦ summarised</Text>
          )}
          <Text style={styles.cardCount}>
            {item.messages.length} message{item.messages.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#4A5568" />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {conversations.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              Your chat history will appear here after you talk to an agent.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Agents')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Browse agents</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  cardEmoji: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardDate: {
    fontSize: 11,
    color: '#5A6478',
  },
  cardPreview: {
    fontSize: 13,
    color: '#8B9CC8',
    marginBottom: 4,
  },
  cardCount: {
    fontSize: 11,
    color: '#4A5568',
  },
  cardSummaryBadge: {
    fontSize: 10,
    color: '#4A9EFF',
    marginTop: 2,
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
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: '#1A3A6B',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A9EFF',
  },
});
