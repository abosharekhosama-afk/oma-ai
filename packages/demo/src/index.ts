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
  'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'DONE' | 'OVERDUE';
export type DemoDeliverableType =
  'STATIC' | 'CAROUSEL' | 'REEL' | 'LONG_VIDEO' | 'COPY' | 'PHOTOGRAPHY';
export type DemoReviewStatus =
  'DRAFT' | 'AWAITING_REVIEW' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';
export type DemoVersionStatus = 'DRAFT' | 'SUBMITTED' | 'SUPERSEDED' | 'APPROVED' | 'REJECTED';
export type DemoIntegrationStatus = 'NOT_CONNECTED' | 'DEFERRED';

export type DemoDeliverableAnnotation = {
  id: string;
  versionId: string;
  x: number;
  y: number;
  number: number;
  author: string;
  body: DemoLocaleCopy;
  at: string;
  resolved: boolean;
  replies: Array<{ id: string; author: string; body: DemoLocaleCopy; at: string }>;
  timestampLabel?: string | null;
};

export type DemoDeliverableComment = {
  id: string;
  versionId: string;
  author: string;
  body: DemoLocaleCopy;
  at: string;
  resolved: boolean;
};

export type DemoDeliverableActivity = {
  id: string;
  at: string;
  actor: string;
  summary: DemoLocaleCopy;
  kind: string;
};

export type DemoDeliverableDecision = {
  id: string;
  at: string;
  actor: string;
  decision: string;
  versionId: string;
  reason: DemoLocaleCopy;
  priorStatus: string;
  newStatus: string;
};

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
    contentId: string | null;
    title: DemoLocaleCopy;
    description: DemoLocaleCopy;
    type: 'CONTENT' | 'DESIGN' | 'VIDEO' | 'CAMPAIGN_SUPPORT' | 'REVISION' | 'OTHER';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status:
      | 'OPEN'
      | 'ASSIGNED'
      | 'IN_BRIEF'
      | 'WAITING_INFO'
      | 'READY_FOR_PRODUCTION'
      | 'IN_PRODUCTION'
      | 'DONE'
      | 'CLOSED';
    dueAt: string;
    submittedAt: string;
    requester: string;
    assignee: string | null;
    briefId: string | null;
    outcome?: DemoLocaleCopy;
    formats?: string[];
    channels?: string[];
    references?: string[];
    conversionTaskIds?: string[];
  }>;
  briefs: Array<{
    id: string;
    requestId: string;
    overview: DemoLocaleCopy;
    objective: DemoLocaleCopy;
    audience: DemoLocaleCopy;
    keyMessage: DemoLocaleCopy;
    deliverableType: DemoLocaleCopy;
    channels: string[];
    formats: string[];
    tone: DemoLocaleCopy;
    mandatory: DemoLocaleCopy;
    cta: DemoLocaleCopy;
    references: string[];
    doList: DemoLocaleCopy[];
    dontList: DemoLocaleCopy[];
    timelineNote: DemoLocaleCopy;
    stakeholders: string[];
    acceptance: DemoLocaleCopy;
    dueAt: string;
    attachmentAssets: string[];
    readiness: 'DRAFT' | 'INCOMPLETE' | 'READY';
  }>;
  tasks: Array<{
    id: string;
    brandId: string;
    campaignId: string | null;
    contentId: string | null;
    requestId: string | null;
    briefId: string | null;
    deliverableId: string | null;
    title: DemoLocaleCopy;
    description: DemoLocaleCopy;
    type: 'DESIGN' | 'COPY' | 'VIDEO' | 'PHOTO';
    status: DemoTaskStatus;
    assignee: string;
    department: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueAt: string;
    updatedAt: string;
    blockedReason: DemoLocaleCopy | null;
    dependencies: string[];
    checklist: Array<{ id: string; label: DemoLocaleCopy; done: boolean }>;
    comments: Array<{ id: string; author: string; body: DemoLocaleCopy; at: string }>;
    activity: Array<{ id: string; at: string; actor: string; summary: DemoLocaleCopy }>;
  }>;
  deliverables: Array<{
    id: string;
    brandId: string;
    campaignId: string;
    taskId: string | null;
    contentId: string | null;
    requestId: string | null;
    title: DemoLocaleCopy;
    type: DemoDeliverableType;
    reviewStatus: DemoReviewStatus;
    owner: string;
    reviewer: string;
    dueAt: string;
    archived: boolean;
    currentVersionId: string;
    approvedVersionId: string | null;
    versions: Array<{
      id: string;
      label: string;
      assets: string[];
      notes: DemoLocaleCopy;
      createdAt: string;
      immutable: boolean;
      createdBy: string;
      reviewDecision: DemoReviewStatus | null;
      status: DemoVersionStatus;
    }>;
    changeRequests: Array<{ id: string; body: DemoLocaleCopy; author: string; at: string }>;
    annotations: DemoDeliverableAnnotation[];
    comments: DemoDeliverableComment[];
    activity: DemoDeliverableActivity[];
    decisions: DemoDeliverableDecision[];
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
      contentId: 'demo-content-carousel',
      title: { en: 'New autumn lookbook assets', ar: 'أصول كتالوج الخريف الجديد' },
      description: {
        en: 'Need bilingual autumn lookbook set for always-on organic.',
        ar: 'نحتاج مجموعة كتالوج خريف ثنائية اللغة للحملة العضوية المستمرة.',
      },
      type: 'DESIGN',
      priority: 'HIGH',
      status: 'IN_PRODUCTION',
      dueAt: '2026-09-18',
      submittedAt: '2026-09-01',
      requester: 'Client — Horizon Marketing',
      assignee: 'Layla Haddad',
      briefId: 'demo-brief-1',
      outcome: {
        en: 'Approved carousel + supporting statics ready for schedule',
        ar: 'كاروسيل معتمد وثوابت داعمة جاهزة للجدول',
      },
      formats: ['Carousel', 'Static'],
      channels: ['Instagram', 'TikTok'],
      references: ['Q2 hero set'],
      conversionTaskIds: ['demo-task-design', 'demo-task-overdue'],
    },
    {
      id: 'demo-request-2',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      contentId: 'demo-content-paid-static',
      title: { en: 'Paid launch cutdowns', ar: 'مقاطع إطلاق مدفوعة مختصرة' },
      description: {
        en: 'Six-second motion cutdowns for planning-only paid push.',
        ar: 'مقاطع حركة من 6 ثوانٍ لدفعة مدفوعة تخطيطية فقط.',
      },
      type: 'VIDEO',
      priority: 'URGENT',
      status: 'WAITING_INFO',
      dueAt: '2026-09-12',
      submittedAt: '2026-09-05',
      requester: 'Omar Faris',
      assignee: null,
      briefId: 'demo-brief-2',
      formats: ['Reel', 'Story'],
      channels: ['Meta Ads', 'TikTok Ads'],
      references: [],
      conversionTaskIds: [],
    },
    {
      id: 'demo-request-3',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: null,
      title: { en: 'LinkedIn founders note revision', ar: 'مراجعة رسالة المؤسسين على لينكدإن' },
      description: {
        en: 'Revise published demo note tone for executive audience.',
        ar: 'مراجعة نبرة الرسالة التجريبية للجمهور التنفيذي.',
      },
      type: 'REVISION',
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      dueAt: '2026-09-22',
      submittedAt: '2026-09-08',
      requester: 'Layla Haddad',
      assignee: 'Maya Nasser',
      briefId: 'demo-brief-3',
      formats: ['Post'],
      channels: ['LinkedIn'],
      conversionTaskIds: ['demo-task-copy-li'],
    },
    {
      id: 'demo-request-4',
      brandId: 'demo-brand-horizon',
      campaignId: null,
      contentId: null,
      title: { en: 'Untriaged product drop teaser', ar: 'تشويقية إطلاق منتج غير مصنّفة' },
      description: {
        en: 'Client asked for a teaser but did not specify channel or format.',
        ar: 'طلب العميل تشويقية دون تحديد القناة أو الصيغة.',
      },
      type: 'CONTENT',
      priority: 'HIGH',
      status: 'OPEN',
      dueAt: '2026-09-25',
      submittedAt: '2026-09-10',
      requester: 'Client — Horizon Marketing',
      assignee: null,
      briefId: null,
      formats: [],
      channels: [],
      conversionTaskIds: [],
    },
    {
      id: 'demo-request-5',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-attention',
      contentId: 'demo-content-overdue',
      title: { en: 'Unblock retargeting square', ar: 'فك اختناق مربع إعادة الاستهداف' },
      description: {
        en: 'Creative stuck in review ahead of paid window.',
        ar: 'إبداع عالق في المراجعة قبل نافذة المدفوع.',
      },
      type: 'CAMPAIGN_SUPPORT',
      priority: 'URGENT',
      status: 'READY_FOR_PRODUCTION',
      dueAt: '2026-09-09',
      submittedAt: '2026-09-03',
      requester: 'Omar Faris',
      assignee: 'Rami Khalil',
      briefId: 'demo-brief-5',
      formats: ['Static'],
      channels: ['Meta Ads'],
      conversionTaskIds: ['demo-task-ready-1'],
    },
    {
      id: 'demo-request-6',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-draft',
      contentId: 'demo-content-email',
      title: { en: 'Holiday email soft teaser', ar: 'بريد تشويقي ناعم للعطلة' },
      description: {
        en: 'Warm the list without hard sell; draft campaign only.',
        ar: 'تدفئة القائمة دون بيع قاسٍ؛ حملة مسودة فقط.',
      },
      type: 'CONTENT',
      priority: 'LOW',
      status: 'IN_BRIEF',
      dueAt: '2026-10-05',
      submittedAt: '2026-09-09',
      requester: 'Sara Alami',
      assignee: 'Sara Alami',
      briefId: 'demo-brief-6',
      formats: ['Email'],
      channels: ['Email'],
      conversionTaskIds: [],
    },
    {
      id: 'demo-request-7',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-tiktok',
      title: { en: 'Behind-the-rack TikTok shoot', ar: 'تصوير تيك توك خلف الرف' },
      description: {
        en: 'Capture quiet chaos before doors open.',
        ar: 'التقاط فوضى هادئة قبل فتح الأبواب.',
      },
      type: 'VIDEO',
      priority: 'MEDIUM',
      status: 'IN_PRODUCTION',
      dueAt: '2026-09-17',
      submittedAt: '2026-09-06',
      requester: 'Maya Nasser',
      assignee: 'Rami Khalil',
      briefId: 'demo-brief-7',
      formats: ['Reel'],
      channels: ['TikTok'],
      conversionTaskIds: ['demo-task-video-tiktok'],
    },
    {
      id: 'demo-request-8',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-done',
      contentId: null,
      title: { en: 'Spring soft launch wrap-up', ar: 'إغلاق الإطلاق الناعم للربيع' },
      description: {
        en: 'Archive remaining assets from completed campaign.',
        ar: 'أرشفة الأصول المتبقية من الحملة المكتملة.',
      },
      type: 'OTHER',
      priority: 'LOW',
      status: 'DONE',
      dueAt: '2026-04-20',
      submittedAt: '2026-04-10',
      requester: 'Maya Nasser',
      assignee: 'Layla Haddad',
      briefId: null,
      formats: [],
      channels: ['Instagram'],
      conversionTaskIds: [],
    },
    {
      id: 'demo-request-9',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-story',
      title: { en: 'Fitting room poll story', ar: 'قصة استطلاع غرفة القياس' },
      description: {
        en: 'Light mid-week engagement story.',
        ar: 'قصة تفاعل خفيفة لمنتصف الأسبوع.',
      },
      type: 'CONTENT',
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      dueAt: '2026-09-11',
      submittedAt: '2026-09-07',
      requester: 'Maya Nasser',
      assignee: 'Maya Nasser',
      briefId: 'demo-brief-9',
      formats: ['Story'],
      channels: ['Instagram'],
      conversionTaskIds: ['demo-task-story'],
    },
    {
      id: 'demo-request-10',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      contentId: null,
      title: { en: 'Closed duplicate spend ask', ar: 'طلب إنفاق مكرر مغلق' },
      description: {
        en: 'Client asked for live ad spend — closed as planning-only.',
        ar: 'طلب العميل إنفاقًا مباشرًا — أُغلق كتخطيط فقط.',
      },
      type: 'CAMPAIGN_SUPPORT',
      priority: 'LOW',
      status: 'CLOSED',
      dueAt: '2026-09-05',
      submittedAt: '2026-09-02',
      requester: 'Client — Horizon Marketing',
      assignee: 'Omar Faris',
      briefId: null,
      formats: [],
      channels: ['Meta Ads'],
      conversionTaskIds: [],
    },
  ],
  briefs: [
    {
      id: 'demo-brief-1',
      requestId: 'demo-request-1',
      overview: {
        en: 'Autumn lookbook package for organic always-on.',
        ar: 'حزمة كتالوج الخريف للحملة العضوية المستمرة.',
      },
      objective: {
        en: 'Launch autumn palette with bilingual captions',
        ar: 'إطلاق لوحة الخريف بعناوين ثنائية اللغة',
      },
      audience: {
        en: 'Existing customers + warm prospects',
        ar: 'عملاء حاليون + مهتمون دافئون',
      },
      keyMessage: {
        en: 'Warm neutrals, unhurried craft.',
        ar: 'حيادي دافئ وحرفية بلا استعجال.',
      },
      deliverableType: { en: 'Carousel + static set', ar: 'كاروسيل ومجموعة ثابتة' },
      channels: ['Instagram', 'TikTok'],
      formats: ['Carousel 1080×1080', 'Static 4:5'],
      tone: { en: 'Calm, tactile, bilingual', ar: 'هادئ وملموس وثنائي اللغة' },
      mandatory: {
        en: 'Logo clear space, Arabic first on AR locale',
        ar: 'مساحة شعار واضحة والعربية أولًا في الواجهة العربية',
      },
      cta: { en: 'Shop neutrals', ar: 'تسوق الحيادي' },
      references: ['Moodboard — warm neutrals', 'Prior Q2 hero set'],
      doList: [{ en: 'Show fabric texture close-ups', ar: 'أظهر لقطات قريبة لملمس القماش' }],
      dontList: [{ en: 'No hard sale overlays', ar: 'لا طبقات بيع قاسية' }],
      timelineNote: {
        en: 'Design due Sep 11; schedule window Sep 14',
        ar: 'التصميم بحلول 11 سبتمبر؛ نافذة الجدول 14 سبتمبر',
      },
      stakeholders: ['Layla Haddad', 'Rami Khalil', 'Client — Horizon Marketing'],
      acceptance: {
        en: 'Client approves carousel v2 contrast fix',
        ar: 'اعتماد العميل لإصلاح تباين كاروسيل v2',
      },
      dueAt: '2026-09-18',
      attachmentAssets: ['/demo/poster-static.svg'],
      readiness: 'READY',
    },
    {
      id: 'demo-brief-2',
      requestId: 'demo-request-2',
      overview: { en: 'Paid cutdowns — incomplete', ar: 'مقاطع مدفوعة — ناقصة' },
      objective: {
        en: 'Produce 6s hooks for planning board',
        ar: 'إنتاج خطافات 6 ثوانٍ للوحة التخطيط',
      },
      audience: { en: 'Cart abandoners', ar: 'متخلّو السلة' },
      keyMessage: { en: '', ar: '' },
      deliverableType: { en: 'Motion cutdown', ar: 'مقطع حركة مختصر' },
      channels: ['Meta Ads'],
      formats: ['6s vertical'],
      tone: { en: '', ar: '' },
      mandatory: { en: 'No live spend claims', ar: 'لا ادعاءات إنفاق مباشر' },
      cta: { en: '', ar: '' },
      references: [],
      doList: [],
      dontList: [{ en: 'Do not imply live Meta connection', ar: 'لا توحي باتصال ميتا حي' }],
      timelineNote: { en: 'Blocked on brand end-frame asset', ar: 'متوقف على أصل الإطار الختامي' },
      stakeholders: ['Omar Faris'],
      acceptance: { en: '', ar: '' },
      dueAt: '2026-09-12',
      attachmentAssets: [],
      readiness: 'INCOMPLETE',
    },
    {
      id: 'demo-brief-3',
      requestId: 'demo-request-3',
      overview: { en: 'LinkedIn revision brief', ar: 'موجز مراجعة لينكدإن' },
      objective: {
        en: 'Soften founders note for executives',
        ar: 'تلطيف رسالة المؤسسين للمديرين',
      },
      audience: { en: 'Gulf executives', ar: 'مديرون تنفيذيون في الخليج' },
      keyMessage: {
        en: 'Offline-first craft still matters',
        ar: 'الحرفية دون اتصال ما زالت مهمة',
      },
      deliverableType: { en: 'Copy revision', ar: 'مراجعة نص' },
      channels: ['LinkedIn'],
      formats: ['Long post'],
      tone: { en: 'Thoughtful, concise', ar: 'متأنٍ وموجز' },
      mandatory: { en: 'Keep bilingual closing', ar: 'أبقِ خاتمة ثنائية اللغة' },
      cta: { en: 'Read more', ar: 'اقرأ المزيد' },
      references: ['Published demo note'],
      doList: [{ en: 'Lead with craft', ar: 'ابدأ بالحرفية' }],
      dontList: [{ en: 'No promo stickers', ar: 'لا ملصقات ترويجية' }],
      timelineNote: { en: 'Due Sep 22', ar: 'الاستحقاق 22 سبتمبر' },
      stakeholders: ['Layla Haddad', 'Maya Nasser'],
      acceptance: { en: 'Layla signs off tone', ar: 'اعتماد ليلى للنبرة' },
      dueAt: '2026-09-22',
      attachmentAssets: ['/demo/poster-static.svg'],
      readiness: 'READY',
    },
    {
      id: 'demo-brief-5',
      requestId: 'demo-request-5',
      overview: { en: 'Retargeting square unblock', ar: 'فك اختناق مربع إعادة الاستهداف' },
      objective: {
        en: 'Clear review so paid planning window can proceed',
        ar: 'إنهاء المراجعة لمتابعة نافذة التخطيط المدفوع',
      },
      audience: { en: 'Recent abandoners', ar: 'متخلّون حديثون' },
      keyMessage: { en: 'Soft reminder, still deciding?', ar: 'تذكير لطيف، ما زلت تقرر؟' },
      deliverableType: { en: '1:1 static', ar: 'ثابت 1:1' },
      channels: ['Meta Ads'],
      formats: ['1080×1080'],
      tone: { en: 'Gentle urgency', ar: 'إلحاح لطيف' },
      mandatory: { en: 'Planning-only badge in internal notes', ar: 'شارة تخطيط فقط في الملاحظات' },
      cta: { en: 'Return to bag', ar: 'ارجع إلى الحقيبة' },
      references: ['demo-content-overdue'],
      doList: [{ en: 'Keep copy under 90 chars', ar: 'أبقِ النص أقل من 90 حرفًا' }],
      dontList: [{ en: 'No discount claim', ar: 'لا ادعاء خصم' }],
      timelineNote: { en: 'Overdue relative to Sep 8 review', ar: 'متأخر عن مراجعة 8 سبتمبر' },
      stakeholders: ['Omar Faris', 'Rami Khalil'],
      acceptance: { en: 'Approved static linked to deliverable', ar: 'ثابت معتمد مرتبط بالمخرج' },
      dueAt: '2026-09-09',
      attachmentAssets: ['/demo/poster-static.svg'],
      readiness: 'READY',
    },
    {
      id: 'demo-brief-6',
      requestId: 'demo-request-6',
      overview: { en: 'Holiday email — draft', ar: 'بريد العطلة — مسودة' },
      objective: { en: 'Warm list without hard sell', ar: 'تدفئة القائمة دون بيع قاسٍ' },
      audience: { en: 'Warm email list', ar: 'قائمة البريد الدافئة' },
      keyMessage: { en: 'Something warm is coming', ar: 'شيء دافئ قادم' },
      deliverableType: { en: 'Email', ar: 'بريد' },
      channels: ['Email'],
      formats: ['HTML email'],
      tone: { en: 'Soft tease', ar: 'تشويق ناعم' },
      mandatory: { en: '', ar: '' },
      cta: { en: 'Stay close', ar: 'ابقَ قريبًا' },
      references: [],
      doList: [],
      dontList: [],
      timelineNote: { en: 'October send window', ar: 'نافذة إرسال أكتوبر' },
      stakeholders: ['Sara Alami'],
      acceptance: { en: '', ar: '' },
      dueAt: '2026-10-05',
      attachmentAssets: [],
      readiness: 'DRAFT',
    },
    {
      id: 'demo-brief-7',
      requestId: 'demo-request-7',
      overview: { en: 'TikTok behind-the-rack', ar: 'تيك توك خلف الرف' },
      objective: { en: 'Show operational craft', ar: 'إظهار حرفية التشغيل' },
      audience: { en: 'Young fashion followers', ar: 'متابعو الموضة الشباب' },
      keyMessage: { en: 'Quiet chaos before doors open', ar: 'فوضى هادئة قبل فتح الأبواب' },
      deliverableType: { en: 'Vertical reel', ar: 'ريل عمودي' },
      channels: ['TikTok'],
      formats: ['9:16'],
      tone: { en: 'Documentary-lite', ar: 'وثائقي خفيف' },
      mandatory: { en: 'No competitor logos in frame', ar: 'لا شعارات منافسين في الإطار' },
      cta: { en: 'Follow', ar: 'تابع' },
      references: ['Studio morning reel'],
      doList: [{ en: 'Natural sound bed', ar: 'خلفية صوت طبيعية' }],
      dontList: [{ en: 'No heavy text stickers', ar: 'لا ملصقات نصية ثقيلة' }],
      timelineNote: { en: 'Shoot Sep 15, edit Sep 17', ar: 'تصوير 15 وتعديل 17 سبتمبر' },
      stakeholders: ['Maya Nasser', 'Rami Khalil'],
      acceptance: { en: 'Approved cut under 20s', ar: 'نسخة معتمدة أقل من 20 ثانية' },
      dueAt: '2026-09-17',
      attachmentAssets: ['/demo/video-poster.svg'],
      readiness: 'READY',
    },
    {
      id: 'demo-brief-9',
      requestId: 'demo-request-9',
      overview: { en: 'Poll story brief', ar: 'موجز قصة الاستطلاع' },
      objective: { en: 'Light mid-week engagement', ar: 'تفاعل خفيف منتصف الأسبوع' },
      audience: { en: 'IG story viewers', ar: 'مشاهدو قصص إنستغرام' },
      keyMessage: { en: 'Which hem wins?', ar: 'أي طول يفوز؟' },
      deliverableType: { en: 'Story poll', ar: 'استطلاع قصة' },
      channels: ['Instagram'],
      formats: ['Story 9:16'],
      tone: { en: 'Playful', ar: 'مرح' },
      mandatory: { en: 'Two clear options', ar: 'خياران واضحان' },
      cta: { en: 'Vote', ar: 'صوّت' },
      references: [],
      doList: [{ en: 'Use studio lighting stills', ar: 'استخدم لقطات إضاءة الاستوديو' }],
      dontList: [{ en: 'No paid media language', ar: 'لا لغة إعلام مدفوع' }],
      timelineNote: { en: 'Publish Sep 11 evening', ar: 'نشر مساء 11 سبتمبر' },
      stakeholders: ['Maya Nasser'],
      acceptance: { en: 'Story approved in schedule preview', ar: 'قصة معتمدة في معاينة الجدول' },
      dueAt: '2026-09-11',
      attachmentAssets: ['/demo/poster-carousel-2.svg'],
      readiness: 'READY',
    },
  ],
  tasks: [
    {
      id: 'demo-task-design',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-carousel',
      requestId: 'demo-request-1',
      briefId: 'demo-brief-1',
      deliverableId: 'demo-deliv-carousel',
      title: { en: 'Design carousel v2', ar: 'تصميم الكاروسيل الإصدار 2' },
      description: {
        en: 'Strengthen CTA contrast and export 1080 assets.',
        ar: 'تعزيز تباين الدعوة وتصدير أصول 1080.',
      },
      type: 'DESIGN',
      status: 'IN_REVIEW',
      assignee: 'Rami Khalil',
      department: 'Design',
      priority: 'HIGH',
      dueAt: '2026-09-11',
      updatedAt: '2026-09-09T16:00:00+03:00',
      blockedReason: null,
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
      activity: [
        {
          id: 'act1',
          at: '2026-09-09T14:20:00+03:00',
          actor: 'Layla Haddad',
          summary: { en: 'Moved to In review', ar: 'نُقلت إلى قيد المراجعة' },
        },
      ],
    },
    {
      id: 'demo-task-overdue',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      contentId: 'demo-content-paid-static',
      requestId: 'demo-request-1',
      briefId: 'demo-brief-1',
      deliverableId: 'demo-deliv-static',
      title: { en: 'Paid hero retouch', ar: 'تنقيح بطل الإعلان المدفوع' },
      description: {
        en: 'Color grade and 4:5 crop for planning-only paid hero.',
        ar: 'تصحيح ألوان وقص 4:5 لبطل مدفوع تخطيطي فقط.',
      },
      type: 'PHOTO',
      status: 'OVERDUE',
      assignee: 'Sara Alami',
      department: 'Photography',
      priority: 'URGENT',
      dueAt: '2026-09-08',
      updatedAt: '2026-09-08T18:00:00+03:00',
      blockedReason: {
        en: 'Waiting on approved crop notes',
        ar: 'بانتظار ملاحظات القص المعتمدة',
      },
      dependencies: [],
      checklist: [{ id: 'c4', label: { en: 'Color grade', ar: 'تصحيح الألوان' }, done: false }],
      comments: [],
      activity: [
        {
          id: 'act2',
          at: '2026-09-08T18:00:00+03:00',
          actor: 'system',
          summary: { en: 'Marked overdue', ar: 'وُسمت كمتأخرة' },
        },
      ],
    },
    {
      id: 'demo-task-video',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-reel',
      requestId: null,
      briefId: null,
      deliverableId: 'demo-deliv-reel',
      title: { en: 'Edit morning reel', ar: 'مونتاج الريل الصباحي' },
      description: { en: 'Final cut approved.', ar: 'النسخة النهائية معتمدة.' },
      type: 'VIDEO',
      status: 'DONE',
      assignee: 'Maya Nasser',
      department: 'Video',
      priority: 'MEDIUM',
      dueAt: '2026-09-10',
      updatedAt: '2026-09-10T11:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        { id: 'c5', label: { en: 'Color pass', ar: 'مرور ألوان' }, done: true },
        { id: 'c6', label: { en: 'Export master', ar: 'تصدير الماستر' }, done: true },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-backlog-brief',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: null,
      requestId: 'demo-request-4',
      briefId: null,
      deliverableId: null,
      title: { en: 'Clarify teaser channel', ar: 'توضيح قناة التشويقية' },
      description: {
        en: 'Gather missing channel/format before briefing.',
        ar: 'جمع القناة/الصيغة الناقصة قبل الموجز.',
      },
      type: 'COPY',
      status: 'BACKLOG',
      assignee: 'Unassigned',
      department: 'Production',
      priority: 'HIGH',
      dueAt: '2026-09-20',
      updatedAt: '2026-09-10T09:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-ready-1',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-attention',
      contentId: 'demo-content-overdue',
      requestId: 'demo-request-5',
      briefId: 'demo-brief-5',
      deliverableId: 'demo-deliv-static',
      title: { en: 'Prep retargeting square export', ar: 'تجهيز تصدير مربع إعادة الاستهداف' },
      description: { en: 'Ready after brief completeness.', ar: 'جاهز بعد اكتمال الموجز.' },
      type: 'DESIGN',
      status: 'READY',
      assignee: 'Rami Khalil',
      department: 'Design',
      priority: 'URGENT',
      dueAt: '2026-09-10',
      updatedAt: '2026-09-09T10:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        { id: 'c7', label: { en: 'Lock copy', ar: 'تثبيت النص' }, done: true },
        { id: 'c8', label: { en: 'Export PNG', ar: 'تصدير PNG' }, done: false },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-progress-1',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-tiktok',
      requestId: 'demo-request-7',
      briefId: 'demo-brief-7',
      deliverableId: null,
      title: { en: 'Shoot behind-the-rack B-roll', ar: 'تصوير لقطات خلف الرف' },
      description: { en: 'In-progress capture day.', ar: 'يوم تصوير قيد التنفيذ.' },
      type: 'VIDEO',
      status: 'IN_PROGRESS',
      assignee: 'Maya Nasser',
      department: 'Video',
      priority: 'MEDIUM',
      dueAt: '2026-09-15',
      updatedAt: '2026-09-10T12:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        { id: 'c9', label: { en: 'Location scout', ar: 'معاينة الموقع' }, done: true },
        { id: 'c10', label: { en: 'Capture takes', ar: 'التقاط اللقطات' }, done: false },
        { id: 'c11', label: { en: 'Select selects', ar: 'اختيار اللقطات' }, done: false },
      ],
      comments: [
        {
          id: 'cm2',
          author: 'Rami Khalil',
          body: { en: 'Doorways look good at 7am light.', ar: 'المداخل تبدو جيدة بضوء السابعة.' },
          at: '2026-09-10T08:00:00+03:00',
        },
      ],
      activity: [],
    },
    {
      id: 'demo-task-blocked-1',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      contentId: 'demo-content-paid-video',
      requestId: 'demo-request-2',
      briefId: 'demo-brief-2',
      deliverableId: null,
      title: { en: 'Assemble paid cutdown board', ar: 'تجميع لوحة المقاطع المدفوعة' },
      description: {
        en: 'Blocked on incomplete brief key message.',
        ar: 'متوقف على رسالة الموجز الناقصة.',
      },
      type: 'VIDEO',
      status: 'BLOCKED',
      assignee: 'Maya Nasser',
      department: 'Video',
      priority: 'HIGH',
      dueAt: '2026-09-13',
      updatedAt: '2026-09-09T11:00:00+03:00',
      blockedReason: {
        en: 'Brief missing key message and CTA',
        ar: 'الموجز ينقصه الرسالة الرئيسية ودعوة الإجراء',
      },
      dependencies: [],
      checklist: [
        { id: 'c12', label: { en: 'Receive end-frame', ar: 'استلام الإطار الختامي' }, done: false },
      ],
      comments: [],
      activity: [
        {
          id: 'act3',
          at: '2026-09-09T11:00:00+03:00',
          actor: 'Maya Nasser',
          summary: { en: 'Status → Blocked', ar: 'الحالة ← متوقف' },
        },
      ],
    },
    {
      id: 'demo-task-copy-li',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-published',
      requestId: 'demo-request-3',
      briefId: 'demo-brief-3',
      deliverableId: 'demo-deliv-copy',
      title: { en: 'Rewrite founders note', ar: 'إعادة كتابة رسالة المؤسسين' },
      description: { en: 'Assigned LinkedIn revision.', ar: 'مراجعة لينكدإن معيّنة.' },
      type: 'COPY',
      status: 'READY',
      assignee: 'Maya Nasser',
      department: 'Copy',
      priority: 'MEDIUM',
      dueAt: '2026-09-22',
      updatedAt: '2026-09-08T15:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        { id: 'c13', label: { en: 'Draft EN', ar: 'مسودة إنجليزية' }, done: true },
        { id: 'c14', label: { en: 'Draft AR', ar: 'مسودة عربية' }, done: false },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-story',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-story',
      requestId: 'demo-request-9',
      briefId: 'demo-brief-9',
      deliverableId: null,
      title: { en: 'Build poll story frames', ar: 'بناء إطارات قصة الاستطلاع' },
      description: { en: 'Two-option hem poll.', ar: 'استطلاع طول بخيارين.' },
      type: 'DESIGN',
      status: 'IN_PROGRESS',
      assignee: 'Maya Nasser',
      department: 'Design',
      priority: 'MEDIUM',
      dueAt: '2026-09-11',
      updatedAt: '2026-09-10T10:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        { id: 'c15', label: { en: 'Frame A', ar: 'إطار أ' }, done: true },
        { id: 'c16', label: { en: 'Frame B', ar: 'إطار ب' }, done: true },
        { id: 'c17', label: { en: 'Sticker poll', ar: 'ملصق الاستطلاع' }, done: false },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-video-tiktok',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-tiktok',
      requestId: 'demo-request-7',
      briefId: 'demo-brief-7',
      deliverableId: null,
      title: { en: 'Edit TikTok cut', ar: 'مونتاج مقطع تيك توك' },
      description: { en: 'Follows shoot task.', ar: 'يتبع مهمة التصوير.' },
      type: 'VIDEO',
      status: 'BACKLOG',
      assignee: 'Rami Khalil',
      department: 'Video',
      priority: 'MEDIUM',
      dueAt: '2026-09-17',
      updatedAt: '2026-09-06T12:00:00+03:00',
      blockedReason: null,
      dependencies: ['demo-task-progress-1'],
      checklist: [],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-email-draft',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-draft',
      contentId: 'demo-content-email',
      requestId: 'demo-request-6',
      briefId: 'demo-brief-6',
      deliverableId: null,
      title: { en: 'Draft holiday email HTML', ar: 'مسودة HTML لبريد العطلة' },
      description: { en: 'Waiting on brief readiness.', ar: 'بانتظار جاهزية الموجز.' },
      type: 'COPY',
      status: 'BACKLOG',
      assignee: 'Sara Alami',
      department: 'Copy',
      priority: 'LOW',
      dueAt: '2026-10-02',
      updatedAt: '2026-09-09T09:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        { id: 'c18', label: { en: 'Outline sections', ar: 'تخطيط الأقسام' }, done: false },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-review-hand',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-carousel',
      requestId: 'demo-request-1',
      briefId: 'demo-brief-1',
      deliverableId: 'demo-deliv-carousel',
      title: { en: 'Handoff carousel to review', ar: 'تسليم الكاروسيل للمراجعة' },
      description: {
        en: 'Production handoff placeholder toward Stage 5 review.',
        ar: 'تسليم إنتاجي مؤقت نحو مراجعة المرحلة 5.',
      },
      type: 'DESIGN',
      status: 'IN_REVIEW',
      assignee: 'Layla Haddad',
      department: 'Production',
      priority: 'HIGH',
      dueAt: '2026-09-12',
      updatedAt: '2026-09-10T13:00:00+03:00',
      blockedReason: null,
      dependencies: ['demo-task-design'],
      checklist: [
        { id: 'c19', label: { en: 'Link deliverable', ar: 'ربط المخرج' }, done: true },
        { id: 'c20', label: { en: 'Notify reviewer', ar: 'إشعار المراجع' }, done: false },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-done-archive',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-done',
      contentId: null,
      requestId: 'demo-request-8',
      briefId: null,
      deliverableId: null,
      title: { en: 'Archive spring assets', ar: 'أرشفة أصول الربيع' },
      description: { en: 'Completed wrap-up.', ar: 'إغلاق مكتمل.' },
      type: 'PHOTO',
      status: 'DONE',
      assignee: 'Layla Haddad',
      department: 'Production',
      priority: 'LOW',
      dueAt: '2026-04-18',
      updatedAt: '2026-04-18T16:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        {
          id: 'c21',
          label: { en: 'Move to archive folder', ar: 'نقل إلى مجلد الأرشيف' },
          done: true,
        },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-backlog-2',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-li-carousel',
      requestId: null,
      briefId: null,
      deliverableId: null,
      title: { en: 'Team craft carousel outline', ar: 'مخطط كاروسيل حرفة الفريق' },
      description: { en: 'Unassigned backlog item.', ar: 'عنصر تراكم غير معيّن.' },
      type: 'COPY',
      status: 'BACKLOG',
      assignee: 'Unassigned',
      department: 'Copy',
      priority: 'LOW',
      dueAt: '2026-09-24',
      updatedAt: '2026-09-08T10:00:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-progress-2',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: null,
      requestId: 'demo-request-1',
      briefId: 'demo-brief-1',
      deliverableId: null,
      title: { en: 'Write bilingual captions pack', ar: 'كتابة حزمة عناوين ثنائية' },
      description: { en: 'Caption variants for lookbook.', ar: 'تنويعات عناوين للكتالوج.' },
      type: 'COPY',
      status: 'IN_PROGRESS',
      assignee: 'Layla Haddad',
      department: 'Copy',
      priority: 'HIGH',
      dueAt: '2026-09-14',
      updatedAt: '2026-09-10T11:30:00+03:00',
      blockedReason: null,
      dependencies: [],
      checklist: [
        { id: 'c22', label: { en: 'EN set', ar: 'مجموعة إنجليزية' }, done: true },
        { id: 'c23', label: { en: 'AR set', ar: 'مجموعة عربية' }, done: false },
      ],
      comments: [],
      activity: [],
    },
    {
      id: 'demo-task-ready-2',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      contentId: 'demo-content-reel',
      requestId: null,
      briefId: null,
      deliverableId: 'demo-deliv-reel',
      title: { en: 'Schedule reel readiness check', ar: 'فحص جاهزية جدولة الريل' },
      description: { en: 'Preview-only schedule readiness.', ar: 'جاهزية جدول للمعاينة فقط.' },
      type: 'VIDEO',
      status: 'READY',
      assignee: 'Omar Faris',
      department: 'Production',
      priority: 'MEDIUM',
      dueAt: '2026-09-12',
      updatedAt: '2026-09-09T17:00:00+03:00',
      blockedReason: null,
      dependencies: ['demo-task-video'],
      checklist: [{ id: 'c24', label: { en: 'Confirm poster', ar: 'تأكيد الملصق' }, done: true }],
      comments: [],
      activity: [],
    },
  ],
  deliverables: [
    {
      id: 'demo-deliv-carousel',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: 'demo-task-design',
      contentId: 'demo-content-carousel',
      requestId: 'demo-request-1',
      title: { en: 'Fabric story carousel', ar: 'كاروسيل قصة القماش' },
      type: 'CAROUSEL',
      reviewStatus: 'AWAITING_REVIEW',
      owner: 'Rami Khalil',
      reviewer: 'Layla Haddad',
      dueAt: '2026-09-11',
      archived: false,
      currentVersionId: 'demo-dv-car-v2',
      approvedVersionId: null,
      versions: [
        {
          id: 'demo-dv-car-v1',
          label: 'v1',
          assets: ['/demo/stage5-carousel-v1.svg', '/demo/poster-carousel-1.svg'],
          notes: { en: 'Initial layout', ar: 'تخطيط أولي' },
          createdAt: '2026-09-05T10:00:00+03:00',
          immutable: true,
          createdBy: 'Rami Khalil',
          reviewDecision: 'CHANGES_REQUESTED',
          status: 'SUPERSEDED',
        },
        {
          id: 'demo-dv-car-v2',
          label: 'v2',
          assets: [
            '/demo/stage5-carousel-v2.svg',
            '/demo/poster-carousel-1.svg',
            '/demo/poster-carousel-2.svg',
          ],
          notes: { en: 'Added slide 2 texture', ar: 'أضيفت ملمس الشريحة 2' },
          createdAt: '2026-09-09T16:00:00+03:00',
          immutable: false,
          createdBy: 'Rami Khalil',
          reviewDecision: null,
          status: 'SUBMITTED',
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
      annotations: [
        {
          id: 'ann-car-1',
          versionId: 'demo-dv-car-v2',
          x: 0.72,
          y: 0.81,
          number: 1,
          author: 'Layla Haddad',
          body: {
            en: 'CTA still washes out against the weave.',
            ar: 'زر الدعوة ما زال باهتًا أمام النسيج.',
          },
          at: '2026-09-09T16:10:00+03:00',
          resolved: false,
          replies: [],
          timestampLabel: '0:00',
        },
        {
          id: 'ann-car-2',
          versionId: 'demo-dv-car-v2',
          x: 0.28,
          y: 0.22,
          number: 2,
          author: 'Omar Faris',
          body: {
            en: 'Logo clear space looks good — resolved.',
            ar: 'مساحة الشعار جيدة — حُلّت.',
          },
          at: '2026-09-09T16:15:00+03:00',
          resolved: true,
          replies: [
            {
              id: 'ann-car-2-r1',
              author: 'Rami Khalil',
              body: { en: 'Thanks — locked from v1.', ar: 'شكرًا — ثُبّتت من الإصدار 1.' },
              at: '2026-09-09T16:18:00+03:00',
            },
          ],
          timestampLabel: null,
        },
      ],
      comments: [
        {
          id: 'cmt-car-1',
          versionId: 'demo-dv-car-v2',
          author: 'Layla Haddad',
          body: {
            en: 'Overall craft direction is strong; focus on CTA contrast.',
            ar: 'اتجاه الحرفية قوي عمومًا؛ ركّز على تباين زر الدعوة.',
          },
          at: '2026-09-09T16:12:00+03:00',
          resolved: false,
        },
      ],
      activity: [
        {
          id: 'da-car-1',
          at: '2026-09-09T16:05:00+03:00',
          actor: 'Rami Khalil',
          summary: { en: 'Submitted carousel v2 for review', ar: 'أُرسل كاروسيل v2 للمراجعة' },
          kind: 'submitted',
        },
      ],
      decisions: [],
    },
    {
      id: 'demo-deliv-reel',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: 'demo-task-video',
      contentId: 'demo-content-reel',
      requestId: null,
      title: { en: 'Studio morning reel', ar: 'ريل صباحي من الاستوديو' },
      type: 'REEL',
      reviewStatus: 'APPROVED',
      owner: 'Maya Nasser',
      reviewer: 'Layla Haddad',
      dueAt: '2026-09-10',
      archived: false,
      currentVersionId: 'demo-dv-reel-v1',
      approvedVersionId: 'demo-dv-reel-v1',
      versions: [
        {
          id: 'demo-dv-reel-v1',
          label: 'v1 Final',
          assets: ['/demo/video-poster.svg'],
          notes: { en: 'Approved cut', ar: 'نسخة معتمدة' },
          createdAt: '2026-09-08T12:00:00+03:00',
          immutable: true,
          createdBy: 'Maya Nasser',
          reviewDecision: 'APPROVED',
          status: 'APPROVED',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: 'da-reel-1',
          at: '2026-09-08T12:10:00+03:00',
          actor: 'Layla Haddad',
          summary: { en: 'Approved morning reel v1', ar: 'اعتمدت ريل الصباح الإصدار 1' },
          kind: 'approved',
        },
      ],
      decisions: [
        {
          id: 'dec-reel-1',
          at: '2026-09-08T12:10:00+03:00',
          actor: 'Layla Haddad',
          decision: 'APPROVED',
          versionId: 'demo-dv-reel-v1',
          reason: { en: 'Cut is clean and on-brand', ar: 'المونتاج نظيف ومتوافق مع العلامة' },
          priorStatus: 'AWAITING_REVIEW',
          newStatus: 'APPROVED',
        },
      ],
    },
    {
      id: 'demo-deliv-static',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      taskId: 'demo-task-overdue',
      contentId: 'demo-content-paid-static',
      requestId: 'demo-request-1',
      title: { en: 'Paid collection hero', ar: 'بطل المجموعة المدفوعة' },
      type: 'STATIC',
      reviewStatus: 'CHANGES_REQUESTED',
      owner: 'Sara Alami',
      reviewer: 'Omar Faris',
      dueAt: '2026-09-08',
      archived: false,
      currentVersionId: 'demo-dv-static-v1',
      approvedVersionId: null,
      versions: [
        {
          id: 'demo-dv-static-v1',
          label: 'v1',
          assets: ['/demo/stage5-static-v1.svg', '/demo/poster-static.svg'],
          notes: { en: 'Needs crop for 4:5', ar: 'يحتاج قص لنسبة 4:5' },
          createdAt: '2026-09-07T09:00:00+03:00',
          immutable: false,
          createdBy: 'Sara Alami',
          reviewDecision: 'CHANGES_REQUESTED',
          status: 'SUBMITTED',
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
      annotations: [
        {
          id: 'ann-static-1',
          versionId: 'demo-dv-static-v1',
          x: 0.5,
          y: 0.15,
          number: 1,
          author: 'Omar Faris',
          body: { en: 'Top safe area clips on 4:5.', ar: 'المنطقة العلوية تُقص في 4:5.' },
          at: '2026-09-07T15:05:00+03:00',
          resolved: false,
          replies: [],
        },
      ],
      comments: [],
      activity: [
        {
          id: 'da-static-1',
          at: '2026-09-07T15:00:00+03:00',
          actor: 'Omar Faris',
          summary: { en: 'Requested 4:5 crop changes', ar: 'طلب تغييرات قص 4:5' },
          kind: 'changes_requested',
        },
      ],
      decisions: [
        {
          id: 'dec-static-1',
          at: '2026-09-07T15:00:00+03:00',
          actor: 'Omar Faris',
          decision: 'CHANGES_REQUESTED',
          versionId: 'demo-dv-static-v1',
          reason: { en: 'Provide 4:5 crop', ar: 'توفير قص 4:5' },
          priorStatus: 'AWAITING_REVIEW',
          newStatus: 'CHANGES_REQUESTED',
        },
      ],
    },
    {
      id: 'demo-deliv-copy',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: 'demo-task-copy-li',
      contentId: 'demo-content-published',
      requestId: 'demo-request-3',
      title: { en: 'Founders LinkedIn note', ar: 'ملاحظة المؤسسين على لينكدإن' },
      type: 'COPY',
      reviewStatus: 'APPROVED',
      owner: 'Maya Nasser',
      reviewer: 'Layla Haddad',
      dueAt: '2026-08-18',
      archived: false,
      currentVersionId: 'demo-dv-copy-v1',
      approvedVersionId: 'demo-dv-copy-v1',
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
          createdBy: 'Maya Nasser',
          reviewDecision: 'APPROVED',
          status: 'APPROVED',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: 'da-copy-1',
          at: '2026-08-18T10:30:00+03:00',
          actor: 'Layla Haddad',
          summary: { en: 'Approved founders note copy', ar: 'اعتمدت نص رسالة المؤسسين' },
          kind: 'approved',
        },
      ],
      decisions: [
        {
          id: 'dec-copy-1',
          at: '2026-08-18T10:30:00+03:00',
          actor: 'Layla Haddad',
          decision: 'APPROVED',
          versionId: 'demo-dv-copy-v1',
          reason: { en: 'Tone fits executive audience', ar: 'النبرة تناسب الجمهور التنفيذي' },
          priorStatus: 'IN_REVIEW',
          newStatus: 'APPROVED',
        },
      ],
    },
    {
      id: 'demo-deliv-storyboard',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: 'demo-task-story',
      contentId: 'demo-content-story',
      requestId: 'demo-request-9',
      title: { en: 'Fitting room poll storyboard', ar: 'قصة مصورة لاستطلاع غرفة القياس' },
      type: 'PHOTOGRAPHY',
      reviewStatus: 'AWAITING_REVIEW',
      owner: 'Maya Nasser',
      reviewer: 'Layla Haddad',
      dueAt: '2026-09-11',
      archived: false,
      currentVersionId: 'demo-dv-story-v1',
      approvedVersionId: null,
      versions: [
        {
          id: 'demo-dv-story-v1',
          label: 'v1',
          assets: ['/demo/stage5-carousel-v3.svg', '/demo/poster-carousel-2.svg'],
          notes: { en: 'Two-frame hem poll boards', ar: 'لوحتان لاستطلاع الطول' },
          createdAt: '2026-09-10T09:00:00+03:00',
          immutable: false,
          createdBy: 'Maya Nasser',
          reviewDecision: null,
          status: 'SUBMITTED',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [
        {
          id: 'cmt-story-1',
          versionId: 'demo-dv-story-v1',
          author: 'Layla Haddad',
          body: { en: 'Option B hem reads clearer.', ar: 'طول الخيار ب أوضح.' },
          at: '2026-09-10T11:00:00+03:00',
          resolved: false,
        },
      ],
      activity: [
        {
          id: 'da-story-1',
          at: '2026-09-10T10:00:00+03:00',
          actor: 'Maya Nasser',
          summary: { en: 'Submitted storyboard for review', ar: 'أُرسلت القصة المصورة للمراجعة' },
          kind: 'submitted',
        },
      ],
      decisions: [],
    },
    {
      id: 'demo-deliv-video',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      taskId: 'demo-task-blocked-1',
      contentId: 'demo-content-paid-video',
      requestId: 'demo-request-2',
      title: { en: 'Paid motion cutdown', ar: 'مقطع حركة مدفوع مختصر' },
      type: 'LONG_VIDEO',
      reviewStatus: 'AWAITING_REVIEW',
      owner: 'Maya Nasser',
      reviewer: 'Omar Faris',
      dueAt: '2026-09-13',
      archived: false,
      currentVersionId: 'demo-dv-video-v3',
      approvedVersionId: 'demo-dv-video-v1',
      versions: [
        {
          id: 'demo-dv-video-v1',
          label: 'v1 Approved',
          assets: ['/demo/stage5-video-v1.svg', '/demo/video-poster.svg'],
          notes: { en: 'Approved 6s hook — older cut', ar: 'خطاف 6 ثوانٍ معتمد — نسخة أقدم' },
          createdAt: '2026-09-04T11:00:00+03:00',
          immutable: true,
          createdBy: 'Maya Nasser',
          reviewDecision: 'APPROVED',
          status: 'APPROVED',
        },
        {
          id: 'demo-dv-video-v2',
          label: 'v2',
          assets: ['/demo/stage5-video-v2.svg'],
          notes: { en: 'Faster open — superseded', ar: 'افتتاح أسرع — أُلغيت' },
          createdAt: '2026-09-08T14:00:00+03:00',
          immutable: false,
          createdBy: 'Maya Nasser',
          reviewDecision: null,
          status: 'SUPERSEDED',
        },
        {
          id: 'demo-dv-video-v3',
          label: 'v3',
          assets: ['/demo/stage5-video-v2.svg', '/demo/video-poster.svg'],
          notes: { en: 'New end-frame awaiting review', ar: 'إطار ختامي جديد بانتظار المراجعة' },
          createdAt: '2026-09-10T15:00:00+03:00',
          immutable: false,
          createdBy: 'Maya Nasser',
          reviewDecision: null,
          status: 'SUBMITTED',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: 'da-video-1',
          at: '2026-09-04T12:00:00+03:00',
          actor: 'Omar Faris',
          summary: { en: 'Approved paid cutdown v1', ar: 'اعتمد مقطع المدفوع الإصدار 1' },
          kind: 'approved',
        },
        {
          id: 'da-video-2',
          at: '2026-09-10T15:05:00+03:00',
          actor: 'Maya Nasser',
          summary: { en: 'Submitted v3 for review', ar: 'أُرسل الإصدار 3 للمراجعة' },
          kind: 'submitted',
        },
      ],
      decisions: [
        {
          id: 'dec-video-1',
          at: '2026-09-04T12:00:00+03:00',
          actor: 'Omar Faris',
          decision: 'APPROVED',
          versionId: 'demo-dv-video-v1',
          reason: { en: 'Hook lands in first second', ar: 'الخطاف يصل في الثانية الأولى' },
          priorStatus: 'AWAITING_REVIEW',
          newStatus: 'APPROVED',
        },
      ],
    },
    {
      id: 'demo-deliv-doc',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: null,
      contentId: null,
      requestId: 'demo-request-1',
      title: { en: 'Autumn lookbook proof PDF', ar: 'إثبات كتالوج الخريف PDF' },
      type: 'COPY',
      reviewStatus: 'APPROVED',
      owner: 'Layla Haddad',
      reviewer: 'Client — Horizon Marketing',
      dueAt: '2026-09-16',
      archived: false,
      currentVersionId: 'demo-dv-doc-v1',
      approvedVersionId: 'demo-dv-doc-v1',
      versions: [
        {
          id: 'demo-dv-doc-v1',
          label: 'v1',
          assets: ['/demo/stage5-doc-proof.svg'],
          notes: { en: 'Client-facing proof sheet', ar: 'ورقة إثبات للعميل' },
          createdAt: '2026-09-09T11:00:00+03:00',
          immutable: true,
          createdBy: 'Layla Haddad',
          reviewDecision: 'APPROVED',
          status: 'APPROVED',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: 'da-doc-1',
          at: '2026-09-09T12:00:00+03:00',
          actor: 'Client — Horizon Marketing',
          summary: { en: 'Approved lookbook proof', ar: 'اعتمد إثبات الكتالوج' },
          kind: 'approved',
        },
      ],
      decisions: [
        {
          id: 'dec-doc-1',
          at: '2026-09-09T12:00:00+03:00',
          actor: 'Client — Horizon Marketing',
          decision: 'APPROVED',
          versionId: 'demo-dv-doc-v1',
          reason: { en: 'Proof matches brief acceptance', ar: 'الإثبات يطابق قبول الموجز' },
          priorStatus: 'AWAITING_REVIEW',
          newStatus: 'APPROVED',
        },
      ],
    },
    {
      id: 'demo-deliv-overdue',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-attention',
      taskId: 'demo-task-ready-1',
      contentId: 'demo-content-overdue',
      requestId: 'demo-request-5',
      title: { en: 'Retargeting square (overdue)', ar: 'مربع إعادة الاستهداف (متأخر)' },
      type: 'STATIC',
      reviewStatus: 'AWAITING_REVIEW',
      owner: 'Rami Khalil',
      reviewer: 'Omar Faris',
      dueAt: '2026-09-08',
      archived: false,
      currentVersionId: 'demo-dv-overdue-v1',
      approvedVersionId: null,
      versions: [
        {
          id: 'demo-dv-overdue-v1',
          label: 'v1',
          assets: ['/demo/stage5-static-v2.svg', '/demo/poster-static.svg'],
          notes: { en: 'Overdue against paid window', ar: 'متأخر عن نافذة المدفوع' },
          createdAt: '2026-09-07T18:00:00+03:00',
          immutable: false,
          createdBy: 'Rami Khalil',
          reviewDecision: null,
          status: 'SUBMITTED',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: 'da-overdue-1',
          at: '2026-09-07T18:05:00+03:00',
          actor: 'Rami Khalil',
          summary: {
            en: 'Submitted overdue retargeting square',
            ar: 'أُرسل مربع إعادة الاستهداف المتأخر',
          },
          kind: 'submitted',
        },
      ],
      decisions: [],
    },
    {
      id: 'demo-deliv-rejected',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-paid',
      taskId: null,
      contentId: null,
      requestId: 'demo-request-10',
      title: { en: 'Live spend claim banner', ar: 'لافتة ادعاء إنفاق مباشر' },
      type: 'STATIC',
      reviewStatus: 'REJECTED',
      owner: 'Omar Faris',
      reviewer: 'Layla Haddad',
      dueAt: '2026-09-05',
      archived: false,
      currentVersionId: 'demo-dv-rej-v1',
      approvedVersionId: null,
      versions: [
        {
          id: 'demo-dv-rej-v1',
          label: 'v1',
          assets: ['/demo/stage5-static-v1.svg'],
          notes: {
            en: 'Implied live Meta connection — rejected',
            ar: 'يوحي باتصال ميتا حي — مرفوض',
          },
          createdAt: '2026-09-03T10:00:00+03:00',
          immutable: false,
          createdBy: 'Omar Faris',
          reviewDecision: 'REJECTED',
          status: 'REJECTED',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: 'da-rej-1',
          at: '2026-09-03T11:00:00+03:00',
          actor: 'Layla Haddad',
          summary: {
            en: 'Rejected live spend claim banner',
            ar: 'رُفضت لافتة ادعاء الإنفاق المباشر',
          },
          kind: 'rejected',
        },
      ],
      decisions: [
        {
          id: 'dec-rej-1',
          at: '2026-09-03T11:00:00+03:00',
          actor: 'Layla Haddad',
          decision: 'REJECTED',
          versionId: 'demo-dv-rej-v1',
          reason: {
            en: 'Planning-only — no live ad spend claims',
            ar: 'تخطيط فقط — لا ادعاءات إنفاق مباشر',
          },
          priorStatus: 'AWAITING_REVIEW',
          newStatus: 'REJECTED',
        },
      ],
    },
    {
      id: 'demo-deliv-draft',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-draft',
      taskId: 'demo-task-email-draft',
      contentId: 'demo-content-email',
      requestId: 'demo-request-6',
      title: { en: 'Holiday email soft teaser', ar: 'بريد تشويقي ناعم للعطلة' },
      type: 'COPY',
      reviewStatus: 'DRAFT',
      owner: 'Sara Alami',
      reviewer: 'Layla Haddad',
      dueAt: '2026-10-02',
      archived: false,
      currentVersionId: 'demo-dv-draft-v1',
      approvedVersionId: null,
      versions: [
        {
          id: 'demo-dv-draft-v1',
          label: 'v1',
          assets: ['/demo/stage5-doc-proof.svg'],
          notes: { en: 'Draft HTML outline only', ar: 'مخطط HTML مسودة فقط' },
          createdAt: '2026-09-09T09:30:00+03:00',
          immutable: false,
          createdBy: 'Sara Alami',
          reviewDecision: null,
          status: 'DRAFT',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: 'da-draft-1',
          at: '2026-09-09T09:30:00+03:00',
          actor: 'Sara Alami',
          summary: { en: 'Created draft deliverable', ar: 'أُنشئ مخرج مسودة' },
          kind: 'created',
        },
      ],
      decisions: [],
    },
    {
      id: 'demo-deliv-in-review',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      taskId: 'demo-task-progress-1',
      contentId: 'demo-content-tiktok',
      requestId: 'demo-request-7',
      title: { en: 'Behind-the-rack TikTok cut', ar: 'مقطع تيك توك خلف الرف' },
      type: 'REEL',
      reviewStatus: 'IN_REVIEW',
      owner: 'Rami Khalil',
      reviewer: 'Maya Nasser',
      dueAt: '2026-09-17',
      archived: false,
      currentVersionId: 'demo-dv-inrev-v1',
      approvedVersionId: null,
      versions: [
        {
          id: 'demo-dv-inrev-v1',
          label: 'v1',
          assets: ['/demo/stage5-video-v1.svg', '/demo/video-poster.svg'],
          notes: { en: 'Rough cut under active review', ar: 'مونتاج أولي قيد المراجعة النشطة' },
          createdAt: '2026-09-10T12:30:00+03:00',
          immutable: false,
          createdBy: 'Rami Khalil',
          reviewDecision: null,
          status: 'SUBMITTED',
        },
      ],
      changeRequests: [],
      annotations: [
        {
          id: 'ann-inrev-1',
          versionId: 'demo-dv-inrev-v1',
          x: 0.4,
          y: 0.55,
          number: 1,
          author: 'Maya Nasser',
          body: { en: 'Hold on doorway light a beat longer.', ar: 'أطلِ ضوء المدخل ثانية أطول.' },
          at: '2026-09-10T13:00:00+03:00',
          resolved: false,
          replies: [],
          timestampLabel: '0:04',
        },
      ],
      comments: [],
      activity: [
        {
          id: 'da-inrev-1',
          at: '2026-09-10T12:45:00+03:00',
          actor: 'Maya Nasser',
          summary: { en: 'Started active review', ar: 'بدأت مراجعة نشطة' },
          kind: 'in_review',
        },
      ],
      decisions: [],
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
    // AWAITING_REVIEW + CHANGES_REQUESTED + IN_REVIEW across seed deliverables
    reviewQueueCount: 6,
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

function revisionAssetsForType(type: DemoDeliverableType): string[] {
  switch (type) {
    case 'CAROUSEL':
      return ['/demo/stage5-carousel-v3.svg', '/demo/poster-carousel-1.svg'];
    case 'REEL':
    case 'LONG_VIDEO':
      return ['/demo/stage5-video-v2.svg', '/demo/video-poster.svg'];
    case 'STATIC':
    case 'PHOTOGRAPHY':
      return ['/demo/stage5-static-v2.svg', '/demo/poster-static.svg'];
    case 'COPY':
      return ['/demo/stage5-doc-proof.svg'];
    default:
      return ['/demo/poster-static.svg'];
  }
}

function taskTypeToDeliverableType(type: DemoGraph['tasks'][number]['type']): DemoDeliverableType {
  switch (type) {
    case 'VIDEO':
      return 'REEL';
    case 'PHOTO':
      return 'PHOTOGRAPHY';
    case 'COPY':
      return 'COPY';
    case 'DESIGN':
    default:
      return 'STATIC';
  }
}

function syncReviewQueueCount(graph: DemoGraph): void {
  graph.commandCenter.reviewQueueCount = graph.deliverables.filter(
    (d) =>
      d.reviewStatus === 'AWAITING_REVIEW' ||
      d.reviewStatus === 'CHANGES_REQUESTED' ||
      d.reviewStatus === 'IN_REVIEW',
  ).length;
}

function replaceDeliverable(
  graph: DemoGraph,
  id: string,
  next: DemoGraph['deliverables'][number],
): DemoGraph['deliverables'][number] {
  const idx = graph.deliverables.findIndex((d) => d.id === id);
  if (idx < 0) throw new Error('Deliverable not found');
  graph.deliverables = [
    ...graph.deliverables.slice(0, idx),
    next,
    ...graph.deliverables.slice(idx + 1),
  ];
  syncReviewQueueCount(graph);
  return next;
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

  canTransitionReview(from: DemoReviewStatus, to: DemoReviewStatus): boolean {
    if (from === to) return true;
    const allowed: Record<DemoReviewStatus, DemoReviewStatus[]> = {
      DRAFT: ['AWAITING_REVIEW'],
      AWAITING_REVIEW: ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'DRAFT'],
      IN_REVIEW: ['CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'AWAITING_REVIEW'],
      CHANGES_REQUESTED: ['DRAFT', 'AWAITING_REVIEW'],
      APPROVED: [],
      REJECTED: ['DRAFT', 'AWAITING_REVIEW'],
    };
    return allowed[from]?.includes(to) ?? false;
  }

  addDemoRevision(id: string, opts?: { clientRequestId?: string; createdBy?: string }) {
    const current = this.getDeliverable(id);
    if (!current) return null;
    if (opts?.clientRequestId) {
      const kind = `clientRequestId:${opts.clientRequestId}`;
      if (current.activity.some((a) => a.kind === kind)) {
        return current;
      }
    }
    const now = new Date().toISOString();
    const versionNum = current.versions.length + 1;
    const versionId = `${id}-v${versionNum}-${Date.now().toString(36)}`;
    const versions = current.versions.map((v) => {
      if (v.immutable || v.status === 'APPROVED') return v;
      if (v.status === 'SUPERSEDED') return v;
      return { ...v, status: 'SUPERSEDED' as const };
    });
    const newVersion: DemoGraph['deliverables'][number]['versions'][number] = {
      id: versionId,
      label: `v${versionNum}`,
      assets: revisionAssetsForType(current.type),
      notes: {
        en: `Revision ${versionNum} from fixture assets`,
        ar: `مراجعة ${versionNum} من أصول تجريبية`,
      },
      createdAt: now,
      immutable: false,
      createdBy: opts?.createdBy ?? current.owner,
      reviewDecision: null,
      status: 'DRAFT',
    };
    versions.push(newVersion);
    const activityKind = opts?.clientRequestId
      ? `clientRequestId:${opts.clientRequestId}`
      : 'revision';
    const activity: DemoDeliverableActivity = {
      id: `da-${Date.now().toString(36)}`,
      at: now,
      actor: opts?.createdBy ?? current.owner,
      summary: {
        en: `Created revision ${newVersion.label}`,
        ar: `أُنشئت المراجعة ${newVersion.label}`,
      },
      kind: activityKind,
    };
    const next = {
      ...current,
      versions,
      currentVersionId: versionId,
      reviewStatus:
        current.reviewStatus === 'APPROVED' || current.reviewStatus === 'REJECTED'
          ? current.reviewStatus
          : ('DRAFT' as DemoReviewStatus),
      activity: [activity, ...current.activity],
    };
    // Do not reopen a fully approved deliverable via revision alone when approvedVersionId set
    if (current.approvedVersionId && current.reviewStatus === 'APPROVED') {
      next.reviewStatus = 'DRAFT';
    }
    return replaceDeliverable(this.graph, id, next);
  }

  selectCurrentVersion(id: string, versionId: string) {
    const current = this.getDeliverable(id);
    if (!current) return null;
    const version = current.versions.find((v) => v.id === versionId);
    if (!version) throw new Error('Version not found');
    const next = {
      ...current,
      currentVersionId: versionId,
      activity: [
        {
          id: `da-${Date.now().toString(36)}`,
          at: new Date().toISOString(),
          actor: 'system',
          summary: {
            en: `Selected ${version.label} as current`,
            ar: `حُدّد ${version.label} كحالي`,
          },
          kind: 'select_version',
        },
        ...current.activity,
      ],
    };
    return replaceDeliverable(this.graph, id, next);
  }

  addAnnotation(
    id: string,
    input: {
      versionId: string;
      x: number;
      y: number;
      author: string;
      body: DemoLocaleCopy;
      timestampLabel?: string | null;
    },
  ) {
    const current = this.getDeliverable(id);
    if (!current) return null;
    const version = current.versions.find((v) => v.id === input.versionId);
    if (!version) throw new Error('Version not found');
    if (version.immutable || version.status === 'APPROVED') {
      throw new Error('Cannot annotate an immutable or approved version');
    }
    const x = Math.min(1, Math.max(0, input.x));
    const y = Math.min(1, Math.max(0, input.y));
    const number = current.annotations.filter((a) => a.versionId === input.versionId).length + 1;
    const now = new Date().toISOString();
    const annotation: DemoDeliverableAnnotation = {
      id: `ann-${Date.now().toString(36)}`,
      versionId: input.versionId,
      x,
      y,
      number,
      author: input.author,
      body: input.body,
      at: now,
      resolved: false,
      replies: [],
      timestampLabel: input.timestampLabel ?? null,
    };
    const next = {
      ...current,
      annotations: [...current.annotations, annotation],
      activity: [
        {
          id: `da-${Date.now().toString(36)}`,
          at: now,
          actor: input.author,
          summary: { en: `Pinned annotation #${number}`, ar: `ثُبّتت ملاحظة #${number}` },
          kind: 'annotation',
        },
        ...current.activity,
      ],
    };
    return replaceDeliverable(this.graph, id, next);
  }

  addGeneralComment(
    id: string,
    input: { versionId: string; author: string; body: DemoLocaleCopy },
  ) {
    const current = this.getDeliverable(id);
    if (!current) return null;
    if (!current.versions.some((v) => v.id === input.versionId)) {
      throw new Error('Version not found');
    }
    const now = new Date().toISOString();
    const comment: DemoDeliverableComment = {
      id: `cmt-${Date.now().toString(36)}`,
      versionId: input.versionId,
      author: input.author,
      body: input.body,
      at: now,
      resolved: false,
    };
    const next = {
      ...current,
      comments: [...current.comments, comment],
      activity: [
        {
          id: `da-${Date.now().toString(36)}`,
          at: now,
          actor: input.author,
          summary: { en: 'Added general comment', ar: 'أُضيف تعليق عام' },
          kind: 'comment',
        },
        ...current.activity,
      ],
    };
    return replaceDeliverable(this.graph, id, next);
  }

  resolveAnnotation(id: string, annotationId: string, resolved: boolean) {
    const current = this.getDeliverable(id);
    if (!current) return null;
    const idx = current.annotations.findIndex((a) => a.id === annotationId);
    if (idx < 0) throw new Error('Annotation not found');
    const annotations = current.annotations.map((a) =>
      a.id === annotationId ? { ...a, resolved } : a,
    );
    const now = new Date().toISOString();
    const next = {
      ...current,
      annotations,
      activity: [
        {
          id: `da-${Date.now().toString(36)}`,
          at: now,
          actor: 'system',
          summary: {
            en: resolved ? 'Resolved annotation' : 'Reopened annotation',
            ar: resolved ? 'حُلّت الملاحظة' : 'أُعيد فتح الملاحظة',
          },
          kind: 'annotation_resolve',
        },
        ...current.activity,
      ],
    };
    return replaceDeliverable(this.graph, id, next);
  }

  submitForReview(id: string, versionId: string) {
    const current = this.getDeliverable(id);
    if (!current) return null;
    const version = current.versions.find((v) => v.id === versionId);
    if (!version) throw new Error('Version not found');
    if (version.immutable || version.status === 'APPROVED') {
      throw new Error('Cannot submit an immutable or approved version');
    }
    const targetStatus: DemoReviewStatus = 'AWAITING_REVIEW';
    if (
      current.reviewStatus !== targetStatus &&
      !this.canTransitionReview(current.reviewStatus, targetStatus)
    ) {
      throw new Error(`Invalid review transition ${current.reviewStatus} → ${targetStatus}`);
    }
    const now = new Date().toISOString();
    const versions = current.versions.map((v) => {
      if (v.id !== versionId) {
        if (v.immutable || v.status === 'APPROVED') return v;
        if (v.status === 'SUBMITTED') return { ...v, status: 'SUPERSEDED' as const };
        return v;
      }
      return { ...v, status: 'SUBMITTED' as const, reviewDecision: null };
    });
    const next = {
      ...current,
      versions,
      currentVersionId: versionId,
      reviewStatus: targetStatus,
      activity: [
        {
          id: `da-${Date.now().toString(36)}`,
          at: now,
          actor: current.owner,
          summary: {
            en: `Submitted ${version.label} for review`,
            ar: `أُرسل ${version.label} للمراجعة`,
          },
          kind: 'submitted',
        },
        ...current.activity,
      ],
    };
    return replaceDeliverable(this.graph, id, next);
  }

  decideReview(
    id: string,
    input: {
      decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
      versionId: string;
      actor: string;
      reason?: DemoLocaleCopy;
    },
  ) {
    const current = this.getDeliverable(id);
    if (!current) return null;
    const version = current.versions.find((v) => v.id === input.versionId);
    if (!version) throw new Error('Version not found');
    if (version.immutable && input.decision !== 'APPROVED') {
      throw new Error('Cannot mutate an immutable version');
    }
    if (version.status === 'APPROVED' && version.immutable && input.decision !== 'APPROVED') {
      throw new Error('Cannot mutate an approved version');
    }
    const to = input.decision;
    if (!this.canTransitionReview(current.reviewStatus, to)) {
      throw new Error(`Invalid review transition ${current.reviewStatus} → ${to}`);
    }
    if (
      (to === 'CHANGES_REQUESTED' || to === 'REJECTED') &&
      (!input.reason || !input.reason.en.trim())
    ) {
      throw new Error('reason is required for CHANGES_REQUESTED and REJECTED');
    }
    const now = new Date().toISOString();
    const reason = input.reason ?? { en: '', ar: '' };
    const versions = current.versions.map((v) => {
      if (v.id !== input.versionId) return v;
      if (to === 'APPROVED') {
        return {
          ...v,
          immutable: true,
          status: 'APPROVED' as const,
          reviewDecision: 'APPROVED' as const,
        };
      }
      if (to === 'REJECTED') {
        return {
          ...v,
          status: 'REJECTED' as const,
          reviewDecision: 'REJECTED' as const,
        };
      }
      return {
        ...v,
        status: 'SUBMITTED' as const,
        reviewDecision: 'CHANGES_REQUESTED' as const,
      };
    });
    const changeRequests =
      to === 'CHANGES_REQUESTED'
        ? [
            {
              id: `cr-${Date.now().toString(36)}`,
              body: reason,
              author: input.actor,
              at: now,
            },
            ...current.changeRequests,
          ]
        : current.changeRequests;
    const decision: DemoDeliverableDecision = {
      id: `dec-${Date.now().toString(36)}`,
      at: now,
      actor: input.actor,
      decision: to,
      versionId: input.versionId,
      reason,
      priorStatus: current.reviewStatus,
      newStatus: to,
    };
    const next = {
      ...current,
      versions,
      reviewStatus: to,
      approvedVersionId: to === 'APPROVED' ? input.versionId : current.approvedVersionId,
      currentVersionId: input.versionId,
      changeRequests,
      decisions: [decision, ...current.decisions],
      activity: [
        {
          id: `da-${Date.now().toString(36)}`,
          at: now,
          actor: input.actor,
          summary: {
            en: `Review decision: ${to}`,
            ar: `قرار المراجعة: ${to}`,
          },
          kind: to.toLowerCase(),
        },
        ...current.activity,
      ],
    };
    return replaceDeliverable(this.graph, id, next);
  }

  createDeliverableFromTask(taskId: string) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');
    if (task.deliverableId) {
      const existing = this.getDeliverable(task.deliverableId);
      if (existing) return existing;
    }
    const existingLinked = this.graph.deliverables.find((d) => d.taskId === taskId);
    if (existingLinked) {
      const tIdx = this.graph.tasks.findIndex((t) => t.id === taskId);
      if (tIdx >= 0 && this.graph.tasks[tIdx]!.deliverableId !== existingLinked.id) {
        this.graph.tasks[tIdx] = {
          ...this.graph.tasks[tIdx]!,
          deliverableId: existingLinked.id,
        };
      }
      return existingLinked;
    }
    const now = new Date().toISOString();
    const id = `demo-deliv-${Date.now().toString(36)}`;
    const versionId = `${id}-v1`;
    const type = taskTypeToDeliverableType(task.type);
    const owner = task.assignee === 'Unassigned' ? 'system' : task.assignee;
    const row: DemoGraph['deliverables'][number] = {
      id,
      brandId: task.brandId,
      campaignId: task.campaignId ?? 'demo-campaign-organic',
      taskId,
      contentId: task.contentId,
      requestId: task.requestId,
      title: task.title,
      type,
      reviewStatus: 'DRAFT',
      owner,
      reviewer: 'Layla Haddad',
      dueAt: task.dueAt,
      archived: false,
      currentVersionId: versionId,
      approvedVersionId: null,
      versions: [
        {
          id: versionId,
          label: 'v1',
          assets: revisionAssetsForType(type),
          notes: {
            en: 'Created from task',
            ar: 'أُنشئ من مهمة',
          },
          createdAt: now,
          immutable: false,
          createdBy: owner,
          reviewDecision: null,
          status: 'DRAFT',
        },
      ],
      changeRequests: [],
      annotations: [],
      comments: [],
      activity: [
        {
          id: `da-${Date.now().toString(36)}`,
          at: now,
          actor: 'system',
          summary: { en: 'Created from task', ar: 'أُنشئ من مهمة' },
          kind: 'created',
        },
      ],
      decisions: [],
    };
    this.graph.deliverables = [row, ...this.graph.deliverables];
    const tIdx = this.graph.tasks.findIndex((t) => t.id === taskId);
    if (tIdx >= 0) {
      this.graph.tasks[tIdx] = { ...this.graph.tasks[tIdx]!, deliverableId: id };
    }
    syncReviewQueueCount(this.graph);
    return row;
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

  getTask(id: string) {
    return this.graph.tasks.find((t) => t.id === id) ?? null;
  }

  getBrief(id: string) {
    return this.graph.briefs.find((b) => b.id === id) ?? null;
  }

  createRequest(input: {
    title: DemoLocaleCopy;
    description?: DemoLocaleCopy;
    type: DemoGraph['requests'][number]['type'];
    brandId: string;
    campaignId?: string | null;
    contentId?: string | null;
    priority: DemoGraph['requests'][number]['priority'];
    dueAt: string;
    requester: string;
    assignee?: string | null;
    channels?: string[];
    formats?: string[];
    outcome?: DemoLocaleCopy;
  }) {
    const id = `demo-request-${Date.now().toString(36)}`;
    const row: DemoGraph['requests'][number] = {
      id,
      brandId: input.brandId,
      campaignId: input.campaignId ?? null,
      contentId: input.contentId ?? null,
      title: input.title,
      description: input.description ?? { en: '', ar: '' },
      type: input.type,
      priority: input.priority,
      status: input.assignee ? 'ASSIGNED' : 'OPEN',
      dueAt: input.dueAt,
      submittedAt: new Date().toISOString().slice(0, 10),
      requester: input.requester,
      assignee: input.assignee ?? null,
      briefId: null,
      outcome: input.outcome,
      formats: input.formats ?? [],
      channels: input.channels ?? [],
      references: [],
      conversionTaskIds: [],
    };
    this.graph.requests = [row, ...this.graph.requests];
    return row;
  }

  updateRequest(
    id: string,
    patch: Partial<
      Pick<
        DemoGraph['requests'][number],
        | 'title'
        | 'description'
        | 'status'
        | 'priority'
        | 'assignee'
        | 'dueAt'
        | 'campaignId'
        | 'contentId'
        | 'briefId'
        | 'conversionTaskIds'
      >
    >,
  ) {
    const idx = this.graph.requests.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const current = this.graph.requests[idx]!;
    const next = { ...current, ...patch };
    this.graph.requests = [
      ...this.graph.requests.slice(0, idx),
      next,
      ...this.graph.requests.slice(idx + 1),
    ];
    return next;
  }

  upsertBrief(
    requestId: string,
    patch: Partial<DemoGraph['briefs'][number]> & {
      readiness?: DemoGraph['briefs'][number]['readiness'];
    },
  ) {
    const request = this.getRequest(requestId);
    if (!request) throw new Error('Request not found');
    const existing = this.graph.briefs.find((b) => b.requestId === requestId);
    if (existing) {
      const next = { ...existing, ...patch, requestId };
      next.readiness = patch.readiness ?? this.briefReadiness(next);
      this.graph.briefs = this.graph.briefs.map((b) => (b.id === existing.id ? next : b));
      if (next.readiness === 'READY' && request.status === 'IN_BRIEF') {
        this.updateRequest(requestId, { status: 'READY_FOR_PRODUCTION' });
      }
      return next;
    }
    const id = `demo-brief-${Date.now().toString(36)}`;
    const empty = { en: '', ar: '' };
    const row: DemoGraph['briefs'][number] = {
      id,
      requestId,
      overview: patch.overview ?? empty,
      objective: patch.objective ?? empty,
      audience: patch.audience ?? empty,
      keyMessage: patch.keyMessage ?? empty,
      deliverableType: patch.deliverableType ?? empty,
      channels: patch.channels ?? [],
      formats: patch.formats ?? [],
      tone: patch.tone ?? empty,
      mandatory: patch.mandatory ?? empty,
      cta: patch.cta ?? empty,
      references: patch.references ?? [],
      doList: patch.doList ?? [],
      dontList: patch.dontList ?? [],
      timelineNote: patch.timelineNote ?? empty,
      stakeholders: patch.stakeholders ?? [],
      acceptance: patch.acceptance ?? empty,
      dueAt: patch.dueAt ?? request.dueAt,
      attachmentAssets: patch.attachmentAssets ?? [],
      readiness: 'DRAFT',
    };
    row.readiness = patch.readiness ?? this.briefReadiness(row);
    this.graph.briefs = [row, ...this.graph.briefs];
    this.updateRequest(requestId, {
      briefId: id,
      status: row.readiness === 'READY' ? 'READY_FOR_PRODUCTION' : 'IN_BRIEF',
    });
    return row;
  }

  briefReadiness(brief: DemoGraph['briefs'][number]): 'DRAFT' | 'INCOMPLETE' | 'READY' {
    const required = [
      brief.objective,
      brief.audience,
      brief.keyMessage,
      brief.cta,
      brief.acceptance,
    ];
    const filled = required.every((c) => c.en.trim().length > 0);
    const hasChannels = brief.channels.length > 0 && brief.formats.length > 0;
    if (!filled && !brief.overview.en.trim()) return 'DRAFT';
    if (!filled || !hasChannels) return 'INCOMPLETE';
    return 'READY';
  }

  convertBriefToTasks(requestId: string) {
    const request = this.getRequest(requestId);
    if (!request) throw new Error('Request not found');
    if (request.conversionTaskIds && request.conversionTaskIds.length > 0) {
      return this.graph.tasks.filter((t) => request.conversionTaskIds!.includes(t.id));
    }
    const brief = this.graph.briefs.find((b) => b.requestId === requestId);
    if (!brief || this.briefReadiness(brief) !== 'READY') {
      throw new Error('Brief is not ready for production');
    }
    const typeMap: Record<string, DemoGraph['tasks'][number]['type']> = {
      DESIGN: 'DESIGN',
      VIDEO: 'VIDEO',
      CONTENT: 'COPY',
      REVISION: 'COPY',
      CAMPAIGN_SUPPORT: 'DESIGN',
      OTHER: 'COPY',
    };
    const id = `demo-task-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const task: DemoGraph['tasks'][number] = {
      id,
      brandId: request.brandId,
      campaignId: request.campaignId,
      contentId: request.contentId,
      requestId,
      briefId: brief.id,
      deliverableId: null,
      title: {
        en: `Produce: ${request.title.en}`,
        ar: `إنتاج: ${request.title.ar}`,
      },
      description: brief.objective,
      type: typeMap[request.type] ?? 'DESIGN',
      status: 'READY',
      assignee: request.assignee ?? 'Unassigned',
      department: 'Production',
      priority: request.priority,
      dueAt: brief.dueAt,
      updatedAt: now,
      blockedReason: null,
      dependencies: [],
      checklist: [
        {
          id: `${id}-c1`,
          label: { en: 'Confirm brief acceptance', ar: 'تأكيد قبول الموجز' },
          done: false,
        },
        {
          id: `${id}-c2`,
          label: { en: 'Deliver first draft', ar: 'تسليم المسودة الأولى' },
          done: false,
        },
      ],
      comments: [],
      activity: [
        {
          id: `${id}-a1`,
          at: now,
          actor: 'system',
          summary: {
            en: 'Created from ready brief',
            ar: 'أُنشئت من موجز جاهز',
          },
        },
      ],
    };
    this.graph.tasks = [task, ...this.graph.tasks];
    this.updateRequest(requestId, {
      conversionTaskIds: [id],
      status: 'IN_PRODUCTION',
    });
    return [task];
  }

  createTask(input: {
    title: DemoLocaleCopy;
    description?: DemoLocaleCopy;
    brandId: string;
    campaignId?: string | null;
    contentId?: string | null;
    requestId?: string | null;
    briefId?: string | null;
    type: DemoGraph['tasks'][number]['type'];
    status?: DemoTaskStatus;
    assignee: string;
    priority: DemoGraph['tasks'][number]['priority'];
    dueAt: string;
  }) {
    const id = `demo-task-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const row: DemoGraph['tasks'][number] = {
      id,
      brandId: input.brandId,
      campaignId: input.campaignId ?? null,
      contentId: input.contentId ?? null,
      requestId: input.requestId ?? null,
      briefId: input.briefId ?? null,
      deliverableId: null,
      title: input.title,
      description: input.description ?? { en: '', ar: '' },
      type: input.type,
      status: input.status ?? 'BACKLOG',
      assignee: input.assignee,
      department: 'Production',
      priority: input.priority,
      dueAt: input.dueAt,
      updatedAt: now,
      blockedReason: null,
      dependencies: [],
      checklist: [],
      comments: [],
      activity: [
        {
          id: `${id}-a0`,
          at: now,
          actor: 'system',
          summary: { en: 'Task created', ar: 'تم إنشاء المهمة' },
        },
      ],
    };
    this.graph.tasks = [row, ...this.graph.tasks];
    return row;
  }

  canTransitionTaskStatus(from: DemoTaskStatus, to: DemoTaskStatus): boolean {
    if (from === to) return true;
    const allowed: Record<DemoTaskStatus, DemoTaskStatus[]> = {
      BACKLOG: ['READY', 'IN_PROGRESS'],
      READY: ['BACKLOG', 'IN_PROGRESS', 'BLOCKED'],
      IN_PROGRESS: ['READY', 'BLOCKED', 'IN_REVIEW', 'DONE', 'OVERDUE'],
      BLOCKED: ['IN_PROGRESS', 'READY', 'BACKLOG'],
      IN_REVIEW: ['IN_PROGRESS', 'DONE', 'BLOCKED'],
      DONE: ['BACKLOG'],
      OVERDUE: ['IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'],
    };
    return allowed[from]?.includes(to) ?? false;
  }

  updateTask(
    id: string,
    patch: Partial<
      Pick<
        DemoGraph['tasks'][number],
        | 'title'
        | 'description'
        | 'status'
        | 'priority'
        | 'assignee'
        | 'dueAt'
        | 'checklist'
        | 'comments'
        | 'activity'
        | 'blockedReason'
      >
    >,
  ) {
    const idx = this.graph.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return null;
    const current = this.graph.tasks[idx]!;
    if (patch.status && !this.canTransitionTaskStatus(current.status, patch.status)) {
      throw new Error(`Invalid task status transition ${current.status} → ${patch.status}`);
    }
    const now = new Date().toISOString();
    const activity = [...(current.activity ?? [])];
    if (patch.status && patch.status !== current.status) {
      activity.unshift({
        id: `${id}-a-${Date.now().toString(36)}`,
        at: now,
        actor: 'system',
        summary: {
          en: `Status → ${patch.status}`,
          ar: `الحالة ← ${patch.status}`,
        },
      });
    }
    if (patch.assignee && patch.assignee !== current.assignee) {
      activity.unshift({
        id: `${id}-a-${Date.now().toString(36)}x`,
        at: now,
        actor: 'system',
        summary: {
          en: `Assignee → ${patch.assignee}`,
          ar: `المكلَّف ← ${patch.assignee}`,
        },
      });
    }
    if (patch.dueAt && patch.dueAt !== current.dueAt) {
      activity.unshift({
        id: `${id}-a-${Date.now().toString(36)}d`,
        at: now,
        actor: 'system',
        summary: {
          en: `Due date → ${patch.dueAt}`,
          ar: `الاستحقاق ← ${patch.dueAt}`,
        },
      });
    }
    const next = {
      ...current,
      ...patch,
      activity: patch.activity ?? activity,
      updatedAt: now,
    };
    this.graph.tasks = [
      ...this.graph.tasks.slice(0, idx),
      next,
      ...this.graph.tasks.slice(idx + 1),
    ];
    return next;
  }

  addTaskComment(id: string, author: string, body: DemoLocaleCopy) {
    const task = this.getTask(id);
    if (!task) return null;
    const comment = {
      id: `cm-${Date.now().toString(36)}`,
      author,
      body,
      at: new Date().toISOString(),
    };
    return this.updateTask(id, { comments: [comment, ...task.comments] });
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
    const request = this.graph.requests.find((r) => r.id === 'demo-request-1')!;
    const brief = this.graph.briefs.find((b) => b.id === request.briefId)!;
    const task = this.graph.tasks.find((t) => t.id === 'demo-task-design')!;
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
