'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import { omaAntdTheme, omaArabicFontFamily } from '@oma/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

const MOBILE_MAX = '(max-width: 767px)';

export function OmaAntdProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const ar = locale.toLowerCase().startsWith('ar');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobileCompact, setMobileCompact] = useState(false);
  dayjs.locale(ar ? 'ar' : 'en');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MAX);
    const apply = () => setMobileCompact(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const theme = useMemo(() => {
    const base = { ...omaAntdTheme.components };
    const mobileTokens = mobileCompact
      ? {
          fontSize: 12,
          fontSizeSM: 11,
          fontSizeLG: 14,
          controlHeight: 30,
          controlHeightSM: 28,
          lineHeight: 1.5,
        }
      : {};
    return {
      ...omaAntdTheme,
      token: {
        ...omaAntdTheme.token,
        fontFamily: ar ? omaArabicFontFamily : omaAntdTheme.token.fontFamily,
        motion: !reducedMotion,
        ...mobileTokens,
      },
      components: mobileCompact
        ? {
            ...base,
            Button: { ...base.Button, controlHeight: 30, paddingInline: 10, fontSize: 12 },
            Input: { ...base.Input, paddingBlock: 2 },
            Select: { ...base.Select, controlHeight: 30 },
            Tabs: { ...base.Tabs, titleFontSize: 12, horizontalItemPadding: '6px 8px' },
          }
        : omaAntdTheme.components,
    };
  }, [ar, mobileCompact, reducedMotion]);

  return (
    <AntdRegistry>
      <ConfigProvider
        direction={ar ? 'rtl' : 'ltr'}
        locale={ar ? arEG : enUS}
        componentSize={mobileCompact ? 'small' : 'middle'}
        theme={theme}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
