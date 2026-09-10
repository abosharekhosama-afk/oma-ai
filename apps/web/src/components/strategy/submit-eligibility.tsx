'use client';
export function SubmitEligibility({
  missingProfile,
  disabled,
}: {
  missingProfile: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="oma-btn"
      disabled={disabled || missingProfile}
      data-testid="strategy-submit-gated"
    >
      Submit
    </button>
  );
}
