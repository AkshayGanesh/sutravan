import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  ExternalLink,
  FileText,
  Inbox,
  LogOut,
  Package,
  Tags,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/useAuth";
import { useUnreadSubmissionsCount } from "@/lib/submissions";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Package;
}

// Four admin sections (D-01). Order + icons are locked by the UI-SPEC
// Admin Shell Layout table.
const NAV_ITEMS: NavItem[] = [
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Site Content", href: "/admin/content", icon: FileText },
  { label: "Submissions", href: "/admin/submissions", icon: Inbox },
];

/**
 * Admin chrome (D-01/D-02/D-03): a sidebar of the four section links + a slim
 * 56px header (brand wordmark, "View site", logout). Deliberately does NOT use
 * the public `Layout` — the marketing Navbar/Footer are dropped inside `/admin`.
 *
 * Each `/admin/*` route wraps its section page in this layout (App.tsx), so the
 * stub section pages render only their own content here.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useAuth();
  // Unread-count badge on the Submissions nav link only (rows with status='new').
  const { data: unreadCount } = useUnreadSubmissionsCount();

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="px-3 py-4">
          {/* Brand wordmark — font-sans (NOT the Samarkan serif); gold accent
              is the one rationed brand highlight in the chrome. */}
          <span className="font-sans text-lg font-semibold text-secondary">
            Sutravan
          </span>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const isActive =
                location === item.href ||
                location.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const showBadge =
                item.href === "/admin/submissions" &&
                typeof unreadCount === "number" &&
                unreadCount > 0;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.href}>
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {showBadge && (
                    <SidebarMenuBadge>{unreadCount}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        {/* Slim admin header (D-02): 56px. */}
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
          <SidebarTrigger className="md:hidden" />
          <span className="font-sans text-base font-semibold text-secondary">
            Sutravan
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                View site
              </a>
            </Button>
            <Button
              variant="ghost"
              onClick={() => signOut()}
              aria-label="Log out"
            >
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        </header>

        {/* Content area: max 1200px, lg gutters (D-02). */}
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-6 lg:py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
