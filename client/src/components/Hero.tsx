import { Link } from "wouter";
import heroBg from "../assets/images/hero-bg.png";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";

export default function Hero() {
  // D-20: hero copy from the single source of truth, with the current literals
  // as mandatory fallbacks so the hero never renders blank.
  const { data } = useSiteContent();
  const heroTitle = data?.hero_title ?? SITE_CONTENT_DEFAULTS.hero_title;
  const heroSubtitle = data?.hero_subtitle ?? SITE_CONTENT_DEFAULTS.hero_subtitle;
  const heroCta = data?.hero_cta ?? SITE_CONTENT_DEFAULTS.hero_cta;

  return (
    <div className="relative w-full h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src={heroBg}
          alt="Sutravan luxurious natural skincare"
          className="w-full h-full object-cover object-center scale-105 animate-in fade-in zoom-in duration-1000"
        />
        <div className="absolute inset-0 bg-primary/20 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-20">
        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-background mb-6 leading-tight drop-shadow-md animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both">
          {heroTitle}
        </h1>
        <p className="text-background/90 text-lg md:text-xl font-light tracking-wide mb-4 max-w-2xl mx-auto drop-shadow animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
          {heroSubtitle}
        </p>
        <p className="text-background/70 text-sm md:text-base tracking-wider mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-400 fill-mode-both">
          Simple Ingredients. Honest Formulations. Real Skin Care.
        </p>
        <Link
          href="/shop"
          className="inline-block bg-secondary text-primary px-8 py-4 text-sm tracking-[0.15em] uppercase font-medium hover:bg-background hover:text-primary transition-all duration-500 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both"
        >
          {heroCta}
        </Link>
      </div>
    </div>
  );
}
