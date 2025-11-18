import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_URL } from '@/utils/api';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

const fileSrc = (slug?: string) => (slug ? `${API_URL}/courses/${slug}/brochure/file` : undefined);
const downloadSrc = (slug?: string) => (slug ? `${API_URL}/courses/${slug}/brochure/file?download=1` : undefined);

export const BrochureViewer: React.FC<{ slug?: string; url?: string | null }>
  = ({ slug, url }) => {
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const [open, setOpen] = useState(false);
  const hasBrochure = !!url;
  const file = hasBrochure ? fileSrc(slug) : undefined;
  const gview = file ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(file)}` : undefined;
  const dl = hasBrochure ? downloadSrc(slug) : undefined;
  if (!file || !gview) {
    return (
      <View style={[styles.empty, { borderColor: border, backgroundColor: surface }]}>
        <ThemedText style={{ opacity: 0.8 }}>No brochure uploaded.</ThemedText>
      </View>
    );
  }
  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: 8 }}>
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={[styles.frameWrap, { borderColor: border }]}> 
          <iframe src={gview} style={{ width: '100%', height: 520, border: 'none' } as any} />
        </Pressable>
        {open && (
          <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
            <View style={styles.overlayInner} pointerEvents="box-none">
              <iframe src={gview} style={{ width: '100%', height: '100%', border: 'none' } as any} />
            </View>
          </Pressable>
        )}
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
  const mobileSrc = `https://docs.google.com/viewer?url=${encodeURIComponent(dl || file)}&embedded=true`;
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
  frameWrap: { borderWidth: 1, borderRadius: 0, overflow: 'hidden', cursor: 'pointer' as any },
  webviewWrap: { borderWidth: 1, borderRadius: 0, overflow: 'hidden' },
  downloadBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 0, borderWidth: 1, alignSelf: 'flex-start' },
  overlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, alignItems: 'center', justifyContent: 'center', padding: 16 },
  overlayInner: { width: '90%', height: '90%', backgroundColor: '#000' },
});
