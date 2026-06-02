import { useState } from "react";
import { useLocation } from "wouter";
import { ImageOff, Pencil, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  useAdminProducts,
  useToggleProductActive,
  useToggleProductInStock,
  useDeleteProduct,
} from "@/lib/admin";
import { formatPrice } from "@/lib/format";
import { supabase } from "@/lib/supabase";

// The snake_case admin product row returned by useAdminProducts (PostgREST).
interface AdminProductRow {
  slug: string;
  name: string;
  price: number | null;
  images: string[] | null;
  is_active: boolean;
  in_stock: boolean;
  categories?:
    | { slug: string; label: string; sort_order: number }
    | { slug: string; label: string; sort_order: number }[]
    | null;
}

/** Resolve a Storage path to its public URL (never hand-concatenate, Pitfall 3). */
function publicUrl(path: string): string {
  return supabase.storage.from("product-images").getPublicUrl(path).data
    .publicUrl;
}

/** Normalize PostgREST's array-typed to-one embed to a single category object. */
function categoryLabel(row: AdminProductRow): string {
  const cat = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;
  return cat?.label ?? "—";
}

const COLUMN_COUNT = 6;

export default function ProductsList() {
  const [, navigate] = useLocation();
  const { data, isLoading, isError, refetch } = useAdminProducts();
  const toggleActive = useToggleProductActive();
  const toggleStock = useToggleProductInStock();
  const deleteProduct = useDeleteProduct();

  const [pendingDelete, setPendingDelete] = useState<AdminProductRow | null>(
    null,
  );

  const products = (data ?? []) as AdminProductRow[];

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteProduct.mutate({
      slug: pendingDelete.slug,
      imagePaths: pendingDelete.images ?? [],
    });
    setPendingDelete(null);
  }

  // ── Header (title + primary CTA) ──────────────────────────────────────────
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-serif text-2xl text-primary">Products</h1>
      <Button onClick={() => navigate("/admin/products/new")}>
        + New product
      </Button>
    </div>
  );

  // ── Loading: ≥4 skeleton rows mirroring the columns ───────────────────────
  if (isLoading) {
    return (
      <section className="space-y-6">
        {header}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>In stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="size-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-8 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    );
  }

  // ── Error: inline block + Retry calling refetch() ─────────────────────────
  if (isError) {
    return (
      <section className="space-y-6">
        {header}
        <div className="space-y-4 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-foreground">
            Couldn&apos;t load this. Check your connection and try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  // ── Empty: "No products yet" + CTA ────────────────────────────────────────
  if (products.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No products yet</EmptyTitle>
            <EmptyDescription>
              Create your first product to show it on the Shop.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate("/admin/products/new")}>
              + New product
            </Button>
          </EmptyContent>
        </Empty>
      </section>
    );
  }

  // ── Reusable per-row controls ─────────────────────────────────────────────
  function Thumbnail({ row }: { row: AdminProductRow }) {
    const first = row.images?.[0];
    if (first) {
      return (
        <img
          src={publicUrl(first)}
          alt=""
          className="size-12 object-cover"
        />
      );
    }
    // images[] empty -> the Phase-2 scrub/cream onboarding signal.
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <ImageOff className="size-3" aria-hidden="true" />
        No photo
      </Badge>
    );
  }

  function PublishedToggle({ row }: { row: AdminProductRow }) {
    return (
      <Switch
        checked={row.is_active}
        onCheckedChange={(next) =>
          toggleActive.mutate({ slug: row.slug, isActive: next })
        }
        className="data-[state=checked]:bg-primary"
        aria-label={`Published — ${row.name}`}
      />
    );
  }

  function StockToggle({ row }: { row: AdminProductRow }) {
    // Distinct from the green Published switch (neutral checked color) — this is
    // NOT a visibility control; an out-of-stock product stays on the Shop.
    return (
      <Switch
        checked={row.in_stock}
        onCheckedChange={(next) =>
          toggleStock.mutate({ slug: row.slug, inStock: next })
        }
        className="data-[state=checked]:bg-secondary"
        aria-label={`In stock — ${row.name}`}
      />
    );
  }

  function RowActions({ row }: { row: AdminProductRow }) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
          onClick={() => navigate(`/admin/products/${row.slug}`)}
          aria-label={`Edit ${row.name}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 text-destructive"
          onClick={() => setPendingDelete(row)}
          aria-label={`Delete ${row.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // ── Populated: table on md+, stacked cards on mobile ─────────────────────
  return (
    <section className="space-y-6">
      {header}

      {/* Desktop / tablet: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>In stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((row) => (
              <TableRow key={row.slug}>
                <TableCell>
                  <Thumbnail row={row} />
                </TableCell>
                <TableCell>
                  <div className="text-base font-medium text-foreground">
                    {row.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {categoryLabel(row)}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {formatPrice(row.price)}
                </TableCell>
                <TableCell>
                  <PublishedToggle row={row} />
                </TableCell>
                <TableCell>
                  <StockToggle row={row} />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions row={row} />
                </TableCell>
              </TableRow>
            ))}
            {/* COLUMN_COUNT referenced so the constant documents the column set */}
            <TableRow className="hidden" aria-hidden="true">
              <TableCell colSpan={COLUMN_COUNT} />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {products.map((row) => (
          <li
            key={row.slug}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <div className="flex items-center gap-3">
              <Thumbnail row={row} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-medium text-foreground">
                  {row.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {categoryLabel(row)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{formatPrice(row.price)}</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Published
                  <PublishedToggle row={row} />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  In stock
                  <StockToggle row={row} />
                </label>
              </div>
            </div>
            <RowActions row={row} />
          </li>
        ))}
      </ul>

      {/* Delete confirmation (D-12) — single reusable surface */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this product?"
        description={
          pendingDelete
            ? `This removes "${pendingDelete.name}" and its photos from the Shop. This can't be undone.`
            : ""
        }
        confirmLabel="Delete product"
        onConfirm={confirmDelete}
      />
    </section>
  );
}
