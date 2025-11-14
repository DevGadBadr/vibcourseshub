import React from 'react';
import { Platform } from 'react-native';

export default function WebScrollbarStyle() {
  if (Platform.OS !== 'web') return null;
  const css = `
  :root{
    --sb-track: rgba(0,0,0,0.06);
    --sb-thumb: rgba(0,0,0,0.28);
    --sb-thumb-hover: rgba(0,0,0,0.38);
  }
  @media (prefers-color-scheme: dark) {
    :root{
      --sb-track: rgba(255,255,255,0.08);
      --sb-thumb: rgba(255,255,255,0.28);
      --sb-thumb-hover: rgba(255,255,255,0.38);
    }
  }

  /* Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--sb-thumb) var(--sb-track);
  }

  /* Chromium/WebKit */
  *::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  *::-webkit-scrollbar-track {
    background: var(--sb-track);
    border-radius: 8px;
  }
  *::-webkit-scrollbar-thumb {
    background-color: var(--sb-thumb);
    border-radius: 8px;
    border: 2px solid var(--sb-track);
  }
  *::-webkit-scrollbar-thumb:hover {
    background-color: var(--sb-thumb-hover);
  }
  *::-webkit-scrollbar-corner {
    background: var(--sb-track);
  }
  `;
  return React.createElement('style', { dangerouslySetInnerHTML: { __html: css } });
}
