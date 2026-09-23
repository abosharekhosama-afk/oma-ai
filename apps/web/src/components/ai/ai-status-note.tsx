const EN = 'Setup required. Billing is not enabled. Continue manually.';
const AR = 'الإعداد مطلوب. الفوترة غير مفعّلة. أكمل يدويًا.';

/** Offline text-intelligence status. No generate action while billing is disabled. */
export function AiStatusNote() {
  return (
    <p className="oma-banner oma-banner-info" data-testid="ai-status-note" role="status">
      {EN} {AR}
    </p>
  );
}
