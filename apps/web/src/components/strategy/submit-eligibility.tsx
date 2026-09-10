'use client';

export function SubmitEligibility({
  missingProfile,
  disabled,
  onClick,
  label = 'Submit',
}: {
  missingProfile: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="oma-btn"
      disabled={disabled || missingProfile}
      data-testid="strategy-submit"
      aria-disabled={disabled || missingProfile}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
