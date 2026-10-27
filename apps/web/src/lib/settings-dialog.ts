/** Open the Settings card from anywhere (the shell listens for this event). */
export const OPEN_SETTINGS_EVENT = 'oma:open-settings';

export function openSettings(section?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { section } }));
}
