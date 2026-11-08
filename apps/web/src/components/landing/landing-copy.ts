/**
 * Original OMA landing copy (EN + AR). Layout follows a Planable-style structure;
 * wording, brand and visuals are OMA's own.
 */
export type LandingCopy = typeof EN;

const EN = {
  nav: {
    features: 'Features',
    workflow: 'Workflow',
    pricing: 'Pricing',
    faq: 'FAQ',
    login: 'Log in',
    start: 'Start free',
    lang: 'العربية',
    menu: 'Menu',
    close: 'Close menu',
  },
  hero: {
    title: 'Create content together, calmly',
    sub: 'Plan, write, approve and schedule social content for every brand — with your team and clients in one workspace.',
    primary: 'Start free',
    secondary: 'Log in',
  },
  channels: 'Plan posts for the channels your audience uses',
  manifesto: {
    lead: 'One place',
    rest: 'for briefs, drafts, comments, approvals and the calendar. No more chasing files in chats, guessing which version is final, or rebuilding the plan in a spreadsheet every week.',
  },
  views: {
    title: 'Look at your plan the way you think',
    tabs: { calendar: 'Calendar', feed: 'Feed', grid: 'Grid', list: 'List' },
    calendar: {
      h: 'A calendar for the whole month',
      b: [
        ['Drag posts', ' between days to reschedule.'],
        ['Every channel', ' on one timeline.'],
        ['Status colors', ' show what is ready.'],
      ],
    },
    feed: {
      h: 'A feed that looks like the real post',
      b: [
        ['Native previews', ' for each network.'],
        ['Comments', ' right under the draft.'],
        ['Approve', ' without leaving the post.'],
      ],
    },
    grid: {
      h: 'A grid to check the visual rhythm',
      b: [
        ['See the profile', ' before you publish.'],
        ['Spot repeats', ' in colors and formats.'],
        ['Reorder', ' with a quick drag.'],
      ],
    },
    list: {
      h: 'A list for fast, focused review',
      b: [
        ['Filter', ' by brand, channel or status.'],
        ['Bulk actions', ' on many posts at once.'],
        ['Owners and dates', ' in plain sight.'],
      ],
    },
    cta: 'Start free',
  },
  feedbackTitle: 'Feedback that stays next to the work',
  split: [
    {
      id: 'comments',
      tone: 'peach',
      h: 'Comments and mentions on every draft',
      b: [
        ['Mention a teammate', ' and they get notified.'],
        ['Threads stay attached', ' to the exact post.'],
        ['Version history', ' so nothing gets lost.'],
      ],
    },
    {
      id: 'approvals',
      tone: 'lavender',
      h: 'Approvals that match how you work',
      b: [
        ['Up to three approval levels', ' depending on your plan.'],
        ['Clear status', ' from draft to approved.'],
        ['Schedule only', ' what has been approved.'],
      ],
    },
    {
      id: 'channels',
      tone: 'pink',
      h: 'Made for short video and every feed',
      b: [
        ['TikTok, Instagram, Facebook, LinkedIn and X', ' in one composer.'],
        ['Media checks', ' for each network’s limits.'],
        ['Captions', ' tailored per channel.'],
      ],
    },
    {
      id: 'drive',
      tone: 'blue',
      h: 'Work Drive keeps every asset in order',
      b: [
        ['A media library', ' for each brand.'],
        ['Find files fast', ' by brand and campaign.'],
        ['Reuse approved assets', ' in new posts.'],
      ],
    },
  ],
  splitCta: 'Try it free',
  workflow: {
    title: 'From request to delivered post',
    sub: 'Requests become tasks, tasks become deliverables, and deliverables go to review — all tracked in one place.',
    steps: [
      ['Requests', 'Clients and teammates send briefs with brand, channel and due date.'],
      ['Tasks', 'Turn a request into tasks and move them across a simple board.'],
      ['Deliverables', 'Upload versions, collect feedback and mark them approved.'],
    ],
  },
  help: {
    title: 'Ready when your team is',
    sub: 'Create a workspace in a minute. The free plan needs no card.',
    cta: 'Create your workspace',
  },
  bento: {
    title: 'Everything your content team needs',
    items: {
      campaigns: 'Group posts into campaigns and track their status',
      ai: 'Draft captions faster with AI assist',
      composer: 'Write once, adjust per channel',
      analytics: 'See how posts perform across channels',
      roles: 'Roles for managers, editors, approvers and viewers',
      notify: 'Notifications when something needs you',
    },
  },
  useCases: {
    title: 'Built for teams that publish every day',
    items: [
      [
        'Agencies',
        'Run many client brands side by side, each with its own calendar, media and approvers.',
      ],
      [
        'In-house teams',
        'Keep marketing, design and leadership on the same plan without long email threads.',
      ],
      [
        'Reviewers and clients',
        'Give approvers a clear view of what needs a decision, and nothing else.',
      ],
    ],
  },
  pricing: {
    title: 'Simple plans that grow with you',
    sub: 'Starter, Pro and Agency — priced before VAT. Choose monthly or yearly billing.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    perMonth: '/mo',
    contact: 'Custom',
    unlimited: 'Unlimited',
    brands: 'brands',
    seats: 'members',
    social: 'social accounts',
    posts: 'scheduled posts / month',
    postsTotal: 'posts total',
    credits: 'AI credits / month',
    keywords: 'listening keywords',
    mentions: 'mentions / month',
    storage: 'GB storage',
    levels: 'approval levels',
    level: 'approval level',
    cta: 'Get started',
    ctaContact: 'Get in touch',
    note: 'Prices are shown before VAT. VAT is added at checkout (default 17%, configurable — Israel is 18%). Paid X API access is an add-on.',
    popular: 'Most popular',
  },
  faq: {
    title: 'Questions, answered',
    items: [
      [
        'Which channels does OMA support?',
        'You can plan and preview posts for TikTok, Instagram, Facebook, LinkedIn and X. Direct publishing depends on each connected account.',
      ],
      [
        'Can clients approve content without a full account?',
        'Yes. Invite them with the viewer or approver role so they only see what needs their review.',
      ],
      [
        'Does OMA work in Arabic?',
        'Fully. The whole app and this page work in Arabic (right to left) and English, and each person can choose their language.',
      ],
      [
        'How many approval levels can I use?',
        'Free and Basic have one level, Pro has two, and Enterprise has up to three.',
      ],
      [
        'Is there a free plan?',
        'Yes. The free plan includes one brand, up to three members and 50 posts to try OMA with your real content.',
      ],
      [
        'Where are my files stored?',
        'Media lives in Work Drive inside your workspace, organized by brand, with storage based on your plan.',
      ],
    ],
  },
  final: {
    title: 'Give your team a calmer way to publish',
    sub: 'Plan, approve and schedule in one place — in Arabic and English.',
    primary: 'Start free',
    secondary: 'Log in',
  },
  footer: {
    tagline: 'Content planning and approvals for social teams.',
    product: 'Product',
    account: 'Account',
    language: 'Language',
    signup: 'Sign up',
    reset: 'Reset password',
    rights: 'All rights reserved.',
  },
  shots: {
    hero: 'OMA content calendar for the Noor Media workspace, showing a month of scheduled TikTok, Instagram and Facebook posts with a saved-drafts sidebar',
    'view-calendar': 'Week view of the OMA content calendar with approved posts for each day',
    'view-feed': 'Feed view in OMA previewing a post as it will look on the channel',
    'view-grid': 'Grid view in OMA showing an Instagram-style preview of upcoming posts',
    'view-list': 'List view in OMA with posts, brands, labels and dates in rows',
    comments: 'An OMA post open with the feedback panel showing team comments and a reaction',
    approvals:
      'An OMA post with its approval steps popover showing the approver and the approved status',
    composer:
      'The OMA composer with Instagram and TikTok channels selected and a caption being written',
    drive: 'The OMA media dialog showing recently added Work Drive images and videos',
    requests: 'The OMA requests list with briefs, brands, priorities and due dates',
    tasks: 'The OMA tasks board with cards in backlog, to do and in progress columns',
    deliverables: 'OMA deliverables with uploaded creatives and their review status',
    analytics: 'OMA analytics with post, scheduled, approval and comment counts and a posts chart',
    team: 'The OMA team page listing members with their roles and status',
    notifications: 'OMA notifications listing approval requests for posts',
  },
  workflowTabs: { requests: 'Requests', tasks: 'Tasks', deliverables: 'Deliverables' },
  mock: {
    draft: 'Draft',
    approved: 'Approved',
    inReview: 'In review',
    caption: 'New collection drops Thursday',
  },
};

const AR: LandingCopy = {
  nav: {
    features: 'الميزات',
    workflow: 'سير العمل',
    pricing: 'الأسعار',
    faq: 'الأسئلة',
    login: 'تسجيل الدخول',
    start: 'ابدأ مجاناً',
    lang: 'English',
    menu: 'القائمة',
    close: 'إغلاق القائمة',
  },
  hero: {
    title: 'اصنعوا المحتوى معاً، بهدوء',
    sub: 'خطّط واكتب ووافق وجدول محتوى التواصل لكل علامة تجارية — مع فريقك وعملائك في مساحة عمل واحدة.',
    primary: 'ابدأ مجاناً',
    secondary: 'تسجيل الدخول',
  },
  channels: 'خطّط منشوراتك للقنوات التي يتابعها جمهورك',
  manifesto: {
    lead: 'مكان واحد',
    rest: 'للطلبات والمسودات والتعليقات والموافقات والتقويم. لا مزيد من البحث عن الملفات في المحادثات، أو التخمين أي نسخة هي النهائية، أو إعادة بناء الخطة في جدول كل أسبوع.',
  },
  views: {
    title: 'شاهد خطتك بالطريقة التي تفكر بها',
    tabs: { calendar: 'التقويم', feed: 'الخلاصة', grid: 'الشبكة', list: 'القائمة' },
    calendar: {
      h: 'تقويم للشهر كاملاً',
      b: [
        ['اسحب المنشورات', ' بين الأيام لإعادة جدولتها.'],
        ['كل القنوات', ' على خط زمني واحد.'],
        ['ألوان الحالة', ' توضّح ما هو جاهز.'],
      ],
    },
    feed: {
      h: 'خلاصة تشبه المنشور الحقيقي',
      b: [
        ['معاينات أصلية', ' لكل منصة.'],
        ['التعليقات', ' أسفل المسودة مباشرة.'],
        ['الموافقة', ' دون مغادرة المنشور.'],
      ],
    },
    grid: {
      h: 'شبكة لمراجعة الإيقاع البصري',
      b: [
        ['شاهد الحساب', ' قبل النشر.'],
        ['اكتشف التكرار', ' في الألوان والأشكال.'],
        ['أعد الترتيب', ' بسحب سريع.'],
      ],
    },
    list: {
      h: 'قائمة لمراجعة سريعة ومركّزة',
      b: [
        ['فلترة', ' حسب العلامة أو القناة أو الحالة.'],
        ['إجراءات جماعية', ' على عدة منشورات.'],
        ['المسؤولون والتواريخ', ' أمامك بوضوح.'],
      ],
    },
    cta: 'ابدأ مجاناً',
  },
  feedbackTitle: 'ملاحظات تبقى بجانب العمل',
  split: [
    {
      id: 'comments',
      tone: 'peach',
      h: 'تعليقات وإشارات على كل مسودة',
      b: [
        ['أشِر إلى زميل', ' ليصله تنبيه.'],
        ['النقاشات تبقى مرتبطة', ' بالمنشور نفسه.'],
        ['سجل النسخ', ' فلا يضيع شيء.'],
      ],
    },
    {
      id: 'approvals',
      tone: 'lavender',
      h: 'موافقات تناسب طريقة عملك',
      b: [
        ['حتى ثلاث مستويات موافقة', ' حسب خطتك.'],
        ['حالة واضحة', ' من المسودة حتى الموافقة.'],
        ['جدولة ما تمت الموافقة عليه', ' فقط.'],
      ],
    },
    {
      id: 'channels',
      tone: 'pink',
      h: 'مصمّم للفيديو القصير ولكل خلاصة',
      b: [
        ['تيك توك وإنستغرام وفيسبوك ولينكدإن وإكس', ' في محرر واحد.'],
        ['فحص الوسائط', ' وفق حدود كل منصة.'],
        ['نصوص مخصّصة', ' لكل قناة.'],
      ],
    },
    {
      id: 'drive',
      tone: 'blue',
      h: 'Work Drive يرتّب كل ملفاتك',
      b: [
        ['مكتبة وسائط', ' لكل علامة تجارية.'],
        ['اعثر على الملفات بسرعة', ' حسب العلامة والحملة.'],
        ['أعد استخدام الملفات المعتمدة', ' في منشورات جديدة.'],
      ],
    },
  ],
  splitCta: 'جرّبه مجاناً',
  workflow: {
    title: 'من الطلب حتى المنشور المسلَّم',
    sub: 'الطلبات تتحول إلى مهام، والمهام إلى مخرجات، والمخرجات تذهب للمراجعة — وكل ذلك متابَع في مكان واحد.',
    steps: [
      ['الطلبات', 'يرسل العملاء والزملاء الطلب مع العلامة والقناة وموعد التسليم.'],
      ['المهام', 'حوّل الطلب إلى مهام وحرّكها على لوحة بسيطة.'],
      ['المخرجات', 'ارفع النسخ واجمع الملاحظات وحدّدها كمعتمدة.'],
    ],
  },
  help: {
    title: 'جاهزون متى كان فريقك جاهزاً',
    sub: 'أنشئ مساحة عمل خلال دقيقة. الخطة المجانية لا تحتاج بطاقة.',
    cta: 'أنشئ مساحة عملك',
  },
  bento: {
    title: 'كل ما يحتاجه فريق المحتوى',
    items: {
      campaigns: 'جمّع المنشورات في حملات وتابع حالتها',
      ai: 'اكتب النصوص أسرع بمساعدة الذكاء الاصطناعي',
      composer: 'اكتب مرة واحدة وعدّل لكل قناة',
      analytics: 'اعرف أداء المنشورات عبر القنوات',
      roles: 'أدوار للمدير والمحرر والمعتمِد والمشاهد',
      notify: 'تنبيهات عندما يحتاجك شيء',
    },
  },
  useCases: {
    title: 'مصمّم للفرق التي تنشر كل يوم',
    items: [
      ['الوكالات', 'أدِر علامات عملاء كثيرة جنباً إلى جنب، لكل منها تقويمها ووسائطها ومعتمدوها.'],
      ['الفرق الداخلية', 'اجمع التسويق والتصميم والإدارة على خطة واحدة دون سلاسل بريد طويلة.'],
      ['المراجعون والعملاء', 'امنح المعتمدين رؤية واضحة لما يحتاج قرارهم فقط.'],
    ],
  },
  pricing: {
    title: 'خطط بسيطة تنمو معك',
    sub: 'البداية والاحترافية والوكالة — الأسعار قبل الضريبة. اختر فوترة شهرية أو سنوية.',
    monthly: 'شهري',
    yearly: 'سنوي',
    perMonth: '/شهرياً',
    contact: 'حسب الطلب',
    unlimited: 'غير محدود',
    brands: 'علامات تجارية',
    seats: 'أعضاء',
    social: 'حسابات اجتماعية',
    posts: 'منشور مجدول / شهر',
    postsTotal: 'منشور إجمالاً',
    credits: 'رصيد ذكاء اصطناعي / شهر',
    keywords: 'كلمات استماع',
    mentions: 'إشارة / شهر',
    storage: 'غيغابايت تخزين',
    levels: 'مستويات موافقة',
    level: 'مستوى موافقة',
    cta: 'ابدأ الآن',
    ctaContact: 'تواصل معنا',
    note: 'الأسعار قبل الضريبة. تُضاف الضريبة عند الدفع (افتراضياً 17٪ وقابلة للتغيير — في إسرائيل 18٪). الوصول إلى واجهة إكس المدفوعة إضافة مستقلة.',
    popular: 'الأكثر اختياراً',
  },
  faq: {
    title: 'إجابات لأسئلتك',
    items: [
      [
        'ما القنوات التي يدعمها OMA؟',
        'يمكنك تخطيط المنشورات ومعاينتها لتيك توك وإنستغرام وفيسبوك ولينكدإن وإكس. النشر المباشر يعتمد على كل حساب مربوط.',
      ],
      [
        'هل يستطيع العملاء الموافقة دون حساب كامل؟',
        'نعم. ادعهم بدور المشاهد أو المعتمِد ليروا فقط ما يحتاج مراجعتهم.',
      ],
      [
        'هل يعمل OMA بالعربية؟',
        'بالكامل. التطبيق وهذه الصفحة يعملان بالعربية (من اليمين لليسار) وبالإنجليزية، ويختار كل شخص لغته.',
      ],
      [
        'كم مستوى موافقة يمكنني استخدامه؟',
        'المجانية والأساسية مستوى واحد، والاحترافية مستويان، والمؤسسات حتى ثلاثة مستويات.',
      ],
      [
        'هل توجد خطة مجانية؟',
        'نعم. تشمل علامة تجارية واحدة وحتى ثلاثة أعضاء و50 منشوراً لتجربة OMA بمحتواك الحقيقي.',
      ],
      [
        'أين تُحفظ ملفاتي؟',
        'الوسائط محفوظة في Work Drive داخل مساحة عملك، مرتبة حسب العلامة، بسعة حسب خطتك.',
      ],
    ],
  },
  final: {
    title: 'امنح فريقك طريقة أهدأ للنشر',
    sub: 'خطّط ووافق وجدول في مكان واحد — بالعربية والإنجليزية.',
    primary: 'ابدأ مجاناً',
    secondary: 'تسجيل الدخول',
  },
  footer: {
    tagline: 'تخطيط المحتوى والموافقات لفرق التواصل الاجتماعي.',
    product: 'المنتج',
    account: 'الحساب',
    language: 'اللغة',
    signup: 'إنشاء حساب',
    reset: 'استعادة كلمة المرور',
    rights: 'جميع الحقوق محفوظة.',
  },
  shots: {
    hero: 'تقويم المحتوى في OMA لمساحة عمل نور ميديا، يعرض شهرًا من منشورات تيك توك وإنستغرام وفيسبوك المجدولة مع قائمة المسودات المحفوظة',
    'view-calendar': 'عرض الأسبوع في تقويم محتوى OMA مع المنشورات المعتمدة لكل يوم',
    'view-feed': 'عرض الخلاصة في OMA يعاين المنشور كما سيظهر على القناة',
    'view-grid': 'عرض الشبكة في OMA بمعاينة شبيهة بإنستغرام للمنشورات القادمة',
    'view-list': 'عرض القائمة في OMA بالمنشورات والعلامات والتصنيفات والتواريخ في صفوف',
    comments: 'منشور مفتوح في OMA مع لوحة الملاحظات وتعليقات الفريق وتفاعل',
    approvals: 'منشور في OMA مع نافذة خطوات الاعتماد تُظهر المعتمِد وحالة الاعتماد',
    composer: 'محرر المنشورات في OMA مع اختيار قناتي إنستغرام وتيك توك وكتابة النص',
    drive: 'نافذة الوسائط في OMA تعرض الصور والفيديوهات المضافة مؤخرًا في WorkDrive',
    requests: 'قائمة الطلبات في OMA مع الموجزات والعلامات والأولويات وتواريخ التسليم',
    tasks: 'لوحة المهام في OMA مع البطاقات في أعمدة المهام المؤجلة وقيد الانتظار وقيد التنفيذ',
    deliverables: 'المخرجات في OMA مع التصاميم المرفوعة وحالة مراجعتها',
    analytics: 'تحليلات OMA مع أعداد المنشورات والمجدولة والموافقات والتعليقات ورسم بياني',
    team: 'صفحة الفريق في OMA تعرض الأعضاء وأدوارهم وحالتهم',
    notifications: 'إشعارات OMA تعرض طلبات الموافقة على المنشورات',
  },
  workflowTabs: { requests: 'الطلبات', tasks: 'المهام', deliverables: 'المخرجات' },
  mock: {
    draft: 'مسودة',
    approved: 'معتمد',
    inReview: 'قيد المراجعة',
    caption: 'التشكيلة الجديدة يوم الخميس',
  },
};

export const LANDING_COPY = { en: EN, ar: AR } as const;
