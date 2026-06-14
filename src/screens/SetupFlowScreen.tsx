import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  AppState,
  useWindowDimensions,
} from 'react-native';
import InnerSpaceLogo from '../components/InnerSpaceLogo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
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
  LOCAL_RUNTIME_KEY,
  DEFAULT_LOCAL_RUNTIME,
  LOCAL_MODEL_KEY,
  USER_PROFILE_KEY,
  getAgeGroup,
  getLocalModelById,
} from '../constants/local-models';
import type { ToneOption, AIMode, LocalModel, LocalRuntime } from '../types';
import {
  downloadLocalModel,
  cancelModelDownload,
  getLocalModelDownloadStatus,
  type LocalModelDownloadStatus,
} from '../services/local-llm-service';
import { isMediaPipeGemma2BAvailable } from '../services/local-mediapipe-service';

const ONBOARDING_DONE_KEY = '@innerspace:onboarding_done';
const LANG_KEY = '@innerspace:language';
const TONE_KEY = '@innerspace:tone';
const SELECTED_HELPERS_KEY = '@innerspace:selected_helpers';
const AI_PROVIDER_KEY = '@innerspace:ai_provider';
const API_KEY_STORE = 'innerspace_api_key';

function providerApiKeyStore(provider: string): string {
  return `${API_KEY_STORE}_${provider}`;
}

const TONES: ToneOption[] = ['warm', 'direct', 'motivational'];
const TOTAL_STEPS = 6;

const SPLASH_FEATURES = [
  { emoji: '💬', title: 'Someone to talk to', desc: 'Dozens of helpers — for confidence, anxiety, career, relationships, and more. Like texting a knowledgeable friend.' },
  { emoji: '✅', title: 'Build habits that stick', desc: 'Check off daily and weekly habits, build streaks, and earn XP as you grow — one small win at a time.' },
  { emoji: '✍️', title: 'A space to reflect', desc: 'Gentle daily prompts to help you understand yourself. Your journal is yours alone.' },
  { emoji: '🎯', title: 'Think decisions through', desc: 'When you\'re stuck between choices, talk it through. You\'ll often know the answer — you just need to say it out loud.' },
  { emoji: '🔒', title: 'Private by default', desc: 'Your conversations stay on your device. Nothing is shared without you knowing. Your space, your rules.' },
];

export default function SetupFlowScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [step, setStep] = useState(1);

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalNoticeText, setLegalNoticeText] = useState('');

  const [userName, setUserName] = useState('');
  const [userAge, setUserAge] = useState('');

  const [aiMode, setAiMode] = useState<AIMode>('cloud');
  const [selectedLocalRuntime, setSelectedLocalRuntime] = useState<LocalRuntime>(DEFAULT_LOCAL_RUNTIME);
  const [selectedLocalModel, setSelectedLocalModel] = useState<LocalModel>('llama321b');
  const [selectedCloudProvider, setSelectedCloudProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showApiHelp, setShowApiHelp] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Partial<Record<LocalModel, LocalModelDownloadStatus>>>({});
  const [downloadingModelId, setDownloadingModelId] = useState<LocalModel | null>(null);
  const [downloadStalled, setDownloadStalled] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const downloadStalledTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const splashScrollRef = useRef<ScrollView>(null);
  const [splashSlideIndex, setSplashSlideIndex] = useState(0);
  const splashAutoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const splashCurrentIdx = useRef(0);

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
    if (!settingUp) return;
    splashAutoTimer.current = setInterval(() => {
      const next = (splashCurrentIdx.current + 1) % SPLASH_FEATURES.length;
      splashCurrentIdx.current = next;
      setSplashSlideIndex(next);
      splashScrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
    }, 3000);
    return () => { if (splashAutoTimer.current) clearInterval(splashAutoTimer.current); };
  }, [settingUp, screenWidth]);

  useEffect(() => {
    if (aiMode !== 'local') return;
    setSelectedHelpers((prev) => prev.filter((id) => {
      const agent = helperPool.find((item) => item.id === id);
      return agent?.minimumAIMode !== 'cloud';
    }));
  }, [aiMode, helperPool]);

  // Refresh statuses whenever the app comes back to foreground (picks up background downloads)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshLocalStatuses();
    });
    return () => sub.remove();
  }, []);

  // Poll every 2 s while any model is actively downloading
  const anyModelDownloading = Object.values(localStatuses).some((s) => s?.downloading);
  useEffect(() => {
    if (!anyModelDownloading) return;
    const interval = setInterval(refreshLocalStatuses, 2000);
    return () => clearInterval(interval);
  }, [anyModelDownloading]);

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

  async function finishSetup() {
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
        ? Promise.all([
          AsyncStorage.setItem(LOCAL_RUNTIME_KEY, selectedLocalRuntime),
          AsyncStorage.setItem(LOCAL_MODEL_KEY, selectedLocalModel),
        ])
        : AsyncStorage.setItem(AI_PROVIDER_KEY, selectedCloudProvider),
    ]);
    if (aiMode === 'cloud' && apiKey.trim()) {
      await Promise.all([
        SecureStore.setItemAsync(providerApiKeyStore(selectedCloudProvider), apiKey.trim()),
        SecureStore.setItemAsync(API_KEY_STORE, apiKey.trim()),
      ]);
    }
    await i18n.changeLanguage(language);
    navigation.replace('Main');
  }

  async function completeSetup() {
    if (aiMode === 'local') {
      if (selectedLocalRuntime === 'mediapipe') {
        const available = await isMediaPipeGemma2BAvailable();
        if (!available) {
          Alert.alert('Offline helper not ready', 'This build doesn\'t include the offline helper. Please use a connected helper for now.');
          return;
        }
      } else {
        const status = await getLocalModelDownloadStatus(selectedLocalModel);
        if (!status.downloaded) {
          // Show splash immediately with whatever progress we already have (may be mid-download)
          setSettingUp(true);
          setSetupProgress(status.progress);

          // Poll every 500 ms so the splash bar moves even when downloadLocalModel
          // skips the onProgress callback because a background download is already in flight.
          const pollInterval = setInterval(async () => {
            const s = await getLocalModelDownloadStatus(selectedLocalModel);
            setSetupProgress(s.progress);
          }, 500);

          try {
            await downloadLocalModel(selectedLocalModel, (progress) => {
              setSetupProgress(progress);
            });
          } catch (err: any) {
            clearInterval(pollInterval);
            setSettingUp(false);
            Alert.alert('Download failed', String(err?.message ?? err));
            return;
          }
          clearInterval(pollInterval);
          setSettingUp(false);
        }
      }
    }

    await finishSetup();
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
    await cancelModelDownload(selectedLocalModel);
    setDownloadStalled(false);
    if (downloadStalledTimer.current) clearTimeout(downloadStalledTimer.current);
    downloadStalledTimer.current = setTimeout(() => setDownloadStalled(true), 30000);
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
            ...prev[selectedLocalModel],
            downloaded: false,
            downloading: true,
            progress,
            bytesWritten: prev[selectedLocalModel]?.bytesWritten ?? 0,
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
      setDownloadStalled(false);
    } finally {
      setDownloadingModelId(null);
      if (downloadStalledTimer.current) clearTimeout(downloadStalledTimer.current);
    }
  }

  if (settingUp) {
    const totalMB = Math.round((getLocalModelById(selectedLocalModel)?.sizeGB ?? 1.2) * 1000);
    const doneMB = Math.round(setupProgress * totalMB);
    return (
      <SafeAreaView style={styles.splashRoot}>
        <View style={styles.splashLogoArea}>
          <InnerSpaceLogo size={80} />
          <Text style={styles.splashAppName}>InnerSpace</Text>
          <Text style={styles.splashTagline}>Getting everything ready for you…</Text>
        </View>

        <View style={styles.splashProgressArea}>
          <View style={styles.splashProgressTrack}>
            <View style={[styles.splashProgressFill, { width: `${Math.round(setupProgress * 100)}%` as any }]} />
          </View>
          <Text style={styles.splashProgressLabel}>
            {setupProgress > 0
              ? `${Math.round(setupProgress * 100)}% · ${doneMB} MB / ${totalMB} MB`
              : 'Downloading offline helper… this takes a few minutes'}
          </Text>
        </View>

        <ScrollView
          ref={splashScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: screenWidth, flexGrow: 0 }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            splashCurrentIdx.current = idx;
            setSplashSlideIndex(idx);
          }}
        >
          {SPLASH_FEATURES.map((f, i) => (
            <View key={i} style={{ width: screenWidth, paddingHorizontal: 20 }}>
              <View style={styles.splashSlide}>
                <Text style={styles.splashSlideEmoji}>{f.emoji}</Text>
                <Text style={styles.splashSlideTitle}>{f.title}</Text>
                <Text style={styles.splashSlideDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.splashDots}>
          {SPLASH_FEATURES.map((_, i) => (
            <View key={i} style={[styles.splashDot, i === splashSlideIndex && styles.splashDotActive]} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('setup.title')}</Text>
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i < step ? styles.stepDotDone : i === step - 1 ? styles.stepDotActive : styles.stepDotFuture,
              ]}
            />
          ))}
        </View>
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
                {acceptedLegal && <Feather name="check" size={12} color="#4A9EFF" />}
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
              placeholderTextColor={colors.textDim}
              value={userName}
              onChangeText={setUserName}
              maxLength={40}
              autoCapitalize="words"
            />
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>{t('setup.profile_age_label')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('setup.profile_age_placeholder')}
              placeholderTextColor={colors.textDim}
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
                <View style={styles.recommendedModelCard}>
                  <View style={styles.recommendedModelHeader}>
                    <Text style={styles.recommendedModelBadge}>⭐ We recommend this one</Text>
                  </View>
                  <Text style={styles.recommendedModelName}>Your offline helper · Llama 3.2</Text>
                  <Text style={styles.recommendedModelDesc}>
                    Fast, private, and lives entirely on your phone. No internet needed once it's set up.
                  </Text>
                  <Text style={styles.recommendedModelSize}>📦 About 1.2 GB · We'll set it up when you tap Continue</Text>
                  {(downloadingModelId === 'llama321b' || localStatuses['llama321b']?.downloading) && (() => {
                    const pct = Math.round((localStatuses['llama321b']?.progress || 0) * 100);
                    const totalMB = Math.round((getLocalModelById(selectedLocalModel)?.sizeGB ?? 1.2) * 1000);
                    const mbDone = Math.round((localStatuses['llama321b']?.progress || 0) * totalMB);
                    return (
                      <View style={{ marginTop: 12 }}>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                        </View>
                        <Text style={styles.progressText}>
                          {pct > 0
                            ? `${pct}% · ${mbDone} MB / ${totalMB} MB downloaded`
                            : 'Starting download…'}
                        </Text>
                        <Text style={styles.progressHint}>
                          Please keep the app open until the download completes.
                        </Text>
                      </View>
                    );
                  })()}
                  {localStatuses['llama321b']?.downloaded && (
                    <Text style={[styles.progressText, { color: '#22C55E', marginTop: 8 }]}>✓ All set — ready to go!</Text>
                  )}
                </View>
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
                      placeholderTextColor={colors.textDim}
                      value={apiKey}
                      onChangeText={setApiKey}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowApiHelp((v) => !v)} style={styles.helpToggle}>
                      <Text style={styles.helpToggleText}>
                        {showApiHelp ? '▲ Hide' : `▼ How do I get access for ${selectedToolInfo.label}?`}
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
                      {isCloudOnly ? '🌐' : '📱'}
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
            onPress={() => {
              if (step === 3 && aiMode === 'local' && !localStatuses['llama321b']?.downloaded && downloadingModelId !== 'llama321b') {
                setSelectedLocalModel('llama321b');
                setSelectedLocalRuntime('executorch');
                handleDownloadSelectedModel();
              }
              setStep((s) => s + 1);
            }}
            disabled={step === 1 && !acceptedLegal}
          >
            <Text style={styles.nextBtnText}>{t('setup.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={async () => {
            try {
              await completeSetup();
            } catch (err) {
              Alert.alert('Something didn\'t go as planned', String((err as any)?.message ?? err));
            }
          }}>
            <Text style={styles.nextBtnText}>{t('setup.start_app')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(c: typeof DARK_COLORS, isDark: boolean) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  splashRoot: { flex: 1, backgroundColor: '#070D1A', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 36 },
  splashLogoArea: { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  splashAppName: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  splashTagline: { fontSize: 15, color: '#94A3B8', textAlign: 'center' },
  splashProgressArea: { width: '100%', paddingHorizontal: 32, gap: 8 },
  splashProgressTrack: { height: 6, borderRadius: 999, backgroundColor: '#1E2A3A', overflow: 'hidden' },
  splashProgressFill: { height: '100%', backgroundColor: '#5BA8FF', borderRadius: 999 },
  splashProgressLabel: { color: '#5BA8FF', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  splashSlide: { backgroundColor: '#0F1B2D', borderRadius: 24, padding: 28, alignItems: 'center', gap: 14, marginRight: 12, borderWidth: 1, borderColor: '#1E2D42' },
  splashSlideEmoji: { fontSize: 54 },
  splashSlideTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  splashSlideDesc: { fontSize: 14, color: '#8B9CC8', textAlign: 'center', lineHeight: 22 },
  splashDots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  splashDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E2D42' },
  splashDotActive: { width: 18, backgroundColor: '#4A9EFF' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: c.textMuted, marginTop: 4, fontSize: 13 },
  stepDots: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 2 },
  stepDot: { height: 6, borderRadius: 3 },
  stepDotDone: { width: 16, backgroundColor: c.accent },
  stepDotActive: { width: 24, backgroundColor: c.accent },
  stepDotFuture: { width: 8, backgroundColor: c.surfaceAlt },
  body: { flex: 1 },
  bodyContent: { padding: 16 },
  card: { backgroundColor: c.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: c.border },
  cardTitle: { fontSize: 22, color: c.text, fontWeight: '800', marginBottom: 8, letterSpacing: -0.2 },
  cardText: { fontSize: 14, color: c.textSecondary, marginBottom: 14, lineHeight: 22 },
  cardHint: { fontSize: 12, color: c.textDim, marginTop: 12 },
  noticeBox: { backgroundColor: c.background, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 12 },
  regionTag: { color: c.accent, fontSize: 12, marginBottom: 10 },
  noticeBullet: { fontSize: 12, lineHeight: 18, color: c.textSecondary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: c.textDim, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: c.accentBg, borderColor: c.accent },
  checkMark: { color: c.accent, fontSize: 12, fontWeight: '700' },
  checkText: { color: c.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 },
  inputLabel: { color: c.textMuted, fontSize: 13, marginBottom: 6 },
  textInput: { backgroundColor: c.background, borderRadius: 10, borderWidth: 1, borderColor: c.border, color: c.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeChip: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, alignItems: 'center' },
  modeChipActive: { backgroundColor: c.accentBg, borderColor: c.accent },
  modeEmoji: { fontSize: 22, marginBottom: 4 },
  modeLabel: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
  modeLabelActive: { color: c.accent },
  modeDesc: { color: c.textDim, fontSize: 11, textAlign: 'center', marginTop: 4 },
  sectionLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  modelRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, gap: 10 },
  modelRowActive: { backgroundColor: c.accentBg, borderColor: c.accent },
  modelRowDisabled: { opacity: 0.45 },
  modelLabel: { color: c.text, fontWeight: '600', fontSize: 13 },
  modelDesc: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  modelSize: { color: c.textDim, fontSize: 12 },
  modelEmoji: { fontSize: 18 },
  apiKeySection: { marginTop: 12 },
  apiKeyLabel: { color: c.textMuted, fontSize: 13, marginBottom: 6 },
  helpToggle: { marginTop: 6 },
  helpToggleText: { color: c.accent, fontSize: 12 },
  helpBox: { backgroundColor: c.background, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, marginTop: 6 },
  helpText: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
  helpLink: { color: c.accent, fontSize: 11, marginTop: 4 },
  downloadCard: {
    backgroundColor: c.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    marginTop: 8,
  },
  downloadTitle: { color: c.text, fontSize: 13, fontWeight: '600' },
  downloadHint: { color: c.textMuted, fontSize: 12, marginTop: 4, lineHeight: 18 },
  downloadBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: c.accentBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  downloadBtnDisabled: { opacity: 0.65 },
  downloadBtnText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent,
  },
  progressText: { color: c.textMuted, fontSize: 12, marginTop: 6 },
  progressHint: { color: c.textMuted, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  stallRow: { marginTop: 10, gap: 8 },
  stallText: { fontSize: 12, color: '#F59E0B', fontStyle: 'italic' },
  stallBtn: { backgroundColor: c.accentBg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  stallBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
  stallBtnSecondary: { backgroundColor: c.surfaceAlt },
  stallBtnSecondaryText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  recommendedModelCard: { backgroundColor: '#0F2040', borderRadius: 14, borderWidth: 1.5, borderColor: '#4A9EFF', padding: 16, marginTop: 12 },
  recommendedModelHeader: { marginBottom: 6 },
  recommendedModelBadge: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
  recommendedModelName: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  recommendedModelDesc: { color: '#8B9CC8', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  recommendedModelSize: { color: '#5A6478', fontSize: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { backgroundColor: c.surfaceAlt, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceChipActive: { backgroundColor: c.accentBg, borderColor: c.accent },
  choiceChipText: { color: c.textMuted, fontSize: 13 },
  choiceChipActiveText: { color: c.accent, fontWeight: '600' },
  helperModeBadge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  helperModeBadgeCloud: { color: '#FBBF24', backgroundColor: '#3A2A0A' },
  helperModeBadgeLocal: { color: '#34D399', backgroundColor: '#0D2F28' },
  toneRow: { backgroundColor: c.surfaceAlt, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  toneRowActive: { backgroundColor: c.accentBg, borderColor: c.accent },
  toneLabel: { color: c.textSecondary, textTransform: 'capitalize' },
  toneLabelActive: { color: c.accent, fontWeight: '600' },
  emoji: { fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#1F2937', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  backBtn: { backgroundColor: c.surfaceAlt, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  backBtnText: { color: c.textMuted, fontWeight: '600' },
  nextBtn: { backgroundColor: c.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginLeft: 'auto' },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  importBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: c.textDim, paddingHorizontal: 12, paddingVertical: 9 },
  importBtnText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
});
}


