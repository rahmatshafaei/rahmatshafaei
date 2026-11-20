import "server-only";
import type { AuthContext } from "@/lib/auth";
import { UserFacingError } from "@/lib/actions";

export type Bucket = "user-media" | "progress-photos";

const LIMITS: Record<Bucket, number> = {
  "user-media": 5 * 1024 * 1024,
  "progress-photos": 8 * 1024 * 1024,
};

const SIGNATURES: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** Detects the real image type from magic bytes; the client-declared MIME type is not trusted. */
export function detectImageType(bytes: Uint8Array) {
  return SIGNATURES.find((s) => s.test(bytes)) ?? null;
}

export async function validateImage(file: unknown, bucket: Bucket) {
  if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Välj en bild.");
  if (file.size > LIMITS[bucket]) {
    throw new UserFacingError(`Bilden är för stor (max ${LIMITS[bucket] / 1024 / 1024} MB).`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) throw new UserFacingError("Endast JPEG, PNG eller WebP stöds.");
  return { bytes, ...type };
}

/** Uploads into the owner's folder; storage policies reject any other prefix. */
export async function uploadImage(auth: AuthContext, bucket: Bucket, folder: string, file: unknown) {
  const { bytes, mime, ext } = await validateImage(file, bucket);
  const path = `${auth.userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await auth.supabase.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) {
    console.error("[storage] upload failed", error.message);
    throw new UserFacingError("Uppladdningen misslyckades. Försök igen.");
  }
  return path;
}

export async function removeObjects(auth: AuthContext, bucket: Bucket, paths: (string | null | undefined)[]) {
  const own = paths.filter((p): p is string => Boolean(p && p.startsWith(`${auth.userId}/`)));
  if (own.length) await auth.supabase.storage.from(bucket).remove(own);
}

/** Short-lived signed URLs for private objects. Returns a path → URL map. */
export async function signedUrls(auth: AuthContext, bucket: Bucket, paths: (string | null | undefined)[], expiresIn = 3600) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await auth.supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Every object path under a prefix (Storage lists one folder level at a time). */
export async function listAllObjects(auth: AuthContext, bucket: Bucket, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const folders = [prefix];
  while (folders.length) {
    const dir = folders.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await auth.supabase.storage.from(bucket).list(dir, { limit: 1000, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        // Folders are returned without an id.
        if (item.id) files.push(`${dir}/${item.name}`);
        else folders.push(`${dir}/${item.name}`);
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  return files;
}

/** Removes all of the user's uploaded files (used before account deletion). */
export async function removeAllUserObjects(auth: AuthContext) {
  for (const bucket of ["user-media", "progress-photos"] as const) {
    const paths = await listAllObjects(auth, bucket, auth.userId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await auth.supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
  }
}
