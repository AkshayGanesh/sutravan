// The public READ hook for editable site copy (hero text, Our Story body,
// contact email + social links) stored in the site_content key/value table.
//
// Mirrors catalog.ts's useQuery+fetch split: fetch ALL rows once into a
// Record<string,string> under the ['siteContent'] key, mapped at the boundary.
//
// D-20 — FALLBACK IS MANDATORY: SITE_CONTENT_DEFAULTS holds the current
// hardcoded literals (copied verbatim from Hero.tsx / OurStory seed /
// Footer.tsx) so Navbar/Footer/Contact/Hero/Our Story NEVER render empty while
// the query loads, on error, or if a key is missing. Consumers read:
//   const { data } = useSiteContent();
//   const email = data?.email ?? SITE_CONTENT_DEFAULTS.email;
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

/**
 * Code-default fallbacks for every site_content key — the current literal values
 * (verbatim from Hero.tsx, the 0006 seed of OurStory, and Footer.tsx). These keep
 * the public chrome populated whenever the live value is unavailable (D-20).
 */
export const SITE_CONTENT_DEFAULTS: Record<string, string> = {
  // Hero.tsx
  hero_title: "Formulas Born From The Purity of Earth",
  hero_subtitle:
    "Experience earthen luxury with our handcrafted botanical skincare.\nNourishing soaps, revitalizing scrubs, and rich creams.",
  hero_cta: "Explore Collection",
  // OurStory body (sanitized HTML, matches migration 0006 seed opening).
  our_story_body:
    "<p>That is the idea behind <strong>Sutravan</strong>, a name that means <em>formulas born from the purity of nature.</em></p>",
  // Footer.tsx:3-5
  email: "sutravan.in@gmail.com",
  instagram_url: "https://www.instagram.com/sutravan.in",
  youtube_url: "https://youtube.com/@sutravan?si=0ne7zUvFEh70AF6j",
};

async function fetchSiteContent(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("site_content")
    .select("key, value");
  if (error) throw error; // consumers fall back to SITE_CONTENT_DEFAULTS
  return Object.fromEntries(
    (data ?? []).map((r: { key: string; value: string | null }) => [
      r.key,
      r.value ?? "",
    ]),
  );
}

/**
 * Read all site_content rows as a key->value map.
 *
 * Returns a TanStack Query result; on success `data` is a Record<string,string>.
 * Always pair lookups with SITE_CONTENT_DEFAULTS:
 *   const email = data?.email ?? SITE_CONTENT_DEFAULTS.email
 */
export function useSiteContent() {
  return useQuery({ queryKey: ["siteContent"], queryFn: fetchSiteContent });
}
