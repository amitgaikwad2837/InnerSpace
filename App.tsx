import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  I18nManager,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { I18nextProvider } from 'react-i18next';
import i18n, { getDeviceLanguage, isRTL } from './src/i18n';
import { useAuthStore } from './src/store/auth';
import { getUser, getAccessToken } from './src/services/storage-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authenticateWithBiometric,
  canUseBiometric,
  getLockEnabled,
  getLockMode,
  type AppLockMode,
  verifyAppPin,
} from './src/services/app-lock';
import { LEGAL_ACK_KEY, LEGAL_ACK_VERSION } from './src/constants/legal-notice';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { scheduleWeeklyDigest } from './src/services/notifications';

// ── Screens ───────────────────────────────────────────────────────────────────
import HomeScreen from './src/screens/HomeScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CreateAgentScreen from './src/screens/CreateAgentScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SetupFlowScreen from './src/screens/SetupFlowScreen';
import JournalScreen from './src/screens/JournalScreen';
import HabitsScreen from './src/screens/HabitsScreen';
import DecisionScreen from './src/screens/DecisionScreen';

// ─── Navigation ───────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();

// Maps tab route names to their Ionicons glyph. Add a new entry when adding a tab.
const TAB_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Agents: 'grid-outline',
  Journal: 'book-outline',
  Habits: 'checkmark-circle-outline',
  History: 'time-outline',
  Settings: 'settings-outline',
};

// AsyncStorage key shared with AgentsScreen — must stay in sync if ever renamed.
const CUSTOM_AGENTS_KEY = '@innerspace:custom_agents';

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={TAB_ICON[route.name] ?? 'ellipse-outline'}
            size={size}
            color={color}
          />
        ),
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Agents"
        component={AgentsScreen}
        options={{ tabBarLabel: 'Helpers' }}
      />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator({ showSetup }: { showSetup: boolean }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {showSetup && <RootStack.Screen name="SetupFlow" component={SetupFlowScreen} />}
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="Decision" component={DecisionScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="CreateAgent" component={CreateAgentScreen} options={{ headerShown: false, presentation: 'modal' }} />
      {!showSetup && <RootStack.Screen name="SetupFlow" component={SetupFlowScreen} />}
    </RootStack.Navigator>
  );
}

// Written by SetupFlowScreen once the user completes first-run setup.
const ONBOARDING_DONE_KEY = '@innerspace:onboarding_done';

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { setUser } = useAuthStore();
  const [ready, setReady] = useState(false);             // false = show splash loader
  const [onboardingDone, setOnboardingDone] = useState(false); // false = route to SetupFlow
  const [isLocked, setIsLocked] = useState(false);        // true = show PIN/biometric screen
  const [lockEnabled, setLockEnabled] = useState(false);  // user has app lock turned on
  const [lockMode, setLockMode] = useState<AppLockMode>('pin'); // 'pin' | 'biometric' | 'both'
  const [pin, setPin] = useState('');                     // PIN input field value
  const [unlockError, setUnlockError] = useState('');     // shown below PIN field on wrong attempt
  const [biometricAvailable, setBiometricAvailable] = useState(false); // device supports Face/Touch ID

  // Restore session from storage on cold start
  useEffect(() => {
    async function restore() {
      try {
        const [user, token] = await Promise.all([getUser(), getAccessToken()]);
        if (user && token) {
          setUser(user.userId, user.email);
        }

        const [done, legalAckVersion] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_DONE_KEY),
          AsyncStorage.getItem(LEGAL_ACK_KEY),
        ]);
        const legalAccepted = legalAckVersion === LEGAL_ACK_VERSION;
        setOnboardingDone(done === 'true' && legalAccepted);

        const [enabled, mode, bioAvailable] = await Promise.all([
          getLockEnabled(),
          getLockMode(),
          canUseBiometric(),
        ]);
        setLockEnabled(enabled);
        setLockMode(mode);
        setBiometricAvailable(bioAvailable);
        setIsLocked(enabled);

        // Schedule weekly digest notification (non-blocking, fire-and-forget)
        scheduleWeeklyDigest().catch(() => {});
      } finally {
        setReady(true);
      }
    }
    restore();
  }, []);

  // Deep link handler: innerspace://import-agent?data=<base64>
  useEffect(() => {
    async function handleUrl(url: string) {
      try {
        if (!url.startsWith('innerspace://import-agent')) return;
        const encoded = new URL(url).searchParams.get('data');
        if (!encoded) return;
        // Guard against DoS via oversized payloads (50 KB limit)
        if (encoded.length > 65536) return;
        const raw = JSON.parse(decodeURIComponent(atob(encoded)));
        const partial = {
          id: `shared_${Date.now()}`,
          name: String(raw.n ?? '').slice(0, 64),
          nameKey: String(raw.n ?? '').slice(0, 64),
          descriptionKey: String(raw.d ?? '').slice(0, 120),
          category: String(raw.c ?? 'other'),
          emoji: String(raw.e ?? '🤖').slice(0, 4),
          expertise: String(raw.x ?? '').slice(0, 800),
          suggestedQuestions: [],
          isCustom: true,
          isPremium: false,
        };
        // Basic validation before storing
        if (partial.name.length < 2 || partial.expertise.length < 20) return;
        const existing = await AsyncStorage.getItem(CUSTOM_AGENTS_KEY);
        const agents = existing ? JSON.parse(existing) : [];
        agents.push({ ...partial, systemPrompt: partial.expertise });
        await AsyncStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(agents));
        console.log('[InnerSpace] Imported shared agent:', partial.name);
      } catch {
        // Silently ignore malformed deep links
      }
    }

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Force RTL layout when the device language requires it (Arabic, Hebrew, etc.).
  // React Native caches the layout direction — this must run on mount, not lazily.
  useEffect(() => {
    const lang = getDeviceLanguage();
    const rtl = isRTL(lang);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
    }
  }, []);

  // Re-lock the app whenever it comes back to the foreground.
  // This ensures that backgrounding the app (e.g. switching apps) requires re-auth.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      const enabled = await getLockEnabled();
      if (enabled) {
        setLockEnabled(true);
        setIsLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const canTryBiometric = useMemo(() => {
    return biometricAvailable && (lockMode === 'biometric' || lockMode === 'both');
  }, [biometricAvailable, lockMode]);

  async function tryBiometricUnlock() {
    const ok = await authenticateWithBiometric();
    if (ok) {
      setUnlockError('');
      setIsLocked(false);
    }
  }

  async function unlockWithPin() {
    if (!pin.trim()) return;
    const ok = await verifyAppPin(pin.trim());
    if (!ok) {
      setUnlockError('Incorrect PIN. Please try again.');
      return;
    }
    setUnlockError('');
    setPin('');
    setIsLocked(false);
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0F1E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#4A9EFF" size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  if (lockEnabled && isLocked) {
    return (
      <View style={styles.lockRoot}>
        <StatusBar style="light" />
        <View style={styles.lockCard}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>App Locked</Text>
          <Text style={styles.lockBody}>Unlock InnerSpace to continue.</Text>

          {(lockMode === 'pin' || lockMode === 'both') && (
            <>
              <TextInput
                value={pin}
                onChangeText={(v) => {
                  setPin(v.replace(/[^0-9]/g, '').slice(0, 6));
                  if (unlockError) setUnlockError('');
                }}
                keyboardType="number-pad"
                secureTextEntry
                style={styles.pinInput}
                placeholder="Enter PIN"
                placeholderTextColor="#5A6478"
                maxLength={6}
              />
              <TouchableOpacity style={styles.unlockBtn} onPress={unlockWithPin} activeOpacity={0.85}>
                <Text style={styles.unlockBtnText}>Unlock with PIN</Text>
              </TouchableOpacity>
            </>
          )}

          {canTryBiometric && (
            <TouchableOpacity style={styles.bioBtn} onPress={tryBiometricUnlock} activeOpacity={0.85}>
              <Text style={styles.bioBtnText}>Use Face/Fingerprint</Text>
            </TouchableOpacity>
          )}

          {!!unlockError && <Text style={styles.unlockError}>{unlockError}</Text>}
        </View>
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator showSetup={!onboardingDone} />
        </NavigationContainer>
      </ThemeProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  lockRoot: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  lockEmoji: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 8,
  },
  lockTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  lockBody: {
    color: '#8B9CC8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
  },
  pinInput: {
    backgroundColor: '#0A0F1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  unlockBtn: {
    backgroundColor: '#1A3A6B',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 8,
  },
  unlockBtnText: {
    color: '#4A9EFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bioBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: 11,
    alignItems: 'center',
  },
  bioBtnText: {
    color: '#CBD5E1',
    fontWeight: '600',
    fontSize: 14,
  },
  unlockError: {
    marginTop: 10,
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 12,
  },
});

