/** Fired by the shell header "Invite members" button on the Team screen. */
export const TEAM_INVITE_EVENT = 'oma:team-invite';

export function openTeamInvite() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TEAM_INVITE_EVENT));
}
