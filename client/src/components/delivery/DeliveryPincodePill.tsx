import { useState } from "react";
import { MapPin } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useDelivery } from "@/delivery/useDelivery";

// The app-wide 6-digit format contract — verbatim from DeliveryEstimate.tsx.
// This widget is a PURE location setter (08-CONTEXT D-05): format-only guard,
// NO network, NO Turnstile, NO estimate call. Persistence is handled by the
// existing DeliveryProvider.setPincode (localStorage + silent profile write).
const PINCODE_RE = /^\d{6}$/;

/**
 * Site-wide "Deliver to [pincode]" navbar widget: a pill trigger + popover that
 * reads and writes the shared Phase 7 `DeliveryProvider` context
 * (`{ pincode, setPincode }`). Because it consumes the SAME `useDelivery()`
 * context as the product-detail `DeliveryEstimate`, a value set here is visible
 * to the estimator with zero provider changes (SC2 two-way sync).
 *
 * Single mount point on all breakpoints (D-07): the icon is always visible and
 * the label swaps between a desktop (`hidden md:inline`) and a mobile
 * (`md:hidden`) span. No toast on save (D-08) — the pill re-rendering to
 * "Deliver to {value}" is the confirmation.
 */
export default function DeliveryPincodePill() {
  const { pincode, setPincode } = useDelivery();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(pincode ?? "");
  const [formatError, setFormatError] = useState(false);

  // Cancel / discard-unsaved contract (UI-SPEC): every time the popover opens,
  // reset the local input back to the current context pincode and clear errors.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValue(pincode ?? "");
      setFormatError(false);
    }
  }

  // Format guard FIRST — no setPincode, no network when invalid (D-05).
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!PINCODE_RE.test(next)) {
      setFormatError(true);
      return;
    }
    setFormatError(false);
    setPincode(next);
    setOpen(false);
  }

  const triggerAriaLabel = pincode
    ? `Delivery pincode: ${pincode}, change it`
    : "Set delivery pincode";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerAriaLabel}
          className="inline-flex items-center gap-2 h-11 md:h-9 px-3 border border-border/60 text-primary hover:text-secondary hover:border-secondary transition-colors duration-300"
        >
          <MapPin size={18} strokeWidth={1.5} />
          {/* Desktop label */}
          <span className="hidden md:inline text-sm">
            {pincode ? (
              <>
                Deliver to <span className="font-semibold">{pincode}</span>
              </>
            ) : (
              "Set pincode"
            )}
          </span>
          {/* Mobile label */}
          <span className="md:hidden text-sm">
            {pincode ? (
              <span className="font-semibold">{pincode}</span>
            ) : (
              "Set"
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-widest text-foreground/50 mb-2">
            Delivery pincode
          </h3>
          <p className="text-sm text-foreground/70">
            We'll use this to estimate delivery across the site.
          </p>
          <form onSubmit={handleSubmit}>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit pincode"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.replace(/\D/g, ""));
                setFormatError(false);
              }}
              aria-label="Delivery pincode"
            />
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-3 px-5 text-sm uppercase tracking-wider font-semibold transition-colors duration-300 hover:bg-secondary hover:text-primary mt-2"
            >
              Save pincode
            </button>
            {formatError && (
              <p className="mt-2 text-sm text-destructive">
                Enter a valid 6-digit pincode.
              </p>
            )}
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
