import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Noto_Sans_Arabic } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { resolveDir, resolveLocale, t, type Locale } from '@oma/i18n';
import { OmaAntdProvider } from '../components/ui/oma-antd-provider';
import { LocaleProvider } from '../lib/locale-context';
import './globals.css';

/** OMA typography: native system UI for Latin text and Noto Sans Arabic for Arabic. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OMA AI',
  description: 'OMA AI by IMKAN',
};

/**
 * Default desktop viewport. Phones override this early via the inline script below
 * (width = round(screenWidth / 0.7), initial-scale = 0.7) so content renders at 70%
 * while the layout width stays under 768px and mobile CSS still applies.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Runs before paint. Sets phone viewport to 70% scale without CSS zoom/transform. */
const MOBILE_VIEWPORT_SCALE_SCRIPT = `(function(){var SCALE=0.7;var DESKTOP=768;var applying=false;function phoneWidth(){var sw=screen.width||0,sh=screen.height||0;if(!sw||!sh)return window.innerWidth||0;var landscape=false;try{if(typeof window.orientation==="number"){landscape=Math.abs(window.orientation)===90;}else if(window.matchMedia){landscape=window.matchMedia("(orientation: landscape)").matches;}else{landscape=(window.innerWidth||0)>(window.innerHeight||0);}}catch(e){}return landscape?Math.max(sw,sh):Math.min(sw,sh);}function ensureMeta(){var meta=document.querySelector('meta[name="viewport"]');if(!meta){meta=document.createElement("meta");meta.setAttribute("name","viewport");(document.head||document.documentElement).appendChild(meta);}return meta;}function desiredContent(){var pw=phoneWidth();if(pw>=DESKTOP){return{mobile:false,content:"width=device-width, initial-scale=1, viewport-fit=cover"};}var layoutW=Math.max(1,Math.round(pw/SCALE));return{mobile:true,content:"width="+layoutW+", initial-scale="+SCALE+", minimum-scale="+SCALE+", maximum-scale="+SCALE+", user-scalable=no, viewport-fit=cover"};}function apply(){if(applying)return;applying=true;try{var meta=ensureMeta();var next=desiredContent();if(meta.getAttribute("content")!==next.content){meta.setAttribute("content",next.content);}if(next.mobile){document.documentElement.setAttribute("data-oma-mobile-scale",String(SCALE));}else{document.documentElement.removeAttribute("data-oma-mobile-scale");}}finally{applying=false;}}apply();if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",apply);}window.addEventListener("orientationchange",function(){setTimeout(apply,80);});try{var obs=new MutationObserver(function(){if(!applying)apply();});function watch(){if(!document.head)return;obs.observe(document.head,{childList:true,subtree:true});setTimeout(function(){try{obs.disconnect();}catch(e){}},2500);}if(document.head){watch();}else{document.addEventListener("DOMContentLoaded",watch);}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('oma_locale')?.value;
  const locale: Locale = resolveLocale(localeCookie ?? hdrs.get('accept-language'));
  const dir = resolveDir(locale);
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${jetbrainsMono.variable} ${notoArabic.variable}`}
      data-oma-typeface="oma-system-ui"
      suppressHydrationWarning
    >
      <head>
        <script
          // Blocking early script so the first paint uses the scaled phone viewport.
          dangerouslySetInnerHTML={{ __html: MOBILE_VIEWPORT_SCALE_SCRIPT }}
        />
      </head>
      <body data-oma-font="oma-system-ui">
        <a href="#main" className="oma-skip-link">
          {t(locale, 'shell.skip')}
        </a>
        <OmaAntdProvider locale={locale}>
          <LocaleProvider locale={locale}>{children}</LocaleProvider>
        </OmaAntdProvider>
      </body>
    </html>
  );
}
