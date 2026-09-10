/**
 * Typed local DemoDataProvider — linked agency scenario for Owner product demo.
 * Guarded by assertDemoModeAllowed(); never active in production.
 */

export type DemoLocaleCopy = { en: string; ar: string };

export type DemoBrandState = 'healthy' | 'partial' | 'draft';
export type DemoTrack = 'ORGANIC' | 'PAID';
export type DemoCampaignStatus = 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
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
    status: DemoContentStatus;
    scheduledAt: string | null;
    assignee: string;
    previewAsset: string;
    deliverableId: string | null;
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
  ],
  contentItems: [
    {
      id: 'demo-content-reel',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Studio morning reel', ar: 'ريل صباحي من الاستوديو' },
      track: 'ORGANIC',
      channel: 'Instagram',
      status: 'SCHEDULED',
      scheduledAt: '2026-09-12T09:00:00+03:00',
      assignee: 'Maya Nasser',
      previewAsset: '/demo/video-poster.svg',
      deliverableId: 'demo-deliv-reel',
    },
    {
      id: 'demo-content-carousel',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Fabric story carousel', ar: 'كاروسيل قصة القماش' },
      track: 'ORGANIC',
      channel: 'Instagram',
      status: 'IN_REVIEW',
      scheduledAt: null,
      assignee: 'Rami Khalil',
      previewAsset: '/demo/poster-carousel-1.svg',
      deliverableId: 'demo-deliv-carousel',
    },
    {
      id: 'demo-content-paid-static',
      campaignId: 'demo-campaign-paid',
      brandId: 'demo-brand-horizon',
      title: { en: 'Paid collection hero', ar: 'بطل المجموعة المدفوعة' },
      track: 'PAID',
      channel: 'Meta Ads',
      status: 'DRAFT',
      scheduledAt: null,
      assignee: 'Sara Alami',
      previewAsset: '/demo/poster-static.svg',
      deliverableId: 'demo-deliv-static',
    },
    {
      id: 'demo-content-published',
      campaignId: 'demo-campaign-organic',
      brandId: 'demo-brand-horizon',
      title: { en: 'Founders note (published demo)', ar: 'رسالة المؤسسين (نشر تجريبي)' },
      track: 'ORGANIC',
      channel: 'LinkedIn',
      status: 'PUBLISHED_DEMO',
      scheduledAt: '2026-08-20T11:00:00+03:00',
      assignee: 'Layla Haddad',
      previewAsset: '/demo/poster-static.svg',
      deliverableId: 'demo-deliv-copy',
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

export class DemoDataProvider {
  constructor(private readonly graph: DemoGraph = DEMO_GRAPH) {}

  getGraph(): DemoGraph {
    return this.graph;
  }

  getCampaign(id: string) {
    return this.graph.campaigns.find((c) => c.id === id) ?? null;
  }

  getDeliverable(id: string) {
    return this.graph.deliverables.find((d) => d.id === id) ?? null;
  }

  getRequest(id: string) {
    return this.graph.requests.find((r) => r.id === id) ?? null;
  }

  getLinkedJourney() {
    const brand = this.graph.brands.find((b) => b.state === 'healthy')!;
    const strategy = this.graph.strategies.find((s) => s.id === brand.strategyId)!;
    const organic = this.graph.campaigns.find((c) => c.track === 'ORGANIC')!;
    const paid = this.graph.campaigns.find((c) => c.track === 'PAID')!;
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

export const demoDataProvider = new DemoDataProvider();
