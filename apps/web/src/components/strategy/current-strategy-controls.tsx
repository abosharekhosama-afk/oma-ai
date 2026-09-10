'use client';
export function CurrentStrategyControls(props: {
  canSet: boolean;
  isCurrent: boolean;
  onSet: () => void;
  onClear: () => void;
}) {
  if (!props.canSet) return null;
  return props.isCurrent ? (
    <button
      type="button"
      className="oma-btn"
      onClick={props.onClear}
      data-testid="strategy-clear-current"
    >
      Clear current
    </button>
  ) : (
    <button
      type="button"
      className="oma-btn"
      onClick={props.onSet}
      data-testid="strategy-set-current"
    >
      Set current
    </button>
  );
}
