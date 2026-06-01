import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';
import { PREDEFINED_AGENTS } from '../constants/agents';
import { getCatalogAgents } from '../services/agents-catalog';
import {
  LEGAL_ACK_KEY,
  LEGAL_ACK_VERSION,
  getEffectiveLegalNoticeText,
  getLegalNotice,
} from '../constants/legal-notice';
import type { ToneOption } from '../types';

const ONBOARDING_DONE_KEY = '@innerspace:onboarding_done';
const LANG_KEY = '@innerspace:language';
const TONE_KEY = '@innerspace:tone';
const SELECTED_HELPERS_KEY = '@innerspace:selected_helpers';

const TONES: ToneOption[] = ['warm', 'direct', 'motivational'];

export default function SetupFlowScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalNoticeText, setLegalNoticeText] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [tone, setTone] = useState<ToneOption>('warm');
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>(['confidence']);
  const [helperPool, setHelperPool] = useState(PREDEFINED_AGENTS.slice(0, 20));

  const legalNotice = useMemo(() => getLegalNotice(), []);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      const [legalText, catalog] = await Promise.all([
        getEffectiveLegalNoticeText(),
        getCatalogAgents(),
      ]);
      if (mounted) {
        setLegalNoticeText(legalText);
        setHelperPool(catalog.slice(0, 20));
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  function toggleHelper(id: string) {
    setSelectedHelpers((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  async function completeSetup() {
    await AsyncStorage.multiSet([
      [ONBOARDING_DONE_KEY, 'true'],
      [LEGAL_ACK_KEY, LEGAL_ACK_VERSION],
      [LANG_KEY, language],
      [TONE_KEY, tone],
      [SELECTED_HELPERS_KEY, JSON.stringify(selectedHelpers)],
    ]);
    await i18n.changeLanguage(language);
    navigation.replace('Main');
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('setup.title')}</Text>
        <Text style={styles.subtitle}>{t('setup.step_of', { step, total: 5 })}</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{legalNotice.title}</Text>
            <Text style={styles.cardText}>{legalNotice.summary}</Text>
            <Text style={styles.regionTag}>{t('setup.region_detected', { region: legalNotice.regionLabel })}</Text>
            <View style={styles.noticeBox}>
              <Text style={styles.noticeBullet}>{legalNoticeText || legalNotice.bullets.map((line) => `• ${line}`).join('\n')}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAcceptedLegal((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkBox, acceptedLegal && styles.checkBoxActive]}>
                {acceptedLegal && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkText}>{t('setup.accept_legal')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('setup.ai_tool_title')}</Text>
            <Text style={styles.cardText}>{t('setup.ai_tool_body')}</Text>
            <View style={styles.choiceChipActive}>
              <Text style={styles.choiceChipActiveText}>{t('setup.gemini_default')}</Text>
            </View>
            <Text style={styles.cardHint}>{t('setup.ai_tool_hint')}</Text>
          </View>
        )}

        {step === 3 && (
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
                    <Text style={[styles.choiceChipText, active && styles.choiceChipActiveText]}>{lang.nativeName}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 4 && (
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
                  <Text style={[styles.toneLabel, active && styles.toneLabelActive]}>{t(`settings.tone_${toneKey}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 5 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('setup.helpers_title')}</Text>
            <Text style={styles.cardText}>{t('setup.helpers_body')}</Text>
            <View style={styles.wrapRow}>
              {helperPool.map((agent) => {
                const active = selectedHelpers.includes(agent.id);
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => toggleHelper(agent.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emoji}>{agent.emoji}</Text>
                    <Text style={[styles.choiceChipText, active && styles.choiceChipActiveText]}>{agent.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
        {step < 5 ? (
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
  root: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8B9CC8',
    marginTop: 6,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 14,
    lineHeight: 20,
  },
  cardHint: {
    fontSize: 12,
    color: '#5A6478',
    marginTop: 12,
  },
  noticeBox: {
    backgroundColor: '#0A0F1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    gap: 8,
  },
  regionTag: {
    color: '#4A9EFF',
    fontSize: 12,
    marginBottom: 10,
  },
  noticeBullet: {
    fontSize: 12,
    lineHeight: 18,
    color: '#CBD5E1',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#4A5568',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: {
    backgroundColor: '#1A3A6B',
    borderColor: '#4A9EFF',
  },
  checkMark: {
    color: '#4A9EFF',
    fontSize: 12,
    fontWeight: '700',
  },
  checkText: {
    color: '#CBD5E1',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    backgroundColor: '#1A2340',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  choiceChipActive: {
    backgroundColor: '#1A3A6B',
    borderColor: '#4A9EFF',
  },
  choiceChipText: {
    color: '#8B9CC8',
    fontSize: 13,
  },
  choiceChipActiveText: {
    color: '#4A9EFF',
    fontWeight: '600',
  },
  toneRow: {
    backgroundColor: '#1A2340',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toneRowActive: {
    backgroundColor: '#1A3A6B',
    borderColor: '#4A9EFF',
  },
  toneLabel: {
    color: '#CBD5E1',
    textTransform: 'capitalize',
  },
  toneLabelActive: {
    color: '#4A9EFF',
    fontWeight: '600',
  },
  emoji: {
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  backBtn: {
    backgroundColor: '#1A2340',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtnText: {
    color: '#8B9CC8',
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#1A3A6B',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginLeft: 'auto',
  },
  nextBtnDisabled: {
    opacity: 0.45,
  },
  nextBtnText: {
    color: '#4A9EFF',
    fontWeight: '700',
  },
});
