export const SETTINGS_SECTIONS = [
  'localization',
  'workflow',
  'approvals',
  'workspace',
  'storage',
  'integrations',
] as const;
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(v: unknown): v is SettingsSectionId {
  return (SETTINGS_SECTIONS as readonly unknown[]).includes(v);
}
