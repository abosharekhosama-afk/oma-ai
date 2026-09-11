/**
 * Typed local DemoDataProvider — linked agency scenario for Owner product demo.
 * Guarded by assertDemoModeAllowed(); never active in production.
 */

export type DemoLocaleCopy = { en: string; ar: string };

export type DemoBrandState = 'healthy' | 'partial' | 'draft';
export type DemoTrack = 'ORGANIC' | 'PAID';
export type DemoCampaignStatus =
  'DRAFT' | 'ACTIVE' | 'NEEDS_ATTENTION' | 'IN_REVIEW' | 'UPCOMING' | 'COMPLETED' | 'ARCHIVED';
export type DemoContentStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED_DEMO' | 'IN_REVIEW' | 'APPROVED';
export type DemoTaskStatus =
  'BACKLOG' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'DONE' | 'OVERDUE';
export type DemoDeliverableType =
  'STATIC' | 'CAROUSEL' | 'REEL' | 'LONG_VIDEO' | 'COPY' | 'PHOTOGRAPHY';
export type DemoReviewStatus = 'AWAITING_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';
export type DemoIntegrationStatus = 'NOT_CONNECTED' | 'DEFERRED';

export type DemoGraph = {
  meta: {
    label: DemoLocaleCopy;
    scenario: string;
    companyName: DemoLocaleCopy;
    tenantSlug: string;
  };
  brands: Array<{
    id: string;
    name: DemoLocaleCopy;
    state: DemoBrandState;
    profileStatus: string;
    strategyId: string | null;
  }>;
  strategies: Array<{
    id: string;
    brandId: string;
    name: DemoLocaleCopy;
    status: string;
    isCurrent: boolean;
  }>;
  campaigns: Array<{
    id: string;
    brandId: string;
    strategyId: string;
    name: DemoLocaleCopy;
    track: DemoTrack;
    status: DemoCampaignStatus;
    objective: DemoLocaleCopy;
    audience: DemoLocaleCopy;
    channels: string[];
    timeline: { start: string; end: string };
    budget: { amount: number; currency: string; planningOnly: true };
    owner: string;
    kpis: Array<{ name: DemoLocaleCopy; target: string; progress: number }>;
  }>;
  contentItems: Array<{
    id: string;
    campaignId: string;
    brandId: string;
    title: DemoLocaleCopy;
    track: DemoTrack;
    channel: string;
    contentType: 'REEL' | 'CAROUSEL' | 'STATIC' | 'STORY' | 'POST';
    status: DemoContentStatus;
    scheduledAt: string | null;
    assignee: string;
    previewAsset: string;
    deliverableId: string | null;
    caption?: DemoLocaleCopy;
    objective?: DemoLocaleCopy;
    cta?: DemoLocaleCopy;
  }>;
  requests: Array<{
    id: string;
    brandId: string;
    campaignId: string | null;
    title: DemoLocaleCopy;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: 'OPEN' | 'IN_BRIEF' | 'IN_PRODUCTION' | 'DONE';
    dueAt: string;
    requester: string;
    briefId: string | null;
  }>;
  briefs: Array<{
    id: string;
    requestId: string;
    objective: DemoLocaleCopy;
    audience: DemoLocaleCopy;
    channels: string[];
    formats: string[];
    references: string[];
    dueAt: string;
    attachmentAssets: string[];
  }>;
  tasks: Array<{
    id: string;
    brandId: string;
    requestId: string | null;
    deliverableId: string | null;
    title: DemoLocaleCopy;
    type: 'DESIGN' | 'COPY' | 'VIDEO' | 'PHOTO';
    status: DemoTaskStatus;
    assignee: string;
    department: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueAt: string;
    dependencies: string[];
    checklist: Array<{ id: string; label: DemoLocaleCopy; done: boolean }>;
    comments: Array<{ id: string; author: string; body: DemoLocaleCopy; at: string }>;
  }>;
  deliverables: Array<{
    id: string;
    brandId: string;
    campaignId: string;
    taskId: string | null;
    title: DemoLocaleCopy;
    type: DemoDeliverableType;
    reviewStatus: DemoReviewStatus;
    currentVersionId: string;
    versions: Array<{
      id: string;
      label: string;
      assets: string[];
      notes: DemoLocaleCopy;
      createdAt: string;
      immutable: boolean;
    }>;
    changeRequests: Array<{ id: string; body: DemoLocaleCopy; author: string; at: string }>;
  }>;
  scheduledPosts: Array<{
    id: string;
    contentId: string;
    brandId: string;
    channels: string[];
    plannedAt: string;
    timezone: string;
    caption: DemoLocaleCopy;
    readiness: Array<{ check: DemoLocaleCopy; ok: boolean }>;
    state: 'PLANNED' | 'READY' | 'PUBLISHED_DEMO';
    externalPublishingConnected: false;
  }>;
  analytics: {
    disclosure: DemoLocaleCopy;
    executiveSummary: DemoLocaleCopy;
    channels: Array<{ channel: string; reach: number; engagement: number; track: DemoTrack }>;
    campaigns: Array<{ campaignId: string; spendPlan: number; resultsIndex: number }>;
    topContent: Array<{ contentId: string; metric: number }>;
    kpiProgress: Array<{ name: DemoLocaleCopy; value: number; target: number }>;
  };
  members: Array<{
    id: string;
    name: DemoLocaleCopy;
    role: string;
    workload: number;
    assignments: number;
    reviewQueue: number;
    restricted: boolean;
  }>;
  activity: Array<{
    id: string;
    at: string;
    actor: string;
    summary: DemoLocaleCopy;
    href: string;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    summary: DemoLocaleCopy;
    deepLinkPath: string;
    read: boolean;
    at: string;
  }>;
  integrations: Array<{
    id: string;
    name: DemoLocaleCopy;
    category: string;
    status: DemoIntegrationStatus;
    note: DemoLocaleCopy;
  }>;
  commandCenter: {
    reviewQueueCount: number;
    overdueTasks: number;
    upcomingDeadlines: Array<{ label: DemoLocaleCopy; at: string; href: string }>;
    performanceBlurb: DemoLocaleCopy;
    nextActions: Array<{ label: DemoLocaleCopy; href: string }>;
  };
};

export function isDemoModeEnabled(env: { NODE_ENV?: string; OMA_DEMO_MODE?: string }): boolean {
  if (env.NODE_ENV === 'production') return false;
  return env.OMA_DEMO_MODE === '1' || env.OMA_DEMO_MODE === 'true';
}

export function assertDemoModeAllowed(env: { NODE_ENV?: string; OMA_DEMO_MODE?: string }): void {
  if (
    env.NODE_ENV === 'production' &&
    (env.OMA_DEMO_MODE === '1' || env.OMA_DEMO_MODE === 'true')
  ) {
    throw new Error('OMA_DEMO_MODE cannot activate in production');
  }
  if (!isDemoModeEnabled(env)) {
    throw new Error('Demo mode is not enabled');
  }
}

export const DEMO_GRAPH: DemoGraph = {
  meta: {
    label: { en: 'Demo Data', ar: 'بيانات تجريبية' },
    scenario: 'horizon-agency-complete-journey',
    companyName: {
      en: 'Horizon Creative Agency',
      ar: 'وكالة هورايزون الإبداعية',
    },
    tenantSlug: 'oma-product-demo',
  },
  brands: [
    {
      id: 'demo-brand-horizon',
      name: { en: 'Horizon Retail', ar: 'هورايزون للتجزئة' },
      state: 'healthy',
      profileStatus: 'APPROVED',
      strategyId: 'demo-strategy-q3',
    },
    {
      id: 'demo-brand-partial',
      name: { en: 'Cedar Wellness', ar: 'سيدار للعافية' },
      state: 'partial',
      profileStatus: 'NEEDS_REVIEW',
      strategyId: null,
    },
    {
      id: 'demo-brand-draft',
      name: { en: 'Nova Labs', ar: 'نوفا لابز' },
      state: 'draft',
      profileStatus: 'DRAFT',
      strategyId: null,
    },
  ],
  strategies: [
    {
      id: 'demo-strategy-q3',
      brandId: 'demo-brand-horizon',
      name: { en: 'Q3 Always-On Growth', ar: 'نمو الربع الثالث المستمر' },
      status: 'APPROVED',
      isCurrent: true,
    },
  ],
  campaigns: [
    {
      id: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      strategyId: 'demo-strategy-q3',
      name: { en: 'Summer Organic Always-On', ar: 'حملة عضوية صيفية مستمرة' },
      track: 'ORGANIC',
      status: 'ACTIVE',
      objective: {
        en: 'Grow branded search and community trust',
        ar: 'تنمية البحث بالعلامة والثقة المجتمعية',
      },
      audience: {
        en: 'Gulf professionals 25–44 interested in lifestyle retail',
        ar: 'محترفون في الخليج 25–44 مهتمون بتجزئة أسلوب الحياة',
      },
      channels: ['Instagram', 'LinkedIn', 'TikTok'],
      timeline: { start: '2026-07-01', end: '2026-09-30' },
      budget: { amount: 0, currency: 'AED', planningOnly: true },
      owner: 'Layla Haddad',
      kpis: [
        {
          name: { en: 'Engagement rate', ar: 'معدل التفاعل' },
          target: '4.5%',
          progress: 0.72,
        },
        {
          name: { en: 'Saves', ar: 'المحفوظات' },
          target: '1.2k',
          progress: 0.61,
        },
      ],
    },
    {
      id: 'demo-campaign-paid',
      brandId: 'demo-brand-horizon',
      strategyId: 'demo-strategy-q3',
      name: { en: 'Back-to-Work Paid Push', ar: 'دفعة مدفوعة للعودة للعمل' },
      track: 'PAID',
      status: 'UPCOMING',
      objective: {
        en: 'Drive qualified traffic to September collection',
        ar: 'دفع زيارات مؤهلة لمجموعة سبتمبر',
      },
      audience: {
        en: 'Lookalike of high-intent site visitors',
        ar: 'جمهور مشابه لزوار الموقع عاليي النية',
      },
      channels: ['Meta Ads', 'TikTok Ads'],
      timeline: { start: '2026-09-15', end: '2026-10-15' },
      budget: { amount: 48000, currency: 'AED', planningOnly: true },
      owner: 'Omar Faris',
      kpis: [
        {
          name: { en: 'CPA (plan)', ar: 'تكلفة الاستحواذ (خطة)' },
          target: 'AED 42',
          progress: 0.2,
        },
      ],
    },
    {
      id: 'demo-campaign-draft',
      brandId: 'demo-brand-horizon',
      strategyId: 'demo-strategy-q3',
      name: { en: 'Holiday Teaser Draft', ar: 'مسودة تشويقية للعطلة' },
      track: 'ORGANIC',
      status: 'DRAFT',
      objective: {
        en: 'Seed holiday narrative without publishing yet',
        ar: 'تأسيس سرد العطلة دون نشر بعد',
      },
      audience: {
        en: 'Existing customers warm list',
        ar: 'قائمة العملاء الدافئة الحالية',
      },
      channels: ['Instagram', 'Email'],
      timeline: { start: '2026-10-01', end: '2026-11-15' },
      budget: { amount: 0, currency: 'AED', planningOnly: true },
      owner: 'Sara Alami',
      kpis: [
        {
          name: { en: 'Story completion', ar: 'إكمال القصة' },
          target: '65%',
          progress: 0.05,
        },
      ],
    },
    {
      id: 'demo-campaign-attention',
      brandId: 'demo-brand-horizon',
      strategyId: 'demo-strategy-q3',
      name: { en: 'Review Bottleneck Sprint', ar: 'سباق اختناق المراجعات' },
      track: 'PAID',
      status: 'NEEDS_ATTENTION',
      objective: {
        en: 'Clear overdue creatives before paid launch window',
        ar: 'إنهاء الإبداعات المتأخرة قبل نافذة الإطلاق المدفوع',
      },
      audience: {
        en: 'Cart abandoners last 30 days',
        ar: 'متخلّو السلة خلال 30 يومًا',
      },
      channels: ['Meta Ads'],
      timeline: { start: '2026-09-01', end: '2026-09-20' },
      budget: { amount: 22000, currency: 'AED', planningOnly: true },
      owner: 'Omar Faris',
      kpis: [
        {
          name: { en: 'Assets approved', ar: 'أصول معتمدة' },
          target: '8',
          progress: 0.35,
        },
      ],
    },
    {
      id: 'demo-campaign-done',
      brandId: 'demo-brand-horizon',
      strategyId: 'demo-strategy-q3',
      name: { en: 'Spring Soft Launch (Complete)', ar: 'إطلاق الربيع الناعم (مكتمل)' },
      track: 'ORGANIC',
      status: 'COMPLETED',
      objective: {
        en: 'Validate bilingual caption system',
        ar: 'التحقق من نظام العناوين ثنائية اللغة',
      },
      audience: {
        en: 'Core Instagram followers',
        ar: 'متابعو إنستغرام الأساسيون',
      },
      channels: ['Instagram'],
      timeline: { start: '2026-03-01', end: '2026-04-15' },
      budget: { amount: 0, currency: 'AED', planningOnly: true },
      owner: 'Maya Nasser',
      kpis: [
        {
          name: { en: 'Posts shipped', ar: 'منشورات أُنجزت' },
          target: '12',
          progress: 1,
        },
      ],
    },
  ],
  contentItems: [
    {
      id: 'demo-content-reel',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Studio morning reel', ar: 'ريل صباحي من الاستوديو' },
      track: 'ORGANIC',
      channel: 'Instagram',
      contentType: 'REEL',
      status: 'SCHEDULED',
      scheduledAt: '2026-09-12T09:00:00+03:00',
      assignee: 'Maya Nasser',
      previewAsset: '/demo/video-poster.svg',
      deliverableId: 'demo-deliv-reel',
      caption: {
        en: 'Morning light, slow fabric, no rush.',
        ar: 'ضوء الصباح، قماش هادئ، بلا استعجال.',
      },
      objective: {
        en: 'Warm the week with brand texture',
        ar: 'تدفئة الأسبوع بملمس العلامة',
      },
      cta: { en: 'Shop neutrals', ar: 'تسوق الحيادي' },
    },
    {
      id: 'demo-content-carousel',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Fabric story carousel', ar: 'كاروسيل قصة القماش' },
      track: 'ORGANIC',
      channel: 'Instagram',
      contentType: 'CAROUSEL',
      status: 'IN_REVIEW',
      scheduledAt: '2026-09-14T11:00:00+03:00',
      assignee: 'Rami Khalil',
      previewAsset: '/demo/poster-carousel-1.svg',
      deliverableId: 'demo-deliv-carousel',
      caption: {
        en: 'Four slides: weave → dye → fit → wear.',
        ar: 'أربع شرائح: النسج ← الصبغ ← المقاس ← الارتداء.',
      },
      objective: {
        en: 'Explain craftsmanship in under 15 seconds of thumbing',
        ar: 'شرح الحرفية في أقل من 15 ثانية تصفح',
      },
      cta: { en: 'Save for later', ar: 'احفظ لاحقًا' },
    },
    {
      id: 'demo-content-paid-static',
      campaignId: 'demo-campaign-paid',
      brandId: 'demo-brand-horizon',
      title: { en: 'Paid collection hero', ar: 'بطل المجموعة المدفوعة' },
      track: 'PAID',
      channel: 'Meta Ads',
      contentType: 'STATIC',
      status: 'DRAFT',
      scheduledAt: '2026-09-16T10:00:00+03:00',
      assignee: 'Sara Alami',
      previewAsset: '/demo/poster-static.svg',
      deliverableId: 'demo-deliv-static',
      caption: {
        en: 'Back-to-work layers that still feel like you.',
        ar: 'طبقات العودة للعمل التي تظل على ذوقك.',
      },
      objective: {
        en: 'Hero creative for planning-only paid push',
        ar: 'إبداع بطل لدفعة مدفوعة تخطيطية فقط',
      },
      cta: { en: 'Plan visit', ar: 'خطّط للزيارة' },
    },
    {
      id: 'demo-content-published',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Founders note (published demo)', ar: 'رسالة المؤسسين (نشر تجريبي)' },
      track: 'ORGANIC',
      channel: 'LinkedIn',
      contentType: 'POST',
      status: 'PUBLISHED_DEMO',
      scheduledAt: '2026-08-20T11:00:00+03:00',
      assignee: 'Layla Haddad',
      previewAsset: '/demo/poster-static.svg',
      deliverableId: 'demo-deliv-copy',
      caption: {
        en: 'Why we still design offline first.',
        ar: 'لماذا ما زلنا نصمم دون اتصال أولًا.',
      },
      objective: {
        en: 'Thought-leadership tone for LinkedIn',
        ar: 'نبرة قيادة فكرية لينكدإن',
      },
      cta: { en: 'Read more', ar: 'اقرأ المزيد' },
    },
    {
      id: 'demo-content-story',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Fitting room poll story', ar: 'قصة استطلاع غرفة القياس' },
      track: 'ORGANIC',
      channel: 'Instagram',
      contentType: 'STORY',
      status: 'APPROVED',
      scheduledAt: '2026-09-11T18:00:00+03:00',
      assignee: 'Maya Nasser',
      previewAsset: '/demo/poster-carousel-2.svg',
      deliverableId: null,
      caption: { en: 'Which hem wins?', ar: 'أي طول يفوز؟' },
      objective: { en: 'Light engagement mid-week', ar: 'تفاعل خفيف منتصف الأسبوع' },
      cta: { en: 'Vote', ar: 'صوّت' },
    },
    {
      id: 'demo-content-tiktok',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Behind-the-rack TikTok', ar: 'تيك توك خلف الرف' },
      track: 'ORGANIC',
      channel: 'TikTok',
      contentType: 'REEL',
      status: 'SCHEDULED',
      scheduledAt: '2026-09-18T16:30:00+03:00',
      assignee: 'Rami Khalil',
      previewAsset: '/demo/video-poster.svg',
      deliverableId: null,
      caption: { en: 'Quiet chaos before doors open.', ar: 'فوضى هادئة قبل فتح الأبواب.' },
      objective: { en: 'Show operational craft', ar: 'إظهار حرفية التشغيل' },
      cta: { en: 'Follow', ar: 'تابع' },
    },
    {
      id: 'demo-content-overdue',
      campaignId: 'demo-campaign-attention',
      brandId: 'demo-brand-horizon',
      title: { en: 'Retargeting square (overdue)', ar: 'مربع إعادة الاستهداف (متأخر)' },
      track: 'PAID',
      channel: 'Meta Ads',
      contentType: 'STATIC',
      status: 'IN_REVIEW',
      scheduledAt: '2026-09-08T09:00:00+03:00',
      assignee: 'Omar Faris',
      previewAsset: '/demo/poster-static.svg',
      deliverableId: 'demo-deliv-static',
      caption: { en: 'Still deciding? Soft reminder.', ar: 'ما زلت تقرر؟ تذكير لطيف.' },
      objective: { en: 'Unblock review for paid window', ar: 'فك اختناق المراجعة لنافذة المدفوع' },
      cta: { en: 'Return to bag', ar: 'ارجع إلى الحقيبة' },
    },
    {
      id: 'demo-content-li-carousel',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Team craft carousel', ar: 'كاروسيل حرفة الفريق' },
      track: 'ORGANIC',
      channel: 'LinkedIn',
      contentType: 'CAROUSEL',
      status: 'DRAFT',
      scheduledAt: '2026-09-22T12:00:00+03:00',
      assignee: 'Layla Haddad',
      previewAsset: '/demo/poster-carousel-1.svg',
      deliverableId: null,
      caption: { en: 'People behind the product.', ar: 'الناس خلف المنتج.' },
      objective: { en: 'Employer + brand trust', ar: 'ثقة العلامة وصاحب العمل' },
      cta: { en: 'Meet the studio', ar: 'تعرّف على الاستوديو' },
    },
    {
      id: 'demo-content-email',
      campaignId: 'demo-campaign-draft',
      brandId: 'demo-brand-horizon',
      title: { en: 'Holiday soft teaser email', ar: 'بريد تشويقي ناعم للعطلة' },
      track: 'ORGANIC',
      channel: 'Email',
      contentType: 'POST',
      status: 'DRAFT',
      scheduledAt: '2026-10-05T08:00:00+03:00',
      assignee: 'Sara Alami',
      previewAsset: '/demo/poster-carousel-2.svg',
      deliverableId: null,
      caption: { en: 'Something warm is coming.', ar: 'شيء دافئ قادم.' },
      objective: { en: 'Warm list without hard sell', ar: 'تدفئة القائمة دون بيع قاسٍ' },
      cta: { en: 'Stay close', ar: 'ابقَ قريبًا' },
    },
    {
      id: 'demo-content-paid-video',
      campaignId: 'demo-campaign-paid',
      brandId: 'demo-brand-horizon',
      title: { en: 'Paid motion cutdown', ar: 'مقطع حركة مدفوع مختصر' },
      track: 'PAID',
      channel: 'TikTok Ads',
      contentType: 'REEL',
      status: 'APPROVED',
      scheduledAt: '2026-09-19T14:00:00+03:00',
      assignee: 'Maya Nasser',
      previewAsset: '/demo/video-poster.svg',
      deliverableId: 'demo-deliv-reel',
      caption: { en: '6s hook for planning board only.', ar: 'خطاف 6 ثوانٍ للوحة التخطيط فقط.' },
      objective: { en: 'Approved creative waiting on schedule', ar: 'إبداع معتمد بانتظار الجدول' },
      cta: { en: 'Discover', ar: 'اكتشف' },
    },
  ],
  requests: [
    {
      id: 'demo-request-1',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      title: {
        en: 'New autumn lookbook assets',
        ar: 'أصول كتالوج الخريف الجديد',
      },
      priority: 'HIGH',
      status: 'IN_PRODUCTION',
      dueAt: '2026-09-18',
      requester: 'Client — Horizon Marketing',
      briefId: 'demo-brief-1',
    },
  ],
  briefs: [
    {
      id: 'demo-brief-1',
      requestId: 'demo-request-1',
      objective: {
        en: 'Launch autumn palette with bilingual captions',
        ar: 'إطلاق لوحة الخريف بعناوين ثنائية اللغة',
      },
      audience: {
        en: 'Existing customers + warm prospects',
        ar: 'عملاء حاليون + مهتمون دافئون',
      },
      channels: ['Instagram', 'TikTok'],
      formats: ['Carousel', 'Reel', 'Static'],
      references: ['Moodboard — warm neutrals', 'Prior Q2 hero set'],
      dueAt: '2026-09-18',
      attachmentAssets: ['/demo/poster-static.svg'],
    },
  ],
  tasks: [
    {
      id: 'demo-task-design',
      brandId: 'demo-brand-horizon',
      requestId: 'demo-request-1',
      deliverableId: 'demo-deliv-carousel',
      title: { en: 'Design carousel v2', ar: 'تصميم الكاروسيل الإصدار 2' },
      type: 'DESIGN',
      status: 'IN_REVIEW',
      assignee: 'Rami Khalil',
      department: 'Design',
      priority: 'HIGH',
      dueAt: '2026-09-11',
      dependencies: [],
      checklist: [
        { id: 'c1', label: { en: 'Slide hierarchy', ar: 'تسلسل الشرائح' }, done: true },
        { id: 'c2', label: { en: 'AR typography check', ar: 'فحص الخط العربي' }, done: true },
        { id: 'c3', label: { en: 'Export 1080 assets', ar: 'تصدير أصول 1080' }, done: false },
      ],
      comments: [
        {
          id: 'cm1',
          author: 'Layla Haddad',
          body: {
            en: 'Please strengthen contrast on slide 2 CTA.',
            ar: 'يرجى تعزيز التباين في زر الشريحة 2.',
          },
          at: '2026-09-09T14:20:00+03:00',
        },
      ],
    },
    {
      id: 'demo-task-overdue',
      brandId: 'demo-brand-horizon',
      requestId: 'demo-request-1',
      deliverableId: 'demo-deliv-static',
      title: { en: 'Paid hero retouch', ar: 'تنقيح بطل الإعلان المدفوع' },
      type: 'PHOTO',
      status: 'OVERDUE',
      assignee: 'Sara Alami',
      department: 'Photography',
      priority: 'URGENT',
      dueAt: '2026-09-08',
      dependencies: [],
      checklist: [{ id: 'c4', label: { en: 'Color grade', ar: 'تصحيح الألوان' }, done: false }],
      comments: [],
    },
    {
      id: 'demo-task-video',
      brandId: 'demo-brand-horizon',
      requestId: null,
      deliverableId: 'demo-deliv-reel',
      title: { en: 'Edit morning reel', ar: 'مونتاج الريل الصباحي' },
      type: 'VIDEO',
      status: 'DONE',
      assignee: 'Maya Nasser',
      department: 'Video',
      priority: 'MEDIUM',
      dueAt: '2026-09-10',
      dependencies: [],
      checklist: [],
      comments: [],
    },
  ],
  deliverables: [
    {
      id: 'demo-deliv-carousel',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: 'demo-task-design',
      title: { en: 'Fabric story carousel', ar: 'كاروسيل قصة القماش' },
      type: 'CAROUSEL',
      reviewStatus: 'AWAITING_REVIEW',
      currentVersionId: 'demo-dv-car-v2',
      versions: [
        {
          id: 'demo-dv-car-v1',
          label: 'v1',
          assets: ['/demo/poster-carousel-1.svg'],
          notes: { en: 'Initial layout', ar: 'تخطيط أولي' },
          createdAt: '2026-09-05T10:00:00+03:00',
          immutable: true,
        },
        {
          id: 'demo-dv-car-v2',
          label: 'v2',
          assets: ['/demo/poster-carousel-1.svg', '/demo/poster-carousel-2.svg'],
          notes: { en: 'Added slide 2 texture', ar: 'أضيفت ملمس الشريحة 2' },
          createdAt: '2026-09-09T16:00:00+03:00',
          immutable: false,
        },
      ],
      changeRequests: [
        {
          id: 'cr1',
          body: {
            en: 'Increase CTA contrast on slide 2',
            ar: 'زيادة تباين زر الدعوة في الشريحة 2',
          },
          author: 'Layla Haddad',
          at: '2026-09-09T14:20:00+03:00',
        },
      ],
    },
    {
      id: 'demo-deliv-reel',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: 'demo-task-video',
      title: { en: 'Studio morning reel', ar: 'ريل صباحي من الاستوديو' },
      type: 'REEL',
      reviewStatus: 'APPROVED',
      currentVersionId: 'demo-dv-reel-v1',
      versions: [
        {
          id: 'demo-dv-reel-v1',
          label: 'v1 Final',
          assets: ['/demo/video-poster.svg'],
          notes: { en: 'Approved cut', ar: 'نسخة معتمدة' },
          createdAt: '2026-09-08T12:00:00+03:00',
          immutable: true,
        },
      ],
      changeRequests: [],
    },
    {
      id: 'demo-deliv-static',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      taskId: 'demo-task-overdue',
      title: { en: 'Paid collection hero', ar: 'بطل المجموعة المدفوعة' },
      type: 'STATIC',
      reviewStatus: 'CHANGES_REQUESTED',
      currentVersionId: 'demo-dv-static-v1',
      versions: [
        {
          id: 'demo-dv-static-v1',
          label: 'v1',
          assets: ['/demo/poster-static.svg'],
          notes: { en: 'Needs crop for 4:5', ar: 'يحتاج قص لنسبة 4:5' },
          createdAt: '2026-09-07T09:00:00+03:00',
          immutable: false,
        },
      ],
      changeRequests: [
        {
          id: 'cr2',
          body: { en: 'Provide 4:5 crop', ar: 'توفير قص 4:5' },
          author: 'Omar Faris',
          at: '2026-09-07T15:00:00+03:00',
        },
      ],
    },
    {
      id: 'demo-deliv-copy',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: null,
      title: { en: 'Founders LinkedIn note', ar: 'ملاحظة المؤسسين على لينكدإن' },
      type: 'COPY',
      reviewStatus: 'APPROVED',
      currentVersionId: 'demo-dv-copy-v1',
      versions: [
        {
          id: 'demo-dv-copy-v1',
          label: 'v1',
          assets: [],
          notes: {
            en: 'EN/AR copy pair approved',
            ar: 'نص إنجليزي/عربي معتمد',
          },
          createdAt: '2026-08-18T10:00:00+03:00',
          immutable: true,
        },
      ],
      changeRequests: [],
    },
  ],
  scheduledPosts: [
    {
      id: 'demo-sched-1',
      contentId: 'demo-content-reel',
      brandId: 'demo-brand-horizon',
      channels: ['Instagram'],
      plannedAt: '2026-09-12T09:00:00+03:00',
      timezone: 'Asia/Dubai',
      caption: {
        en: 'Morning light in the studio. New textures landing this week.',
        ar: 'ضوء الصباح في الاستوديو. خامات جديدة تصل هذا الأسبوع.',
      },
      readiness: [
        { check: { en: 'Asset approved', ar: 'الأصل معتمد' }, ok: true },
        { check: { en: 'Caption bilingual', ar: 'التعليق ثنائي اللغة' }, ok: true },
        {
          check: { en: 'External publishing connected', ar: 'النشر الخارجي متصل' },
          ok: false,
        },
      ],
      state: 'READY',
      externalPublishingConnected: false,
    },
  ],
  analytics: {
    disclosure: {
      en: 'Demo data — external analytics not connected',
      ar: 'بيانات تجريبية — التحليلات الخارجية غير متصلة',
    },
    executiveSummary: {
      en: 'Organic engagement is ahead of plan; paid push not yet live.',
      ar: 'التفاعل العضوي متقدم على الخطة؛ الدفعة المدفوعة لم تبدأ بعد.',
    },
    channels: [
      { channel: 'Instagram', reach: 128400, engagement: 4.8, track: 'ORGANIC' },
      { channel: 'LinkedIn', reach: 22100, engagement: 3.1, track: 'ORGANIC' },
      { channel: 'Meta Ads', reach: 0, engagement: 0, track: 'PAID' },
    ],
    campaigns: [
      { campaignId: 'demo-campaign-organic', spendPlan: 0, resultsIndex: 78 },
      { campaignId: 'demo-campaign-paid', spendPlan: 48000, resultsIndex: 12 },
    ],
    topContent: [
      { contentId: 'demo-content-published', metric: 940 },
      { contentId: 'demo-content-reel', metric: 610 },
    ],
    kpiProgress: [
      {
        name: { en: 'Engagement rate', ar: 'معدل التفاعل' },
        value: 4.1,
        target: 4.5,
      },
      { name: { en: 'Qualified visits', ar: 'زيارات مؤهلة' }, value: 820, target: 1200 },
    ],
  },
  members: [
    {
      id: 'demo-member-layla',
      name: { en: 'Layla Haddad', ar: 'ليلى حداد' },
      role: 'Account Lead',
      workload: 0.82,
      assignments: 6,
      reviewQueue: 3,
      restricted: false,
    },
    {
      id: 'demo-member-rami',
      name: { en: 'Rami Khalil', ar: 'رامي خليل' },
      role: 'Designer',
      workload: 0.91,
      assignments: 5,
      reviewQueue: 1,
      restricted: false,
    },
    {
      id: 'demo-member-reader',
      name: { en: 'Nour Reader', ar: 'نور قارئة' },
      role: 'Client Viewer',
      workload: 0.1,
      assignments: 0,
      reviewQueue: 0,
      restricted: true,
    },
  ],
  activity: [
    {
      id: 'act-1',
      at: '2026-09-09T16:05:00+03:00',
      actor: 'Rami Khalil',
      summary: {
        en: 'Uploaded carousel v2 for review',
        ar: 'رفع كاروسيل الإصدار 2 للمراجعة',
      },
      href: '/app/deliverables/demo-deliv-carousel',
    },
    {
      id: 'act-2',
      at: '2026-09-08T12:10:00+03:00',
      actor: 'Layla Haddad',
      summary: { en: 'Approved morning reel v1', ar: 'اعتمدت ريل الصباح الإصدار 1' },
      href: '/app/deliverables/demo-deliv-reel',
    },
    {
      id: 'act-3',
      at: '2026-09-01T09:00:00+03:00',
      actor: 'Omar Faris',
      summary: {
        en: 'Linked paid campaign to Q3 strategy',
        ar: 'ربط الحملة المدفوعة باستراتيجية الربع الثالث',
      },
      href: '/app/campaigns/demo-campaign-paid',
    },
  ],
  notifications: [
    {
      id: 'demo-notif-1',
      type: 'deliverable.review_requested',
      summary: {
        en: 'Carousel v2 awaits your review',
        ar: 'كاروسيل الإصدار 2 بانتظار مراجعتك',
      },
      deepLinkPath: '/app/reviews',
      read: false,
      at: '2026-09-09T16:06:00+03:00',
    },
    {
      id: 'demo-notif-2',
      type: 'task.overdue',
      summary: {
        en: 'Paid hero retouch is overdue',
        ar: 'تنقيح بطل الإعلان المدفوع متأخر',
      },
      deepLinkPath: '/app/tasks',
      read: false,
      at: '2026-09-09T08:00:00+03:00',
    },
  ],
  integrations: [
    {
      id: 'int-ai',
      name: { en: 'AI provider', ar: 'مزود الذكاء الاصطناعي' },
      category: 'AI',
      status: 'DEFERRED',
      note: {
        en: 'Not connected — DEC-016 / DEC-007',
        ar: 'غير متصل — DEC-016 / DEC-007',
      },
    },
    {
      id: 'int-crawl',
      name: { en: 'Website crawl vendor', ar: 'مزود زحف المواقع' },
      category: 'Intelligence',
      status: 'DEFERRED',
      note: {
        en: 'Not connected — DEC-016 / DEC-004',
        ar: 'غير متصل — DEC-016 / DEC-004',
      },
    },
    {
      id: 'int-meta',
      name: { en: 'Meta / paid media', ar: 'ميتا / الإعلام المدفوع' },
      category: 'Paid',
      status: 'NOT_CONNECTED',
      note: {
        en: 'Planning only — no live ad account',
        ar: 'تخطيط فقط — لا حساب إعلانات مباشر',
      },
    },
    {
      id: 'int-publish',
      name: { en: 'Social publishing', ar: 'النشر على الشبكات' },
      category: 'Publishing',
      status: 'NOT_CONNECTED',
      note: {
        en: 'External publishing not connected',
        ar: 'النشر الخارجي غير متصل',
      },
    },
    {
      id: 'int-analytics',
      name: { en: 'External analytics', ar: 'التحليلات الخارجية' },
      category: 'Analytics',
      status: 'NOT_CONNECTED',
      note: {
        en: 'Demo charts only',
        ar: 'رسوم تجريبية فقط',
      },
    },
    {
      id: 'int-storage',
      name: { en: 'Object storage / WorkDrive', ar: 'تخزين الكائنات / وورك درايف' },
      category: 'Storage',
      status: 'DEFERRED',
      note: {
        en: 'Not connected — DEC-003',
        ar: 'غير متصل — DEC-003',
      },
    },
  ],
  commandCenter: {
    reviewQueueCount: 2,
    overdueTasks: 1,
    upcomingDeadlines: [
      {
        label: { en: 'Carousel review due', ar: 'موعد مراجعة الكاروسيل' },
        at: '2026-09-11',
        href: '/app/reviews',
      },
      {
        label: { en: 'Reel publish window', ar: 'نافذة نشر الريل' },
        at: '2026-09-12',
        href: '/app/schedule',
      },
      {
        label: { en: 'Autumn lookbook due', ar: 'موعد كتالوج الخريف' },
        at: '2026-09-18',
        href: '/app/requests/demo-request-1',
      },
    ],
    performanceBlurb: {
      en: 'Organic engagement 4.1% (target 4.5%). Paid campaign still upcoming.',
      ar: 'التفاعل العضوي 4.1٪ (الهدف 4.5٪). الحملة المدفوعة لا تزال قادمة.',
    },
    nextActions: [
      {
        label: { en: 'Review carousel v2', ar: 'راجع كاروسيل الإصدار 2' },
        href: '/app/deliverables/demo-deliv-carousel',
      },
      {
        label: { en: 'Clear overdue photo task', ar: 'أنهِ مهمة التصوير المتأخرة' },
        href: '/app/tasks',
      },
      {
        label: { en: 'Confirm scheduled reel', ar: 'أكد جدولة الريل' },
        href: '/app/schedule',
      },
    ],
  },
};

export type DemoCampaignInput = {
  name: DemoLocaleCopy;
  goal?: DemoLocaleCopy;
  strategyId: string;
  brandId: string;
  track: DemoTrack;
  owner: string;
  timeline: { start: string; end: string };
  channels: string[];
  status?: DemoCampaignStatus;
  audience?: DemoLocaleCopy;
};

export type DemoContentInput = {
  title: DemoLocaleCopy;
  campaignId: string;
  brandId: string;
  track: DemoTrack;
  channel: string;
  contentType: DemoGraph['contentItems'][number]['contentType'];
  owner: string;
  scheduledAt: string | null;
  status?: DemoContentStatus;
  caption?: DemoLocaleCopy;
  objective?: DemoLocaleCopy;
  cta?: DemoLocaleCopy;
  previewAsset?: string;
};

export type DemoContentPatch = Partial<{
  title: DemoLocaleCopy;
  caption: DemoLocaleCopy;
  objective: DemoLocaleCopy;
  cta: DemoLocaleCopy;
  status: DemoContentStatus;
  scheduledAt: string | null;
  assignee: string;
  channel: string;
}>;

function cloneDemoGraph(seed: DemoGraph): DemoGraph {
  return structuredClone(seed);
}

function previewForType(type: DemoContentInput['contentType']): string {
  switch (type) {
    case 'REEL':
    case 'STORY':
      return '/demo/video-poster.svg';
    case 'CAROUSEL':
      return '/demo/poster-carousel-1.svg';
    default:
      return '/demo/poster-static.svg';
  }
}

export class DemoDataProvider {
  private graph: DemoGraph;

  constructor(seed: DemoGraph = DEMO_GRAPH) {
    this.graph = cloneDemoGraph(seed);
  }

  getGraph(): DemoGraph {
    return this.graph;
  }

  getCampaign(id: string) {
    return this.graph.campaigns.find((c) => c.id === id) ?? null;
  }

  getContent(id: string) {
    return this.graph.contentItems.find((c) => c.id === id) ?? null;
  }

  getDeliverable(id: string) {
    return this.graph.deliverables.find((d) => d.id === id) ?? null;
  }

  getRequest(id: string) {
    return this.graph.requests.find((r) => r.id === id) ?? null;
  }

  createCampaign(input: DemoCampaignInput) {
    const strategy = this.graph.strategies.find((s) => s.id === input.strategyId);
    if (!strategy) throw new Error('Strategy not found');
    const id = `demo-campaign-${Date.now().toString(36)}`;
    const row: DemoGraph['campaigns'][number] = {
      id,
      brandId: input.brandId || strategy.brandId,
      strategyId: input.strategyId,
      name: input.name,
      track: input.track,
      status: input.status ?? 'DRAFT',
      objective: input.goal ?? {
        en: 'Campaign goal pending definition',
        ar: 'هدف الحملة بانتظار التعريف',
      },
      audience: input.audience ?? {
        en: 'Audience to be refined',
        ar: 'الجمهور قيد التحديد',
      },
      channels: input.channels,
      timeline: input.timeline,
      budget: { amount: 0, currency: 'AED', planningOnly: true },
      owner: input.owner,
      kpis: [
        {
          name: { en: 'Plan progress', ar: 'تقدم الخطة' },
          target: '—',
          progress: 0.05,
        },
      ],
    };
    this.graph.campaigns = [row, ...this.graph.campaigns];
    return row;
  }

  createContent(input: DemoContentInput) {
    const campaign = this.getCampaign(input.campaignId);
    if (!campaign) throw new Error('Campaign not found');
    const id = `demo-content-${Date.now().toString(36)}`;
    const row: DemoGraph['contentItems'][number] = {
      id,
      campaignId: input.campaignId,
      brandId: input.brandId || campaign.brandId,
      title: input.title,
      track: input.track || campaign.track,
      channel: input.channel,
      contentType: input.contentType,
      status: input.status ?? 'DRAFT',
      scheduledAt: input.scheduledAt,
      assignee: input.owner,
      previewAsset: input.previewAsset ?? previewForType(input.contentType),
      deliverableId: null,
      caption: input.caption,
      objective: input.objective,
      cta: input.cta,
    };
    this.graph.contentItems = [row, ...this.graph.contentItems];
    return row;
  }

  updateContent(id: string, patch: DemoContentPatch) {
    const idx = this.graph.contentItems.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    const current = this.graph.contentItems[idx]!;
    const next = {
      ...current,
      ...patch,
      assignee: patch.assignee ?? current.assignee,
    };
    this.graph.contentItems = [
      ...this.graph.contentItems.slice(0, idx),
      next,
      ...this.graph.contentItems.slice(idx + 1),
    ];
    return next;
  }

  contentCountByCampaign(campaignId: string): number {
    return this.graph.contentItems.filter((c) => c.campaignId === campaignId).length;
  }

  reviewStateForCampaign(campaignId: string): DemoContentStatus | 'CLEAR' {
    const items = this.graph.contentItems.filter((c) => c.campaignId === campaignId);
    if (items.some((i) => i.status === 'IN_REVIEW')) return 'IN_REVIEW';
    if (items.some((i) => i.status === 'DRAFT')) return 'DRAFT';
    if (items.some((i) => i.status === 'APPROVED')) return 'APPROVED';
    if (items.some((i) => i.status === 'SCHEDULED')) return 'SCHEDULED';
    return 'CLEAR';
  }

  getLinkedJourney() {
    const brand = this.graph.brands.find((b) => b.state === 'healthy')!;
    const strategy = this.graph.strategies.find((s) => s.id === brand.strategyId)!;
    const organic = this.graph.campaigns.find(
      (c) => c.track === 'ORGANIC' && c.id === 'demo-campaign-organic',
    )!;
    const paid = this.graph.campaigns.find(
      (c) => c.track === 'PAID' && c.id === 'demo-campaign-paid',
    )!;
    const request = this.graph.requests[0]!;
    const brief = this.graph.briefs.find((b) => b.id === request.briefId)!;
    const task = this.graph.tasks.find((t) => t.status === 'IN_REVIEW')!;
    const deliverable = this.graph.deliverables.find((d) => d.id === task.deliverableId)!;
    const scheduled = this.graph.scheduledPosts[0]!;
    return {
      company: this.graph.meta.companyName,
      brand,
      strategy,
      organicCampaign: organic,
      paidCampaign: paid,
      contentPlan: this.graph.contentItems.filter((c) => c.campaignId === organic.id),
      request,
      brief,
      task,
      deliverable,
      scheduled,
      analytics: this.graph.analytics,
    };
  }
}

export const demoDataProvider =
  (globalThis as { __omaDemoDataProvider?: DemoDataProvider }).__omaDemoDataProvider ??
  new DemoDataProvider();

(globalThis as { __omaDemoDataProvider?: DemoDataProvider }).__omaDemoDataProvider =
  demoDataProvider;
