import { Router as WouterRouter, Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthProvider from "@/auth/AuthProvider";
import DeliveryProvider from "@/delivery/DeliveryProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import OurStory from "@/pages/OurStory";
import Contact from "@/pages/Contact";
import Questionnaire from "@/pages/Questionnaire";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ResetPassword from "@/pages/ResetPassword";
import AuthGuard from "@/auth/AuthGuard";
import Wishlist from "@/pages/Wishlist";
import Profile from "@/pages/Profile";
import AdminGuard from "@/auth/AdminGuard";
import AdminLayout from "@/pages/admin/AdminLayout";
import ProductsList from "@/pages/admin/ProductsList";
import ProductForm from "@/pages/admin/ProductForm";
import CategoriesList from "@/pages/admin/CategoriesList";
import QuestionsList from "@/pages/admin/QuestionsList";
import SectionsList from "@/pages/admin/SectionsList";
import SiteContent from "@/pages/admin/SiteContent";
import Delivery from "@/pages/admin/Delivery";
import Submissions from "@/pages/admin/Submissions";
import type { ReactNode } from "react";

/**
 * Every `/admin/*` route stays behind the unchanged AdminGuard (T-04-11:
 * logged-out→/login, non-admin→/, admin→children) and renders its section
 * inside AdminLayout. The guard is UX; RLS is the real boundary.
 */
function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayout>{children}</AdminLayout>
    </AdminGuard>
  );
}

function Router() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/shop" component={Shop} />
        <Route path="/shop/:category" component={Shop} />
        <Route path="/our-story" component={OurStory} />
        <Route path="/contact" component={Contact} />
        <Route path="/questionnaire" component={Questionnaire} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* Auth-gated customer route — its own Layout (not AdminLayout). */}
        <Route path="/wishlist">
          {() => (
            <AuthGuard>
              <Wishlist />
            </AuthGuard>
          )}
        </Route>

        {/* Auth-gated customer account page — its own Layout (not AdminLayout). */}
        <Route path="/profile">
          {() => (
            <AuthGuard>
              <Profile />
            </AuthGuard>
          )}
        </Route>

        <Route path="/admin/products/new">
          {() => (
            <AdminRoute>
              <ProductForm />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/products/:slug">
          {() => (
            <AdminRoute>
              <ProductForm />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/products">
          {() => (
            <AdminRoute>
              <ProductsList />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/categories">
          {() => (
            <AdminRoute>
              <CategoriesList />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/questions">
          {() => (
            <AdminRoute>
              <QuestionsList />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/sections">
          {() => (
            <AdminRoute>
              <SectionsList />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/content">
          {() => (
            <AdminRoute>
              <SiteContent />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/delivery">
          {() => (
            <AdminRoute>
              <Delivery />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin/submissions">
          {() => (
            <AdminRoute>
              <Submissions />
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin">
          {() => (
            <AdminRoute>
              <ProductsList />
            </AdminRoute>
          )}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {/* Pincode persistence for the delivery estimator (D-11). Nested
              inside AuthProvider and QueryClientProvider so useDeliveryEstimate's
              React Query works; Phase 8's navbar widget reads the same context. */}
          <DeliveryProvider>
            <Toaster />
            <SonnerToaster />
            <Router />
          </DeliveryProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
