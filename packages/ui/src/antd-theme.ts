/**
 * Single Planable-derived Ant Design theme.
 * Planable remains the visual authority. Values measured from live app.planable.io
 * and owner reference screenshots 2026-10-18 (calendar, composer, feed, shell).
 * R2 live measures: body 14/400/~21.5, ink #333, muted ~#5E6166,
 * control height 32, radius 6, compose radius 8, motion 0.15s–0.3s.
 */
export const omaAntdTheme = {
  token: {
    colorPrimary: '#1677FF',
    colorPrimaryHover: '#4096FF',
    colorPrimaryActive: '#0958D9',
    colorBgLayout: '#F5F6F7',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorText: '#333333',
    colorTextSecondary: '#5E6166',
    colorTextTertiary: '#8C8C8C',
    colorBorder: '#E2E3E5',
    colorBorderSecondary: '#E2E3E5',
    colorFillSecondary: '#F5F6F7',
    colorFillTertiary: '#F5F6F7',
    controlHeight: 32,
    controlHeightSM: 28,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    fontSize: 14,
    fontSizeSM: 12,
    lineHeight: 1.5714285714,
    fontWeightStrong: 500,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    motionDurationMid: '0.15s',
    motionDurationSlow: '0.3s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 0 1px rgba(50, 79, 58, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08)',
    boxShadowSecondary: '0 0 1px rgba(50, 79, 58, 0.15), 0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  components: {
    Button: {
      borderRadius: 6,
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 400,
      controlHeight: 32,
      paddingInline: 15,
    },
    Input: {
      borderRadius: 6,
      paddingBlock: 4,
      paddingInline: 11,
      activeBorderColor: '#1677FF',
      hoverBorderColor: '#4096FF',
    },
    Select: {
      borderRadius: 6,
      controlHeight: 32,
      optionSelectedBg: '#F5F6F7',
    },
    Modal: {
      borderRadiusLG: 8,
      contentBg: '#FFFFFF',
      headerBg: '#FFFFFF',
      footerBg: '#FFFFFF',
    },
    Drawer: {
      borderRadiusLG: 0,
      colorBgElevated: '#FFFFFF',
      paddingLG: 0,
    },
    Card: { borderRadiusLG: 8 },
    Tabs: {
      horizontalItemPadding: '8px 12px',
      titleFontSize: 14,
      itemSelectedColor: '#333333',
      inkBarColor: '#1677FF',
    },
    Tooltip: {
      borderRadius: 6,
    },
    Dropdown: {
      borderRadiusLG: 8,
      paddingBlock: 6,
      controlItemBgHover: '#F5F6F7',
      controlItemBgActive: '#F5F6F7',
    },
    Menu: {
      itemBorderRadius: 6,
      itemHeight: 36,
      itemHoverBg: '#F5F6F7',
      itemSelectedBg: '#F5F6F7',
      itemSelectedColor: '#333333',
      activeBarBorderWidth: 0,
    },
    Popover: {
      borderRadiusLG: 8,
    },
    Empty: {
      colorTextDescription: '#5E6166',
    },
  },
} as const;

export const omaArabicFontFamily =
  'var(--font-noto-arabic), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
