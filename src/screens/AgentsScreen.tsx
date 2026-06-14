import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_MODE_KEY } from '../constants/local-models';
import {
  AGENT_CATEGORIES,
  type AgentCategory,
} from '../constants/agents';
import { getCatalogAgents } from '../services/agents-catalog';
import type { Agent, AIMode } from '../types';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import InnerSpaceLogo from '../components/InnerSpaceLogo';

const CATEGORY_KEYS = Object.keys(AGENT_CATEGORIES) as AgentCategory[];
const ALL_KEY = '__all__';
const SELECTED_HELPERS_KEY = '@innerspace:selected_helpers';
const PINNED_HELPERS_KEY = '@innerspace:pinned_helpers';

export default function AgentsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | typeof ALL_KEY>(ALL_KEY);
  const [query, setQuery] = useState('');
  const [selectedHelperIds, setSelectedHelperIds] = useState<string[]>([]);
  const [onlyMyHelpers, setOnlyMyHelpers] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [aiMode, setAiMode] = useState<AIMode>('cloud');
  const [showOnlyLocalCapable, setShowOnlyLocalCapable] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [catalog, raw, pinnedRaw, savedAiMode] = await Promise.all([
        getCatalogAgents(),
        AsyncStorage.getItem(SELECTED_HELPERS_KEY),
        AsyncStorage.getItem(PINNED_HELPERS_KEY),
        AsyncStorage.getItem(AI_MODE_KEY),
      ]);
      setAllAgents(catalog);
      if (savedAiMode === 'local' || savedAiMode === 'cloud') setAiMode(savedAiMode);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setSelectedHelperIds(parsed.filter((v) => typeof v === 'string'));
          }
        } catch {
          // ignore corrupted preference
        }
      }
      if (pinnedRaw) {
        try {
          const parsed = JSON.parse(pinnedRaw);
          if (Array.isArray(parsed)) setPinnedIds(parsed.filter((v) => typeof v === 'string'));
        } catch {
          // ignore
        }
      }
    }
    loadData();
  }, []);

  async function togglePin(id: string) {
    const updated = pinnedIds.includes(id)
      ? pinnedIds.filter((p) => p !== id)
      : [...pinnedIds, id];
    setPinnedIds(updated);
    await AsyncStorage.setItem(PINNED_HELPERS_KEY, JSON.stringify(updated));
  }

  const styles = useMemo(() => createStyles(colors), [colors]);

  const filteredAgents = useMemo(() => {
    const pool =
      selectedCategory === ALL_KEY
        ? allAgents
        : allAgents.filter((a) => a.category === (selectedCategory as AgentCategory));

    let workingPool = pool;
    if (onlyMyHelpers) {
      workingPool = workingPool.filter((a) => selectedHelperIds.includes(a.id));
    }
    if (showOnlyLocalCapable && aiMode === 'local') {
      workingPool = workingPool.filter((a) => a.minimumAIMode !== 'cloud');
    }

    if (!query.trim()) {
      if (!selectedHelperIds.length && !pinnedIds.length) return workingPool;
      return [...workingPool].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.id) ? 2 : 0;
        const bPinned = pinnedIds.includes(b.id) ? 2 : 0;
        const aSelected = selectedHelperIds.includes(a.id) ? 1 : 0;
        const bSelected = selectedHelperIds.includes(b.id) ? 1 : 0;
        return (bPinned + bSelected) - (aPinned + aSelected);
      });
    }

    const q = query.toLowerCase();
    return workingPool.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        t(a.descriptionKey).toLowerCase().includes(q),
    );
  }, [selectedCategory, query, t, selectedHelperIds, onlyMyHelpers, showOnlyLocalCapable, aiMode]);

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
    const isPinned = pinnedIds.includes(item.id);
    const isCloudOnly = item.minimumAIMode === 'cloud';
    const blockedInLocalMode = aiMode === 'local' && isCloudOnly;
    const CardWrapper = blockedInLocalMode ? View : TouchableOpacity;
    const cardWrapperProps = blockedInLocalMode
      ? {}
      : { activeOpacity: 0.82, onPress: () => navigation.navigate('Chat', { agentId: item.id }) };
    return (
      <CardWrapper
        style={[styles.agentCard, isPinned && styles.agentCardPinned, blockedInLocalMode && styles.agentCardBlocked]}
        {...cardWrapperProps}
      >
        <Text style={styles.agentEmoji}>{item.emoji}</Text>
        <View style={styles.agentInfo}>
          <View style={styles.agentNameRow}>
            <Text style={styles.agentName}>{t(item.nameKey)}</Text>
            {blockedInLocalMode ? (
              <View style={styles.cloudLockBadge}>
                <Feather name="lock" size={9} color="#9CA3AF" />
                <Text style={styles.cloudLockBadgeText}>{t('helpers.cloud_only_lock')}</Text>
              </View>
            ) : (
              <Text style={[styles.modeBadge, isCloudOnly ? styles.modeBadgeCloud : styles.modeBadgeLocal]}>
                {isCloudOnly ? t('helpers.badge_cloud') : t('helpers.badge_local')}
              </Text>
            )}
            {selectedHelperIds.includes(item.id) && !blockedInLocalMode && (
              <Text style={styles.pickedBadge}>{t('helpers.my_pick')}</Text>
            )}
          </View>
          <Text style={styles.agentDesc} numberOfLines={2}>
            {t(item.descriptionKey)}
          </Text>
          {blockedInLocalMode && (
            <Text style={styles.cloudLockHint}>{t('helpers.cloud_only_hint')}</Text>
          )}
        </View>
        {!blockedInLocalMode && (
          <TouchableOpacity onPress={() => togglePin(item.id)} style={styles.pinBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather
              name="heart"
              size={18}
              color={isPinned ? '#EF4444' : '#4A5568'}
            />
          </TouchableOpacity>
        )}
      </CardWrapper>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <InnerSpaceLogo size={28} />
          <Text style={styles.headerTitle}>{t('helpers.title')}</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateAgent')}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={22} color="#4A9EFF" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.textDim} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('helpers.search_placeholder')}
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {(!!selectedHelperIds.length || (aiMode === 'local')) && (
        <View style={styles.filterRow}>
          {!!selectedHelperIds.length && (
            <TouchableOpacity
              style={[styles.filterChip, onlyMyHelpers && styles.filterChipActive]}
              onPress={() => setOnlyMyHelpers((v) => !v)}
              activeOpacity={0.8}
            >
              <Feather name="star" size={13} color={onlyMyHelpers ? '#4A9EFF' : '#8B9CC8'} />
              <Text style={[styles.filterChipText, onlyMyHelpers && styles.filterChipTextActive]}>
                {t('helpers.my_helpers_only')}
              </Text>
            </TouchableOpacity>
          )}
          {aiMode === 'local' && (
            <TouchableOpacity
              style={[styles.filterChip, showOnlyLocalCapable && styles.filterChipActive]}
              onPress={() => setShowOnlyLocalCapable((v) => !v)}
              activeOpacity={0.8}
            >
              <Feather name="home" size={13} color={showOnlyLocalCapable ? '#34D399' : '#8B9CC8'} />
              <Text style={[styles.filterChipText, showOnlyLocalCapable && styles.filterChipTextActive]}>
                {t('helpers.local_capable_only')}
              </Text>
            </TouchableOpacity>
          )}
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
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>{t('helpers.none_found')}</Text>
            <Text style={styles.emptyBody}>Try a different search or category</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: c.text },
  createBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 10, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40, color: c.text, fontSize: 15 },
  filterRow: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { borderColor: c.accent, backgroundColor: c.accentBg },
  filterChipText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: c.accent },
  catScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  catContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  catTab: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 5 },
  catTabActive: { backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accent },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 13, color: c.textMuted },
  catLabelActive: { color: c.accent, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  agentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 14, borderWidth: 1, borderColor: 'transparent' },
  agentCardPinned: { borderColor: c.danger, backgroundColor: '#1A0F0F' },
  agentCardBlocked: { opacity: 0.65 },
  cloudLockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1F2937', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  cloudLockBadgeText: { fontSize: 9, color: '#9CA3AF', fontWeight: '600' },
  cloudLockHint: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  agentEmoji: { fontSize: 28, width: 40, textAlign: 'center' },
  agentInfo: { flex: 1 },
  agentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  agentName: { fontSize: 15, fontWeight: '600', color: c.text },
  modeBadge: { fontSize: 10, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  modeBadgeCloud: { color: '#FBBF24', backgroundColor: '#3A2A0A' },
  modeBadgeLocal: { color: '#34D399', backgroundColor: '#0D2F28' },
  pickedBadge: { fontSize: 10, color: c.accent, backgroundColor: c.accentBg, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  agentDesc: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
  pinBtn: { padding: 4 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 6, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
  });
}
