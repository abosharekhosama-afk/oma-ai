import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { omaAntdTheme, omaArabicFontFamily } from '@oma/ui';

describe('Planable Ant Design theme contract', () => {
  it('locks the measured control tokens', () => {
    expect(omaAntdTheme.token).toMatchObject({
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
      motionDurationMid: '0.15s',
      motionDurationSlow: '0.3s',
    });
    expect(omaAntdTheme.token.fontFamily).toContain('-apple-system');
    expect(omaArabicFontFamily.startsWith('var(--font-noto-arabic)')).toBe(true);
  });

  it('keeps one provider hierarchy and the App feedback API', () => {
    const provider = readFileSync('apps/web/src/components/ui/oma-antd-provider.tsx', 'utf8');
    const registry = provider.indexOf('<AntdRegistry>');
    const config = provider.indexOf('<ConfigProvider');
    const app = provider.indexOf('<App>');
    expect(registry).toBeGreaterThan(-1);
    expect(config).toBeGreaterThan(registry);
    expect(app).toBeGreaterThan(config);
    expect(provider).toContain('locale={ar ? arEG : enUS}');
    expect(provider).toContain("direction={ar ? 'rtl' : 'ltr'}");
    expect(provider).toContain("dayjs.locale(ar ? 'ar' : 'en')");
    const controls = readFileSync('packages/ui/src/controls.tsx', 'utf8');
    for (const name of [
      'Button',
      'IconButton',
      'Input',
      'TextArea',
      'OmaSelect',
      'DatePicker',
      'TimePicker',
      'Checkbox',
      'Modal',
      'Drawer',
      'Popover',
      'Tooltip',
      'Tabs',
      'Segmented',
      'useOmaFeedback',
    ]) {
      expect(controls).toContain(name);
    }
    expect(readFileSync('apps/web/src/components/ui/toast.tsx', 'utf8')).toContain(
      'useOmaFeedback',
    );
  });
});
