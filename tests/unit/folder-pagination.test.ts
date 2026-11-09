import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listFolderPagewise, WorkDriveClient } from '@oma/domain';
import { fakeKey, startFakeWorkDrive } from '../helpers/fake-workdrive';

describe('WorkDrive folder pagination', () => {
  const key = fakeKey('g');
  let wd: Awaited<ReturnType<typeof startFakeWorkDrive>>;

  beforeAll(async () => {
    wd = await startFakeWorkDrive({ key, rootName: 'OMA' });
  });
  afterAll(async () => {
    await wd.close();
  });

  it('pages with cursor/limit and listFolderPagewise collects every entry', async () => {
    const client = new WorkDriveClient(wd.baseUrl, key);
    const parent = await client.ensurePath(['tenants', 'paged']);
    for (let i = 0; i < 5; i++) {
      await client.ensurePath([`child-${i}`], parent.folderId);
    }
    const first = await client.getFolder(parent.folderId, { limit: 2 });
    expect(first.folders.length + first.files.length).toBe(2);
    expect(first.nextCursor).toBeTruthy();
    const rest = await listFolderPagewise(client, parent.folderId, 2);
    expect(rest.folders.length).toBe(5);
  });
});
