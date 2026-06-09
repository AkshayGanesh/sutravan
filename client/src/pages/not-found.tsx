import { Link } from "wouter";
import Layout from "@/components/Layout";

export default function NotFound() {
  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
        <div className="max-w-lg text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-secondary mb-4">
            Page not found
          </p>
          <h1 className="font-serif text-6xl md:text-7xl text-primary mb-4">
            404
          </h1>
          <p className="text-foreground/70 mb-8 leading-relaxed">
            The page you&rsquo;re looking for has wandered off — it may have
            moved or no longer exists. Let&rsquo;s get you back to something
            lovely for your skin.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-block bg-primary text-primary-foreground px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-secondary hover:text-primary transition-colors duration-300"
            >
              Return Home
            </Link>
            <Link
              href="/shop"
              className="inline-block border border-primary text-primary px-8 py-3.5 text-sm uppercase tracking-wider font-medium hover:bg-primary hover:text-primary-foreground transition-colors duration-300"
            >
              Browse the Shop
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
