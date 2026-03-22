import { Link } from "wouter";
import Layout from "@/components/Layout";

const INSTAGRAM_URL = "https://www.instagram.com/sutravan.in";
const EMAIL = "sutravan.in@gmail.com";

export default function Contact() {
  return (
    <Layout>
      {/* Header */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 text-center bg-card">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
            Get in Touch
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
          <p className="text-foreground/70 max-w-xl mx-auto">
            We&rsquo;d love to hear from you. Whether you have a question about
            our products, need a custom formulation, or just want to say
            hello &mdash; reach out to us.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Instagram */}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-background border border-border hover:border-primary p-8 text-center transition-all duration-300"
          >
            <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center border border-secondary rounded-full text-secondary group-hover:bg-secondary group-hover:text-primary transition-colors duration-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </div>
            <h2 className="font-sans font-bold text-xl text-primary mb-2">
              Instagram
            </h2>
            <p className="text-foreground/60 text-sm mb-4">
              Follow us and send a DM for enquiries, custom formulations, or
              just to connect.
            </p>
            <span className="text-secondary font-medium text-sm uppercase tracking-wider">
              @sutravan.in
            </span>
          </a>

          {/* Email */}
          <a
            href={`mailto:${EMAIL}`}
            className="group bg-background border border-border hover:border-primary p-8 text-center transition-all duration-300"
          >
            <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center border border-secondary rounded-full text-secondary group-hover:bg-secondary group-hover:text-primary transition-colors duration-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h2 className="font-sans font-bold text-xl text-primary mb-2">
              Email
            </h2>
            <p className="text-foreground/60 text-sm mb-4">
              Write to us for detailed enquiries, collaborations, or bulk
              orders.
            </p>
            <span className="text-secondary font-medium text-sm">
              {EMAIL}
            </span>
          </a>
        </div>
      </section>

      {/* Custom Formulation Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-sans font-bold text-2xl md:text-3xl text-primary mb-4">
            Need a Custom Formulation?
          </h2>
          <p className="text-foreground/70 max-w-xl mx-auto mb-8 leading-relaxed">
            Every skin is unique. Tell us your skin type, concern, or purpose,
            and we&rsquo;ll customize the formulation accordingly. Fill out our
            skin questionnaire to get started.
          </p>
          <Link
            href="/questionnaire"
            className="inline-block bg-primary text-primary-foreground px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-secondary hover:text-primary transition-colors duration-300"
          >
            Take the Skin Questionnaire
          </Link>
        </div>
      </section>

      {/* Brand Values */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 mb-6">
            Our Promise
          </p>
          <div className="space-y-3 text-foreground/70">
            <p>Natural formulations inspired by the purity of earth.</p>
            <p>Free from harsh chemicals.</p>
            <p>Gentle on skin.</p>
            <p>Made with care.</p>
          </div>
          <p className="mt-8 text-lg text-primary font-medium italic">
            Pure. Simple. Honest care.
          </p>
        </div>
      </section>
    </Layout>
  );
}
