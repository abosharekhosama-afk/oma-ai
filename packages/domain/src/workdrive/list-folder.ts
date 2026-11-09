import type { WorkDriveClient, WorkDriveFileEntry, WorkDriveFolderEntry } from './client';

export const FOLDER_PAGE_SIZE = 100;

export async function listFolderPagewise(
  client: WorkDriveClient,
  folderId: string,
  pageSize = FOLDER_PAGE_SIZE,
) {
  let cursor: string | undefined;
  const files: WorkDriveFileEntry[] = [];
  const folders: WorkDriveFolderEntry[] = [];
  let id = folderId;
  let name = '';
  let parentId: string | null = null;
  do {
    const page = await client.getFolder(folderId, { cursor, limit: pageSize });
    id = page.id;
    name = page.name;
    parentId = page.parentId;
    files.push(...page.files);
    folders.push(...page.folders);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return { id, name, parentId, files, folders };
}
