'use client';
import { Button } from '@oma/ui/controls';
import { useT } from '../../lib/use-locale';

/**
 * DEC-030: approval normally makes a strategy current, so this only appears for an
 * approved strategy that is *not* the brand's current one (e.g. an older approval,
 * or a second approved strategy the team wants to switch to).
 */
export function CurrentStrategyControls(props: {
  canSet: boolean;
  isCurrent: boolean;
  /** Current only by inference (no pointer saved yet): offer to pin it. */
  inferred?: boolean;
  onSet: () => void;
}) {
  const t = useT();
  if (!props.canSet) return null;
  if (props.isCurrent && !props.inferred) return null;
  return (
    <Button type="default" onClick={props.onSet} data-testid="strategy-set-current">
      {props.isCurrent ? t('strategy.current.pin') : t('strategy.current.set')}
    </Button>
  );
}
