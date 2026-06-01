import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PREDEFINED_AGENTS,
  AGENT_CATEGORIES,
  getAgentsByCategory,
  type AgentCategory,
} from '../constants/agents';
import type { Agent } from '../types';

const CATEGORY_KEYS = Object.keys(AGENT_CATEGORIES) as AgentCategory[];
const ALL_KEY = '__all__';
const SELECTED_HELPERS_KEY = '@innerspace:selected_helpers';

export default function AgentsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | typeof ALL_KEY>(ALL_KEY);
  const [query, setQuery] = useState('');
  const [selectedHelperIds, setSelectedHelperIds] = useState<string[]>([]);
  const [onlyMyHelpers, setOnlyMyHelpers] = useState(false);

  useEffect(() => {
    async function loadSelectedHelpers() {
      const raw = await AsyncStorage.getItem(SELECTED_HELPERS_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelectedHelperIds(parsed.filter((v) => typeof v === 'string'));
        }
      } catch {
        // ignore corrupted preference
      }
    }
    loadSelectedHelpers();
  }, []);

  const filteredAgents = useMemo(() => {
    const pool =
      selectedCategory === ALL_KEY
        ? PREDEFINED_AGENTS
        : getAgentsByCategory(selectedCategory as AgentCategory);

    let workingPool = pool;
    if (onlyMyHelpers) {
      workingPool = workingPool.filter((a) => selectedHelperIds.includes(a.id));
    }

    if (!query.trim()) {
      if (!selectedHelperIds.length) return workingPool;
      return [...workingPool].sort((a, b) => {
        const aSelected = selectedHelperIds.includes(a.id) ? 1 : 0;
        const bSelected = selectedHelperIds.includes(b.id) ? 1 : 0;
        return bSelected - aSelected;
      });
    }

    const q = query.toLowerCase();
    return workingPool.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        t(a.descriptionKey).toLowerCase().includes(q),
    );
  }, [selectedCategory, query, t, selectedHelperIds, onlyMyHelpers]);

  function renderCategoryTab(key: AgentCategory | typeof ALL_KEY) {
    const isActive = key === selectedCategory;
    const label =
      key === ALL_KEY ? t('helpers.all') : t(AGENT_CATEGORIES[key as AgentCategory].labelKey);
    const emoji = key === ALL_KEY ? '✨' : AGENT_CATEGORIES[key as AgentCategory].emoji;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.catTab, isActive && styles.catTabActive]}
        onPress={() => setSelectedCategory(key)}
        activeOpacity={0.7}
      >
        <Text style={styles.catEmoji}>{emoji}</Text>
        <Text style={[styles.catLabel, isActive && styles.catLabelActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  function renderAgent({ item }: { item: Agent }) {
    return (
      <TouchableOpacity
        style={styles.agentCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('Chat', { agentId: item.id })}
      >
        <Text style={styles.agentEmoji}>{item.emoji}</Text>
        <View style={styles.agentInfo}>
          <View style={styles.agentNameRow}>
            <Text style={styles.agentName}>{t(item.nameKey)}</Text>
            {selectedHelperIds.includes(item.id) && (
              <Text style={styles.pickedBadge}>{t('helpers.my_pick')}</Text>
            )}
          </View>
          <Text style={styles.agentDesc} numberOfLines={2}>
            {t(item.descriptionKey)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#4A5568" />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('helpers.title')}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateAgent')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#4A9EFF" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#5A6478" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('helpers.search_placeholder')}
          placeholderTextColor="#5A6478"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {!!selectedHelperIds.length && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, onlyMyHelpers && styles.filterChipActive]}
            onPress={() => setOnlyMyHelpers((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={13} color={onlyMyHelpers ? '#4A9EFF' : '#8B9CC8'} />
            <Text style={[styles.filterChipText, onlyMyHelpers && styles.filterChipTextActive]}>
              {t('helpers.my_helpers_only')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        {renderCategoryTab(ALL_KEY)}
        {CATEGORY_KEYS.map((k) => renderCategoryTab(k))}
      </ScrollView>

      {/* Agent list */}
      <FlatList
        data={filteredAgents}
        keyExtractor={(item) => item.id}
        renderItem={renderAgent}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('helpers.none_found')}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
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
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A2340',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#FFFFFF',
    fontSize: 15,
  },
  filterRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: '#4A9EFF',
    backgroundColor: '#1A3A6B',
  },
  filterChipText: {
    color: '#8B9CC8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#4A9EFF',
  },
  catScroll: {
    maxHeight: 48,
    marginBottom: 8,
  },
  catContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  catTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  catTabActive: {
    backgroundColor: '#1A3A6B',
    borderWidth: 1,
    borderColor: '#4A9EFF',
  },
  catEmoji: {
    fontSize: 14,
  },
  catLabel: {
    fontSize: 13,
    color: '#8B9CC8',
  },
  catLabelActive: {
    color: '#4A9EFF',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  agentEmoji: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  agentInfo: {
    flex: 1,
  },
  agentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pickedBadge: {
    fontSize: 10,
    color: '#4A9EFF',
    backgroundColor: '#112642',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  agentDesc: {
    fontSize: 13,
    color: '#8B9CC8',
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#4A5568',
    fontSize: 15,
  },
});
