import InviteAcceptance from './invite-acceptance';

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; invite?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token)
    ? params.token[0]
    : Array.isArray(params.invite)
      ? params.invite[0]
      : (params.token ?? params.invite ?? '');

  return <InviteAcceptance token={token} />;
}
