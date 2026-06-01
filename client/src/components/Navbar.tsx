import { Link, useLocation } from "wouter";
import { useState } from "react";
import { User, LogOut, Heart } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/auth/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";
import { useWishlistCount } from "@/lib/wishlist";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/our-story", label: "Our Story" },
  { href: "/questionnaire", label: "Skin Guide" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const { session, signOut } = useAuth();
  const { toast } = useToast();

  // D-20: email + social links from the single source of truth, with mandatory
  // code-default fallbacks so the nav never renders blank links.
  const { data } = useSiteContent();
  const instagramUrl = data?.instagram_url ?? SITE_CONTENT_DEFAULTS.instagram_url;
  const youtubeUrl = data?.youtube_url ?? SITE_CONTENT_DEFAULTS.youtube_url;
  const email = data?.email ?? SITE_CONTENT_DEFAULTS.email;

  // Role lives in useAuth too (Phase 5 Wishlist/Profile items go here);
  // session presence is sufficient to decide logged-in vs logged-out here.
  const isLoggedIn = !!session;

  // Live count derived from the shared ['wishlist'] cache — NO separate query
  // (D-12 / Pitfall 6). The badge is hidden at 0.
  const wishlistCount = useWishlistCount();

  async function handleSignOut() {
    await signOut();
    toast({ title: "Signed out" });
    navigate("/");
  }

  return (
    <nav className="w-full bg-background/90 backdrop-blur-sm fixed top-0 z-50 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link href="/" className="flex flex-col items-start cursor-pointer">
              <span className="font-serif text-2xl text-primary tracking-wide">
                sutravan
              </span>
              <span className="text-[0.65rem] tracking-[0.2em] text-foreground/70 uppercase mt-0.5">
                Forest Formulations
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-300 ${
                  location === link.href || location.startsWith(link.href + "/")
                    ? "text-secondary"
                    : "hover:text-secondary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            {/* Instagram */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:text-secondary transition-colors duration-300"
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

            {/* YouTube */}
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:text-secondary transition-colors duration-300"
              aria-label="YouTube"
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
                <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                <path d="m10 15 5-3-5-3z" />
              </svg>
            </a>

            {/* Email */}
            <a
              href={`mailto:${email}`}
              className="hidden sm:block p-2 hover:text-secondary transition-colors duration-300"
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

            {/* Wishlist heart + live count badge (logged-in only). */}
            {isLoggedIn && (
              <Link
                href="/wishlist"
                aria-label="Wishlist"
                className="relative inline-flex h-11 w-11 items-center justify-center hover:text-secondary transition-colors duration-300"
              >
                <Heart size={20} strokeWidth={1.5} />
                {wishlistCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-medium leading-none text-primary-foreground">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {/* Account */}
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="p-2 hover:text-secondary transition-colors duration-300 outline-none"
                  aria-label="Account menu"
                >
                  <User size={20} strokeWidth={1.5} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <User size={16} strokeWidth={1.5} />
                      Your account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/wishlist">
                      <Heart size={16} strokeWidth={1.5} />
                      Wishlist
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleSignOut()}>
                    <LogOut size={16} strokeWidth={1.5} />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="p-2 hover:text-secondary transition-colors duration-300"
                aria-label="Log in"
              >
                <User size={20} strokeWidth={1.5} />
              </Link>
            )}

            {/* Mobile Hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  className="md:hidden p-2 hover:text-secondary transition-colors duration-300"
                  aria-label="Open menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <line x1="4" x2="20" y1="18" y2="18" />
                  </svg>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-background w-72">
                <SheetTitle className="font-serif text-2xl text-primary mb-1">
                  sutravan
                </SheetTitle>
                <p className="text-[0.65rem] tracking-[0.2em] text-foreground/70 uppercase mb-8">
                  Forest Formulations
                </p>
                <nav className="flex flex-col space-y-6">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`text-base font-medium transition-colors duration-300 ${
                        location === link.href ||
                        location.startsWith(link.href + "/")
                          ? "text-secondary"
                          : "hover:text-secondary"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  {/* Account parity: wishlist/logout/login reachable on mobile too */}
                  {isLoggedIn ? (
                    <>
                      <Link
                        href="/profile"
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2 text-base font-medium transition-colors duration-300 ${
                          location === "/profile"
                            ? "text-secondary"
                            : "hover:text-secondary"
                        }`}
                      >
                        <User size={18} strokeWidth={1.5} />
                        Your account
                      </Link>
                      <Link
                        href="/wishlist"
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2 text-base font-medium transition-colors duration-300 ${
                          location === "/wishlist"
                            ? "text-secondary"
                            : "hover:text-secondary"
                        }`}
                      >
                        <Heart size={18} strokeWidth={1.5} />
                        Wishlist
                        {wishlistCount > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-medium leading-none text-primary-foreground">
                            {wishlistCount}
                          </span>
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          void handleSignOut();
                        }}
                        className="flex items-center gap-2 text-base font-medium text-left hover:text-secondary transition-colors duration-300"
                      >
                        <LogOut size={18} strokeWidth={1.5} />
                        Log out
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2 text-base font-medium transition-colors duration-300 ${
                        location === "/login"
                          ? "text-secondary"
                          : "hover:text-secondary"
                      }`}
                    >
                      <User size={18} strokeWidth={1.5} />
                      Log in
                    </Link>
                  )}
                </nav>
                <div className="mt-10 pt-6 border-t border-border/50 space-y-4">
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-foreground/70 hover:text-secondary transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        width="20"
                        height="20"
                        x="2"
                        y="2"
                        rx="5"
                        ry="5"
                      />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                    @sutravan.in
                  </a>
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-foreground/70 hover:text-secondary transition-colors"
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
                      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                      <path d="m10 15 5-3-5-3z" />
                    </svg>
                    @sutravan
                  </a>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-sm text-foreground/70 hover:text-secondary transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
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
                    {email}
                  </a>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
