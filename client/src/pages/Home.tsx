import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        
        {/* Brand Philosophy Section */}
        <section className="py-24 px-4 bg-card text-center flex flex-col items-center justify-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-sans font-bold text-3xl md:text-5xl text-primary mb-8 leading-tight">
              "We believe that true luxury lies in nature's untouched simplicity."
            </h2>
            <p className="text-foreground/80 leading-relaxed font-light mb-8">
              At Sutravan, we forage for the finest earthen ingredients to formulate 
              skincare that grounds you. Our process respects the ancient rhythms 
              of the forest, bringing you formulations that are as pure as they are potent.
            </p>
            <div className="w-12 h-12 border border-secondary rounded-full flex items-center justify-center mx-auto text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4-4 8-9.5 8-14a8 8 0 1 0-16 0c0 4.5 4 10 8 14z"/><path d="M12 22V12"/></svg>
            </div>
          </div>
        </section>

        <ProductGrid />
      </main>
      <Footer />
    </div>
  );
}