import { Link } from "wouter";
import Layout from "@/components/Layout";

export default function OurStory() {
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

      {/* The Beginning */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6 text-foreground/80 leading-relaxed">
          <p>
            That is the idea behind <strong className="text-primary">Sutravan</strong>, a name
            that means <em>formulas born from the purity of nature.</em>
          </p>
          <p>
            But Sutravan didn&rsquo;t begin as a business. It began as a{" "}
            <strong className="text-primary">personal search for healing.</strong>
          </p>
          <p>
            For many years, I struggled with marks on my face &mdash; from
            accidents, acne, pimples and everyday skin issues. Like many people,
            I tried several cosmetic products. Some worked for a while, but often
            the results didn&rsquo;t last. When I stopped using them, the
            problems slowly came back.
          </p>
          <p>Then something unexpected happened.</p>
        </div>
      </section>

      {/* The Discovery */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-3xl mx-auto space-y-6 text-foreground/80 leading-relaxed">
          <h2 className="font-sans font-bold text-2xl md:text-3xl text-primary mb-4">
            The Discovery
          </h2>
          <p>
            During a visit to villages in Rajasthan, I noticed something
            fascinating. In places where there were no beauty stores, no cosmetic
            brands and sometimes not even proper houses, people still had a deep
            understanding of caring for their skin and body.
          </p>
          <p>
            Women there used simple ingredients from their kitchens and
            surroundings: <strong className="text-primary">besan, multani mitti, chandan,
            neem leaves, haldi</strong> and even the{" "}
            <strong className="text-primary">peels of vegetables and fruits</strong> like
            potato, cucumber, onion, orange and lemon.
          </p>
          <p>
            Nothing was wasted. Everything from nature had a purpose.
          </p>
          <p>
            These natural ingredients were used to clean the face, nourish the
            skin, strengthen the hair and maintain overall well-being. That
            moment stayed with me.
          </p>
        </div>
      </section>

      {/* The Journey */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6 text-foreground/80 leading-relaxed">
          <h2 className="font-sans font-bold text-2xl md:text-3xl text-primary mb-4">
            Three Years of Patience
          </h2>
          <p>
            I thought, <em>if these natural methods have worked for
            generations, why not try them myself?</em>
          </p>
          <p>
            So I started experimenting. Slowly. Carefully. Patiently.
          </p>
          <p>
            Over the last <strong className="text-primary">three years</strong>, I began
            creating small formulations using natural ingredients. I tested them
            on myself first and gradually shared them with family, friends,
            relatives and colleagues.
          </p>
          <p>
            The results were encouraging. With consistent use, marks began
            fading, skin started improving naturally and the biggest difference
            was this:
          </p>
          <p className="text-lg font-medium text-primary pl-6 border-l-2 border-secondary">
            When people stopped using these products, the improvements did not
            reverse immediately, unlike many chemical-based cosmetics.
          </p>
          <p>
            Because the goal wasn&rsquo;t just temporary beauty. The goal was{" "}
            <strong className="text-primary">
              natural skin repair and long-term balance.
            </strong>
          </p>
        </div>
      </section>

      {/* What We Make */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-3xl mx-auto space-y-6 text-foreground/80 leading-relaxed">
          <h2 className="font-sans font-bold text-2xl md:text-3xl text-primary mb-4">
            What We Create
          </h2>
          <p>
            This journey led to the creation of our first products:
          </p>
          <ul className="space-y-3 pl-6">
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full shrink-0" />
              Natural soaps
            </li>
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full shrink-0" />
              Gentle scrubs
            </li>
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full shrink-0" />
              Nourishing creams
            </li>
          </ul>
          <p>
            All made with{" "}
            <strong className="text-primary">
              earth-inspired ingredients and traditional wisdom.
            </strong>
          </p>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="font-sans font-bold text-2xl md:text-3xl text-primary">
            Our Belief
          </h2>
          <p className="text-foreground/80 leading-relaxed text-lg">
            At <strong className="text-primary">Sutravan</strong>, we believe
            skincare should not fight your skin. It should{" "}
            <strong className="text-primary">work with it</strong>. Our products
            are chemical-free, simple and honest, designed to support your
            skin&rsquo;s natural ability to heal and renew.
          </p>
          <p className="text-foreground/70 leading-relaxed">
            What started as a personal experiment is now something we want to
            share with others. Because sometimes the most powerful solutions are
            not new inventions. They are{" "}
            <strong className="text-primary">old wisdom rediscovered.</strong>
          </p>
          <div className="pt-8">
            <p className="text-2xl md:text-3xl font-serif text-primary italic leading-relaxed">
              &ldquo;Nature does not rush.
              <br />
              And yet, everything grows beautifully.&rdquo;
            </p>
            <p className="text-sm text-foreground/50 mt-4 uppercase tracking-widest">
              That is the spirit of Sutravan
            </p>
          </div>
        </div>
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
