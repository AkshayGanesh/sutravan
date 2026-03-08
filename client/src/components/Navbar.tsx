import { Link } from "wouter";

export default function Navbar() {
  return (
    <nav className="w-full bg-background/90 backdrop-blur-sm fixed top-0 z-50 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link href="/" className="flex flex-col items-start cursor-pointer">
              <span className="font-serif text-2xl text-primary tracking-wide">sutravan</span>
              <span className="text-[0.65rem] tracking-[0.2em] text-foreground/70 uppercase uppercase mt-0.5">Forest Formulations</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#" className="text-sm font-medium hover:text-secondary transition-colors duration-300">Shop</Link>
            <Link href="#" className="text-sm font-medium hover:text-secondary transition-colors duration-300">Our Story</Link>
            <Link href="#" className="text-sm font-medium hover:text-secondary transition-colors duration-300">Ingredients</Link>
            <Link href="#" className="text-sm font-medium hover:text-secondary transition-colors duration-300">Contact</Link>
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 hover:text-secondary transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            </button>
            <button className="p-2 hover:text-secondary transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}