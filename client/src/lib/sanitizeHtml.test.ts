// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "@/lib/sanitizeHtml";

describe("sanitizeRichText", () => {
  it("strips a <script> tag", () => {
    const out = sanitizeRichText("<p>hi</p><script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("<p>hi</p>");
  });

  it("strips an onerror attribute", () => {
    const out = sanitizeRichText('<img src=x onerror=alert(1)>');
    expect(out).not.toContain("onerror");
  });

  it("keeps strong and em formatting", () => {
    const out = sanitizeRichText("<p><strong>bold</strong> <em>it</em></p>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>it</em>");
  });

  it("keeps href and hardens external links with rel + target", () => {
    const out = sanitizeRichText('<a href="https://x.com">x</a>');
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });
});
