import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  commentThreadHasOutbound,
  nestInboxMessages,
} from '../../apps/web/src/app/(app)/app/inbox/inbox-utils';
import { parseMeta } from '../../apps/worker/src/inbox/parse-webhooks';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('inbox comment reply tree', () => {
  it('nests replies under their parent and keeps unknown parents as roots', () => {
    const messages = [
      { id: 'a', parentMessageId: null, direction: 'INBOUND' as const },
      { id: 'b', parentMessageId: 'a', direction: 'OUTBOUND' as const },
      { id: 'c', parentMessageId: 'a', direction: 'INBOUND' as const },
      { id: 'd', parentMessageId: 'missing', direction: 'INBOUND' as const },
    ];
    const { roots, childrenOf } = nestInboxMessages(messages);
    expect(roots.map((m) => m.id)).toEqual(['a', 'd']);
    expect(childrenOf.get('a')?.map((m) => m.id)).toEqual(['b', 'c']);
    expect(commentThreadHasOutbound(messages[0]!, childrenOf)).toBe(true);
    expect(commentThreadHasOutbound(messages[3]!, childrenOf)).toBe(false);
  });

  it('reads Meta comment parent_id as parentExternalId except when it is the post', () => {
    const parsed = parseMeta(
      {
        entry: [
          {
            id: 'page1',
            changes: [
              {
                field: 'comments',
                value: {
                  from: { id: 'u1', username: 'sam' },
                  text: 'reply text',
                  comment_id: 'comment-2',
                  post_id: 'post-1',
                  parent_id: 'comment-1',
                },
              },
              {
                field: 'comments',
                value: {
                  from: { id: 'u2', username: 'pat' },
                  text: 'top level',
                  comment_id: 'comment-3',
                  post_id: 'post-1',
                  parent_id: 'post-1',
                },
              },
            ],
          },
        ],
      },
      'META_FB',
    );
    expect(parsed[0]).toMatchObject({
      externalMessageId: 'comment-2',
      parentExternalId: 'comment-1',
      content: 'reply text',
    });
    expect(parsed[1]?.parentExternalId).toBeUndefined();
  });

  it('persists and returns parentMessageId from the inbox API and UI', () => {
    const service = read('apps/api/src/inbox/inbox.service.ts');
    const client = read('apps/web/src/app/(app)/app/inbox/inbox-client.tsx');
    const schema = read('packages/db/prisma/schema.prisma');
    const ingest = read('apps/worker/src/inbox/ingest-conversation.ts');
    expect(schema).toContain('parentMessageId');
    expect(schema).toContain('InboxMessageReplies');
    expect(service).toContain('parentMessageId');
    expect(service).toContain('replyToMessageId: parentMessageId');
    expect(ingest).toContain('parentExternalId');
    expect(client).toContain('oma-plx-inbox-comment-tree');
    expect(client).toContain('inbox.replyCount');
    expect(client).toContain('nestUnder');
    expect(client).toContain('clearInline ? replyToMessageId : null');
  });

  it('styles reply groups like the sidebar tree and strips the comment-composer focus ring only', () => {
    const css = read('apps/web/src/styles/inbox-listening.css');
    const nav = read('apps/web/src/styles/analytics-planable.css');
    expect(nav).toContain('.oma-nav-sublist > li::after');
    expect(nav).toContain('border-end-start-radius: 7px');
    expect(css).toContain('.oma-plx-inbox-comment-tree > li::before');
    expect(css).toContain('.oma-plx-inbox-comment-tree > li::after');
    expect(css).toContain('border-end-start-radius: 7px');
    expect(css).toContain('inset-inline-start: 0');
    expect(css).toContain(
      '.oma-plx-inbox-composer--comments .oma-plx-inbox-composer__pill-input:focus-visible',
    );
    expect(css).toContain('outline: none !important');
    expect(css).not.toMatch(
      /\.oma-plx-inbox-inline-reply__field input:focus-visible \{\s*outline: none !important/,
    );
    expect(css).not.toContain(
      '.oma-plx-inbox-composer--dms .oma-plx-inbox-composer__pill-input:focus-visible',
    );
  });
});
