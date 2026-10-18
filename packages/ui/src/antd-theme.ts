/**
 * Single Planable-derived Ant Design theme.
 * Planable remains the visual authority. These values are measured tokens, not library defaults.
 * R2 live measures (CDP Planable): body 14/400/~21.5, ink #333, muted ~#5E6166,
 * control height 32, radius 6, compose radius 8, motion 0.15s–0.3s.
 */
export const omaAntdTheme = {
  token: {
    colorPrimary: '#1677FF',
    colorPrimaryHover: '#4096FF',
    colorPrimaryActive: '#0958D9',
    colorBgLayout: '#F5F6F7',
    colorBgContainer: '#FFFFFF',
    colorText: '#333333',
    colorTextSecondary: '#5E6166',
    colorTextTertiary: '#8C8C8C',
    colorBorder: '#E2E3E5',
    colorBorderSecondary: '#E2E3E5',
    controlHeight: 32,
    borderRadius: 6,
    borderRadiusLG: 8,
    fontSize: 14,
    fontSizeSM: 12,
    lineHeight: 1.5714285714,
    fontWeightStrong: 500,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    motionDurationMid: '0.15s',
    motionDurationSlow: '0.3s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  components: {
    Button: {
      borderRadius: 6,
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 400,
    },
    Input: {
      borderRadius: 6,
      paddingBlock: 4,
      paddingInline: 11,
    },
    Select: {
      borderRadius: 6,
    },
    Modal: {
      borderRadiusLG: 8,
      contentBg: '#FFFFFF',
      headerBg: '#FFFFFF',
    },
    Drawer: {
      borderRadiusLG: 8,
      colorBgElevated: '#FFFFFF',
    },
    Card: { borderRadiusLG: 8 },
    Tabs: {
      horizontalItemPadding: '8px 12px',
      titleFontSize: 14,
    },
    Tooltip: {
      borderRadius: 6,
    },
  },
} as const;

export const omaArabicFontFamily =
  'var(--font-noto-arabic), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
