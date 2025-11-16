import { Alert, Platform, ToastAndroid } from 'react-native';

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // Lightweight fallback; consider replacing with a Snackbar later
    Alert.alert(type === 'success' ? 'Success' : 'Error', message);
  }
}
