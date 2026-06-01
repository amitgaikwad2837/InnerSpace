import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { saveUser, saveAccessToken } from '../services/storage-service';

WebBrowser.maybeCompleteAuthSession();

// Create ONE Web OAuth client ID at:
// https://console.cloud.google.com → APIs & Services → Credentials
// → Create OAuth 2.0 Client ID → Web application
// Authorised redirect URI: https://auth.expo.io/@<your-expo-username>/InnerSpace
//
// Also enable the Generative Language API for your project:
// https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Scopes: profile info + Gemini API access (no separate API key needed)
const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/generative-language',
];

export default function SignInScreen() {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showGeminiPrompt, setShowGeminiPrompt] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ userId: string; email: string } | null>(null);

  // useProxy: true lets Expo Go work with a single Web client ID (no Android/iOS IDs needed)
  const redirectUri = AuthSession.makeRedirectUri({});

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      scopes: SCOPES,
      responseType: AuthSession.ResponseType.Token,
      redirectUri,
    },
    discovery,
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      handleGoogleToken(access_token);
    } else if (response?.type === 'error') {
      setLoading(false);
      Alert.alert('Sign-in failed', response.error?.message ?? 'Unknown error');
    }
  }, [response]);

  async function handleGoogleToken(accessToken: string) {
    try {
      const profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const profile = await profileRes.json();
      const userId: string = profile.id ?? profile.sub ?? 'unknown';
      const email: string = profile.email ?? '';

      await Promise.all([
        saveUser({ userId, email }),
        saveAccessToken(accessToken),
      ]);

      // Test Gemini access — if 403 the user needs to enable the API
      const geminiTest = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          }),
        },
      );

      if (geminiTest.status === 403) {
        // Show enable-Gemini guide before entering the app
        setPendingUser({ userId, email });
        setShowGeminiPrompt(true);
        return;
      }

      setUser(userId, email);
    } catch {
      Alert.alert('Error', 'Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleEnableGemini() {
    Linking.openURL(
      'https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com',
    );
  }

  function handleContinueAnyway() {
    if (pendingUser) setUser(pendingUser.userId, pendingUser.email);
    setShowGeminiPrompt(false);
  }

  async function handleSignIn() {
    setLoading(true);
    await promptAsync();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Gemini not-enabled modal */}
      <Modal visible={showGeminiPrompt} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>⚡</Text>
            <Text style={styles.modalTitle}>Enable Gemini API</Text>
            <Text style={styles.modalBody}>
              Your Google account is connected but the Gemini (Generative Language) API
              isn't enabled yet. Tap below to enable it — it's free.{'\n\n'}
              After enabling, come back and your chats will work automatically.
            </Text>
            <TouchableOpacity style={styles.enableBtn} onPress={handleEnableGemini} activeOpacity={0.85}>
              <Text style={styles.enableBtnText}>Enable Gemini API →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={handleContinueAnyway} activeOpacity={0.85}>
              <Text style={styles.skipBtnText}>Continue anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logo / branding */}
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <Text style={styles.logoEmoji}>🧠</Text>
        </View>
        <Text style={styles.appName}>InnerSpace</Text>
        <Text style={styles.tagline}>Your personal AI companion</Text>
      </View>

      {/* Feature bullets */}
      <View style={styles.features}>
        {[
          { icon: '🤖', text: '35+ specialist AI agents' },
          { icon: '🔒', text: 'All data stays on your device' },
          { icon: '🌍', text: 'Works in 10 languages' },
          { icon: '✨', text: 'Free — powered by Gemini' },
        ].map(({ icon, text }) => (
          <View key={text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
          </View>
        ))}
      </View>

      {/* Sign-in button */}
      <TouchableOpacity
        style={[styles.googleBtn, (loading || !request) && styles.btnDisabled]}
        onPress={handleSignIn}
        disabled={loading || !request}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#1A1A2E" size="small" />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color="#1A1A2E" style={styles.googleIcon} />
            <Text style={styles.googleBtnText}>{t('auth.signin')}</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        By continuing you agree to our{' '}
        <Text style={styles.disclaimerLink} onPress={() => Linking.openURL('https://amitgaikwad2837.github.io/InnerSpace/terms.html')}>Terms of Service</Text>
        {' '}&amp;{' '}
        <Text style={styles.disclaimerLink} onPress={() => Linking.openURL('https://amitgaikwad2837.github.io/InnerSpace/privacy.html')}>Privacy Policy</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1A2340',
    borderWidth: 2,
    borderColor: '#4A9EFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#8B9CC8',
    marginTop: 6,
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 40,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 15,
    color: '#CBD5E1',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 15,
    alignSelf: 'stretch',
    gap: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    // positioned via gap
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 11,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 16,
  },
  disclaimerLink: {
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#131929',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3A5C',
  },
  modalEmoji: { fontSize: 40, marginBottom: 12 },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: '#9BA8C4',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  enableBtn: {
    backgroundColor: '#4A9EFF',
    borderRadius: 10,
    paddingVertical: 13,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 10,
  },
  enableBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  skipBtn: { paddingVertical: 8 },
  skipBtnText: { fontSize: 13, color: '#6B7A99' },
});
