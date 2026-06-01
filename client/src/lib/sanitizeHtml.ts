// DOMPurify allow-list wrapper for safe public rich-text render (D-19).
//
// site_content.value (admin-authored Our Story HTML) is rendered to every
// visitor via dangerouslySetInnerHTML — even admin-authored content is an XSS
// foothold, so it MUST be sanitized on render (RESEARCH Pattern 4). The
// allow-list matches the TipTap editor marks the admin can produce
// (bold/italic/underline/link/bullet+ordered list + h2/h3). Pure string->string
// — no React, no I/O. Imports dompurify (verified legitimate, Task 1).
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
];
const ALLOWED_ATTR = ["href", "target", "rel"];

// Harden every surviving <a>: DOMPurify allows the link but does NOT add a safe
// rel by default, so a link-injection could open a tabnabbing/open-redirect
// vector (T-04-05). Force target="_blank" + rel="noopener noreferrer" on any
// node that carries an href. Registered once at module load.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node instanceof Element && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Sanitize admin-authored HTML to an XSS-safe, link-hardened string.
 *
 * @param html - untrusted HTML from site_content.value.
 * @returns sanitized HTML safe to render via dangerouslySetInnerHTML.
 */
export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
