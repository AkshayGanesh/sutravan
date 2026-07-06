// Admin Rate Slabs editor (Phase 10, D-01..D-08). The owner edits the fixed 5×4
// zone × weight-band rate card — one cost per cell (20 inputs) and one ETA min/max
// pair per zone (5 pairs, fanned to all 4 bands on save, D-06) — then hits a single
// Save that bulk-upserts all 20 rows and purges the estimate cache so customer
// estimates recompute live with no redeploy (D-10/D-11, SC2). Cloned from
// Delivery.tsx's shape (useForm(zodResolver) + reset() prefill in useEffect +
// number Input + inline role="alert" errors + single Save + loading Spinner);
// the serviceability/preview blocks are dropped as N/A. The live source is the
// delivery_rate_slabs table via useDeliveryRateSlabs (NOT useSiteContent). There
// deliberately no affordance to insert or remove rows — the cartesian grid is
// always complete, so SC3's "no missing slab" holds structurally (D-01).
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDeliveryRateSlabs, useSaveRateSlabs } from "@/lib/admin";
import {
  rateSlabsSchema,
  mapSlabsToForm,
  expandFormToRows,
  ZONE_ORDER,
  WEIGHT_BAND_LABELS,
  type RateSlabsFormValues,
} from "./rateSlabsSchema";

// The 4 weight bands as numeric column indices (1-based, matching the schema).
const WEIGHT_BANDS = [1, 2, 3, 4] as const;

// Human-readable zone row header (the DB stores lowercase enum values).
function zoneLabel(zone: string): string {
  return zone.charAt(0).toUpperCase() + zone.slice(1);
}

export default function RateSlabs() {
  const { data, isLoading } = useDeliveryRateSlabs();
  const save = useSaveRateSlabs();

  const form = useForm<RateSlabsFormValues>({
    resolver: zodResolver(rateSlabsSchema),
    // onChange so formState.isValid tracks live for the block-save gate (D-07).
    mode: "onChange",
  });
  const { reset, register, handleSubmit, formState } = form;
  const { errors, isValid } = formState;

  // Prefill the grid with the live 20 rows once the query resolves (D-03):
  // 20 rows → 20 per-cell costs + 5 per-zone ETA pairs (D-06).
  useEffect(() => {
    if (isLoading || !data) return;
    reset(mapSlabsToForm(data));
  }, [data, isLoading, reset]);

  function onSubmit(values: RateSlabsFormValues) {
    // values are post-zod-parse; re-parse for the fully-typed output shape, then
    // fan each zone's single ETA pair across its 4 bands → exactly 20 rows (D-06).
    const parsed = rateSlabsSchema.parse(values);
    save.mutate(expandFormToRows(parsed));
  }

  if (isLoading) {
    return (
      <section className="flex items-center justify-center py-24">
        <Spinner className="size-6" />
      </section>
    );
  }

  return (
    <section className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Rate Slabs</h1>
        <p className="text-muted-foreground">
          Set the delivery cost for each zone &amp; weight band, plus the delivery
          time (ETA) per zone. Costs are the base ₹ amount before rounding. Changes
          apply to customer estimates immediately — no redeploy.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Rate card: zones down the side, weight bands across the top, one ETA
            per zone. The grid is fixed & complete — no add/remove affordance. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left font-semibold text-foreground/80">
                  Zone
                </th>
                {WEIGHT_BAND_LABELS.map((label) => (
                  <th
                    key={label}
                    className="p-2 text-left font-semibold text-foreground/80"
                    scope="col"
                  >
                    {label}
                  </th>
                ))}
                <th className="p-2 text-left font-semibold text-foreground/80">
                  ETA min (days)
                </th>
                <th className="p-2 text-left font-semibold text-foreground/80">
                  ETA max (days)
                </th>
              </tr>
            </thead>
            <tbody>
              {ZONE_ORDER.map((zone) => {
                const zoneCostErrors = errors.costs;
                const zoneEtaError = errors.etas?.[zone];
                return (
                  <tr key={zone} className="border-b border-border align-top">
                    {/* Read-only zone row header (D-02). */}
                    <th
                      scope="row"
                      className="whitespace-nowrap p-2 text-left font-medium"
                    >
                      {zoneLabel(zone)}
                    </th>

                    {/* One cost cell per weight band (20 total). */}
                    {WEIGHT_BANDS.map((band) => {
                      const key = `${zone}_${band}`;
                      const cellError = zoneCostErrors?.[key];
                      return (
                        <td key={band} className="p-2">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">₹</span>
                            <Input
                              aria-label={`Cost for ${zoneLabel(zone)}, ${WEIGHT_BAND_LABELS[band - 1]}`}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={1}
                              className="w-24"
                              {...register(`costs.${zone}_${band}`)}
                            />
                          </div>
                          {cellError && (
                            <p
                              role="alert"
                              className="mt-1 text-[0.8rem] font-medium text-destructive"
                            >
                              {cellError.message}
                            </p>
                          )}
                        </td>
                      );
                    })}

                    {/* One ETA min/max pair per zone (D-06). */}
                    <td className="p-2">
                      <Input
                        aria-label={`Minimum ETA days for ${zoneLabel(zone)}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        className="w-20"
                        {...register(`etas.${zone}.min`)}
                      />
                      {zoneEtaError?.min && (
                        <p
                          role="alert"
                          className="mt-1 text-[0.8rem] font-medium text-destructive"
                        >
                          {zoneEtaError.min.message}
                        </p>
                      )}
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label={`Maximum ETA days for ${zoneLabel(zone)}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        className="w-20"
                        {...register(`etas.${zone}.max`)}
                      />
                      {zoneEtaError?.max && (
                        <p
                          role="alert"
                          className="mt-1 text-[0.8rem] font-medium text-destructive"
                        >
                          {zoneEtaError.max.message}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button type="submit" disabled={save.isPending || !isValid}>
          {save.isPending ? (
            <>
              <Spinner className="size-4" />
              Saving…
            </>
          ) : (
            "Save rate slabs"
          )}
        </Button>
        {!isValid && (
          <p className="text-[0.8rem] text-muted-foreground">
            Fix the highlighted cells to enable saving.
          </p>
        )}
      </form>
    </section>
  );
}
