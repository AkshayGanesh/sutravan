export default function Footer() {
  return (
    <footer className="bg-primary text-background/80 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <h2 className="font-serif text-3xl text-background mb-2">SUTRAVAN</h2>
          <p className="text-xs tracking-[0.2em] text-secondary uppercase mb-6">Forest Formulations</p>
          <p className="max-w-sm font-light text-sm leading-relaxed mb-6">
            Embracing the purity of earth to bring you luxurious, natural skincare. 
            Every jar and bottle holds the quiet wisdom of the forest.
          </p>
        </div>
        
        <div>
          <h3 className="font-serif text-xl text-background mb-6">Explore</h3>
          <ul className="space-y-4 text-sm font-light">
            <li><a href="#" className="hover:text-secondary transition-colors">Shop All</a></li>
            <li><a href="#" className="hover:text-secondary transition-colors">Our Ingredients</a></li>
            <li><a href="#" className="hover:text-secondary transition-colors">The Sutravan Story</a></li>
            <li><a href="#" className="hover:text-secondary transition-colors">Journal</a></li>
          </ul>
        </div>
        
        <div>
          <h3 className="font-serif text-xl text-background mb-6">Connect</h3>
          <ul className="space-y-4 text-sm font-light">
            <li><a href="#" className="hover:text-secondary transition-colors">Contact Us</a></li>
            <li><a href="#" className="hover:text-secondary transition-colors">FAQ</a></li>
            <li><a href="#" className="hover:text-secondary transition-colors">Shipping & Returns</a></li>
          </ul>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center text-xs font-light">
        <p>&copy; {new Date().getFullYear()} Sutravan. All rights reserved.</p>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <a href="#" className="hover:text-secondary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-secondary transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}