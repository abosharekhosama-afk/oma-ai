'use client';
import { Button } from '@oma/ui/controls';
export function CurrentStrategyControls(props: {
  canSet: boolean;
  isCurrent: boolean;
  onSet: () => void;
  onClear: () => void;
}) {
  if (!props.canSet) return null;
  return props.isCurrent ? (
    <Button type="primary" onClick={props.onClear} data-testid="strategy-clear-current">
      Clear current
    </Button>
  ) : (
    <Button type="primary" onClick={props.onSet} data-testid="strategy-set-current">
      Set current
    </Button>
  );
}
