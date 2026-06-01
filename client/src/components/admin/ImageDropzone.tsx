import { ImagePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

// TODO(Plan 09): wire heic2any + browser-image-compression pipeline
// This is an interface-first STUB. Plan 09 replaces this file with the full
// upload pipeline (size guard, HEIC conversion, compression, progress, remove
// confirm). For now it renders the empty-state copy and read-only thumbnails of
// any already-saved image paths so the product form route compiles and the
// shape of `{ value, onChange, slug? }` is locked for the feature plan.

export interface ImageDropzoneProps {
  value: string[];
  onChange: (paths: string[]) => void;
  slug?: string;
}

/** Resolve a Storage path to its public URL (never hand-concatenate). */
function publicUrl(path: string): string {
  return supabase.storage.from("product-images").getPublicUrl(path).data
    .publicUrl;
}

export default function ImageDropzone({ value, slug }: ImageDropzoneProps) {
  // `onChange` and `slug` are part of the locked prop contract; the real upload
  // logic that calls them ships in Plan 09. `slug` is read here only to keep the
  // signature honest for the type-checker.
  void slug;

  return (
    <div className="space-y-4">
      {/* Empty drop zone (UI-SPEC: copy + subtext verbatim) */}
      <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-border p-12 text-center text-muted-foreground">
        <ImagePlus className="size-8" aria-hidden="true" />
        <p className="text-base">Drag photos here, or click to choose</p>
        <p className="text-sm">
          JPEG, PNG, WebP or HEIC · up to 10 MB each
        </p>
      </div>

      {/* Read-only thumbnails of any already-saved images */}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((path) => (
            <li key={path}>
              <img
                src={publicUrl(path)}
                alt=""
                className="size-24 object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
