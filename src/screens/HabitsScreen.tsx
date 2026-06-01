/**
 * HabitsScreen — Habit Tracker
 *
 * Create daily/weekly habits, mark them complete, track streaks.
 * Completing a habit awards XP.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from '../types';

const HABITS_KEY = '@innerspace:habits';
const XP_KEY = '@innerspace:xp';

async function addXp(amount: number) {
  try {
    const raw = await AsyncStorage.getItem(XP_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    await AsyncStorage.setItem(XP_KEY, String(Math.min(current + amount, 9999)));
  } catch {
    // Non-critical
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDueToday(habit: Habit): boolean {
  if (habit.frequency === 'daily') return true;
  // Weekly: due if not completed this week (Mon-based)
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const mondayStr = monday.toISOString().slice(0, 10);
  if (!habit.lastCompletedAt) return true;
  return new Date(habit.lastCompletedAt).toISOString().slice(0, 10) < mondayStr;
}

function isCompletedToday(habit: Habit): boolean {
  if (!habit.lastCompletedAt) return false;
  if (habit.frequency === 'daily') {
    return new Date(habit.lastCompletedAt).toISOString().slice(0, 10) === todayStr();
  }
  // Weekly: completed this week
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return new Date(habit.lastCompletedAt) >= monday;
}

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly'>('daily');

  useFocusEffect(
    useCallback(() => {
      loadHabits();
    }, []),
  );

  async function loadHabits() {
    const raw = await AsyncStorage.getItem(HABITS_KEY);
    if (raw) {
      const parsed: Habit[] = JSON.parse(raw);
      setHabits(parsed);
    }
  }

  async function saveHabits(updated: Habit[]) {
    setHabits(updated);
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(updated));
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const habit: Habit = {
      id: Date.now().toString(),
      name: newName.trim(),
      frequency: newFreq,
      streak: 0,
      createdAt: new Date(),
    };
    await saveHabits([...habits, habit]);
    setNewName('');
    setNewFreq('daily');
    setModalVisible(false);
  }

  async function handleComplete(habit: Habit) {
    if (isCompletedToday(habit)) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const lastDate = habit.lastCompletedAt
      ? new Date(habit.lastCompletedAt).toISOString().slice(0, 10)
      : null;
    const newStreak =
      habit.frequency === 'daily' && lastDate === yesterday
        ? habit.streak + 1
        : habit.frequency === 'weekly'
        ? habit.streak + 1
        : 1;

    const updated = habits.map((h) =>
      h.id === habit.id
        ? { ...h, streak: newStreak, lastCompletedAt: new Date() }
        : h,
    );
    await saveHabits(updated);
    await addXp(8);
    Alert.alert('✓ Done!', `${habit.name} — streak: ${newStreak} 🔥  +8 XP`);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete habit', 'Remove this habit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => saveHabits(habits.filter((h) => h.id !== id)),
      },
    ]);
  }

  const dueToday = habits.filter((h) => isDueToday(h));
  const completedToday = habits.filter((h) => isCompletedToday(h));
  const remaining = dueToday.filter((h) => !isCompletedToday(h));

  function renderHabit({ item }: { item: Habit }) {
    const done = isCompletedToday(item);
    return (
      <TouchableOpacity
        style={[styles.habitCard, done && styles.habitCardDone]}
        onPress={() => handleComplete(item)}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.82}
      >
        <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
          {done && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <View style={styles.habitInfo}>
          <Text style={[styles.habitName, done && styles.habitNameDone]}>{item.name}</Text>
          <Text style={styles.habitMeta}>
            {item.frequency === 'daily' ? '📅 Daily' : '📆 Weekly'} · 🔥 {item.streak} streak
          </Text>
        </View>
        {done && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
      </TouchableOpacity>
    );
  }

  const allHabits = [...remaining, ...completedToday, ...habits.filter((h) => !isDueToday(h))];

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✅ Habits</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#4A9EFF" />
        </TouchableOpacity>
      </View>

      {/* Progress summary */}
      {habits.length > 0 && (
        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            {completedToday.length} / {dueToday.length} done today
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: dueToday.length > 0 ? `${(completedToday.length / dueToday.length) * 100}%` : '0%' },
              ]}
            />
          </View>
        </View>
      )}

      <FlatList
        data={allHabits}
        keyExtractor={(item) => item.id}
        renderItem={renderHabit}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyBody}>
              Add your first habit. Small consistent actions create big change.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={16} color="#4A9EFF" />
              <Text style={styles.emptyBtnText}>Add a habit</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add habit modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Habit</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Habit name (e.g. Read 10 pages)"
              placeholderTextColor="#5A6478"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={60}
            />
            <Text style={styles.freqLabel}>Frequency</Text>
            <View style={styles.freqRow}>
              {(['daily', 'weekly'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.freqChip, newFreq === f && styles.freqChipActive]}
                  onPress={() => setNewFreq(f)}
                >
                  <Text style={[styles.freqText, newFreq === f && styles.freqTextActive]}>
                    {f === 'daily' ? '📅 Daily' : '📆 Weekly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalBtn, !newName.trim() && styles.btnDisabled]}
                onPress={handleAdd}
                disabled={!newName.trim()}
              >
                <Text style={styles.saveModalBtnText}>Add Habit</Text>
              </TouchableOpacity>
            </View>
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A2340',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  progressText: {
    fontSize: 13,
    color: '#8B9CC8',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1F2937',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
    flexGrow: 1,
  },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  habitCardDone: {
    opacity: 0.6,
    borderColor: '#22C55E22',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#4A5568',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  habitNameDone: {
    textDecorationLine: 'line-through',
    color: '#5A6478',
  },
  habitMeta: {
    fontSize: 12,
    color: '#5A6478',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#8B9CC8',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A3A6B',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A9EFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  freqLabel: {
    fontSize: 12,
    color: '#5A6478',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 10,
  },
  freqChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  freqChipActive: {
    borderColor: '#4A9EFF',
    backgroundColor: '#1A3A6B',
  },
  freqText: {
    fontSize: 14,
    color: '#8B9CC8',
    fontWeight: '500',
  },
  freqTextActive: {
    color: '#4A9EFF',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1F2937',
  },
  cancelBtnText: {
    color: '#8B9CC8',
    fontSize: 15,
    fontWeight: '600',
  },
  saveModalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1A3A6B',
  },
  saveModalBtnText: {
    color: '#4A9EFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
