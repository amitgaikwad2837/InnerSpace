import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateCustomAgent } from '../constants/agents';
import type { Agent } from '../types';

const CUSTOM_AGENTS_KEY = '@innerspace:custom_agents';

const CATEGORY_OPTIONS = [
  { key: 'home_family',     label: '🏠 Home & Family' },
  { key: 'health_wellness', label: '💪 Health & Wellness' },
  { key: 'career_learning', label: '🎓 Career & Learning' },
  { key: 'creative_hobbies',label: '🎨 Creative & Hobbies' },
  { key: 'personal_growth', label: '🌱 Personal Growth' },
  { key: 'tech_digital',    label: '💻 Tech & Digital' },
  { key: 'other',           label: '✨ Other' },
];

export default function CreateAgentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expertise, setExpertise] = useState('');
  const [category, setCategory] = useState('other');
  const [emoji, setEmoji] = useState('🤖');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please give your agent a name.');
      return;
    }
    if (!expertise.trim()) {
      Alert.alert('Missing description', 'Please describe what your agent knows about.');
      return;
    }

    const validation = validateCustomAgent(name, expertise);
    if (!validation.valid) {
      Alert.alert(t('custom_agent.blocked'), validation.reason ?? '');
      return;
    }

    setSaving(true);
    try {
      const newAgent: Agent = {
        id: `custom_${Date.now()}`,
        name: name.trim(),
        nameKey: name.trim(),
        descriptionKey: description.trim() || expertise.trim(),
        category,
        emoji: emoji.trim() || '🤖',
        systemPrompt: buildCustomPrompt(name.trim(), expertise.trim()),
        suggestedQuestions: [],
        isCustom: true,
        isPremium: false,
      };

      const existing = await AsyncStorage.getItem(CUSTOM_AGENTS_KEY);
      const agents: Agent[] = existing ? JSON.parse(existing) : [];
      agents.push(newAgent);
      await AsyncStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(agents));

      Alert.alert('Agent created!', `${emoji} ${name} is ready to chat.`, [
        { text: 'Chat now', onPress: () => navigation.replace('Chat', { agentId: newAgent.id, customAgent: newAgent }) },
        { text: 'Share agent', onPress: () => handleShareAgent(newAgent) },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setSaving(false);
    }
  }

  async function handleShareAgent(agent: Agent) {
    try {
      const payload = JSON.stringify({
        n: agent.name,
        e: agent.emoji,
        c: agent.category,
        d: agent.descriptionKey,
        x: agent.systemPrompt.slice(0, 800),
      });
      const encoded = btoa(encodeURIComponent(payload));
      const shareUrl = `innerspace://import-agent?data=${encoded}`;
      await Share.share({
        message: `Check out this InnerSpace helper: ${agent.emoji} ${agent.name}\n\nImport it: ${shareUrl}`,
        title: `${agent.emoji} ${agent.name} — InnerSpace helper`,
      });
    } catch {
      // User cancelled
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('custom_agent.title')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            {t('custom_agent.intro')}
          </Text>

          {/* Emoji picker (simple text field for now) */}
          <Field label="Emoji" styles={styles}>
            <TextInput
              style={[styles.input, { maxWidth: 80, textAlign: 'center', fontSize: 28 }]}
              value={emoji}
              onChangeText={setEmoji}
              maxLength={4}
            />
          </Field>

          {/* Name */}
          <Field label={t('custom_agent.name_label')} styles={styles}>
            <TextInput
              style={styles.input}
              placeholder={t('custom_agent.name_placeholder')}
              placeholderTextColor="#5A6478"
              value={name}
              onChangeText={setName}
              maxLength={40}
            />
          </Field>

          {/* Short description */}
          <Field label="Short description (shown on agent card)" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder={t('custom_agent.desc_placeholder')}
              placeholderTextColor="#5A6478"
              value={description}
              onChangeText={setDescription}
              maxLength={100}
            />
          </Field>

          {/* Expertise / system prompt seed */}
          <Field label={t('custom_agent.desc_label')} styles={styles}>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder={t('custom_agent.expertise_placeholder')}
              placeholderTextColor="#5A6478"
              value={expertise}
              onChangeText={setExpertise}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{expertise.length}/500</Text>
          </Field>

          {/* Category */}
          <Field label="Category" styles={styles}>
            {CATEGORY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.catOption, category === opt.key && styles.catOptionActive]}
                onPress={() => setCategory(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.catOptionText, category === opt.key && styles.catOptionTextActive]}>
                  {opt.label}
                </Text>
                {category === opt.key && (
                  <Ionicons name="checkmark" size={16} color="#4A9EFF" />
                )}
              </TouchableOpacity>
            ))}
          </Field>

          {/* Safety notice */}
          <View style={styles.safetyNotice}>
            <Ionicons name="shield-checkmark" size={16} color="#4A9EFF" />
            <Text style={styles.safetyText}>
              Your agent automatically inherits all safety rules. It cannot give medical, legal, or crisis advice, and will redirect appropriately.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.createBtn, saving && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>
              {saving ? 'Creating...' : t('custom_agent.create')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function buildCustomPrompt(name: string, expertise: string): string {
  return `You are ${name}, an expert in: ${expertise}.

IMPORTANT RULES — ALWAYS FOLLOW — NO EXCEPTIONS:
- Suicidal thoughts/self-harm/crisis → immediate crisis resources (988 US / 116 123 UK). Stop normal conversation.
- Medical symptoms/diagnosis/medications → redirect to a doctor or pharmacist.
- Legal advice for a specific situation → redirect to a solicitor or Citizens Advice.
- Specific investment/financial decisions → redirect to a qualified financial adviser.
- Domestic abuse/violence/child at risk → provide emergency helpline immediately.
- Political/religious opinion questions → remain neutral.
- Never give advice that could cause physical harm.

Stay strictly within your area of expertise. If asked about something outside it, politely say so and suggest a better resource.`;
}

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function createStyles(c: typeof DARK_COLORS) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background, paddingTop: RNStatusBar.currentHeight ?? 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  scroll: { padding: 20 },
  intro: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 24 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 15, borderWidth: 1, borderColor: c.border },
  multiline: { minHeight: 100, paddingTop: 12 },
  charCount: { fontSize: 11, color: c.textDim, textAlign: 'right', marginTop: 4 },
  catOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6, borderWidth: 1, borderColor: c.border },
  catOptionActive: { borderColor: c.accent, backgroundColor: c.accentBg },
  catOptionText: { fontSize: 15, color: c.textMuted },
  catOptionTextActive: { color: c.accent, fontWeight: '600' },
  safetyNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.accentBg, borderRadius: 10, padding: 12, marginBottom: 20 },
  safetyText: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 18 },
  createBtn: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
}
