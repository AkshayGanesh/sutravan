import { Link } from "wouter";

const INSTAGRAM_URL = "https://www.instagram.com/sutravan.in";
const EMAIL = "sutravan.in@gmail.com";

export default function Footer() {
  return (
    <footer className="bg-primary text-background/80 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <h2 className="font-serif text-3xl text-background mb-2">sutravan</h2>
          <p className="text-xs tracking-[0.2em] text-secondary uppercase mb-6">
            Forest Formulations
          </p>
          <p className="max-w-sm font-light text-sm leading-relaxed mb-6">
            Formulas born from the purity of earth. Natural skincare that works
            with your skin, not against it. Simple ingredients. Honest
            formulations. Real skin care.
          </p>
          {/* Social */}
          <div className="flex items-center gap-4">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-secondary transition-colors"
              aria-label="Instagram"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
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
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="hover:text-secondary transition-colors"
              aria-label="Email"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
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
            </a>
          </div>
        </div>

        <div>
          <h3 className="font-sans font-bold text-xl text-background mb-6">
            Explore
          </h3>
          <ul className="space-y-4 text-sm font-light">
            <li>
              <Link
                href="/shop"
                className="hover:text-secondary transition-colors"
              >
                Shop All
              </Link>
            </li>
            <li>
              <Link
                href="/shop/soap"
                className="hover:text-secondary transition-colors"
              >
                Soaps
              </Link>
            </li>
            <li>
              <Link
                href="/shop/scrub"
                className="hover:text-secondary transition-colors"
              >
                Scrubs
              </Link>
            </li>
            <li>
              <Link
                href="/shop/cream"
                className="hover:text-secondary transition-colors"
              >
                Creams
              </Link>
            </li>
            <li>
              <Link
                href="/shop/toner"
                className="hover:text-secondary transition-colors"
              >
                Toners
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-sans font-bold text-xl text-background mb-6">
            Company
          </h3>
          <ul className="space-y-4 text-sm font-light">
            <li>
              <Link
                href="/our-story"
                className="hover:text-secondary transition-colors"
              >
                Our Story
              </Link>
            </li>
            <li>
              <Link
                href="/questionnaire"
                className="hover:text-secondary transition-colors"
              >
                Skin Guide
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="hover:text-secondary transition-colors"
              >
                Contact Us
              </Link>
            </li>
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-secondary transition-colors"
              >
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center text-xs font-light">
        <p>&copy; {new Date().getFullYear()} Sutravan. All rights reserved.</p>
        <p className="mt-2 md:mt-0 text-background/50">
          Handcrafted in small batches. Made with care.
        </p>
      </div>
    </footer>
  );
}
