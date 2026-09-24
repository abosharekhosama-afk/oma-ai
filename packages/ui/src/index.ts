import { omaAntdTheme, omaArabicFontFamily } from './antd-theme';

export { omaAntdTheme, omaArabicFontFamily };

export const tokens = {
  primary: omaAntdTheme.token.colorPrimary,
  canvas: omaAntdTheme.token.colorBgLayout,
  ink: omaAntdTheme.token.colorText,
  surface: omaAntdTheme.token.colorBgContainer,
  railExpanded: 256,
  railCollapsed: 64,
  controlHeight: omaAntdTheme.token.controlHeight,
  radiusControl: omaAntdTheme.token.borderRadius,
} as const;
