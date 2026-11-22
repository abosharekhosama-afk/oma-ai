/**
 * Content-gap topics created from SEO audit findings are stored as
 * `<English label> · <page>` (see strategy-bridge `findingTopic`). Show them in the
 * reader's language; free-text topics written by people are left as they are.
 */
const TOPIC_LABELS: Array<{ match: RegExp; ar: string; en: string }> = [
  { match: /^meta description$/i, ar: 'الوصف التعريفي (Meta)', en: 'Meta description' },
  { match: /^title tag$/i, ar: 'وسم عنوان الصفحة', en: 'Title tag' },
  { match: /^h1 heading$/i, ar: 'العنوان الرئيسي (H1)', en: 'H1 heading' },
  { match: /^h1 missing$/i, ar: 'العنوان الرئيسي (H1)', en: 'H1 heading' },
  { match: /^thin body copy$/i, ar: 'محتوى نصي قليل', en: 'Thin body copy' },
  { match: /^thin content$/i, ar: 'محتوى نصي قليل', en: 'Thin body copy' },
  { match: /^product description$/i, ar: 'وصف المنتج', en: 'Product description' },
  { match: /^product no description$/i, ar: 'وصف المنتج', en: 'Product description' },
  { match: /^indexed for search$/i, ar: 'الظهور في فهرس البحث', en: 'Indexed for search' },
  { match: /^unique title$/i, ar: 'عنوان فريد للصفحة', en: 'Unique title' },
  { match: /^canonical (link|missing)$/i, ar: 'رابط Canonical مفقود', en: 'Canonical link' },
  { match: /^http error$/i, ar: 'خطأ في تحميل الصفحة (HTTP)', en: 'Page load error (HTTP)' },
];

export function localizeSeoGapTopic(topic: string, locale: 'en' | 'ar' | string): string {
  const raw = (topic ?? '').trim();
  if (!raw) return raw;
  const sep = raw.indexOf(' · ');
  const label = sep >= 0 ? raw.slice(0, sep).trim() : raw;
  const page = sep >= 0 ? raw.slice(sep + 3).trim() : '';
  const hit = TOPIC_LABELS.find((t) => t.match.test(label));
  if (!hit) return raw;
  const text = locale === 'ar' ? hit.ar : hit.en;
  const pageText = page === 'Site page' && locale === 'ar' ? 'صفحة الموقع' : page;
  return pageText ? `${text} · ${pageText}` : text;
}
