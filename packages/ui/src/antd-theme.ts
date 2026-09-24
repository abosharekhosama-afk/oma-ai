/**
 * Single Planable-derived Ant Design theme.
 * Planable remains the visual authority. These values are measured tokens, not library defaults.
 */
export const omaAntdTheme = {
  token: {
    colorPrimary: '#1677FF',
    colorPrimaryHover: '#4096FF',
    colorPrimaryActive: '#0958D9',
    colorBgLayout: '#F5F6F7',
    colorBgContainer: '#FFFFFF',
    colorText: '#333333',
    colorBorder: '#E2E3E5',
    controlHeight: 32,
    borderRadius: 6,
    borderRadiusLG: 8,
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    motionDurationMid: '0.15s',
    motionDurationSlow: '0.3s',
  },
  components: {
    Modal: { borderRadiusLG: 8 },
    Drawer: { borderRadiusLG: 8 },
    Card: { borderRadiusLG: 8 },
  },
} as const;

export const omaArabicFontFamily =
  'var(--font-noto-arabic), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
