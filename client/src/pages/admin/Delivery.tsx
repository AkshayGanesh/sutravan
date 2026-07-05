// Admin delivery-settings editor (D-01/D-02). The owner sets the shipping origin
// (with live serviceability validation + a preview), the default parcel weight,
// the dispatch lead time, the COD rules, and the free-shipping threshold — ALL in
// one Save (D-02). Cloned from SiteContent.tsx (same useSiteContent prefill +
// useForm(zodResolver) + sectioned <fieldset><legend> + inline role="alert"
// errors + single Save button) and wired to the plan 09-01 pure-logic helpers
// (deliverySchema, the codRules codec, checkServiceable, previewDelivery) so an
// edit here flows to the customer estimator with no redeploy (SC1–SC5).
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSaveDeliverySettings } from "@/lib/admin";
import { useSiteContent, SITE_CONTENT_DEFAULTS } from "@/lib/siteContent";
import { deliverySchema, formatPreviewLine } from "./deliverySchema";
import { parseCodRules, serializeCodRules } from "@/lib/codRules";
import { checkServiceable, type ServiceabilityResult } from "@/lib/pincodes";
import { previewDelivery, type DeliveryEstimateResult } from "@/lib/delivery";

// The form's working value type: z.input (raw field values before coercion), the
// same idiom ProductForm uses so text inputs can hold strings that deliverySchema
// coerces on submit (RESEARCH — numeric-input-in-string-field pattern).
type DeliveryFormValues = typeof deliverySchema._input;

// Pull one live delivery key, falling back to the code default so the editor is
// never prefilled blank (D-03/D-20).
function keyValue(
  data: Record<string, string> | undefined,
  key: string,
): string {
  return data?.[key] ?? SITE_CONTENT_DEFAULTS[key] ?? "";
}

export default function Delivery() {
  const { data, isLoading } = useSiteContent();
  const save = useSaveDeliverySettings();

  // Serviceability of the current origin (D-09/D-10) — refreshed on the origin
  // input's onBlur; null until first checked.
  const [serviceability, setServiceability] =
    useState<ServiceabilityResult | null>(null);
  const [checkingOrigin, setCheckingOrigin] = useState(false);

  // Live preview (D-04/D-05/D-06): a test destination + the result, independent
  // of Save. previewError carries the retry copy on an invoke failure.
  const [testDest, setTestDest] = useState("");
  const [previewResult, setPreviewResult] =
    useState<DeliveryEstimateResult | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState("");
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const form = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      originPincode: SITE_CONTENT_DEFAULTS.delivery_origin_pincode,
      defaultWeightG: Number(SITE_CONTENT_DEFAULTS.delivery_default_weight_g),
      dispatchLeadDays: Number(SITE_CONTENT_DEFAULTS.delivery_dispatch_lead_days),
      codEnabled: true,
      codFee: "",
      codValueCap: "",
      freeShipThreshold: "",
    },
  });

  const { reset, control, register, watch, handleSubmit, formState } = form;
  const { errors } = formState;

  // Re-seed the form with live values once the query resolves (prefill). COD
  // fields come from the JSON-in-text codec (D-09); plain keys map 1:1.
  useEffect(() => {
    if (isLoading) return;
    const cod = parseCodRules(data?.delivery_cod_rules);
    reset({
      originPincode: keyValue(data, "delivery_origin_pincode"),
      defaultWeightG: Number(keyValue(data, "delivery_default_weight_g")),
      dispatchLeadDays: Number(keyValue(data, "delivery_dispatch_lead_days")),
      codEnabled: cod.enabled,
      codFee: cod.fee === null ? "" : String(cod.fee),
      codValueCap: cod.valueCap === null ? "" : String(cod.valueCap),
      freeShipThreshold: keyValue(data, "delivery_free_ship_threshold"),
    });
  }, [data, isLoading, reset]);

  const originValue = String(watch("originPincode") ?? "");
  const codEnabled = watch("codEnabled");

  // D-10: Save is blocked until the origin is a 6-digit serviceable pincode and
  // is not the 000000 placeholder (in addition to the in-flight save guard).
  const originValid =
    /^\d{6}$/.test(originValue) &&
    originValue !== "000000" &&
    serviceability?.serviceable === true;

  async function handleOriginBlur(value: string) {
    if (!/^\d{6}$/.test(value)) {
      setServiceability(null);
      return;
    }
    setCheckingOrigin(true);
    try {
      setServiceability(await checkServiceable(value));
    } finally {
      setCheckingOrigin(false);
    }
  }

  async function handlePreview() {
    if (!/^\d{6}$/.test(originValue) || !/^\d{6}$/.test(testDest)) {
      setPreviewError("Enter a 6-digit origin and test pincode first.");
      setPreviewResult(null);
      return;
    }
    setPreviewPending(true);
    setPreviewError(null);
    try {
      const result = await previewDelivery(originValue, testDest);
      setPreviewOrigin(originValue);
      setPreviewResult(result);
    } catch {
      setPreviewResult(null);
      setPreviewError("Couldn’t fetch a preview. Try again.");
    } finally {
      setPreviewPending(false);
    }
  }

  function onSubmit(values: DeliveryFormValues) {
    // values are post-zod-parse here; re-parse for the fully-typed output shape.
    const parsed = deliverySchema.parse(values);
    save.mutate({
      delivery_origin_pincode: parsed.originPincode,
      delivery_default_weight_g: String(parsed.defaultWeightG),
      delivery_dispatch_lead_days: String(parsed.dispatchLeadDays),
      // D-13: fee/cap retained even when disabled; D-14: blank cap → null in JSON.
      delivery_cod_rules: serializeCodRules({
        enabled: parsed.codEnabled,
        fee: parsed.codFee ?? 0,
        valueCap: parsed.codValueCap,
      }),
      // D-14/D-19: blank threshold saves as "" (free shipping off).
      delivery_free_ship_threshold:
        parsed.freeShipThreshold == null ? "" : String(parsed.freeShipThreshold),
    });
  }

  if (isLoading) {
    return (
      <section className="flex items-center justify-center py-24">
        <Spinner className="size-6" />
      </section>
    );
  }

  return (
    <section className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Delivery</h1>
        <p className="text-muted-foreground">
          Set your shipping origin, parcel defaults, cash-on-delivery rules and
          free-shipping threshold. Changes apply to delivery estimates
          immediately — no redeploy.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Origin & dispatch */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground/80">
            Origin &amp; dispatch
          </legend>

          <div className="space-y-1.5">
            <Label htmlFor="originPincode">Shipping origin pincode</Label>
            <Input
              id="originPincode"
              inputMode="numeric"
              maxLength={6}
              {...register("originPincode", {
                onBlur: (e) => handleOriginBlur(e.target.value),
              })}
            />
            {checkingOrigin && (
              <p className="text-[0.8rem] text-muted-foreground">Checking…</p>
            )}
            {!checkingOrigin && serviceability && (
              <p
                className={`text-[0.8rem] font-medium ${
                  serviceability.serviceable
                    ? "text-emerald-600"
                    : "text-destructive"
                }`}
              >
                {serviceability.serviceable
                  ? `✓ serviceable${
                      serviceability.label ? ` (${serviceability.label})` : ""
                    }`
                  : "✗ not a serviceable pincode"}
              </p>
            )}
            {errors.originPincode && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.originPincode.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="defaultWeightG">Default parcel weight (grams)</Label>
            <Input
              id="defaultWeightG"
              type="number"
              inputMode="numeric"
              min={1}
              max={2000}
              step={1}
              {...register("defaultWeightG", { valueAsNumber: true })}
            />
            {errors.defaultWeightG && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.defaultWeightG.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispatchLeadDays">Dispatch lead time (days)</Label>
            <Input
              id="dispatchLeadDays"
              type="number"
              inputMode="numeric"
              min={0}
              max={14}
              step={1}
              {...register("dispatchLeadDays", { valueAsNumber: true })}
            />
            {errors.dispatchLeadDays && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.dispatchLeadDays.message}
              </p>
            )}
          </div>
        </fieldset>

        {/* Cash on delivery */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground/80">
            Cash on delivery
          </legend>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="codEnabled"
              render={({ field }) => (
                <Switch
                  id="codEnabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="codEnabled">Offer cash on delivery</Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codFee">COD fee (₹)</Label>
            {/* D-13: disabled when COD is off but the value is RETAINED (never
                cleared/unmounted) so toggling back on restores it. */}
            <Input
              id="codFee"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              disabled={!codEnabled}
              {...register("codFee")}
            />
            {errors.codFee && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.codFee.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codValueCap">COD value cap (₹)</Label>
            <Input
              id="codValueCap"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              disabled={!codEnabled}
              {...register("codValueCap")}
            />
            <p className="text-[0.8rem] text-muted-foreground">
              Leave blank to disable the cap.
            </p>
            {errors.codValueCap && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.codValueCap.message}
              </p>
            )}
          </div>
        </fieldset>

        {/* Free shipping */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground/80">
            Free shipping
          </legend>

          <div className="space-y-1.5">
            <Label htmlFor="freeShipThreshold">Free-shipping threshold (₹)</Label>
            <Input
              id="freeShipThreshold"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              {...register("freeShipThreshold")}
            />
            <p className="text-[0.8rem] text-muted-foreground">
              Leave blank to disable free shipping.
            </p>
            {errors.freeShipThreshold && (
              <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                {errors.freeShipThreshold.message}
              </p>
            )}
          </div>
        </fieldset>

        <Button type="submit" disabled={save.isPending || !originValid}>
          {save.isPending ? (
            <>
              <Spinner className="size-4" />
              Saving…
            </>
          ) : (
            "Save delivery settings"
          )}
        </Button>
        {!originValid && (
          <p className="text-[0.8rem] text-muted-foreground">
            Set a real, serviceable 6-digit origin pincode to enable saving.
          </p>
        )}
      </form>

      {/* Live preview (D-04/D-05/D-06) — independent of Save. */}
      <div className="space-y-3 rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground/80">
          Preview an estimate
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="testDest">Test against pincode</Label>
            <Input
              id="testDest"
              inputMode="numeric"
              maxLength={6}
              value={testDest}
              onChange={(e) => setTestDest(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={previewPending}
          >
            {previewPending ? <Spinner className="size-4" /> : "Preview"}
          </Button>
        </div>
        {previewError && (
          <p role="alert" className="text-[0.8rem] font-medium text-destructive">
            {previewError}
          </p>
        )}
        {previewResult && !previewError && (
          <p className="text-sm">
            {formatPreviewLine(previewOrigin, testDest, previewResult)}
          </p>
        )}
      </div>
    </section>
  );
}
