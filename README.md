# OMA AI — Spec Kit + Cursor Workflow (v0.2)

هذه الحزمة هي **طبقة تأسيس خاصة بـ OMA AI فقط**. لا تنقل مواصفات تطبيقات IMKAN ONE الأخرى، ولا تختار Stack تقني، ولا تبدأ كود المنتج.

## تعريف المنتج المختصر

OMA AI منصة متعددة الشركات تدير دورة صناعة المحتوى كاملة:

`Website intelligence → Strategy → Organic/Paid plans → Briefs → Production tasks → Review/Approval → WorkDrive → Publishing/Paid media`

المنتج ليس Kanban فقط؛ الـKanban هو جزء التنفيذ داخل سلسلة مترابطة تحفظ أصل كل قرار وكل ملف وكل اعتماد.

OMA AI **منتج مستقل داخل مظلة IMKAN**: له مستودعه وتطبيقه وهيكل معلوماته وهوية التصميم والحركة الخاصة به. لا يلزمه نسخ IMKAN ONE بصريًا، ويظهر ارتباطه بإمكان عبر هوية اعتماد مثل `OMA AI by IMKAN` والتكاملات المعتمدة، لا عبر تكرار الشاشات والألوان.

## ما تتضمنه الحزمة

```text
.
├── AGENTS.md
├── CURSOR_BOOTSTRAP_PROMPT.md
├── docs/
│   ├── CURSOR_WORKFLOW.md
│   └── DESIGN_REFERENCE_STRATEGY.md
├── .specify/
│   └── memory/
│       └── constitution.md
├── specs/
│   └── 001-oma-ai-product-foundation/
│       ├── spec.md
│       └── checklists/
│           └── requirements.md
├── .agents/
│   └── skills/
│       ├── oma-spec-first/SKILL.md
│       ├── oma-deliver-change/SKILL.md
│       └── oma-verify-change/SKILL.md
└── .cursor/
    ├── rules/
    │   └── oma-orchestrator.mdc
    └── agents/
        ├── oma-spec-auditor.md
        └── oma-verifier.md
```

`AGENTS.md` و`.agents/skills/` هما العقد المشترك بين Cursor وCodex وOpenCode. ملفات `.cursor/` تضيف فقط سلوك التنسيق الخاص بـCursor، ولا تعيد نسخ المواصفة.

## المسار الأسهل: دع Cursor ينشئ المشروع وGitHub repo

1. افتح في Cursor مجلدًا أبًا آمنًا تريد إنشاء المشروع داخله.
2. أرفق ملفات هذه الحزمة في سياق Cursor إن أمكن، وبالأخص `spec.md`.
3. انسخ محتوى `CURSOR_BOOTSTRAP_PROMPT.md` كاملًا إلى Cursor Agent.
4. سيجري Cursor فحصًا أولًا، ثم ينشئ `oma-ai` وGitHub repo خاصًا، يثبت الملفات، يدفع أول Commit، ويقف قبل البرمجة.

لا ترسل إلى Cursor أي Token أو Password داخل الدردشة؛ إذا احتاج GitHub login سيوقف العمل لتكمله يدويًا.

## طريقة التركيب في مشروع OMA AI

1. أنشئ أو افتح مستودع OMA AI.
2. افحص الأدوات الموجودة أولاً، ولا تعِد تثبيت أي أداة تعمل بالفعل.
3. إذا لم يكن GitHub Spec Kit مهيأً، شغّل التهيئة الرسمية **قبل** نسخ هذه الحزمة:

   ```bash
   specify --version
   specify integration list
   specify init --here --force --non-interactive --integration cursor-agent
   ```

4. انسخ محتويات هذا المجلد إلى جذر المشروع مع الحفاظ على المجلدات المخفية.
5. افتح Cursor Agent والصق رسالة البدء التالية:

   ```text
   Read AGENTS.md, .specify/memory/constitution.md,
   specs/001-oma-ai-product-foundation/spec.md, and docs/CURSOR_WORKFLOW.md.
   Work in SPEC_ONLY mode. Do not implement product code and do not choose a stack.
   Inspect the actual repository and installed tool versions, report conflicts,
   then ask only for the unresolved blocker decisions required before technical planning.
   ```

6. بعد إغلاق القرارات المانعة، اتبع دورة Spec Kit الظاهرة داخل Cursor:

   `clarify → plan → tasks → analyze → implement → converge`

   في تكامل Cursor الحديث تظهر عادةً كمهارات مثل `/speckit-clarify` و`/speckit-plan`. استخدم الأسماء التي يعرضها Cursor/نسخة Spec Kit المثبتة فعلياً.

## حالة القرارات قبل أي Plan تقني

| ID      | الحالة       | القرار                                                                       | الأثر                                                                                                       |
| ------- | ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| DEC-001 | **RESOLVED** | مستودع مستقل خاص باسم `oma-ai`                                               | OMA AI مشروع مستقل داخل مظلة IMKAN.                                                                         |
| DEC-002 | **RESOLVED** | OMA يملك الحسابات والدخول والجلسات والمستخدمين والشركات والعضويات والصلاحيات | أي IMKAN SSO أو مزامنة مستقبلية ستكون مشروع تكامل منفصلًا.                                                  |
| DEC-003 | Open         | ملكية ملفات Imkan WorkDrive                                                  | يحدد أين توجد الـfile bytes وأين توجد metadata/version history.                                             |
| DEC-004 | Open         | طريقة ربط المواقع في النسخة الأولى                                           | Public URL crawl أم connector/API لمتاجر إلكترونية؟                                                         |
| DEC-005 | Open         | نموذج التسعير والطلب والدفع                                                  | سعر ثابت، باقات، Quote مخصص، وهل الدفع داخل OMA أم نظام آخر؟                                                |
| DEC-006 | Open         | حدود Meta والإطلاق المدفوع                                                   | Draft فقط، أم Schedule/Launch بعد اعتماد بشري؟ ومن يملك صلاحية الإنفاق؟                                     |
| DEC-007 | Open         | مزودات AI وسياسة الاحتفاظ بالبيانات                                          | تمس الخصوصية، التكلفة، المصدرية، وإعادة الإنتاج.                                                            |
| DEC-013 | **RESOLVED** | سبعة مراجع عالمية بأدوار محددة                                               | Planable، Linear، Frame.io، Adobe Workfront، Jasper Brand IQ، Semrush، وSmartly مع منع خلط أنظمتها البصرية. |

انتهى المانع العام الخاص بالهوية وTenant. يمكن لاحقًا بدء تخطيط أساس المنصة المستقلة بعد فحص المستودع وطلب صريح منك، بينما تبقى القرارات الأخرى بوابات خاصة بالأجزاء التي تؤثر فيها.

## ما تم تثبيته في Spec v0.2

- أدوار أصحاب المنصة، الشركات، الاستراتيجية، الإنتاج، المراجعة، الإعلام المدفوع والمساهمين.
- رحلات الربط والتحليل، الخطة Organic/Paid، تحويلها إلى Briefs وTasks، التنفيذ والمراجعات والإصدارات.
- بوابة الشركات للتسعير والطلب والمتابعة.
- تكامل WorkDrive وحدود Meta ومنصات الإعلانات اللاحقة.
- حالات موحدة للطلبات والخطط والمهام والملفات والحملات.
- Multi-tenancy، الصلاحيات، الإشعارات والروابط العميقة، EN/AR وRTL، والاستمرارية بعد refresh/re-login.
- Human approval لكل مخرجات AI والإنفاق والنشر الحساس.
- استقلال OMA AI بصريًا وحركيًا عن IMKAN ONE مع بقاء انتمائه للمنظومة.
- استراتيجية مراجع عالمية متماسكة وألوان OMA مقترحة داخل `docs/DESIGN_REFERENCE_STRATEGY.md`.
- Definition of Done يمنع “الاكتمال الوهمي”.

## ما لم يتم اختياره عمداً

- Framework أو قاعدة بيانات أو Cloud أو AI provider.
- الـDesign System النهائي أو مكتبة المكونات؛ خريطة المراجع معتمدة، بينما الألوان والمكونات تحتاج اختبار Prototype وAccessibility.
- Schema/API routes أو أسماء مجلدات كود المنتج.
- نموذج الدفع أو العمولة أو الضرائب.
- ربط أي حساب حقيقي أو إطلاق حملة إعلانية حقيقية.

هذه الاختيارات تأتي في مرحلة `plan` بعد فحص المستودع وإغلاق القرار الخاص بكل جزء. بعد إنشاء المستودع بنجاح، يحتاج Cursor إلى موافقتك الصريحة قبل بدء `/speckit-plan` لأساس OMA AI المستقل.
