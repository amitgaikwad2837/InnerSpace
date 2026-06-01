import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';
import { PREDEFINED_AGENTS } from '../constants/agents';
import { getCatalogAgents } from '../services/agents-catalog';
import { importBackupFromFile } from '../services/backup-service';
import {
  LEGAL_ACK_KEY,
  LEGAL_ACK_VERSION,
  getEffectiveLegalNoticeText,
  getLegalNotice,
} from '../constants/legal-notice';
import {
  LOCAL_MODELS,
  CLOUD_AI_TOOLS,
  AI_MODE_KEY,
  LOCAL_MODEL_KEY,
  USER_PROFILE_KEY,
  getAgeGroup,
} from '../constants/local-models';
import type { ToneOption, AIMode, LocalModel } from '../types';
import {
  downloadLocalModel,
  getLocalModelDownloadStatus,
  type LocalModelDownloadStatus,
} from '../services/local-llm-service';

const ONBOARDING_DONE_KEY = '@innerspace:onboarding_done';
const LANG_KEY = '@innerspace:language';
const TONE_KEY = '@innerspace:tone';
const SELECTED_HELPERS_KEY = '@innerspace:selected_helpers';
const AI_PROVIDER_KEY = '@innerspace:ai_provider';
const API_KEY_STORE = 'innerspace_api_key';

const TONES: ToneOption[] = ['warm', 'direct', 'motivational'];
const TOTAL_STEPS = 6;

export default function SetupFlowScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalNoticeText, setLegalNoticeText] = useState('');

  const [userName, setUserName] = useState('');
  const [userAge, setUserAge] = useState('');

  const [aiMode, setAiMode] = useState<AIMode>('cloud');
  const [selectedLocalModel, setSelectedLocalModel] = useState<LocalModel>('llama321b');
  const [selectedCloudProvider, setSelectedCloudProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showApiHelp, setShowApiHelp] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Partial<Record<LocalModel, LocalModelDownloadStatus>>>({});
  const [downloadingModelId, setDownloadingModelId] = useState<LocalModel | null>(null);

  const [language, setLanguage] = useState<LanguageCode>('en');
  const [tone, setTone] = useState<ToneOption>('warm');
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>(['confidence']);
  const [helperPool, setHelperPool] = useState(PREDEFINED_AGENTS.slice(0, 20));

  const legalNotice = useMemo(() => getLegalNotice(), []);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      const statuses = await Promise.all(
        LOCAL_MODELS.map(async (model) => [model.id, await getLocalModelDownloadStatus(model.id)] as const),
      );
      const [legalText, catalog] = await Promise.all([
        getEffectiveLegalNoticeText(),
        getCatalogAgents(),
      ]);
      if (mounted) {
        setLegalNoticeText(legalText);
        setHelperPool(catalog.slice(0, 20) as typeof PREDEFINED_AGENTS);
        setLocalStatuses(Object.fromEntries(statuses) as Partial<Record<LocalModel, LocalModelDownloadStatus>>);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (aiMode !== 'local') return;
    setSelectedHelpers((prev) => prev.filter((id) => {
      const agent = helperPool.find((item) => item.id === id);
      return agent?.minimumAIMode !== 'cloud';
    }));
  }, [aiMode, helperPool]);

  function toggleHelper(id: string) {
    setSelectedHelpers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleImportBackup() {
    try {
      const result = await importBackupFromFile();
      if (result.cancelled) return;
      const [savedLang, savedTone, savedHelpers] = await Promise.all([
        AsyncStorage.getItem(LANG_KEY),
        AsyncStorage.getItem(TONE_KEY),
        AsyncStorage.getItem(SELECTED_HELPERS_KEY),
      ]);
      if (savedLang) setLanguage(savedLang as LanguageCode);
      if (savedTone) setTone(savedTone as ToneOption);
      if (savedHelpers) {
        try {
          const parsed = JSON.parse(savedHelpers);
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
            setSelectedHelpers(parsed);
          }
        } catch { /* ignore */ }
      }
      Alert.alert(
        t('setup.backup_imported_title'),
        t('setup.backup_imported_body', { count: result.restoredKeys }),
      );
    } catch {
      Alert.alert(t('setup.import_failed_title'), t('setup.import_failed_body'));
    }
  }

  async function completeSetup() {
    if (aiMode === 'local') {
      const status = await getLocalModelDownloadStatus(selectedLocalModel);
      if (!status.downloaded) {
        Alert.alert(
          t('setup.download_model_alert_title', { defaultValue: 'Download model first' }),
          t('setup.download_model_alert_body', { defaultValue: 'Please download the selected on-device model before finishing setup.' }),
        );
        return;
      }
    }

    const ageNum = parseInt(userAge, 10);
    const validAge = !Number.isNaN(ageNum) && ageNum >= 13 && ageNum <= 120 ? ageNum : null;
    const ageGroup = getAgeGroup(validAge);
    const profile = { name: userName.trim(), age: validAge, ageGroup };
    await Promise.all([
      AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true'),
      AsyncStorage.setItem(LEGAL_ACK_KEY, LEGAL_ACK_VERSION),
      AsyncStorage.setItem(LANG_KEY, language),
      AsyncStorage.setItem(TONE_KEY, tone),
      AsyncStorage.setItem(SELECTED_HELPERS_KEY, JSON.stringify(selectedHelpers)),
      AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile)),
      AsyncStorage.setItem(AI_MODE_KEY, aiMode),
      aiMode === 'local'
        ? AsyncStorage.setItem(LOCAL_MODEL_KEY, selectedLocalModel)
        : AsyncStorage.setItem(AI_PROVIDER_KEY, selectedCloudProvider),
    ]);
    if (aiMode === 'cloud' && apiKey.trim()) {
      await SecureStore.setItemAsync(API_KEY_STORE, apiKey.trim());
    }
    await i18n.changeLanguage(language);
    navigation.replace('Main');
  }

  const selectedToolInfo = CLOUD_AI_TOOLS.find((tool) => tool.id === selectedCloudProvider);
  const selectedLocalStatus = localStatuses[selectedLocalModel];
  const visibleHelperPool = helperPool.filter((agent) => aiMode === 'cloud' || agent.minimumAIMode !== 'cloud');

  async function refreshLocalStatuses() {
    const statuses = await Promise.all(
      LOCAL_MODELS.map(async (model) => [model.id, await getLocalModelDownloadStatus(model.id)] as const),
    );
    setLocalStatuses(Object.fromEntries(statuses) as Partial<Record<LocalModel, LocalModelDownloadStatus>>);
  }

  async function handleDownloadSelectedModel() {
    try {
      setDownloadingModelId(selectedLocalModel);
      setLocalStatuses((prev) => ({
        ...prev,
        [selectedLocalModel]: {
          downloaded: false,
          downloading: true,
          progress: 0,
          supported: prev[selectedLocalModel]?.supported ?? true,
          available: prev[selectedLocalModel]?.available ?? true,
        },
      }));
      await downloadLocalModel(selectedLocalModel, (progress) => {
        setLocalStatuses((prev) => ({
          ...prev,
          [selectedLocalModel]: {
            downloaded: false,
            downloading: true,
            progress,
            supported: prev[selectedLocalModel]?.supported ?? true,
            available: prev[selectedLocalModel]?.available ?? true,
          },
        }));
      });
      await refreshLocalStatuses();
    } catch (error: any) {
      Alert.alert(
        t('setup.download_failed_title', { defaultValue: 'Download failed' }),
        String(error?.message ?? error),
      );
      await refreshLocalStatuses();
    } finally {
      setDownloadingModelId(null);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('setup.title')}</Text>
        <Text style={styles.subtitle}>{t('setup.step_of', { step, total: TOTAL_STEPS })}</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{legalNotice.title}</Text>
            <Text style={styles.cardText}>{legalNotice.summary}</Text>
            <Text style={styles.regionTag}>{t('setup.region_detected', { region: legalNotice.regionLabel })}</Text>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeBullet}>
                {legalNoticeText || legalNotice.bullets.map((line) => `- ${line}`).join('\n')}
              </Text>
            </View>
            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedLegal((v) => !v)} activeOpacity={0.8}>
              <View style={[styles.checkBox, acceptedLegal && styles.checkBoxActive]}>
                {acceptedLegal && <Ionicons name="checkmark" size={12} color="#4A9EFF" />}
              </View>
              <Text style={styles.checkText}>{t('setup.accept_legal')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('setup.profile_title')}</Text>
            <Text style={styles.cardText}>{t('setup.profile_body')}</Text>
            <Text style={styles.inputLabel}>{t('setup.profile_name_label')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('setup.profile_name_placeholder')}
              placeholderTextColor="#5A6478"
              value={userName}
              onChangeText={setUserName}
              maxLength={40}
              autoCapitalize="words"
            />
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>{t('setup.profile_age_label')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('setup.profile_age_placeholder')}
              placeholderTextColor="#5A6478"
              value={userAge}
              onChangeText={(v) => setUserAge(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.cardHint}>{t('setup.profile_age_hint')}</Text>
          </View>
        )}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('setup.ai_mode_title')}</Text>
            <Text style={styles.cardText}>{t('setup.ai_mode_body')}</Text>
            <View style={styles.modeRow}>
              {(['local', 'cloud'] as AIMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeChip, aiMode === m && styles.modeChipActive]}
                  onPress={() => setAiMode(m)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modeEmoji}>{m === 'local' ? '📱' : '☁️'}</Text>
                  <Text style={[styles.modeLabel, aiMode === m && styles.modeLabelActive]}>
                    {m === 'local' ? t('setup.ai_mode_local') : t('setup.ai_mode_cloud')}
                  </Text>
                  <Text style={styles.modeDesc}>
                    {m === 'local' ? t('setup.ai_mode_local_desc') : t('setup.ai_mode_cloud_desc')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {aiMode === 'local' && (
              <>
                <Text style={styles.sectionLabel}>{t('setup.choose_local_model')}</Text>
                {LOCAL_MODELS.map((model) => (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.modelRow,
                      selectedLocalModel === model.id && styles.modelRowActive,
                      !model.supported && styles.modelRowDisabled,
                    ]}
                    onPress={() => {
                      if (!model.supported) return;
                      setSelectedLocalModel(model.id);
                    }}
                    activeOpacity={0.85}
                    disabled={!model.supported}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelLabel}>{model.label}</Text>
                      <Text style={styles.modelDesc}>{model.description}</Text>
                    </View>
                    <Text style={styles.modelSize}>{model.supported ? `${model.sizeGB} GB` : 'Soon'}</Text>
                  </TouchableOpacity>
                ))}
                {selectedLocalStatus?.supported && (
                  <View style={styles.downloadCard}>
                    <Text style={styles.downloadTitle}>{selectedLocalStatus.downloaded
                      ? t('setup.model_downloaded', { defaultValue: 'Model downloaded and ready' })
                      : selectedLocalStatus.downloading
                        ? t('setup.model_downloading', { defaultValue: 'Downloading model...' })
                        : t('setup.model_not_downloaded', { defaultValue: 'Model not downloaded yet' })}</Text>
                    <Text style={styles.downloadHint}>
                      {selectedLocalStatus.downloaded
                        ? t('setup.model_ready_hint', { defaultValue: 'Local chats can start immediately without another download.' })
                        : t('setup.model_download_hint', { defaultValue: 'Download now so the first local chat does not stall later.' })}
                    </Text>
                    {!selectedLocalStatus.downloaded && (
                      <>
                        <TouchableOpacity
                          style={[styles.downloadBtn, downloadingModelId === selectedLocalModel && styles.downloadBtnDisabled]}
                          onPress={handleDownloadSelectedModel}
                          disabled={downloadingModelId === selectedLocalModel}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.downloadBtnText}>
                            {downloadingModelId === selectedLocalModel
                              ? t('setup.downloading_model', { defaultValue: 'Downloading...' })
                              : t('setup.download_model', { defaultValue: 'Download model now' })}
                          </Text>
                        </TouchableOpacity>
                        {(selectedLocalStatus.downloading || downloadingModelId === selectedLocalModel) && (
                          <>
                            <View style={styles.progressTrack}>
                              <View
                                style={[
                                  styles.progressFill,
                                  { width: `${Math.round((selectedLocalStatus.progress || 0) * 100)}%` },
                                ]}
                              />
                            </View>
                            <Text style={styles.progressText}>{Math.round((selectedLocalStatus.progress || 0) * 100)}%</Text>
                          </>
                        )}
                      </>
                    )}
                  </View>
                )}
                <Text style={styles.cardHint}>{t('setup.local_model_hint')}</Text>
              </>
            )}
            {aiMode === 'cloud' && (
              <>
                <Text style={styles.sectionLabel}>{t('setup.choose_cloud_provider')}</Text>
                {CLOUD_AI_TOOLS.map((tool) => (
                  <TouchableOpacity
                    key={tool.id}
                    style={[styles.modelRow, selectedCloudProvider === tool.id && styles.modelRowActive]}
                    onPress={() => { setSelectedCloudProvider(tool.id); setShowApiHelp(false); }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modelEmoji}>{tool.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelLabel}>{tool.label}</Text>
                      <Text style={styles.modelDesc}>{tool.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {selectedToolInfo && (
                  <View style={styles.apiKeySection}>
                    <Text style={styles.apiKeyLabel}>
                      {t('setup.api_key_label', { provider: selectedToolInfo.label })}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder={t('setup.api_key_placeholder')}
                      placeholderTextColor="#5A6478"
                      value={apiKey}
                      onChangeText={setApiKey}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowApiHelp((v) => !v)} style={styles.helpToggle}>
                      <Text style={styles.helpToggleText}>
                        {showApiHelp ? '▲ Hide help' : `▼ How to get a key for ${selectedToolInfo.label}`}
                      </Text>
                    </TouchableOpacity>
                    {showApiHelp && (
                      <View style={styles.helpBox}>
                        <Text style={styles.helpText}>{selectedToolInfo.apiKeyHelp}</Text>
                        <Text style={styles.helpLink}>{selectedToolInfo.apiKeyUrl}</Text>
                      </View>
                    )}
                  </View>
                )}
                <Text style={styles.cardHint}>{t('setup.ai_tool_hint')}</Text>
                <TouchableOpacity style={styles.importBtn} onPress={handleImportBackup} activeOpacity={0.85}>
                  <Text style={styles.importBtnText}>{t('setup.import_existing_backup')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        {step === 4 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('setup.language_title')}</Text>
            <Text style={styles.cardText}>{t('setup.language_body')}</Text>
            <View style={styles.wrapRow}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => setLanguage(lang.code)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.choiceChipText, active && styles.choiceChipActiveText]}>
                      {lang.nativeName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        {step === 5 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('setup.tone_title')}</Text>
            <Text style={styles.cardText}>{t('setup.tone_body')}</Text>
            {TONES.map((toneKey) => {
              const active = tone === toneKey;
              return (
                <TouchableOpacity
                  key={toneKey}
                  style={[styles.toneRow, active && styles.toneRowActive]}
                  onPress={() => setTone(toneKey)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.toneLabel, active && styles.toneLabelActive]}>
                    {t(`settings.tone_${toneKey}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {step === 6 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('setup.helpers_title')}</Text>
            <Text style={styles.cardText}>{t('setup.helpers_body')}</Text>
            <View style={styles.wrapRow}>
              {visibleHelperPool.map((agent) => {
                const active = selectedHelpers.includes(agent.id);
                const isCloudOnly = agent.minimumAIMode === 'cloud';
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => toggleHelper(agent.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emoji}>{agent.emoji}</Text>
                    <Text style={[styles.choiceChipText, active && styles.choiceChipActiveText]}>
                      {agent.name}
                    </Text>
                    <Text style={[styles.helperModeBadge, isCloudOnly ? styles.helperModeBadgeCloud : styles.helperModeBadgeLocal]}>
                      {isCloudOnly ? t('helpers.badge_cloud') : t('helpers.badge_local')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {aiMode === 'local' && (
              <Text style={styles.cardHint}>
                {t('setup.helpers_local_hint', { defaultValue: 'Only helpers marked for on-device AI are shown in local mode.' })}
              </Text>
            )}
            <Text style={styles.cardHint}>{t('setup.helpers_selected', { count: selectedHelpers.length })}</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.backBtnText}>{t('general.back')}</Text>
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.nextBtn, step === 1 && !acceptedLegal && styles.nextBtnDisabled]}
            onPress={() => setStep((s) => s + 1)}
            disabled={step === 1 && !acceptedLegal}
          >
            <Text style={styles.nextBtnText}>{t('setup.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={completeSetup}>
            <Text style={styles.nextBtnText}>{t('setup.start_app')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1E' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#8B9CC8', marginTop: 6 },
  body: { flex: 1 },
  bodyContent: { padding: 16 },
  card: { backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1F2937' },
  cardTitle: { fontSize: 20, color: '#FFFFFF', fontWeight: '700', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#CBD5E1', marginBottom: 14, lineHeight: 20 },
  cardHint: { fontSize: 12, color: '#5A6478', marginTop: 12 },
  noticeBox: { backgroundColor: '#0A0F1E', borderRadius: 10, borderWidth: 1, borderColor: '#1F2937', padding: 12 },
  regionTag: { color: '#4A9EFF', fontSize: 12, marginBottom: 10 },
  noticeBullet: { fontSize: 12, lineHeight: 18, color: '#CBD5E1' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#4A5568', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: '#1A3A6B', borderColor: '#4A9EFF' },
  checkMark: { color: '#4A9EFF', fontSize: 12, fontWeight: '700' },
  checkText: { color: '#CBD5E1', fontSize: 13, flex: 1, lineHeight: 18 },
  inputLabel: { color: '#8B9CC8', fontSize: 13, marginBottom: 6 },
  textInput: { backgroundColor: '#0A0F1E', borderRadius: 10, borderWidth: 1, borderColor: '#1F2937', color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeChip: { flex: 1, backgroundColor: '#1A2340', borderRadius: 12, borderWidth: 1, borderColor: '#1F2937', padding: 12, alignItems: 'center' },
  modeChipActive: { backgroundColor: '#1A3A6B', borderColor: '#4A9EFF' },
  modeEmoji: { fontSize: 22, marginBottom: 4 },
  modeLabel: { color: '#CBD5E1', fontWeight: '600', fontSize: 13 },
  modeLabelActive: { color: '#4A9EFF' },
  modeDesc: { color: '#5A6478', fontSize: 11, textAlign: 'center', marginTop: 4 },
  sectionLabel: { color: '#8B9CC8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  modelRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2340', borderRadius: 10, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, gap: 10 },
  modelRowActive: { backgroundColor: '#1A3A6B', borderColor: '#4A9EFF' },
  modelRowDisabled: { opacity: 0.45 },
  modelLabel: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  modelDesc: { color: '#8B9CC8', fontSize: 12, marginTop: 2 },
  modelSize: { color: '#5A6478', fontSize: 12 },
  modelEmoji: { fontSize: 18 },
  apiKeySection: { marginTop: 12 },
  apiKeyLabel: { color: '#8B9CC8', fontSize: 13, marginBottom: 6 },
  helpToggle: { marginTop: 6 },
  helpToggleText: { color: '#4A9EFF', fontSize: 12 },
  helpBox: { backgroundColor: '#0A0F1E', borderRadius: 8, borderWidth: 1, borderColor: '#1F2937', padding: 10, marginTop: 6 },
  helpText: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  helpLink: { color: '#4A9EFF', fontSize: 11, marginTop: 4 },
  downloadCard: {
    backgroundColor: '#0A0F1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    marginTop: 8,
  },
  downloadTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  downloadHint: { color: '#8B9CC8', fontSize: 12, marginTop: 4, lineHeight: 18 },
  downloadBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1A3A6B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  downloadBtnDisabled: { opacity: 0.65 },
  downloadBtnText: { color: '#4A9EFF', fontSize: 13, fontWeight: '700' },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1A2340',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A9EFF',
  },
  progressText: { color: '#8B9CC8', fontSize: 12, marginTop: 6 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { backgroundColor: '#1A2340', borderRadius: 16, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceChipActive: { backgroundColor: '#1A3A6B', borderColor: '#4A9EFF' },
  choiceChipText: { color: '#8B9CC8', fontSize: 13 },
  choiceChipActiveText: { color: '#4A9EFF', fontWeight: '600' },
  helperModeBadge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  helperModeBadgeCloud: { color: '#FBBF24', backgroundColor: '#3A2A0A' },
  helperModeBadgeLocal: { color: '#34D399', backgroundColor: '#0D2F28' },
  toneRow: { backgroundColor: '#1A2340', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  toneRowActive: { backgroundColor: '#1A3A6B', borderColor: '#4A9EFF' },
  toneLabel: { color: '#CBD5E1', textTransform: 'capitalize' },
  toneLabelActive: { color: '#4A9EFF', fontWeight: '600' },
  emoji: { fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#1F2937', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  backBtn: { backgroundColor: '#1A2340', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  backBtnText: { color: '#8B9CC8', fontWeight: '600' },
  nextBtn: { backgroundColor: '#1A3A6B', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginLeft: 'auto' },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#4A9EFF', fontWeight: '700' },
  importBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#1A2340', borderRadius: 10, borderWidth: 1, borderColor: '#4A5568', paddingHorizontal: 12, paddingVertical: 9 },
  importBtnText: { color: '#8B9CC8', fontSize: 13, fontWeight: '600' },
});
