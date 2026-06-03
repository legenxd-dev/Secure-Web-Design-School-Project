import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export type CloudinaryResourceType = 'image' | 'video' | 'raw';

interface StoredAsset {
  url: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

function configure(): void {
  if (!isConfigured()) {
    throw new Error('Cloudinary is not configured');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function requireCloudinary(): void {
  configure();
}

export function resourceTypeForMime(mimeType: string): CloudinaryResourceType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: { folder: string; resourceType: CloudinaryResourceType },
): Promise<StoredAsset> {
  configure();

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: options.resourceType,
        });
      },
    );

    Readable.from(buffer).pipe(upload);
  });
}

export async function deleteCloudinaryAsset(
  publicId: string | null | undefined,
  resourceType: CloudinaryResourceType | null | undefined,
): Promise<void> {
  if (!publicId) return;
  configure();

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType ?? 'image',
  });
}
