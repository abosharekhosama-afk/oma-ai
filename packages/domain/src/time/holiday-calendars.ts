/** Bundled public-holiday calendars. No live third-party fetch (DEC-016). */

export const HOLIDAY_CALENDAR_IDS = [
  'il',
  'ps',
  'us',
  'gb',
  'ae',
  'sa',
  'eg',
  'jo',
  'intl',
] as const;

export type HolidayCalendarId = (typeof HOLIDAY_CALENDAR_IDS)[number];

export type HolidayEntry = {
  date: string;
  nameEn: string;
  nameAr: string;
  calendarId: HolidayCalendarId;
};

export type HolidayCalendarDef = {
  id: HolidayCalendarId;
  nameEn: string;
  nameAr: string;
};

const YEARS = [2025, 2026, 2027, 2028] as const;

export const HOLIDAY_CALENDAR_CATALOG: HolidayCalendarDef[] = [
  { id: 'il', nameEn: 'Israel', nameAr: 'إسرائيل' },
  { id: 'ps', nameEn: 'Palestine', nameAr: 'فلسطين' },
  { id: 'us', nameEn: 'United States', nameAr: 'الولايات المتحدة' },
  { id: 'gb', nameEn: 'United Kingdom', nameAr: 'المملكة المتحدة' },
  { id: 'ae', nameEn: 'United Arab Emirates', nameAr: 'الإمارات' },
  { id: 'sa', nameEn: 'Saudi Arabia', nameAr: 'السعودية' },
  { id: 'eg', nameEn: 'Egypt', nameAr: 'مصر' },
  { id: 'jo', nameEn: 'Jordan', nameAr: 'الأردن' },
  { id: 'intl', nameEn: 'International', nameAr: 'دولية' },
];

function yearly(
  monthDay: string,
  nameEn: string,
  nameAr: string,
  calendarId: HolidayCalendarId,
): HolidayEntry[] {
  return YEARS.map((y) => ({ date: `${y}-${monthDay}`, nameEn, nameAr, calendarId }));
}

function dated(
  rows: Array<[string, string, string]>,
  calendarId: HolidayCalendarId,
): HolidayEntry[] {
  return rows.map(([date, nameEn, nameAr]) => ({ date, nameEn, nameAr, calendarId }));
}

const IL: HolidayEntry[] = [
  ...dated(
    [
      ['2025-04-13', 'Passover', 'عيد الفصح'],
      ['2025-04-30', 'Independence Day', 'يوم الاستقلال'],
      ['2025-06-02', 'Shavuot', 'شافوعوت'],
      ['2025-09-23', 'Rosh Hashanah', 'رأس السنة العبرية'],
      ['2025-10-02', 'Yom Kippur', 'يوم الغفران'],
      ['2025-10-07', 'Sukkot', 'المظال'],
      ['2025-12-15', 'Hanukkah', 'حانوكا'],
      ['2026-03-03', 'Purim', 'بوريم'],
      ['2026-04-02', 'Passover', 'عيد الفصح'],
      ['2026-04-22', 'Independence Day', 'يوم الاستقلال'],
      ['2026-05-22', 'Shavuot', 'شافوعوت'],
      ['2026-09-12', 'Rosh Hashanah', 'رأس السنة العبرية'],
      ['2026-09-21', 'Yom Kippur', 'يوم الغفران'],
      ['2026-09-26', 'Sukkot', 'المظال'],
      ['2026-11-01', 'Aliyah Day', 'يوم الهجرة'],
      ['2026-12-06', "Asarah B'Tevet", 'العاشر من طيفت'],
      ['2026-12-15', 'Hanukkah', 'حانوكا'],
      ['2027-03-23', 'Purim', 'بوريم'],
      ['2027-04-22', 'Passover', 'عيد الفصح'],
      ['2027-05-12', 'Independence Day', 'يوم الاستقلال'],
      ['2027-06-11', 'Shavuot', 'شافوعوت'],
      ['2027-10-02', 'Rosh Hashanah', 'رأس السنة العبرية'],
      ['2027-10-11', 'Yom Kippur', 'يوم الغفران'],
      ['2027-10-16', 'Sukkot', 'المظال'],
      ['2028-03-12', 'Purim', 'بوريم'],
      ['2028-04-11', 'Passover', 'عيد الفصح'],
      ['2028-05-02', 'Independence Day', 'يوم الاستقلال'],
      ['2028-05-31', 'Shavuot', 'شافوعوت'],
      ['2028-09-21', 'Rosh Hashanah', 'رأس السنة العبرية'],
      ['2028-09-30', 'Yom Kippur', 'يوم الغفران'],
      ['2028-10-05', 'Sukkot', 'المظال'],
    ],
    'il',
  ),
];

const PS: HolidayEntry[] = [
  ...yearly('01-01', 'New Year’s Day', 'رأس السنة', 'ps'),
  ...yearly('05-01', 'Labour Day', 'عيد العمال', 'ps'),
  ...yearly('05-15', 'Nakba Day', 'يوم النكبة', 'ps'),
  ...yearly('11-15', 'Independence Day', 'يوم الاستقلال', 'ps'),
  ...dated(
    [
      ['2025-03-31', 'Eid al-Fitr', 'عيد الفطر'],
      ['2025-06-07', 'Eid al-Adha', 'عيد الأضحى'],
      ['2026-03-20', 'Eid al-Fitr', 'عيد الفطر'],
      ['2026-05-27', 'Eid al-Adha', 'عيد الأضحى'],
      ['2027-03-10', 'Eid al-Fitr', 'عيد الفطر'],
      ['2027-05-17', 'Eid al-Adha', 'عيد الأضحى'],
      ['2028-02-27', 'Eid al-Fitr', 'عيد الفطر'],
      ['2028-05-05', 'Eid al-Adha', 'عيد الأضحى'],
    ],
    'ps',
  ),
];

const US: HolidayEntry[] = [
  ...yearly('01-01', "New Year's Day", 'رأس السنة', 'us'),
  ...yearly('06-19', 'Juneteenth', 'جونتينث', 'us'),
  ...yearly('07-04', 'Independence Day', 'يوم الاستقلال', 'us'),
  ...yearly('11-11', 'Veterans Day', 'يوم المحاربين', 'us'),
  ...yearly('12-25', 'Christmas Day', 'عيد الميلاد', 'us'),
  ...dated(
    [
      ['2025-01-20', 'Martin Luther King Jr. Day', 'يوم مارتن لوثر كينغ'],
      ['2025-02-17', "Presidents' Day", 'يوم الرؤساء'],
      ['2025-05-26', 'Memorial Day', 'يوم الذكرى'],
      ['2025-09-01', 'Labor Day', 'عيد العمال'],
      ['2025-10-13', 'Indigenous Peoples’ Day', 'يوم الشعوب الأصلية'],
      ['2025-11-27', 'Thanksgiving', 'عيد الشكر'],
      ['2026-01-19', 'Martin Luther King Jr. Day', 'يوم مارتن لوثر كينغ'],
      ['2026-02-16', "Presidents' Day", 'يوم الرؤساء'],
      ['2026-05-25', 'Memorial Day', 'يوم الذكرى'],
      ['2026-09-07', 'Labor Day', 'عيد العمال'],
      ['2026-10-12', 'Indigenous Peoples’ Day', 'يوم الشعوب الأصلية'],
      ['2026-11-03', 'Election Day', 'يوم الانتخابات'],
      ['2026-11-26', 'Thanksgiving', 'عيد الشكر'],
      ['2027-01-18', 'Martin Luther King Jr. Day', 'يوم مارتن لوثر كينغ'],
      ['2027-02-15', "Presidents' Day", 'يوم الرؤساء'],
      ['2027-05-31', 'Memorial Day', 'يوم الذكرى'],
      ['2027-09-06', 'Labor Day', 'عيد العمال'],
      ['2027-10-11', 'Indigenous Peoples’ Day', 'يوم الشعوب الأصلية'],
      ['2027-11-25', 'Thanksgiving', 'عيد الشكر'],
      ['2028-01-17', 'Martin Luther King Jr. Day', 'يوم مارتن لوثر كينغ'],
      ['2028-02-21', "Presidents' Day", 'يوم الرؤساء'],
      ['2028-05-29', 'Memorial Day', 'يوم الذكرى'],
      ['2028-09-04', 'Labor Day', 'عيد العمال'],
      ['2028-10-09', 'Indigenous Peoples’ Day', 'يوم الشعوب الأصلية'],
      ['2028-11-23', 'Thanksgiving', 'عيد الشكر'],
    ],
    'us',
  ),
];

const GB: HolidayEntry[] = [
  ...yearly('01-01', "New Year's Day", 'رأس السنة', 'gb'),
  ...yearly('12-25', 'Christmas Day', 'عيد الميلاد', 'gb'),
  ...yearly('12-26', 'Boxing Day', 'يوم الملاكمة', 'gb'),
  ...dated(
    [
      ['2025-04-18', 'Good Friday', 'الجمعة العظيمة'],
      ['2025-04-21', 'Easter Monday', 'اثنين الفصح'],
      ['2025-05-05', 'Early May bank holiday', 'عطلة مايو'],
      ['2025-05-26', 'Spring bank holiday', 'عطلة الربيع'],
      ['2025-08-25', 'Summer bank holiday', 'عطلة الصيف'],
      ['2026-04-03', 'Good Friday', 'الجمعة العظيمة'],
      ['2026-04-06', 'Easter Monday', 'اثنين الفصح'],
      ['2026-05-04', 'Early May bank holiday', 'عطلة مايو'],
      ['2026-05-25', 'Spring bank holiday', 'عطلة الربيع'],
      ['2026-08-31', 'Summer bank holiday', 'عطلة الصيف'],
      ['2027-03-26', 'Good Friday', 'الجمعة العظيمة'],
      ['2027-03-29', 'Easter Monday', 'اثنين الفصح'],
      ['2027-05-03', 'Early May bank holiday', 'عطلة مايو'],
      ['2027-05-31', 'Spring bank holiday', 'عطلة الربيع'],
      ['2027-08-30', 'Summer bank holiday', 'عطلة الصيف'],
      ['2028-04-14', 'Good Friday', 'الجمعة العظيمة'],
      ['2028-04-17', 'Easter Monday', 'اثنين الفصح'],
      ['2028-05-01', 'Early May bank holiday', 'عطلة مايو'],
      ['2028-05-29', 'Spring bank holiday', 'عطلة الربيع'],
      ['2028-08-28', 'Summer bank holiday', 'عطلة الصيف'],
    ],
    'gb',
  ),
];

const AE: HolidayEntry[] = [
  ...yearly('01-01', "New Year's Day", 'رأس السنة', 'ae'),
  ...yearly('12-02', 'National Day', 'اليوم الوطني', 'ae'),
  ...dated(
    [
      ['2025-03-31', 'Eid al-Fitr', 'عيد الفطر'],
      ['2025-06-07', 'Eid al-Adha', 'عيد الأضحى'],
      ['2026-03-20', 'Eid al-Fitr', 'عيد الفطر'],
      ['2026-05-27', 'Eid al-Adha', 'عيد الأضحى'],
      ['2027-03-10', 'Eid al-Fitr', 'عيد الفطر'],
      ['2027-05-17', 'Eid al-Adha', 'عيد الأضحى'],
      ['2028-02-27', 'Eid al-Fitr', 'عيد الفطر'],
      ['2028-05-05', 'Eid al-Adha', 'عيد الأضحى'],
    ],
    'ae',
  ),
];

const SA: HolidayEntry[] = [
  ...yearly('02-22', 'Founding Day', 'يوم التأسيس', 'sa'),
  ...yearly('09-23', 'National Day', 'اليوم الوطني', 'sa'),
  ...dated(
    [
      ['2025-03-31', 'Eid al-Fitr', 'عيد الفطر'],
      ['2025-06-07', 'Eid al-Adha', 'عيد الأضحى'],
      ['2026-03-20', 'Eid al-Fitr', 'عيد الفطر'],
      ['2026-05-27', 'Eid al-Adha', 'عيد الأضحى'],
      ['2027-03-10', 'Eid al-Fitr', 'عيد الفطر'],
      ['2027-05-17', 'Eid al-Adha', 'عيد الأضحى'],
      ['2028-02-27', 'Eid al-Fitr', 'عيد الفطر'],
      ['2028-05-05', 'Eid al-Adha', 'عيد الأضحى'],
    ],
    'sa',
  ),
];

const EG: HolidayEntry[] = [
  ...yearly('01-07', 'Coptic Christmas', 'عيد الميلاد القبطي', 'eg'),
  ...yearly('01-25', 'Revolution Day', 'عيد الثورة', 'eg'),
  ...yearly('04-25', 'Sinai Liberation Day', 'عيد تحرير سيناء', 'eg'),
  ...yearly('05-01', 'Labour Day', 'عيد العمال', 'eg'),
  ...yearly('07-23', 'Revolution Day', 'عيد ثورة يوليو', 'eg'),
  ...yearly('10-06', 'Armed Forces Day', 'عيد القوات المسلحة', 'eg'),
  ...dated(
    [
      ['2025-03-31', 'Eid al-Fitr', 'عيد الفطر'],
      ['2025-06-07', 'Eid al-Adha', 'عيد الأضحى'],
      ['2026-03-20', 'Eid al-Fitr', 'عيد الفطر'],
      ['2026-05-27', 'Eid al-Adha', 'عيد الأضحى'],
      ['2027-03-10', 'Eid al-Fitr', 'عيد الفطر'],
      ['2027-05-17', 'Eid al-Adha', 'عيد الأضحى'],
      ['2028-02-27', 'Eid al-Fitr', 'عيد الفطر'],
      ['2028-05-05', 'Eid al-Adha', 'عيد الأضحى'],
    ],
    'eg',
  ),
];

const JO: HolidayEntry[] = [
  ...yearly('01-01', "New Year's Day", 'رأس السنة', 'jo'),
  ...yearly('05-01', 'Labour Day', 'عيد العمال', 'jo'),
  ...yearly('05-25', 'Independence Day', 'عيد الاستقلال', 'jo'),
  ...yearly('12-25', 'Christmas Day', 'عيد الميلاد', 'jo'),
  ...dated(
    [
      ['2025-03-31', 'Eid al-Fitr', 'عيد الفطر'],
      ['2025-06-07', 'Eid al-Adha', 'عيد الأضحى'],
      ['2026-03-20', 'Eid al-Fitr', 'عيد الفطر'],
      ['2026-05-27', 'Eid al-Adha', 'عيد الأضحى'],
      ['2027-03-10', 'Eid al-Fitr', 'عيد الفطر'],
      ['2027-05-17', 'Eid al-Adha', 'عيد الأضحى'],
      ['2028-02-27', 'Eid al-Fitr', 'عيد الفطر'],
      ['2028-05-05', 'Eid al-Adha', 'عيد الأضحى'],
    ],
    'jo',
  ),
];

const INTL: HolidayEntry[] = [
  ...yearly('01-01', "New Year's Day", 'رأس السنة', 'intl'),
  ...yearly('12-24', 'Christmas Eve', 'ليلة الميلاد', 'intl'),
  ...yearly('12-25', 'Christmas Day', 'عيد الميلاد', 'intl'),
  ...yearly('12-26', 'Boxing Day', 'يوم الملاكمة', 'intl'),
  ...yearly('12-31', "New Year's Eve", 'ليلة رأس السنة', 'intl'),
];

const ALL: Record<HolidayCalendarId, HolidayEntry[]> = {
  il: IL,
  ps: PS,
  us: US,
  gb: GB,
  ae: AE,
  sa: SA,
  eg: EG,
  jo: JO,
  intl: INTL,
};

export function isHolidayCalendarId(v: unknown): v is HolidayCalendarId {
  return typeof v === 'string' && (HOLIDAY_CALENDAR_IDS as readonly string[]).includes(v);
}

export function parseHolidayCalendarIds(raw: unknown): HolidayCalendarId[] {
  if (typeof raw === 'string') {
    try {
      return parseHolidayCalendarIds(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<HolidayCalendarId>();
  const out: HolidayCalendarId[] = [];
  for (const v of raw) {
    if (!isHolidayCalendarId(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function defaultHolidayCalendarsForTimezone(timezone: string): HolidayCalendarId[] {
  const tz = timezone.trim();
  if (tz === 'Asia/Jerusalem' || tz === 'Asia/Tel_Aviv') return ['il'];
  if (tz === 'Asia/Gaza' || tz === 'Asia/Hebron') return ['ps'];
  if (tz === 'Europe/London') return ['gb'];
  if (tz === 'Asia/Dubai') return ['ae'];
  if (tz === 'Asia/Riyadh') return ['sa'];
  if (tz === 'Africa/Cairo') return ['eg'];
  if (tz === 'Asia/Amman') return ['jo'];
  if (tz.startsWith('America/')) return ['us'];
  if (tz.startsWith('Europe/')) return ['intl'];
  return ['intl'];
}

export function resolveHolidayCalendarIds(stored: unknown, timezone: string): HolidayCalendarId[] {
  const parsed = parseHolidayCalendarIds(stored);
  return parsed.length ? parsed : defaultHolidayCalendarsForTimezone(timezone);
}

export function holidaysForCalendars(
  ids: readonly HolidayCalendarId[],
  from?: string,
  to?: string,
): HolidayEntry[] {
  const rows = ids.flatMap((id) => ALL[id] ?? []);
  return rows
    .filter((h) => (!from || h.date >= from) && (!to || h.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.calendarId.localeCompare(b.calendarId));
}

export function holidayMapForCalendars(
  ids: readonly HolidayCalendarId[],
  locale?: string,
): Record<string, string> {
  const ar = (locale ?? '').toLowerCase().startsWith('ar');
  const map: Record<string, string> = {};
  for (const h of holidaysForCalendars(ids)) {
    const label = ar ? h.nameAr || h.nameEn : h.nameEn;
    map[h.date] = map[h.date] ? `${map[h.date]} · ${label}` : label;
  }
  return map;
}
