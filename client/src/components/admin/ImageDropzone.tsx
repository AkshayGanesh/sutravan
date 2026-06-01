import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  ACCEPTED_IMAGE_TYPES,
  assertImageAllowed,
  processImage,
} from "@/lib/imagePipeline";
import {
  uploadProductImage,
  removeProductImages,
  productImageUrls,
} from "@/lib/admin";

// The real product-image dropzone (Plan 09) — replaces the Plan-04 stub.
//
// Responsibilities (ADMIN-03 / D-10/D-11/D-12, UI-SPEC Image-dropzone states):
//  - drag-drop AND click-to-pick, multiple files at once (D-10)
//  - per file: assertImageAllowed FIRST (reject >10MB / unsupported BEFORE any
//    conversion CPU — Pitfall 3), then processImage (lazy HEIC convert +
//    compress to JPEG; heic2any/browser-image-compression are dynamically
//    imported INSIDE processImage so they never land in the public bundle),
//    then uploadProductImage into products/{slug}/ (D-08).
//  - progress/spinner per tile, "Converting…" during HEIC, success/failure toasts
//  - remove: in-session (not-yet-saved) images drop directly; already-saved
//    images go through a ConfirmDialog and removeProductImages (orphan cleanup,
//    Pitfall 2).
//  - thumbnails resolve via productImageUrls (getPublicUrl) — never hand-built.
//  - the upload folder is keyed by `slug` (= slugify(name) on create, the route
//    slug on edit) so create-flow uploads land in the product's PERMANENT folder
//    (D-07). A blank name => no slug => the zone is disabled.

export interface ImageDropzoneProps {
  value: string[];
  onChange: (paths: string[]) => void;
  slug?: string;
}

/** Resolve a single Storage path to its public URL (category is irrelevant for non-empty paths). */
function thumbUrl(path: string): string {
  return productImageUrls([path], "soap")[0];
}

/** True when a filename looks like a HEIC/HEIF file (drives the "Converting…" label). */
function isHeic(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

// A tile for an upload still in flight (processing/uploading).
interface PendingTile {
  id: string;
  converting: boolean;
}

export default function ImageDropzone({
  value,
  onChange,
  slug,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [confirmPath, setConfirmPath] = useState<string | null>(null);
  // Paths that already exist on the product (present at mount) need a confirm
  // before deletion; in-session uploads can be dropped directly. We snapshot the
  // initial value once so newly-uploaded paths aren't treated as "saved".
  const savedRef = useRef<Set<string>>(new Set(value));

  const enabled = Boolean(slug);

  async function handleOneFile(file: File, index: number) {
    // (1) Guard BEFORE any conversion CPU (Pitfall 3). Reject + skip on throw.
    try {
      assertImageAllowed(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That file can't be used.");
      return;
    }

    // (2) Pending tile with spinner; "Converting…" if HEIC.
    const tileId = `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
    setPending((p) => [...p, { id: tileId, converting: isHeic(file) }]);

    const clearTile = () =>
      setPending((p) => p.filter((t) => t.id !== tileId));

    // (3) Convert + compress (lazy heic2any/compression inside processImage).
    let blob: Blob;
    try {
      blob = await processImage(file);
    } catch (err) {
      clearTile();
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn’t process this photo — try a JPEG or PNG.",
      );
      return;
    }

    // (4) Upload into products/{slug}/ and append the returned Storage path.
    try {
      const filename = `${Date.now()}-${index}.jpg`;
      const path = await uploadProductImage(slug as string, blob, filename);
      onChange([...value, path]);
      toast.success("Photo added.");
    } catch {
      toast.error("Couldn’t upload that photo. Please try again.");
    } finally {
      clearTile();
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!enabled) {
      toast.error("Name the product first to add photos.");
      return;
    }
    Array.from(files).forEach((file, index) => {
      void handleOneFile(file, index);
    });
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    // Allow re-picking the same file twice in a row.
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (enabled) setDragOver(true);
  }

  function removePath(path: string) {
    onChange(value.filter((p) => p !== path));
  }

  // X on a thumbnail: saved images confirm + delete from Storage; in-session
  // uploads drop directly (their Storage object is harmless to keep until save,
  // but we still clean them on confirm-path for parity with saved removal).
  function requestRemove(path: string) {
    if (savedRef.current.has(path)) {
      setConfirmPath(path);
    } else {
      // In-session upload: remove from the list (object is overwritten/cleaned
      // on save or product delete). Keep UX instant, no confirm.
      removePath(path);
      toast.success("Photo removed.");
    }
  }

  async function confirmRemove() {
    const path = confirmPath;
    if (!path) return;
    setConfirmPath(null);
    try {
      await removeProductImages(slug as string, [path]);
      savedRef.current.delete(path);
      removePath(path);
      toast.success("Photo removed.");
    } catch {
      toast.error("Couldn’t remove that photo. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone — drop target + click-to-pick */}
      <div
        role="button"
        tabIndex={enabled ? 0 : -1}
        aria-disabled={!enabled}
        onClick={() => enabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (enabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "flex flex-col items-center justify-center gap-2 border border-dashed p-12 text-center transition-colors",
          enabled ? "cursor-pointer" : "cursor-not-allowed opacity-60",
          dragOver
            ? "border-primary bg-primary/5 text-foreground"
            : "border-border text-muted-foreground",
        ].join(" ")}
      >
        <ImagePlus className="size-8" aria-hidden="true" />
        {enabled ? (
          <>
            <p className="text-base">Drag photos here, or click to choose</p>
            <p className="text-sm">JPEG, PNG, WebP or HEIC · up to 10 MB each</p>
          </>
        ) : (
          <p className="text-sm">Name the product first to add photos.</p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={onInputChange}
          disabled={!enabled}
        />
      </div>

      {/* Thumbnails: saved/in-session images + pending (uploading) tiles */}
      {(value.length > 0 || pending.length > 0) && (
        <ul className="flex flex-wrap gap-3">
          {value.map((path) => (
            <li key={path} className="relative">
              <img
                src={thumbUrl(path)}
                alt=""
                className="size-24 rounded-md object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => requestRemove(path)}
                className="absolute -right-2 -top-2 flex size-11 items-center justify-center sm:size-7"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
                  <X className="size-4" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
          {pending.map((tile) => (
            <li
              key={tile.id}
              className="flex size-24 flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted text-muted-foreground"
            >
              <Spinner className="size-5" />
              {tile.converting && (
                <span className="text-xs">Converting…</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmPath !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmPath(null);
        }}
        title="Remove this photo?"
        description="This photo will be removed from the product. This can’t be undone."
        confirmLabel="Remove photo"
        onConfirm={confirmRemove}
      />
    </div>
  );
}
