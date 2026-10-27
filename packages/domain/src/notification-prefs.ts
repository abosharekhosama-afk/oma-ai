/**
 * Per-user notification preference check, shared by the API and the worker.
 * Preferences live in User.preferencesJson as `{ notifications: { all?: boolean, [type]: boolean } }`.
 * A user opted out when `notifications.all === false` (mutes every in-app notification type)
 * or `notifications[type] === false`. Everything defaults ON.
 */
export function notificationAllowed(prefsJson: string | null | undefined, type: string): boolean {
  let prefs: unknown;
  try {
    prefs = JSON.parse(prefsJson || '{}');
  } catch {
    return true;
  }
  const n =
    prefs && typeof prefs === 'object' && !Array.isArray(prefs)
      ? (prefs as { notifications?: unknown }).notifications
      : undefined;
  if (!n || typeof n !== 'object') return true;
  const map = n as Record<string, unknown>;
  if (map.all === false) return false;
  return map[type] !== false;
}
