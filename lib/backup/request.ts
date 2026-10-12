import { gunzipSync } from 'node:zlib';
import { BackupFormatError, parseBackup } from '@/lib/backup/format';

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
// Leave headroom below Vercel's 4.5 MB Function request limit.
export const MAX_CLOUD_UPLOAD_BYTES = 4 * 1024 * 1024;

export class BackupRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function readBackupRequest(request: Request) {
  const maxUploadBytes = process.env.VERCEL_ENV ? MAX_CLOUD_UPLOAD_BYTES : MAX_BACKUP_BYTES;
  const type = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (type !== 'application/json' && type !== 'application/gzip') {
    throw new BackupRequestError('Choose a LifeOS JSON backup file.', 415);
  }
  const declared = Number(request.headers.get('content-length'));
  if (declared > maxUploadBytes) {
    throw new BackupRequestError('This backup is too large to upload. Try a smaller backup.', 413);
  }
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length > maxUploadBytes) {
    throw new BackupRequestError('This backup is too large to upload. Try a smaller backup.', 413);
  }
  let json: string;
  try {
    json =
      type === 'application/gzip'
        ? gunzipSync(bytes, { maxOutputLength: MAX_BACKUP_BYTES }).toString('utf8')
        : bytes.toString('utf8');
  } catch {
    throw new BackupRequestError('This is not a valid compressed LifeOS backup.', 400);
  }
  if (Buffer.byteLength(json, 'utf8') > MAX_BACKUP_BYTES) {
    throw new BackupRequestError('The backup exceeds the 25 MB limit.', 413);
  }
  try {
    return parseBackup(JSON.parse(json));
  } catch (error) {
    throw new BackupRequestError(
      error instanceof BackupFormatError
        ? error.message
        : 'This is not a valid LifeOS JSON backup.',
      400,
    );
  }
}
