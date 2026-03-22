import Layout from "@/components/Layout";

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScxi_Gb-3KFW7ipQid_1PKJF84aUNIv-j9BDCyYS7SkLTrUzw/viewform?embedded=true";
const GOOGLE_FORM_LINK = "https://forms.gle/Jk6cH2DH9Vph6Spf7";

export default function Questionnaire() {
  return (
    <Layout>
      {/* Header */}
      <section className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 text-center bg-card">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
            Skin Guide
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
          <p className="text-foreground/70 max-w-xl mx-auto mb-3">
            Help us understand your skin better so we can recommend the most
            suitable Sutravan formulations for you.
          </p>
          <p className="text-sm text-foreground/50">
            Fill out the form below and we&rsquo;ll get back to you with
            personalized recommendations.
          </p>
        </div>
      </section>

      {/* Embedded Google Form */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <div className="bg-background border border-border/50 overflow-hidden">
          <iframe
            src={GOOGLE_FORM_URL}
            title="Sutravan Skin Care Guide"
            className="w-full border-0"
            style={{ minHeight: "1200px" }}
          >
            Loading form&hellip;
          </iframe>
        </div>

        <p className="text-center text-xs text-foreground/40 mt-4">
          Having trouble viewing the form?{" "}
          <a
            href={GOOGLE_FORM_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-secondary transition-colors"
          >
            Open it in a new tab
          </a>
        </p>
      </section>
    </Layout>
  );
}
