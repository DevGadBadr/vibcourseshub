import { useAuth } from '@/providers/AuthProvider';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// Check if we're in a secure context (HTTPS or localhost)
const isSecureContext = Platform.OS !== 'web' || 
  (typeof window !== 'undefined' && (
    window.isSecureContext || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'
  ));

// Inner component that uses the hook - only rendered in secure contexts
const GoogleSignInButtonInner: React.FC<{ config: any; onSuccess: (idToken: string) => Promise<void> }> = ({ config, onSuccess }) => {
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest(config);

  useEffect(() => {
    (async () => {
      if (response?.type === 'success') {
        const idToken = (response.params as any)?.id_token;
        if (!idToken) return;
        try {
          setBusy(true);
          await onSuccess(idToken);
        } catch (e) {
          console.error('Google login failed:', e);
          alert('Google sign-in failed. Please try again.');
        } finally {
          setBusy(false);
        }
      }
    })();
  }, [response, onSuccess]);

  const handlePress = async () => {
    if (!request || !promptAsync) return;
    try {
      await promptAsync();
    } catch (error: any) {
      console.error('Google auth prompt failed:', error);
      if (error?.message?.includes('WebCrypto') || error?.message?.includes('secure origins')) {
        alert('Google sign-in requires HTTPS or localhost. Please open the site via https:// or use localhost for development.');
      } else {
        alert('Google sign-in failed. Please try again.');
      }
    }
  };

  return (
    <Pressable onPress={handlePress} disabled={!request || busy} style={[styles.button, ((!request || busy) && styles.disabled)]}>
      <View style={styles.inner}>
        {busy && <ActivityIndicator style={styles.spinner} />}
        <Text style={[styles.text, busy && styles.textBusy]}>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </Text>
      </View>
    </Pressable>
  );
};

// Fallback component for insecure contexts
const GoogleSignInButtonFallback: React.FC = () => {
  const handlePress = () => {
    alert('Google sign-in requires HTTPS or localhost. Please open the site via https:// or use localhost for development.');
  };

  return (
    <Pressable onPress={handlePress} disabled style={[styles.button, styles.disabled]}>
      <View style={styles.inner}>
        <Text style={styles.text}>
          Enable HTTPS for Google login
        </Text>
      </View>
    </Pressable>
  );
};

// Main component that conditionally renders based on secure context
export const GoogleSignInButton: React.FC = () => {
  const extra: any = Constants.expoConfig?.extra || {};
  const { googleSignIn } = useAuth();

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

  // Only render the hook-using component in secure contexts
  // This prevents the hook from being called in insecure contexts
  if (isSecureContext) {
    return <GoogleSignInButtonInner config={config} onSuccess={googleSignIn} />;
  }

  return <GoogleSignInButtonFallback />;
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
