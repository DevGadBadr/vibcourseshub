/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#7dd3fc';

export const Colors = {
  light: {
    // base text & backgrounds
    text: '#11181C',
    background: '#F6F7F8',
    surface: '#FFFFFF',
    surface2: '#F3F4F6',
    border: '#E5E7EB',

    // accents
    tint: tintColorLight,
    icon: '#687076',
    muted: '#6B7280',

    // semantic
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#ef4444',
    neutral: '#e5e7eb',
    overlay: 'rgba(0,0,0,0.85)',

    // tabs
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    // base text & backgrounds
    text: '#ECEDEE',
    background: '#101113',
    surface: '#17191C',
    surface2: '#1D2024',
    border: '#2A2F35',

    // accents
    tint: tintColorDark,
    icon: '#9BA1A6',
    muted: '#9BA1A6',

    // semantic
    success: '#22c55e',
    warning: '#fbbf24',
    danger: '#f87171',
    neutral: '#2A2F35',
    overlay: 'rgba(0,0,0,0.85)',

    // tabs
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
