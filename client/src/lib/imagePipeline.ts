// Image size/type guard + lazy HEIC convert + compress (D-11 / D-12).
//
// The guard (assertImageAllowed) is a pure, synchronous, cheap check that
// rejects oversized or non-image files BEFORE any conversion CPU is spent
// (T-04-06). processImage performs the heavy work (HEIC→JPEG decode + downscale)
// and DYNAMICALLY imports heic2any / browser-image-compression so those large
// libs never land in the public Shop bundle (bundle discipline / anti-pattern).
// Error copy is verbatim from the UI-SPEC Error-states contract.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // D-12: reject >10MB up front
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** True when a filename ends in a HEIC/HEIF extension (some browsers report an empty MIME for HEIC). */
function hasHeicExtension(name: string): boolean {
  return /\.(heic|heif)$/i.test(name);
}

/**
 * Reject oversized or unsupported files before any conversion work.
 * Pure + synchronous — throws with UI-SPEC copy on rejection, returns void on accept.
 *
 * @param file - minimal file descriptor (size in bytes, MIME type, name).
 */
export function assertImageAllowed(file: {
  size: number;
  type: string;
  name: string;
}): void {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That photo is too large (max 10 MB). Try a smaller one.");
  }
  if (
    !ACCEPTED_IMAGE_TYPES.includes(file.type) &&
    !hasHeicExtension(file.name)
  ) {
    throw new Error(
      "That file type isn’t supported. Use JPEG, PNG, WebP or HEIC.",
    );
  }
}

/**
 * Validate, then (lazily) HEIC→JPEG convert if needed and downscale/compress.
 * Heavy libs are dynamically imported so they stay out of the public bundle.
 *
 * @param file - the uploaded File.
 * @returns a compressed JPEG Blob ready for upload.
 */
export async function processImage(file: File): Promise<Blob> {
  assertImageAllowed(file);

  let working: Blob = file;

  // HEIC/HEIF needs decoding to JPEG before the compressor can read it.
  if (file.type === "image/heic" || file.type === "image/heif" || hasHeicExtension(file.name)) {
    try {
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({ blob: file, toType: "image/jpeg" });
      working = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      throw new Error("Couldn’t process this photo — try a JPEG or PNG.");
    }
  }

  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(working as File, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
}
