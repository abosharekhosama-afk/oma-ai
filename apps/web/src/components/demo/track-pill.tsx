export function TrackPill({
  track,
  organicLabel,
  paidLabel,
}: {
  track: string;
  organicLabel: string;
  paidLabel: string;
}) {
  const organic = track === 'ORGANIC';
  return (
    <span
      className={`oma-track-pill ${organic ? 'oma-track-pill--organic' : 'oma-track-pill--paid'}`}
    >
      {organic ? organicLabel : paidLabel}
    </span>
  );
}
