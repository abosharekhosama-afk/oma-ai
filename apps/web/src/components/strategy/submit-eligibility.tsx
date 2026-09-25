'use client';
import { Button } from '@oma/ui/controls';

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
    <Button
      type="primary"
      disabled={disabled || missingProfile}
      data-testid="strategy-submit"
      aria-disabled={disabled || missingProfile}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
