import { adminStorage } from './firebaseAdmin';
import { ValidationError } from './validation';

export async function uploadPlayerImage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  if (!contentType.startsWith('image/')) {
    throw new ValidationError('Uploaded file must be an image (PNG, JPEG, WebP, etc.).', 400);
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (buffer.length > maxSize) {
    throw new ValidationError('File size exceeds the 5MB limit.', 400);
  }

  const cleanFilename = filename.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  const bucket = adminStorage.bucket();
  const file = bucket.file(`players/${cleanFilename}`);

  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
    },
    public: true,
  });

  return `https://storage.googleapis.com/${bucket.name}/players/${cleanFilename}`;
}
