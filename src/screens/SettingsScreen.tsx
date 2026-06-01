import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  StatusBar as RNStatusBar,
  Switch,
  Linking,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/auth';
import { clearStorage } from '../services/storage-service';
import { exportBackupAndShare, importBackupFromFile } from '../services/backup-service';
import i18n, { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';
import type { ToneOption, AIMode, LocalModel } from '../types';
import {
  LOCAL_MODELS,
  AI_MODE_KEY,
  LOCAL_MODEL_KEY,
  USER_PROFILE_KEY,
  getAgeGroup,
} from '../constants/local-models';
import {
  canUseBiometric,
  clearAppPin,
  getLockEnabled,
  getLockMode,
  hasAppPin,
  saveAppPin,
  setLockEnabled,
  setLockMode,
  type AppLockMode,
} from '../services/app-lock';
import { LEGAL_ACK_KEY, getEffectiveLegalNoticeText } from '../constants/legal-notice';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';
import {
  downloadLocalModel,
  getLocalModelDownloadStatus,
  type LocalModelDownloadStatus,
} from '../services/local-llm-service';

const TONE_KEY = '@innerspace:tone';
const LANG_KEY = '@innerspace:language';
const API_KEY_STORE = 'innerspace_api_key';
const AI_PROVIDER_KEY = '@innerspace:ai_provider';
type AIProvider = 'gemini' | 'openai' | 'claude' | 'groq';
const ONBOARDING_DONE_KEY = '@innerspace:onboarding_done';
const CREDIT_NAME = 'Amit Gaikwad';
const CREDIT_ROLE = 'Creator, Product & Engineering';
const CREDIT_WEBSITE = 'https://github.com/amitgaikwad2837/InnerSpace';
const CREDIT_LINKEDIN = 'https://www.linkedin.com/in/amit-gaikwad';
const APP_WEBSITE_URL = 'https://amitgaikwad2837.github.io/InnerSpace/';
const PRIVACY_URL = 'https://amitgaikwad2837.github.io/InnerSpace/privacy.html';
const TERMS_URL = 'https://amitgaikwad2837.github.io/InnerSpace/terms.html';

type ExpoExtra = {
  rateAppUrl?: string;
  shareAppUrl?: string;
};

const TONES: { key: ToneOption; labelKey: string; desc: string }[] = [
  {
    key: 'warm',
    labelKey: 'settings.tone_warm',
    desc: 'Friendly, encouraging, and empathetic',
  },
  {
    key: 'direct',
    labelKey: 'settings.tone_direct',
    desc: 'Clear, concise, no fluff',
  },
  {
    key: 'motivational',
    labelKey: 'settings.tone_motivational',
    desc: 'High energy, action-oriented',
  },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { email } = useAuthStore();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const [tone, setTone] = useState<ToneOption>('warm');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [lockMode, setAppLockMode] = useState<AppLockMode>('pin');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasPin, setHasPin] = useState(false);
  // Profile
  const [profileName, setProfileName] = useState('');
  const [profileAge, setProfileAge] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  // AI Mode
  const [aiMode, setAiMode] = useState<AIMode>('cloud');
  const [localModelId, setLocalModelId] = useState<LocalModel>('llama321b');
  const [localStatuses, setLocalStatuses] = useState<Record<string, LocalModelDownloadStatus>>({});
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);

  // Load saved prefs
  useEffect(() => {
    async function load() {
      const [savedTone, savedLang, savedKey, savedProvider] = await Promise.all([
        AsyncStorage.getItem(TONE_KEY),
        AsyncStorage.getItem(LANG_KEY),
        SecureStore.getItemAsync(API_KEY_STORE),
        AsyncStorage.getItem(AI_PROVIDER_KEY),
      ]);
      if (savedTone) setTone(savedTone as ToneOption);
      if (savedLang) setLanguage(savedLang as LanguageCode);
      if (savedProvider) setAiProvider(savedProvider as AIProvider);
      if (savedKey) {
        setApiKey(savedKey);
        setUseCustomKey(true);
      }

      const [profileRaw, savedMode, savedModelId] = await Promise.all([
        AsyncStorage.getItem(USER_PROFILE_KEY),
        AsyncStorage.getItem(AI_MODE_KEY),
        AsyncStorage.getItem(LOCAL_MODEL_KEY),
      ]);
      if (profileRaw) {
        try {
          const p = JSON.parse(profileRaw);
          if (p.name) setProfileName(p.name);
          if (p.age != null) setProfileAge(String(p.age));
        } catch { /* ignore */ }
      }
      if (savedMode) setAiMode(savedMode as AIMode);
      if (savedModelId) setLocalModelId(savedModelId as LocalModel);

      const statuses = await Promise.all(
        LOCAL_MODELS.map(async (model) => [model.id, await getLocalModelDownloadStatus(model.id)] as const),
      );
      setLocalStatuses(Object.fromEntries(statuses));

      const [enabled, mode, bioAvailable, pinExists] = await Promise.all([
        getLockEnabled(),
        getLockMode(),
        canUseBiometric(),
        hasAppPin(),
      ]);
      setAppLockEnabled(enabled);
      setAppLockMode(mode);
      setBiometricAvailable(bioAvailable);
      setHasPin(pinExists);
    }
    load();
  }, []);

  async function handleLockToggle(enabled: boolean) {
    if (enabled && (lockMode === 'pin' || lockMode === 'both') && !hasPin) {
      Alert.alert(t('settings.lock_set_pin_first_title'), t('settings.lock_set_pin_first_body'));
      return;
    }
    if (enabled && (lockMode === 'biometric' || lockMode === 'both') && !biometricAvailable) {
      Alert.alert(t('settings.lock_bio_unavailable_title'), t('settings.lock_bio_unavailable_body'));
      return;
    }
    setAppLockEnabled(enabled);
    await setLockEnabled(enabled);
  }

  async function handleLockModeChange(mode: AppLockMode) {
    if ((mode === 'pin' || mode === 'both') && !hasPin) {
      Alert.alert(t('settings.lock_set_pin_first_title'), t('settings.lock_mode_requires_pin'));
      return;
    }
    if ((mode === 'biometric' || mode === 'both') && !biometricAvailable) {
      Alert.alert(t('settings.lock_bio_unavailable_title'), t('settings.lock_bio_unavailable_body'));
      return;
    }
    setAppLockMode(mode);
    await setLockMode(mode);
  }

  async function handleSavePin() {
    if (pin.length < 4 || pin.length > 6) {
      Alert.alert(t('settings.lock_invalid_pin_title'), t('settings.lock_invalid_pin_body'));
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert(t('settings.lock_pin_mismatch_title'), t('settings.lock_pin_mismatch_body'));
      return;
    }
    await saveAppPin(pin);
    setHasPin(true);
    setPin('');
    setConfirmPin('');
    Alert.alert(t('general.done'), t('settings.lock_pin_updated'));
  }

  async function handleClearPin() {
    await clearAppPin();
    setHasPin(false);
    setPin('');
    setConfirmPin('');
    if (lockMode === 'pin' || lockMode === 'both') {
      setAppLockEnabled(false);
      await setLockEnabled(false);
      await setLockMode('biometric');
      setAppLockMode('biometric');
    }
    Alert.alert(t('general.done'), t('settings.lock_pin_removed'));
  }

  async function saveTone(t: ToneOption) {
    setTone(t);
    await AsyncStorage.setItem(TONE_KEY, t);
  }

  async function saveLanguage(lang: LanguageCode) {
    setLanguage(lang);
    await AsyncStorage.setItem(LANG_KEY, lang);
    i18n.changeLanguage(lang);
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const ageNum = parseInt(profileAge, 10);
      const validAge = !Number.isNaN(ageNum) && ageNum >= 13 && ageNum <= 120 ? ageNum : null;
      const ageGroup = getAgeGroup(validAge);
      const profile = { name: profileName.trim(), age: validAge, ageGroup };
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
      Alert.alert(t('general.done'), t('settings.profile_saved'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function refreshLocalStatuses() {
    const statuses = await Promise.all(
      LOCAL_MODELS.map(async (model) => [model.id, await getLocalModelDownloadStatus(model.id)] as const),
    );
    setLocalStatuses(Object.fromEntries(statuses));
  }

  async function handleDownloadSelectedLocalModel() {
    try {
      setDownloadingModelId(localModelId);
      setLocalStatuses((prev) => ({
        ...prev,
        [localModelId]: {
          downloaded: false,
          downloading: true,
          progress: 0,
          supported: prev[localModelId]?.supported ?? true,
          available: prev[localModelId]?.available ?? true,
        },
      }));
      await downloadLocalModel(localModelId, (progress) => {
        setLocalStatuses((prev) => ({
          ...prev,
          [localModelId]: {
            downloaded: false,
            downloading: true,
            progress,
            supported: prev[localModelId]?.supported ?? true,
            available: prev[localModelId]?.available ?? true,
          },
        }));
      });
      await refreshLocalStatuses();
    } catch (error: any) {
      Alert.alert(
        t('settings.download_failed_title', { defaultValue: 'Download failed' }),
        String(error?.message ?? error),
      );
      await refreshLocalStatuses();
    } finally {
      setDownloadingModelId(null);
    }
  }

  async function handleSaveAiMode() {
    if (aiMode === 'local') {
      const status = await getLocalModelDownloadStatus(localModelId);
      if (!status.downloaded) {
        Alert.alert(
          t('settings.download_model_alert_title', { defaultValue: 'Download model first' }),
          t('settings.download_model_alert_body', { defaultValue: 'Please download the selected on-device model before switching to local AI mode.' }),
        );
        return;
      }
    }

    await Promise.all([
      AsyncStorage.setItem(AI_MODE_KEY, aiMode),
      aiMode === 'local'
        ? AsyncStorage.setItem(LOCAL_MODEL_KEY, localModelId)
        : AsyncStorage.setItem(AI_PROVIDER_KEY, aiProvider),
    ]);
    Alert.alert(t('general.done'), t('settings.ai_mode_saved'));
  }

  async function saveApiKey() {
    setSaving(true);
    try {
      await AsyncStorage.setItem(AI_PROVIDER_KEY, aiProvider);
      if (useCustomKey && apiKey.trim()) {
        await SecureStore.setItemAsync(API_KEY_STORE, apiKey.trim());
        Alert.alert('Saved', t('settings.api_key_saved'));
      } else {
        await SecureStore.deleteItemAsync(API_KEY_STORE);
        setApiKey('');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      const result = await exportBackupAndShare();
      if (!result.shared) {
        Alert.alert(t('settings.exported_title'), t('settings.exported_path', { path: result.path }));
      }
    } catch {
      Alert.alert(t('general.error'), t('settings.export_failed'));
    }
  }

  async function handleImportBackup() {
    try {
      const result = await importBackupFromFile();
      if (result.cancelled) return;
      Alert.alert(
        t('settings.import_complete_title'),
        t('settings.import_complete_body', { count: result.restoredKeys }),
        [
          { text: t('settings.import_later'), style: 'cancel' },
          { text: t('settings.import_run_setup_now'), onPress: handleRerunSetup },
        ],
      );
    } catch {
      Alert.alert(t('settings.import_failed_title'), t('settings.import_failed_body'));
    }
  }

  async function handleDeleteAll() {
    Alert.alert(
      t('settings.delete_account'),
      t('settings.delete_confirm'),
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await clearStorage();
            await SecureStore.deleteItemAsync(API_KEY_STORE);
          },
        },
      ],
    );
  }

  async function handleRerunSetup() {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'false');
    navigation.navigate('SetupFlow');
  }

  async function handleViewLegalNotice() {
    const noticeText = await getEffectiveLegalNoticeText();
    Alert.alert(
      t('settings.legal_notice_title'),
      noticeText,
      [{ text: 'OK' }],
      { cancelable: true },
    );
  }

  async function handleReAcceptLegal() {
    await Promise.all([
      AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'false'),
      AsyncStorage.setItem(LEGAL_ACK_KEY, ''),
    ]);
    navigation.navigate('SetupFlow');
  }

  async function handleRateApp() {
    try {
      const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
      const rateUrl = extra.rateAppUrl || extra.shareAppUrl || APP_WEBSITE_URL;
      const supported = await Linking.canOpenURL(rateUrl);
      if (!supported) {
        Alert.alert('Rate InnerSpace', `Please rate us here: ${rateUrl}`);
        return;
      }
      await Linking.openURL(rateUrl);
    } catch {
      Alert.alert('Rate InnerSpace', 'Unable to open the rating page right now.');
    }
  }

  async function handleShareApp() {
    try {
      const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
      const shareUrl = extra.shareAppUrl || APP_WEBSITE_URL;
      await Share.share({
        message: `I am using InnerSpace for habits, reflection, and AI support. Try it here: ${shareUrl}`,
      });
    } catch {
      Alert.alert('Share InnerSpace', 'Unable to open the share sheet right now.');
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile */}
        <Section title={t('settings.profile')}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color="#4A9EFF" />
            </View>
            <Text style={styles.emailText}>{email || t('settings.guest_mode')}</Text>
          </View>
        </Section>
        <Section title={t('settings.profile_info')}>
          <Text style={styles.fieldLabel}>{t('settings.profile_name_label')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={t('settings.profile_name_placeholder')}
            placeholderTextColor="#5A6478"
            value={profileName}
            onChangeText={setProfileName}
            maxLength={40}
            autoCapitalize="words"
          />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('settings.profile_age_label')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={t('settings.profile_age_placeholder')}
            placeholderTextColor="#5A6478"
            value={profileAge}
            onChangeText={(v) => setProfileAge(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
          <TouchableOpacity
            style={[styles.saveKeyBtn, { alignSelf: 'flex-start', marginTop: 12 }, savingProfile && { opacity: 0.6 }]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
          >
            <Text style={styles.saveKeyText}>{t('settings.save_profile')}</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Appearance">
          <View style={styles.modeRow}>
            {([['dark', '🌙 Dark'], ['light', '☀️ Light'], ['system', '⚙️ System']] as const).map(([m, label]) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeChip, themeMode === m && styles.modeChipActive]}
                onPress={() => setThemeMode(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeChipText, themeMode === m && styles.modeChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Language */}
        <Section title={t('settings.language')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langChip, language === lang.code && styles.langChipActive]}
                onPress={() => saveLanguage(lang.code)}
                activeOpacity={0.8}
              >
                <Text style={[styles.langText, language === lang.code && styles.langTextActive]}>
                  {lang.nativeName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>

        {/* Tone */}
        <Section title={t('settings.tone')}>
          {TONES.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.toneRow, tone === opt.key && styles.toneRowActive]}
              onPress={() => saveTone(opt.key)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.toneLabel, tone === opt.key && styles.toneLabelActive]}>
                  {t(opt.labelKey)}
                </Text>
                <Text style={styles.toneDesc}>{opt.desc}</Text>
              </View>
              {tone === opt.key && (
                <Ionicons name="checkmark-circle" size={20} color="#4A9EFF" />
              )}
            </TouchableOpacity>
          ))}
        </Section>

        {/* AI Provider / BYOK */}
        <Section title={t('settings.ai_provider')}>
          {/* AI Mode toggle — local vs cloud */}
          <Text style={styles.providerLabel}>{t('settings.ai_mode_label')}</Text>
          <View style={styles.providerChipRow}>
            {(['local', 'cloud'] as AIMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.providerChip, aiMode === m && styles.providerChipActive]}
                onPress={() => setAiMode(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.providerChipText, aiMode === m && styles.providerChipTextActive]}>
                  {m === 'local' ? `📱 ${t('settings.ai_mode_local')}` : `☁️ ${t('settings.ai_mode_cloud')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {aiMode === 'local' && (
            <>
              <Text style={styles.providerLabel}>{t('settings.local_model_label')}</Text>
              {LOCAL_MODELS.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.toneRow,
                    localModelId === model.id && styles.toneRowActive,
                    !model.supported && { opacity: 0.45 },
                  ]}
                  onPress={() => {
                    if (!model.supported) return;
                    setLocalModelId(model.id);
                  }}
                  activeOpacity={0.85}
                  disabled={!model.supported}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toneLabel, localModelId === model.id && styles.toneLabelActive]}>
                      {model.label}
                    </Text>
                    <Text style={styles.toneDesc}>
                      {model.description} {model.supported ? `· ${model.sizeGB} GB` : '· Coming soon'}
                    </Text>
                  </View>
                  {model.supported && localModelId === model.id && <Ionicons name="checkmark-circle" size={20} color="#4A9EFF" />}
                </TouchableOpacity>
              ))}
              {localStatuses[localModelId]?.supported && (
                <View style={styles.localDownloadCard}>
                  <Text style={styles.localDownloadTitle}>
                    {localStatuses[localModelId]?.downloaded
                      ? t('settings.model_downloaded', { defaultValue: 'Model downloaded and ready' })
                      : localStatuses[localModelId]?.downloading
                        ? t('settings.model_downloading', { defaultValue: 'Downloading model...' })
                        : t('settings.model_not_downloaded', { defaultValue: 'Model not downloaded yet' })}
                  </Text>
                  <Text style={styles.localDownloadHint}>
                    {localStatuses[localModelId]?.downloaded
                      ? t('settings.model_ready_hint', { defaultValue: 'You can switch to local mode immediately.' })
                      : t('settings.model_download_hint', { defaultValue: 'Download the selected model now so local chats work immediately.' })}
                  </Text>
                  {!localStatuses[localModelId]?.downloaded && (
                    <>
                      <TouchableOpacity
                        style={[styles.saveKeyBtn, { alignSelf: 'flex-start', marginTop: 10 }, downloadingModelId === localModelId && { opacity: 0.65 }]}
                        onPress={handleDownloadSelectedLocalModel}
                        disabled={downloadingModelId === localModelId}
                      >
                        <Text style={styles.saveKeyText}>
                          {downloadingModelId === localModelId
                            ? t('settings.downloading_model', { defaultValue: 'Downloading...' })
                            : t('settings.download_model', { defaultValue: 'Download model now' })}
                        </Text>
                      </TouchableOpacity>
                      {(localStatuses[localModelId]?.downloading || downloadingModelId === localModelId) && (
                        <>
                          <View style={styles.localProgressTrack}>
                            <View
                              style={[
                                styles.localProgressFill,
                                { width: `${Math.round((localStatuses[localModelId]?.progress ?? 0) * 100)}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.localProgressText}>{Math.round((localStatuses[localModelId]?.progress ?? 0) * 100)}%</Text>
                        </>
                      )}
                    </>
                  )}
                </View>
              )}
            </>
          )}

          {aiMode === 'cloud' && (
            <>
              <View style={styles.geminiStatusRow}>
                <Text style={styles.geminiStatusIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('settings.guest_mode_active')}</Text>
                  <Text style={styles.toggleDesc}>{t('settings.guest_mode_desc')}</Text>
                </View>
              </View>
              <Text style={styles.providerLabel}>{t('settings.ai_provider_label')}</Text>
              <View style={styles.providerChipRow}>
                {(['gemini', 'openai', 'claude', 'groq'] as AIProvider[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.providerChip, aiProvider === p && styles.providerChipActive]}
                    onPress={() => setAiProvider(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.providerChipText, aiProvider === p && styles.providerChipTextActive]}>
                      {t(`settings.provider_${p}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('settings.override_custom_key')}</Text>
                  <Text style={styles.toggleDesc}>{t('settings.override_custom_key_desc')}</Text>
                </View>
                <Switch
                  value={useCustomKey}
                  onValueChange={setUseCustomKey}
                  trackColor={{ false: '#1F2937', true: '#1A3A6B' }}
                  thumbColor={useCustomKey ? '#4A9EFF' : '#5A6478'}
                />
              </View>
              {useCustomKey && (
                <View style={styles.apiKeyRow}>
                  <TextInput
                    style={styles.apiKeyInput}
                    placeholder={t(`settings.api_key_placeholder_${aiProvider}`)}
                    placeholderTextColor="#5A6478"
                    value={apiKey}
                    onChangeText={setApiKey}
                    secureTextEntry={!showApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowApiKey((v) => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showApiKey ? 'eye-off' : 'eye'} size={20} color="#8B9CC8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveKeyBtn, saving && { opacity: 0.6 }]}
                    onPress={saveApiKey}
                    disabled={saving}
                  >
                    <Text style={styles.saveKeyText}>{t('general.save')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          <TouchableOpacity
            style={[styles.saveKeyBtn, { alignSelf: 'flex-start', marginTop: 10 }]}
            onPress={handleSaveAiMode}
          >
            <Text style={styles.saveKeyText}>{t('settings.save_ai_mode')}</Text>
          </TouchableOpacity>
        </Section>

        {/* App Lock */}
        <Section title={t('settings.app_lock')}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{t('settings.require_unlock')}</Text>
              <Text style={styles.toggleDesc}>{t('settings.require_unlock_desc')}</Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={handleLockToggle}
              trackColor={{ false: '#1F2937', true: '#1A3A6B' }}
              thumbColor={appLockEnabled ? '#4A9EFF' : '#5A6478'}
            />
          </View>

          <View style={styles.modeRow}>
            {[
              { key: 'pin', label: 'PIN' },
              { key: 'biometric', label: 'Biometric' },
              { key: 'both', label: 'PIN + Biometric' },
            ].map((mode) => {
              const active = lockMode === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => handleLockModeChange(mode.key as AppLockMode)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{mode.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {(lockMode === 'pin' || lockMode === 'both') && (
            <View style={styles.pinSetupWrap}>
              <TextInput
                style={styles.pinInput}
                placeholder={hasPin ? t('settings.pin_update_placeholder') : t('settings.pin_create_placeholder')}
                placeholderTextColor="#5A6478"
                value={pin}
                onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                style={styles.pinInput}
                placeholder={t('settings.pin_confirm_placeholder')}
                placeholderTextColor="#5A6478"
                value={confirmPin}
                onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
              <View style={styles.pinBtnRow}>
                <TouchableOpacity style={styles.savePinBtn} onPress={handleSavePin}>
                  <Text style={styles.savePinBtnText}>{hasPin ? t('settings.pin_update') : t('settings.pin_save')}</Text>
                </TouchableOpacity>
                {hasPin && (
                  <TouchableOpacity style={styles.clearPinBtn} onPress={handleClearPin}>
                    <Text style={styles.clearPinBtnText}>{t('settings.pin_clear')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {lockMode !== 'pin' && !biometricAvailable && (
            <Text style={styles.lockWarning}>{t('settings.lock_bio_warning')}</Text>
          )}
        </Section>

        {/* Data */}
        <Section title={t('settings.data')}>
          <RowBtn icon="options-outline" label={t('settings.rerun_setup')} onPress={handleRerunSetup} />
          <RowBtn icon="download-outline" label={t('settings.export')} onPress={handleExport} />
          <RowBtn icon="cloud-upload-outline" label={t('settings.import_backup')} onPress={handleImportBackup} />
          <RowBtn icon="trash-outline" label={t('settings.delete_account')} onPress={handleDeleteAll} destructive />
        </Section>

        <Section title={t('settings.legal_privacy')}>
          <RowBtn icon="document-text-outline" label={t('settings.view_legal_notice')} onPress={handleViewLegalNotice} />
          <RowBtn icon="refresh-outline" label={t('settings.review_accept_notice_again')} onPress={handleReAcceptLegal} />
          <RowBtn icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <RowBtn icon="reader-outline" label="Terms of Service" onPress={() => Linking.openURL(TERMS_URL)} />
        </Section>

        <Section title="Support">
          <RowBtn icon="star-outline" label="Rate InnerSpace" onPress={handleRateApp} />
          <RowBtn icon="share-social-outline" label="Share InnerSpace" onPress={handleShareApp} />
        </Section>

        <View style={styles.creditsWrap}>
          <Text style={styles.creditsTitle}>InnerSpace</Text>
          <Text style={styles.creditsText}>Designed and built by {CREDIT_NAME}</Text>
          <Text style={styles.creditsSubText}>{CREDIT_ROLE}</Text>
          <View style={styles.creditsLinksRow}>
            <TouchableOpacity onPress={() => Linking.openURL(CREDIT_WEBSITE)} activeOpacity={0.8}>
              <Text style={styles.creditsLink}>GitHub</Text>
            </TouchableOpacity>
            <Text style={styles.creditsDot}>•</Text>
            <TouchableOpacity onPress={() => Linking.openURL(CREDIT_LINKEDIN)} activeOpacity={0.8}>
              <Text style={styles.creditsLink}>LinkedIn</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function RowBtn({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.rowBtn} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon as any} size={18} color={destructive ? '#EF4444' : '#8B9CC8'} />
      <Text style={[styles.rowBtnLabel, destructive && styles.rowBtnLabelDestructive]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#4A5568" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    paddingTop: RNStatusBar.currentHeight ?? 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A6478',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionBody: {
    backgroundColor: '#111827',
    borderRadius: 14,
    overflow: 'hidden',
    gap: 1,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A2340',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailText: {
    fontSize: 14,
    color: '#CBD5E1',
    flex: 1,
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowBtnLabel: {
    flex: 1,
    fontSize: 15,
    color: '#CBD5E1',
  },
  rowBtnLabelDestructive: {
    color: '#EF4444',
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A2340',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langChipActive: {
    borderColor: '#4A9EFF',
    backgroundColor: '#1A3A6B',
  },
  langText: {
    fontSize: 14,
    color: '#8B9CC8',
  },
  langTextActive: {
    color: '#4A9EFF',
    fontWeight: '600',
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  toneRowActive: {
    backgroundColor: '#0D1B30',
  },
  toneLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 2,
  },
  toneLabelActive: {
    color: '#4A9EFF',
  },
  toneDesc: {
    fontSize: 12,
    color: '#5A6478',
  },
  geminiStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2340',
  },
  geminiStatusIcon: { fontSize: 20, marginTop: 2 },
  // GAP-10: provider chips
  providerLabel: { fontSize: 12, fontWeight: '600', color: '#5A6478', textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 14, paddingBottom: 6 },
  providerChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  providerChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1A2340', borderWidth: 1, borderColor: '#2A3555' },
  fieldLabel: { color: '#8B9CC8', fontSize: 13, marginBottom: 6, paddingHorizontal: 14 },
  fieldInput: {
    backgroundColor: '#0A0F1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    marginHorizontal: 14,
  },
  providerChipActive: { backgroundColor: '#1A3A6B', borderColor: '#4A9EFF' },
  providerChipText: { fontSize: 13, color: '#8B9CC8', fontWeight: '500' },
  providerChipTextActive: { color: '#4A9EFF', fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#CBD5E1',
    fontWeight: '500',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 12,
    color: '#5A6478',
    maxWidth: 220,
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  apiKeyInput: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  saveKeyBtn: {
    backgroundColor: '#1A3A6B',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveKeyText: {
    color: '#4A9EFF',
    fontWeight: '600',
    fontSize: 14,
  },
  localDownloadCard: {
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: '#0A0F1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
  },
  localDownloadTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  localDownloadHint: {
    color: '#8B9CC8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  localProgressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1A2340',
    overflow: 'hidden',
  },
  localProgressFill: {
    height: '100%',
    backgroundColor: '#4A9EFF',
  },
  localProgressText: {
    color: '#8B9CC8',
    fontSize: 12,
    marginTop: 6,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#1A2340',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeChipActive: {
    backgroundColor: '#1A3A6B',
    borderColor: '#4A9EFF',
  },
  modeChipText: {
    color: '#8B9CC8',
    fontSize: 12,
  },
  modeChipTextActive: {
    color: '#4A9EFF',
    fontWeight: '600',
  },
  pinSetupWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  pinInput: {
    backgroundColor: '#0A0F1E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  pinBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  savePinBtn: {
    backgroundColor: '#1A3A6B',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  savePinBtnText: {
    color: '#4A9EFF',
    fontWeight: '600',
    fontSize: 13,
  },
  clearPinBtn: {
    backgroundColor: '#281217',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  clearPinBtnText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 13,
  },
  lockWarning: {
    color: '#EF4444',
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  creditsWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  creditsTitle: {
    color: '#8B9CC8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  creditsText: {
    color: '#5A6478',
    fontSize: 12,
  },
  creditsSubText: {
    color: '#4A5568',
    fontSize: 11,
    marginTop: 3,
  },
  creditsLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  creditsDot: {
    color: '#4A5568',
    fontSize: 11,
  },
  creditsLink: {
    color: '#4A9EFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
