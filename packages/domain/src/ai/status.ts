export type AiPublicState =
  | 'not_connected'
  | 'configured_disabled'
  | 'billing_required'
  | 'ready'
  | 'generating'
  | 'proposal_ready'
  | 'human_review'
  | 'budget_warning'
  | 'budget_reached'
  | 'failed_manual';

/** Live stays off until a separate billing activation. Never claim model verification. */
export function resolveAiPublicState(input: {
  providerConfigured: boolean;
  liveEnabled: boolean;
  budgetReached?: boolean;
  budgetWarning?: boolean;
  runStatus?: string | null;
}): AiPublicState {
  if (!input.providerConfigured) return 'not_connected';
  if (input.budgetReached) return 'budget_reached';
  if (input.runStatus === 'RUNNING' || input.runStatus === 'QUEUED') return 'generating';
  if (input.runStatus === 'SUCCEEDED') return 'human_review';
  if (
    input.runStatus === 'FAILED' ||
    input.runStatus === 'SCHEMA_INVALID' ||
    input.runStatus === 'REFUSED'
  ) {
    return 'failed_manual';
  }
  if (!input.liveEnabled) return 'billing_required';
  if (input.budgetWarning) return 'budget_warning';
  return 'ready';
}

export function aiPublicStateCopy(state: AiPublicState, language: 'en' | 'ar' = 'en'): string {
  const en: Record<AiPublicState, string> = {
    not_connected: 'AI not connected. Continue manually.',
    configured_disabled: 'AI is configured but disabled.',
    billing_required: 'Setup required. Billing is not enabled. Continue manually.',
    ready: 'AI text proposals are available and require human review.',
    generating: 'Generating an AI proposal.',
    proposal_ready: 'Proposal ready. Human review required.',
    human_review: 'AI generated proposal — requires human review.',
    budget_warning: 'AI budget warning. Manual workflow remains available.',
    budget_reached: 'AI budget reached. Continue manually.',
    failed_manual: 'AI failed. Manual workflow remains available.',
  };
  const ar: Record<AiPublicState, string> = {
    not_connected: 'الذكاء غير متصل. أكمل يدويًا.',
    configured_disabled: 'الذكاء مُعد لكنه معطّل.',
    billing_required: 'الإعداد مطلوب. الفوترة غير مفعّلة. أكمل يدويًا.',
    ready: 'اقتراحات النص متاحة وتحتاج مراجعة بشرية.',
    generating: 'جارٍ إنشاء اقتراح.',
    proposal_ready: 'الاقتراح جاهز. المراجعة البشرية مطلوبة.',
    human_review: 'اقتراح مولّد بالذكاء — يتطلب مراجعة بشرية.',
    budget_warning: 'تحذير ميزانية الذكاء. المسار اليدوي متاح.',
    budget_reached: 'بلغت ميزانية الذكاء حدها. أكمل يدويًا.',
    failed_manual: 'فشل الذكاء. المسار اليدوي متاح.',
  };
  return language === 'ar' ? ar[state] : en[state];
}
