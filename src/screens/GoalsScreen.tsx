import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGet, secureSet } from '../services/storage-encryption';
import type { Goal, Habit } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';

const GOALS_KEY = '@innerspace:goals';
const HABITS_KEY = '@innerspace:habits';

export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [linkedHabits, setLinkedHabits] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const [goalsRaw, habitsRaw] = await Promise.all([
      AsyncStorage.getItem(GOALS_KEY),
      secureGet(HABITS_KEY),
    ]);
    if (goalsRaw) setGoals(JSON.parse(goalsRaw));
    if (habitsRaw) setHabits(JSON.parse(habitsRaw));
  }

  async function handleAdd() {
    if (!title.trim()) return;
    const goal: Goal = {
      id: Date.now().toString(),
      title: title.trim(),
      targetDate: targetDate.trim() || undefined,
      habitIds: linkedHabits,
      createdAt: new Date().toISOString(),
    };
    const updated = [goal, ...goals];
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(updated));
    setGoals(updated);
    setTitle('');
    setTargetDate('');
    setLinkedHabits([]);
    setModalVisible(false);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete goal', 'Remove this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = goals.filter((g) => g.id !== id);
          await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(updated));
          setGoals(updated);
        },
      },
    ]);
  }

  function renderGoal({ item }: { item: Goal }) {
    const linked = habits.filter((h) => item.habitIds.includes(h.id));
    return (
      <TouchableOpacity
        style={styles.goalCard}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>{item.title}</Text>
          {item.targetDate && (
            <View style={styles.dateBadge}>
              <Feather name="calendar" size={11} color={colors.accent} />
              <Text style={styles.dateBadgeText}>{item.targetDate}</Text>
            </View>
          )}
        </View>
        {linked.length > 0 && (
          <View style={styles.linkedRow}>
            <Text style={styles.linkedLabel}>Linked habits:</Text>
            {linked.map((h) => (
              <View key={h.id} style={styles.linkedChip}>
                <Text style={styles.linkedChipText}>{h.name} 🔥{h.streak}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="flag" size={22} color={colors.accent} />
          <Text style={styles.headerTitle}>Goals</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <Feather name="plus" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={goals}
        keyExtractor={(g) => g.id}
        renderItem={renderGoal}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptyBody}>Set a goal and link habits to track your progress.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
              <Feather name="plus-circle" size={16} color={colors.accent} />
              <Text style={styles.emptyBtnText}>Add a goal</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Goal</Text>
            <TextInput
              style={styles.input}
              placeholder="Goal title..."
              placeholderTextColor={colors.textDim}
              value={title}
              onChangeText={setTitle}
              autoFocus
              maxLength={80}
            />
            <TextInput
              style={styles.input}
              placeholder="Target date (optional, e.g. 2025-12-31)"
              placeholderTextColor={colors.textDim}
              value={targetDate}
              onChangeText={setTargetDate}
              maxLength={10}
            />
            {habits.length > 0 && (
              <>
                <Text style={styles.linkLabel}>Link habits (optional)</Text>
                <View style={styles.habitChips}>
                  {habits.map((h) => {
                    const linked = linkedHabits.includes(h.id);
                    return (
                      <TouchableOpacity
                        key={h.id}
                        style={[styles.habitChip, linked && styles.habitChipActive]}
                        onPress={() =>
                          setLinkedHabits((prev) =>
                            linked ? prev.filter((id) => id !== h.id) : [...prev, h.id],
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.habitChipText, linked && styles.habitChipTextActive]}>{h.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !title.trim() && { opacity: 0.4 }]}
                onPress={handleAdd}
                disabled={!title.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>Add Goal</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: c.text },
    addBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentBg, borderRadius: 10 },
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
    goalCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: c.border },
    goalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    goalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: c.text },
    dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    dateBadgeText: { fontSize: 11, color: c.accent, fontWeight: '600' },
    linkedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    linkedLabel: { fontSize: 11, color: c.textDim, fontWeight: '600' },
    linkedChip: { backgroundColor: c.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.border },
    linkedChipText: { fontSize: 12, color: c.textSecondary },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
    emptyBody: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentBg, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    emptyBtnText: { fontSize: 14, fontWeight: '600', color: c.accent },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    input: { backgroundColor: c.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 15, borderWidth: 1, borderColor: c.border },
    linkLabel: { fontSize: 12, fontWeight: '600', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
    habitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    habitChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
    habitChipActive: { backgroundColor: c.accentBg, borderColor: c.accent },
    habitChipText: { fontSize: 13, color: c.textMuted },
    habitChipTextActive: { color: c.accent, fontWeight: '600' },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    cancelBtnText: { fontSize: 15, color: c.textMuted, fontWeight: '600' },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center' },
    saveBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },
  });
}
