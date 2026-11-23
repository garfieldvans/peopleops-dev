/**
 * Private document storage contract. Business code depends on this interface so
 * a local disk adapter can be swapped for object storage (S3, GCS, …) later
 * without touching employee services. Files are never exposed through a public
 * URL: downloads always pass through an authorized API route.
 */
export interface FileStorage {
  /** Stores the bytes under a generated, caller-opaque key. */
  save(input: { data: Buffer; originalName: string; mimeType: string }): Promise<{ key: string }>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol("FILE_STORAGE");
