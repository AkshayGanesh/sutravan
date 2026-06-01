import Layout from "@/components/Layout";

/**
 * Empty protected admin shell.
 *
 * This page exists solely to prove the `AdminGuard` renders for an admin
 * (AUTH-05). The actual admin portal — catalog management, product/category
 * controls, image uploads — is built in Phase 4. Intentionally no data
 * fetching and no portal controls here (D-11).
 */
export default function Admin() {
  return (
    <Layout>
      {/* Header */}
      <section className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 text-center bg-card">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-6xl text-primary mb-4">
            Admin
          </h1>
          <div className="w-16 h-0.5 bg-secondary mx-auto mb-6" />
          <p className="text-foreground/70 max-w-xl mx-auto">
            Welcome to the Sutravan admin area.
          </p>
        </div>
      </section>

      {/* Placeholder body */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center">
        <p className="text-foreground/60">
          The catalog management portal will be built in a later milestone.
        </p>
      </section>
    </Layout>
  );
}
