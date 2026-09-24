'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import { omaAntdTheme, omaArabicFontFamily } from '@oma/ui';
import { useEffect, useState, type ReactNode } from 'react';

export function OmaAntdProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const ar = locale.toLowerCase().startsWith('ar');
  const [reducedMotion, setReducedMotion] = useState(false);
  dayjs.locale(ar ? 'ar' : 'en');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return (
    <AntdRegistry>
      <ConfigProvider
        direction={ar ? 'rtl' : 'ltr'}
        locale={ar ? arEG : enUS}
        theme={{
          ...omaAntdTheme,
          token: {
            ...omaAntdTheme.token,
            fontFamily: ar ? omaArabicFontFamily : omaAntdTheme.token.fontFamily,
            motion: !reducedMotion,
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
