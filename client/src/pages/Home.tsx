import { Link } from "wouter";
import Layout from "@/components/Layout";
import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/lib/catalog";

export default function Home() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  return (
    <Layout>
      <Hero />

      {/* Brand Philosophy Section */}
      <section className="py-24 px-4 bg-card text-center flex flex-col items-center justify-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-sans font-bold text-3xl md:text-5xl text-primary mb-8 leading-tight">
            &ldquo;We believe that true luxury lies in nature&rsquo;s untouched
            simplicity.&rdquo;
          </h2>
          <p className="text-foreground/80 leading-relaxed font-light mb-8">
            At Sutravan, we draw from the ancient wisdom of the earth to bring
            you skincare that works with your skin, not against it. Our
            formulations are chemical-free, simple, and honest &mdash; designed
            to support your skin&rsquo;s natural ability to heal and renew.
          </p>
          <div className="w-12 h-12 border border-secondary rounded-full flex items-center justify-center mx-auto text-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22c4-4 8-9.5 8-14a8 8 0 1 0-16 0c0 4.5 4 10 8 14z" />
              <path d="M12 22V12" />
            </svg>
          </div>
        </div>
      </section>

      {/* Category Showcase */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans font-bold text-4xl md:text-5xl text-primary mb-4">
            Shop by Category
          </h2>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoriesLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full" />
              ))
            : (categories ?? []).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop/${cat.id}`}
                  className="group relative aspect-[4/5] overflow-hidden bg-card cursor-pointer"
                >
                  <img
                    src={cat.image}
                    alt={cat.label}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-background">
                    <h3 className="font-sans font-bold text-2xl mb-1 group-hover:text-secondary transition-colors duration-300">
                      {cat.label}
                    </h3>
                    <p className="text-sm text-background/70 font-light">
                      {cat.description}
                    </p>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Featured Products */}
      <ProductGrid />

      {/* Why Sutravan */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-sans font-bold text-4xl md:text-5xl text-primary mb-4">
              Why Sutravan?
            </h2>
            <div className="w-16 h-0.5 bg-secondary mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-secondary rounded-full text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4-4 8-9.5 8-14a8 8 0 1 0-16 0c0 4.5 4 10 8 14z"/><path d="M12 22V12"/></svg>
              </div>
              <h3 className="font-sans font-bold text-base text-primary mb-2">
                Chemical-Free
              </h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Only natural, earth-inspired ingredients. No harsh chemicals, no
                synthetics.
              </p>
            </div>

            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-secondary rounded-full text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/></svg>
              </div>
              <h3 className="font-sans font-bold text-base text-primary mb-2">
                Small Batches
              </h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Handcrafted in small quantities to maintain purity and freshness.
              </p>
            </div>

            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-secondary rounded-full text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <h3 className="font-sans font-bold text-base text-primary mb-2">
                Lasting Results
              </h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Results that don&rsquo;t reverse when you stop &mdash; real skin
                repair, not temporary fixes.
              </p>
            </div>

            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-secondary rounded-full text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </div>
              <h3 className="font-sans font-bold text-base text-primary mb-2">
                Customizable
              </h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Tell us your skin type and we&rsquo;ll customize the formulation
                just for you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Promise */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm uppercase tracking-[0.2em] mb-6 text-secondary">
            Our Promise
          </p>
          <p className="text-xl md:text-2xl font-light leading-relaxed mb-3">
            Natural formulations inspired by the purity of earth.
          </p>
          <p className="text-lg font-light text-primary-foreground/70 mb-8">
            Free from harsh chemicals. Gentle on skin. Made with care.
          </p>
          <p className="text-2xl md:text-3xl font-serif italic text-secondary">
            Pure. Simple. Honest care.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-sans font-bold text-3xl md:text-4xl text-primary mb-4">
          Your Skin Deserves Better
        </h2>
        <p className="text-foreground/70 max-w-lg mx-auto mb-8">
          Discover formulations born from the wisdom of generations. Take our
          skin questionnaire to get personalized recommendations.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/shop"
            className="inline-block bg-primary text-primary-foreground px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-secondary hover:text-primary transition-colors duration-300"
          >
            Shop Now
          </Link>
          <Link
            href="/questionnaire"
            className="inline-block bg-transparent border border-primary text-primary px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-primary hover:text-primary-foreground transition-colors duration-300"
          >
            Take the Skin Guide
          </Link>
        </div>
      </section>
    </Layout>
  );
}
