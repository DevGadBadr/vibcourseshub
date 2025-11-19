import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_URL } from '@/utils/api';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

const fileSrc = (slug?: string) => (slug ? `${API_URL}/courses/${slug}/brochure/file` : undefined);
const dataSrc = (slug?: string) => (slug ? `${API_URL}/courses/${slug}/brochure/data` : undefined);
const downloadSrc = (slug?: string) => (slug ? `${API_URL}/courses/${slug}/brochure/file?download=1` : undefined);

export const BrochureViewer: React.FC<{ slug?: string; url?: string | null }>
  = ({ slug, url }) => {
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const hasBrochure = !!url;
  const file = hasBrochure ? fileSrc(slug) : undefined;
  const dataUrl = hasBrochure ? dataSrc(slug) : undefined;
  const dl = hasBrochure ? downloadSrc(slug) : undefined;
  if (!file) {
    return (
      <View style={[styles.empty, { borderColor: border, backgroundColor: surface }]}>
        <ThemedText style={{ opacity: 0.8 }}>No brochure uploaded.</ThemedText>
      </View>
    );
  }

  // WEB: fetch PDF as blob and render via blob: URL to avoid browser auto-download
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [webError, setWebError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dataUrl) return;
    let active = true;
    let currentUrl: string | null = null;
    setWebError(null);
    setWebViewUrl(null);
    (async () => {
      try {
        const res = await fetch(dataUrl);
        if (!res.ok) throw new Error('Failed to load brochure data');
        const json = (await res.json()) as { data?: string };
        if (!json?.data) throw new Error('Empty brochure data');
        // Decode base64 to binary string
        const binaryString = atob(json.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        if (!active) return;
        currentUrl = URL.createObjectURL(blob);
        setWebViewUrl(currentUrl);
      } catch (e) {
        console.error('Brochure load error:', e);
        if (!active) return;
        setWebError('Unable to preview brochure. You can still download it below.');
      }
    })();
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [dataUrl]);

  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: 8 }}>
        <View style={[styles.frameWrap, { borderColor: border, backgroundColor: surface }]}>
          {webError ? (
            <View style={styles.centerFill}>
              <ThemedText style={{ opacity: 0.8, textAlign: 'center' }}>{webError}</ThemedText>
            </View>
          ) : !webViewUrl ? (
            <View style={styles.centerFill}>
              <ThemedText style={{ opacity: 0.7 }}>Loading brochure…</ThemedText>
            </View>
          ) : (
            <iframe
              src={webViewUrl}
              title="Course brochure"
              style={{ width: '100%', height: '100%', border: 'none' } as any}
            />
          )}
        </View>
        {dl && (
          <View style={{ alignItems: 'flex-start' }}>
            <a href={dl} download style={{ textDecoration: 'none' }}>
              <View style={[styles.downloadBtn, { borderColor: border }]}>
                <ThemedText style={{ fontWeight: '600' }}>Download Brochure</ThemedText>
              </View>
            </a>
          </View>
        )}
      </View>
    );
  }
  const WebView: any = require('react-native-webview').WebView;
  // For mobile, use Google Docs Viewer which reliably renders PDFs
  const mobileSrc = `https://docs.google.com/viewer?url=${encodeURIComponent(file)}&embedded=true`;
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.webviewWrap, { borderColor: border }]}> 
        <WebView 
          source={{ uri: mobileSrc }} 
          style={{ width: '100%', height: 500 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
      {dl && (
        <Pressable onPress={() => Linking.openURL(dl)} style={[styles.downloadBtn, { borderColor: border }]}> 
          <ThemedText style={{ fontWeight: '600' }}>Download Brochure</ThemedText>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { borderWidth: 1, borderRadius: 0, padding: 16, alignItems: 'center' },
  frameWrap: { borderWidth: 1, borderRadius: 0, overflow: 'hidden', cursor: 'default' as any, height: 520 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  webviewWrap: { borderWidth: 1, borderRadius: 0, overflow: 'hidden' },
  downloadBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 0, borderWidth: 1, alignSelf: 'flex-start' },
});
