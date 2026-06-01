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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../store/auth';
import { clearStorage } from '../services/storage-service';
import i18n, { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';
import type { ToneOption } from '../types';
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

const TONE_KEY = '@innerspace:tone';
const LANG_KEY = '@innerspace:language';
const API_KEY_STORE = 'innerspace_api_key';
const ONBOARDING_DONE_KEY = '@innerspace:onboarding_done';
const CREDIT_NAME = 'Amit';
const CREDIT_ROLE = 'Creator, Product & Engineering';
const CREDIT_WEBSITE = 'https://github.com/';
const CREDIT_LINKEDIN = 'https://www.linkedin.com/';

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

  const [tone, setTone] = useState<ToneOption>('warm');
  const [language, setLanguage] = useState<LanguageCode>('en');
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

  // Load saved prefs
  useEffect(() => {
    async function load() {
      const [savedTone, savedLang, savedKey] = await Promise.all([
        AsyncStorage.getItem(TONE_KEY),
        AsyncStorage.getItem(LANG_KEY),
        SecureStore.getItemAsync(API_KEY_STORE),
      ]);
      if (savedTone) setTone(savedTone as ToneOption);
      if (savedLang) setLanguage(savedLang as LanguageCode);
      if (savedKey) {
        setApiKey(savedKey);
        setUseCustomKey(true);
      }

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

  async function saveApiKey() {
    setSaving(true);
    try {
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
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      const data = Object.fromEntries(pairs.map(([k, v]) => [k, v ?? '']));
      const json = JSON.stringify(data, null, 2);
      const path = FileSystem.documentDirectory + 'innerspace_export.json';
      await FileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json' });
      } else {
        Alert.alert(t('settings.exported_title'), t('settings.exported_path', { path }));
      }
    } catch {
      Alert.alert(t('general.error'), t('settings.export_failed'));
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
    await AsyncStorage.multiSet([
      [ONBOARDING_DONE_KEY, 'false'],
      [LEGAL_ACK_KEY, ''],
    ]);
    navigation.navigate('SetupFlow');
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
          <View style={styles.geminiStatusRow}>
            <Text style={styles.geminiStatusIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{t('settings.guest_mode_active')}</Text>
              <Text style={styles.toggleDesc}>
                  {t('settings.guest_mode_desc')}
              </Text>
            </View>
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
                placeholder={t('settings.api_key_placeholder')}
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
          <RowBtn icon="trash-outline" label={t('settings.delete_account')} onPress={handleDeleteAll} destructive />
        </Section>

        <Section title={t('settings.legal_privacy')}>
          <RowBtn icon="document-text-outline" label={t('settings.view_legal_notice')} onPress={handleViewLegalNotice} />
          <RowBtn icon="refresh-outline" label={t('settings.review_accept_notice_again')} onPress={handleReAcceptLegal} />
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
