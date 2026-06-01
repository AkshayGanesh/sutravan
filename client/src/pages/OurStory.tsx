import { Link } from "wouter";
import Layout from "@/components/Layout";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";
import { sanitizeRichText } from "@/lib/sanitizeHtml";

export default function OurStory() {
  // D-19/D-20: the editable Our Story body comes from the single source of truth
  // and is the ONLY dangerouslySetInnerHTML in the app — it MUST go through
  // sanitizeRichText (DOMPurify allow-list) before render. Falls back to the
  // code default so the page never renders blank.
  const { data } = useSiteContent();
  const body = data?.our_story_body ?? SITE_CONTENT_DEFAULTS.our_story_body;

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 text-center bg-card">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-6">
            Our Story
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-8" />
          <p className="text-xl md:text-2xl text-foreground/80 font-light leading-relaxed italic">
            &ldquo;What if skincare didn&rsquo;t come from a lab&hellip; but
            from the wisdom of the earth?&rdquo;
          </p>
        </div>
      </section>

      {/* Editable body (the owner authors this in /admin/content; rendered here
          through DOMPurify — the only dangerouslySetInnerHTML in the app, D-19). */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div
          className="max-w-3xl mx-auto space-y-6 text-foreground/80 leading-relaxed prose prose-stone max-w-none prose-strong:text-primary prose-headings:font-sans prose-headings:font-bold prose-headings:text-primary"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }}
        />
      </section>

      {/* Handcrafted Note */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground text-center">
        <p className="text-sm uppercase tracking-[0.2em] mb-2 text-secondary">
          Our Promise
        </p>
        <p className="text-lg md:text-xl font-light">
          Handcrafted in small batches to maintain purity and quality.
        </p>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-sans font-bold text-2xl text-primary mb-6">
          Experience the Sutravan Difference
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/shop"
            className="inline-block bg-primary text-primary-foreground px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-secondary hover:text-primary transition-colors duration-300"
          >
            Explore Our Collection
          </Link>
          <Link
            href="/questionnaire"
            className="inline-block bg-transparent border border-primary text-primary px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-primary hover:text-primary-foreground transition-colors duration-300"
          >
            Find Your Skin Guide
          </Link>
        </div>
      </section>
    </Layout>
  );
}
