import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Switch,
  Linking,
  Share,
  Image,
  AppState,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/auth';
import { clearStorage } from '../services/storage-service';
import { exportBackupAndShare, importBackupFromFile } from '../services/backup-service';
import i18n, { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';
import type { ToneOption, AIMode, LocalModel, LocalRuntime } from '../types';
import {
  LOCAL_MODELS,
  AI_MODE_KEY,
  LOCAL_RUNTIME_KEY,
  DEFAULT_LOCAL_RUNTIME,
  LOCAL_MODEL_KEY,
  USER_PROFILE_KEY,
  getAgeGroup,
  getLocalModelById,
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
import { useTheme, DARK_COLORS } from '../context/ThemeContext';
import {
  downloadLocalModel,
  cancelModelDownload,
  getLocalModelDownloadStatus,
  type LocalModelDownloadStatus,
} from '../services/local-llm-service';
import {
  isMediaPipeGemma2BAvailable,
  getMediaPipeGemmaModelPath,
  setMediaPipeGemmaModelPath,
} from '../services/local-mediapipe-service';

const TONE_KEY = '@innerspace:tone';
const LANG_KEY = '@innerspace:language';
const API_KEY_STORE = 'innerspace_api_key';
const AI_PROVIDER_KEY = '@innerspace:ai_provider';
type AIProvider = 'gemini' | 'openai' | 'claude' | 'groq';
const AI_PROVIDERS: AIProvider[] = ['gemini', 'openai', 'claude', 'groq'];

function providerApiKeyStore(provider: AIProvider): string {
  return `${API_KEY_STORE}_${provider}`;
}
const ONBOARDING_DONE_KEY = '@innerspace:onboarding_done';
const CREDIT_NAME = 'Amit Gaikwad';
const CREDIT_ROLE = 'Creator, Product & Engineering';
const CREDIT_WEBSITE = 'https://github.com/amitgaikwad2837/InnerSpace';
const CREDIT_LINKEDIN = 'https://www.linkedin.com/in/amit-gaikwad-6385415b/';
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
    desc: 'Like talking to a caring friend — kind, patient, encouraging',
  },
  {
    key: 'direct',
    labelKey: 'settings.tone_direct',
    desc: 'Gets to the point — honest, clear, no filler',
  },
  {
    key: 'motivational',
    labelKey: 'settings.tone_motivational',
    desc: 'High energy — keeps you moving and excited',
  },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email } = useAuthStore();
  const { mode: themeMode, setMode: setThemeMode, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [tone, setTone] = useState<ToneOption>('warm');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [providerKeyStatus, setProviderKeyStatus] = useState<Partial<Record<AIProvider, boolean>>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const expandSection = route.params?.expandSection as string | undefined;
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: !expandSection,
    appearance: false,
    language: false,
    tone: false,
    ai: expandSection === 'ai',
    lock: false,
    data: false,
    legal: false,
    support: false,
  });
  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [lockMode, setAppLockMode] = useState<AppLockMode>('pin');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasPin, setHasPin] = useState(false);
  // Profile
  const [profileName, setProfileName] = useState('');
  const [profileAge, setProfileAge] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  // AI Mode
  const [aiMode, setAiMode] = useState<AIMode>('cloud');
  const [localRuntime, setLocalRuntime] = useState<LocalRuntime>(DEFAULT_LOCAL_RUNTIME);
  const [localModelId, setLocalModelId] = useState<LocalModel>('llama321b');
  const [localStatuses, setLocalStatuses] = useState<Record<string, LocalModelDownloadStatus>>({});
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [mediaPipeAvailable, setMediaPipeAvailable] = useState<boolean | null>(null);
  const [mediaPipeModelPath, setMediaPipeModelPath] = useState('');
  const [savingModelPath, setSavingModelPath] = useState(false);

  // Load saved prefs
  useEffect(() => {
    async function load() {
      const [savedTone, savedLang, savedProvider] = await Promise.all([
        AsyncStorage.getItem(TONE_KEY),
        AsyncStorage.getItem(LANG_KEY),
        AsyncStorage.getItem(AI_PROVIDER_KEY),
      ]);
      if (savedTone) setTone(savedTone as ToneOption);
      if (savedLang) setLanguage(savedLang as LanguageCode);

      const selectedProvider = (savedProvider as AIProvider) || 'gemini';
      setAiProvider(selectedProvider);

      const providerKeyPairs = await Promise.all(
        AI_PROVIDERS.map(async (provider) => {
          const providerKey = await SecureStore.getItemAsync(providerApiKeyStore(provider));
          return [provider, Boolean(providerKey?.trim())] as const;
        }),
      );
      setProviderKeyStatus(Object.fromEntries(providerKeyPairs) as Partial<Record<AIProvider, boolean>>);

      const [selectedProviderKey, legacyKey] = await Promise.all([
        SecureStore.getItemAsync(providerApiKeyStore(selectedProvider)),
        SecureStore.getItemAsync(API_KEY_STORE),
      ]);
      const activeKey = selectedProviderKey?.trim() || legacyKey?.trim() || '';
      if (activeKey) {
        setApiKey(activeKey);
        setUseCustomKey(true);
      }

      const [profileRaw, savedMode, savedRuntime, savedModelId] = await Promise.all([
        AsyncStorage.getItem(USER_PROFILE_KEY),
        AsyncStorage.getItem(AI_MODE_KEY),
        AsyncStorage.getItem(LOCAL_RUNTIME_KEY),
        AsyncStorage.getItem(LOCAL_MODEL_KEY),
      ]);
      if (profileRaw) {
        try {
          const p = JSON.parse(profileRaw);
          if (p.name) setProfileName(p.name);
          if (p.age != null) setProfileAge(String(p.age));
          if (p.photo) setProfilePhoto(p.photo);
        } catch { /* ignore */ }
      }
      if (savedMode) setAiMode(savedMode as AIMode);
      if (savedRuntime) setLocalRuntime(savedRuntime as LocalRuntime);
      if (savedModelId) setLocalModelId(savedModelId as LocalModel);

      const statuses = await Promise.all(
        LOCAL_MODELS.map(async (model) => [model.id, await getLocalModelDownloadStatus(model.id)] as const),
      );
      setLocalStatuses(Object.fromEntries(statuses));

      const [enabled, mode, bioAvailable, pinExists, mpAvailable, mpPath] = await Promise.all([
        getLockEnabled(),
        getLockMode(),
        canUseBiometric(),
        hasAppPin(),
        isMediaPipeGemma2BAvailable(),
        getMediaPipeGemmaModelPath(),
      ]);
      setAppLockEnabled(enabled);
      setAppLockMode(mode);
      setBiometricAvailable(bioAvailable);
      setHasPin(pinExists);
      setMediaPipeAvailable(mpAvailable);
      setMediaPipeModelPath(mpPath);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadSelectedProviderKey() {
      const providerKey = await SecureStore.getItemAsync(providerApiKeyStore(aiProvider));
      setApiKey(providerKey?.trim() || '');
      setUseCustomKey(Boolean(providerKey?.trim()));
    }
    loadSelectedProviderKey();
  }, [aiProvider]);

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
      const profile = { name: profileName.trim(), age: validAge, ageGroup, photo: profilePhoto };
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
      Alert.alert(t('general.done'), t('settings.profile_saved'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        perm.canAskAgain
          ? 'Allow InnerSpace to access your photos so you can pick a profile picture.'
          : 'Photo access was denied. You can turn it on in Settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0].uri);
    }
  }

  async function refreshLocalStatuses() {
    const statuses = await Promise.all(
      LOCAL_MODELS.map(async (model) => [model.id, await getLocalModelDownloadStatus(model.id)] as const),
    );
    setLocalStatuses(Object.fromEntries(statuses));
  }

  async function handleDownloadSelectedLocalModel() {
    await cancelModelDownload(localModelId);
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
      if (localRuntime === 'mediapipe') {
        const available = await isMediaPipeGemma2BAvailable();
        if (!available) {
          Alert.alert('Offline helper not ready', 'This version of the app doesn\'t include the offline helper. Please use a connected helper for now.');
          return;
        }
      } else {
        const status = await getLocalModelDownloadStatus(localModelId);
        if (!status.downloaded) {
          Alert.alert(
            t('settings.download_model_alert_title', { defaultValue: 'Almost there' }),
            t('settings.download_model_alert_body', { defaultValue: 'Your offline helper needs to be set up before you can go offline.' }),
          );
          return;
        }
      }
    }

    await Promise.all([
      AsyncStorage.setItem(AI_MODE_KEY, aiMode),
      aiMode === 'local'
        ? Promise.all([
          AsyncStorage.setItem(LOCAL_RUNTIME_KEY, localRuntime),
          AsyncStorage.setItem(LOCAL_MODEL_KEY, localModelId),
        ])
        : AsyncStorage.setItem(AI_PROVIDER_KEY, aiProvider),
    ]);
    Alert.alert(t('general.done'), t('settings.ai_mode_saved'));
  }

  async function handleSaveMediaPipeModelPath() {
    if (!mediaPipeModelPath.trim()) return;
    setSavingModelPath(true);
    try {
      await setMediaPipeGemmaModelPath(mediaPipeModelPath.trim());
      Alert.alert(t('general.done'), 'Model path saved.');
    } finally {
      setSavingModelPath(false);
    }
  }

  async function saveApiKey() {
    setSaving(true);
    try {
      await AsyncStorage.setItem(AI_PROVIDER_KEY, aiProvider);
      if (useCustomKey && apiKey.trim()) {
        await SecureStore.setItemAsync(providerApiKeyStore(aiProvider), apiKey.trim());
        setProviderKeyStatus((prev) => ({ ...prev, [aiProvider]: true }));
        Alert.alert('Saved ✓', t('settings.api_key_saved'));
      } else {
        await SecureStore.deleteItemAsync(providerApiKeyStore(aiProvider));
        setProviderKeyStatus((prev) => ({ ...prev, [aiProvider]: false }));
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
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferences</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile */}
        <Section title={t('settings.profile_info')} sectionKey="profile" expanded={expandedSections.profile} onToggle={toggleSection}>
          <TouchableOpacity style={styles.photoPickerRow} onPress={handlePickPhoto} activeOpacity={0.8}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.profilePhotoLarge} />
            ) : (
              <View style={styles.profilePhotoPlaceholder}>
                <Feather name="user" size={32} color={colors.accent} />
              </View>
            )}
            <View style={styles.photoPickerInfo}>
              <Text style={styles.photoPickerLabel}>Your photo</Text>
              <Text style={styles.photoPickerHint}>Tap to pick one from your gallery</Text>
            </View>
            <Feather name="camera" size={20} color={colors.textDim} />
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>{t('settings.profile_name_label')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={t('settings.profile_name_placeholder')}
            placeholderTextColor={colors.textDim}
            value={profileName}
            onChangeText={setProfileName}
            maxLength={40}
            autoCapitalize="words"
          />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('settings.profile_age_label')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={t('settings.profile_age_placeholder')}
            placeholderTextColor={colors.textDim}
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

        <Section title="Look & Feel" sectionKey="appearance" expanded={expandedSections.appearance} onToggle={toggleSection}>
          <View style={styles.modeRow}>
            {([['dark', '🌙 Night'], ['light', '☀️ Day'], ['system', '🔄 Auto']] as const).map(([m, label]) => (
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
        <Section title={t('settings.language')} sectionKey="language" expanded={expandedSections.language} onToggle={toggleSection}>
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
        <Section title={t('settings.tone')} sectionKey="tone" expanded={expandedSections.tone} onToggle={toggleSection}>
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
                <Feather name="check-circle" size={20} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </Section>

        {/* How helpers work */}
        <Section title="How your helpers work" sectionKey="ai" expanded={expandedSections.ai} onToggle={toggleSection}>
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
                  {m === 'local' ? `📱 Offline` : `☁️ Connected`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {aiMode === 'local' && (
            <View style={styles.localDownloadCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather
                  name={localStatuses['llama321b']?.downloaded ? 'check-circle' : 'download-cloud'}
                  size={18}
                  color={localStatuses['llama321b']?.downloaded ? '#22C55E' : colors.accent}
                />
                <Text style={styles.localDownloadTitle}>
                  {localStatuses['llama321b']?.downloaded ? 'Your offline helper · Ready to go' : 'Your offline helper · not set up yet'}
                </Text>
              </View>
              {!localStatuses['llama321b']?.downloaded && (
                <>
                  <TouchableOpacity
                    style={[styles.saveKeyBtn, { alignSelf: 'flex-start', marginTop: 10 }, downloadingModelId === 'llama321b' && { opacity: 0.65 }]}
                    onPress={() => { setLocalModelId('llama321b'); setLocalRuntime('executorch'); handleDownloadSelectedLocalModel(); }}
                    disabled={downloadingModelId === 'llama321b'}
                  >
                    <Text style={styles.saveKeyText}>
                      {downloadingModelId === 'llama321b' ? 'Setting up…' : 'Set up offline helper'}
                    </Text>
                  </TouchableOpacity>
                  {(localStatuses['llama321b']?.downloading || downloadingModelId === 'llama321b') && (() => {
                    const pct = Math.round((localStatuses['llama321b']?.progress ?? 0) * 100);
                    const totalMB = Math.round((getLocalModelById('llama321b')?.sizeGB ?? 1.2) * 1000);
                    const doneMB = Math.round((localStatuses['llama321b']?.progress ?? 0) * totalMB);
                    return (
                      <>
                        <View style={styles.localProgressTrack}>
                          <View style={[styles.localProgressFill, { width: `${pct}%` as any }]} />
                        </View>
                        <Text style={styles.localProgressText}>
                          {pct > 0
                            ? `${pct}% · ${doneMB} MB / ${totalMB} MB downloaded`
                            : 'Starting download…'}
                        </Text>
                        <Text style={styles.localProgressHint}>
                          Please keep the app open until the download completes.
                        </Text>
                      </>
                    );
                  })()}
                </>
              )}
            </View>
          )}

          {aiMode === 'cloud' && (
            <>
              <Text style={styles.providerLabel}>{t('settings.ai_provider_label')}</Text>
              <View style={styles.providerChipRow}>
                {AI_PROVIDERS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.providerChip, aiProvider === p && styles.providerChipActive]}
                    onPress={() => setAiProvider(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.providerChipText, aiProvider === p && styles.providerChipTextActive]}>
                      {t(`settings.provider_${p}`)}{providerKeyStatus[p] ? ' • ✓' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.providerHintText}>
                {t('settings.provider_fallback_hint')}
              </Text>
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
                    placeholderTextColor={colors.textDim}
                    value={apiKey}
                    onChangeText={setApiKey}
                    secureTextEntry={!showApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowApiKey((v) => !v)} style={styles.eyeBtn}>
                    <Feather name={showApiKey ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
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
            style={[styles.saveKeyBtn, styles.saveAiModeBtn]}
            onPress={handleSaveAiMode}
          >
            <Feather name="check-circle" size={16} color="#FFFFFF" />
            <Text style={[styles.saveKeyText, styles.saveAiModeBtnText]}>{t('settings.save_ai_mode')}</Text>
          </TouchableOpacity>
        </Section>

        {/* App Lock */}
        <Section title={t('settings.app_lock')} sectionKey="lock" expanded={expandedSections.lock} onToggle={toggleSection}>
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
              { key: 'pin', label: 'Number code' },
              { key: 'biometric', label: 'Face / fingerprint' },
              { key: 'both', label: 'Either works' },
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
                placeholderTextColor={colors.textDim}
                value={pin}
                onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                style={styles.pinInput}
                placeholder={t('settings.pin_confirm_placeholder')}
                placeholderTextColor={colors.textDim}
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
        <Section title="Your data" sectionKey="data" expanded={expandedSections.data} onToggle={toggleSection}>
          <RowBtn icon="sliders" label="Walk through setup again" onPress={handleRerunSetup} />
          <RowBtn icon="download" label="Save a backup" onPress={handleExport} />
          <RowBtn icon="upload-cloud" label="Restore from backup" onPress={handleImportBackup} />
          <RowBtn icon="trash-2" label="Erase everything" onPress={handleDeleteAll} destructive />
        </Section>

        <Section title="Privacy & Legal" sectionKey="legal" expanded={expandedSections.legal} onToggle={toggleSection}>
          <RowBtn icon="file-text" label="Read the legal & privacy notice" onPress={handleViewLegalNotice} />
          <RowBtn icon="refresh-cw" label="Review and accept again" onPress={handleReAcceptLegal} />
          <RowBtn icon="shield" label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <RowBtn icon="book-open" label="Terms of Service" onPress={() => Linking.openURL(TERMS_URL)} />
        </Section>

        <Section title="Get in touch" sectionKey="support" expanded={expandedSections.support} onToggle={toggleSection}>
          <RowBtn icon="star" label="Leave a review" onPress={handleRateApp} />
          <RowBtn icon="share-2" label="Tell a friend about InnerSpace" onPress={handleShareApp} />
        </Section>

        <View style={styles.creditsWrap}>
          <Text style={styles.creditsTitle}>InnerSpace</Text>
          <Text style={styles.creditsText}>Made with care by {CREDIT_NAME}</Text>
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

function Section({
  title,
  sectionKey,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={s.section}>
      <TouchableOpacity
        style={s.sectionHeader}
        onPress={() => onToggle(sectionKey)}
        activeOpacity={0.7}
      >
        <Text style={s.sectionTitle}>{title}</Text>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textDim}
        />
      </TouchableOpacity>
      {expanded && <View style={s.sectionBody}>{children}</View>}
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
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <TouchableOpacity style={s.rowBtn} onPress={onPress} activeOpacity={0.8}>
      <Feather name={icon as any} size={18} color={destructive ? '#EF4444' : colors.textMuted} />
      <Text style={[s.rowBtnLabel, destructive && s.rowBtnLabelDestructive]}>
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.textDim} />
    </TouchableOpacity>
  );
}

function createStyles(c: typeof DARK_COLORS, isDark: boolean) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
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
    color: c.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionBody: {
    backgroundColor: c.surface,
    borderRadius: 16,
    overflow: 'hidden',
    paddingTop: 4,
    paddingBottom: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  profilePhotoLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.border,
  },
  profilePhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPickerInfo: { flex: 1 },
  photoPickerLabel: { color: c.text, fontWeight: '600', fontSize: 15 },
  photoPickerHint: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  emailText: {
    fontSize: 14,
    color: c.textSecondary,
    flex: 1,
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBtnLabel: {
    flex: 1,
    fontSize: 15,
    color: c.textSecondary,
  },
  rowBtnLabelDestructive: {
    color: c.danger,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langChipActive: {
    borderColor: c.accent,
    backgroundColor: c.accentBg,
  },
  langText: {
    fontSize: 14,
    color: c.textMuted,
  },
  langTextActive: {
    color: c.accent,
    fontWeight: '600',
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  toneRowActive: {
    backgroundColor: c.accentBg,
  },
  toneLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textSecondary,
    marginBottom: 2,
  },
  toneLabelActive: {
    color: c.accent,
  },
  toneDesc: {
    fontSize: 12,
    color: c.textDim,
  },
  geminiStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceAlt,
  },
  geminiStatusIcon: { fontSize: 20, marginTop: 2 },
  // GAP-10: provider chips
  providerLabel: { fontSize: 12, fontWeight: '600', color: c.textDim, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  providerChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  providerChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  fieldLabel: { color: c.textMuted, fontSize: 13, marginBottom: 6, paddingHorizontal: 16, paddingTop: 14 },
  fieldInput: {
    backgroundColor: c.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginHorizontal: 16,
  },
  providerChipActive: { backgroundColor: c.accentBg, borderColor: c.accent },
  providerChipText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
  providerChipTextActive: { color: c.accent, fontWeight: '700' },
  providerHintText: {
    color: c.textDim,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLabel: {
    fontSize: 15,
    color: c.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 12,
    color: c.textDim,
    maxWidth: 220,
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  apiKeyInput: {
    flex: 1,
    backgroundColor: c.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: c.text,
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  saveKeyBtn: {
    backgroundColor: c.accentBg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveKeyText: {
    color: c.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  saveAiModeBtn: {
    alignSelf: 'stretch',
    marginTop: 14,
    backgroundColor: c.accent,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveAiModeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  localDownloadCard: {
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: c.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
  },
  localDownloadTitle: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  localDownloadHint: {
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  localProgressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  localProgressFill: {
    height: '100%',
    backgroundColor: c.accent,
  },
  localProgressText: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  localProgressHint: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeChipActive: {
    backgroundColor: c.accentBg,
    borderColor: c.accent,
  },
  modeChipText: {
    color: c.textMuted,
    fontSize: 12,
  },
  modeChipTextActive: {
    color: c.accent,
    fontWeight: '600',
  },
  pinSetupWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  pinInput: {
    backgroundColor: c.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: c.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  pinBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  savePinBtn: {
    backgroundColor: c.accentBg,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  savePinBtnText: {
    color: c.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  clearPinBtn: {
    backgroundColor: isDark ? '#281217' : '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  clearPinBtnText: {
    color: c.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  lockWarning: {
    color: c.danger,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  creditsWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  creditsTitle: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  creditsText: {
    color: c.textDim,
    fontSize: 12,
  },
  creditsSubText: {
    color: c.textDim,
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
    color: c.textDim,
    fontSize: 11,
  },
  creditsLink: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '600',
  },
});
}




