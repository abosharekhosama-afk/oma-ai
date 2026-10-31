/** BullMQ social publish job payload */
export type SocialPublishJobPayload = {
  publishTargetId: string;
  tenantId: string;
  contentItemId: string;
};

export function bullSocialJobId(publishTargetId: string): string {
  return `social-publish-${publishTargetId.replace(/:/g, '_')}`;
}

export function buildSocialPublishJobData(input: {
  publishTargetId: string;
  tenantId: string;
  contentItemId: string;
}): SocialPublishJobPayload {
  return {
    publishTargetId: input.publishTargetId,
    tenantId: input.tenantId,
    contentItemId: input.contentItemId,
  };
}
