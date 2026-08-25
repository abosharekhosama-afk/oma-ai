export function PermissionDenied({
  message = 'You do not have permission to view this.',
}: {
  message?: string;
}) {
  return (
    <div className="oma-card" role="alert">
      <h2>Permission denied</h2>
      <p>{message}</p>
    </div>
  );
}
