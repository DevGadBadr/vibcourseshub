import { useAuth } from '@/providers/AuthProvider';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export const GoogleSignInButton: React.FC = () => {
  const extra: any = Constants.expoConfig?.extra || {};
  const [busy, setBusy] = useState(false);

  const config = useMemo(
    () => ({
      // Expo Go / Dev Client
      expoClientId: extra.googleWebClientId,
      // Web requires a webClientId key
      webClientId: extra.googleWebClientId,
      // Platform-specific native IDs for production builds
      androidClientId: extra.googleAndroidClientId,
      iosClientId: extra.googleIosClientId,
      responseType: 'id_token' as const,
      scopes: ['openid', 'profile', 'email'],
      selectAccount: true,
    }),
    [extra],
  );

  const [request, response, promptAsync] = Google.useAuthRequest(config);
  const insecureWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext;
  const { googleSignIn } = useAuth();

  useEffect(() => {
    (async () => {
      if (response?.type === 'success') {
        const idToken = (response.params as any)?.id_token;
        if (!idToken) return;
        try {
          setBusy(true);
          await googleSignIn(idToken);
        } catch (e) {
          console.error('Google login failed:', e);
          alert('Google sign-in failed. Please try again.');
        } finally {
          setBusy(false);
        }
      }
    })();
  }, [response]);

  const onPress = () => {
    if (insecureWeb) {
      alert('Google sign-in requires HTTPS or localhost. Please open the site via https:// or localhost.');
      return;
    }
    if (!request) return;
    promptAsync();
  };

  return (
    <Pressable onPress={onPress} disabled={!request || busy || insecureWeb} style={[styles.button, ((!request || busy || insecureWeb) && styles.disabled)]}>
      <View style={styles.inner}>
        {busy && <ActivityIndicator style={styles.spinner} />}
        <Text style={[styles.text, busy && styles.textBusy]}>
          {insecureWeb
            ? 'Enable HTTPS for Google login'
            : busy
              ? 'Signing in…'
              : 'Continue with Google'}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  disabled: { opacity: 0.6 },
  inner: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { marginBottom: 6 },
  text: { fontWeight: '600', color: '#444' },
  textBusy: { opacity: 0.85 },
});

export default GoogleSignInButton;
