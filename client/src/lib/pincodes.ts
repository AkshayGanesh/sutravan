// The pincode serviceability lookup (D-09). A single public-read query against
// public.pincodes (0015 — `pincodes_public_read using (true)`) mapped to the
// normalized {known,serviceable,label} shape the admin preview and any future
// widget consume. Absence of a row = not serviceable (D-09): never throw, so a
// missing/blocked lookup degrades to "not serviceable" rather than an error state.
import { supabase } from "./supabase";

/** The normalized outcome of a serviceability lookup. */
export interface ServiceabilityResult {
  /** true when a pincodes row exists for this code. */
  known: boolean;
  /** true only when the row exists AND its serviceable flag is true. */
  serviceable: boolean;
  /** district (preferred) or state for display; null when the pincode is unknown. */
  label: string | null;
}

/** A public-read pincodes row (the columns this lookup selects). */
interface PincodeRow {
  pincode: string;
  district: string | null;
  state: string;
  serviceable: boolean;
}

/**
 * Look up one pincode's serviceability. Runs a single
 * `from("pincodes").select(...).eq("pincode", p).maybeSingle()` — maybeSingle
 * returns a null row (not an error) for an unknown pincode, so the absent case
 * maps to {known:false, serviceable:false, label:null} without throwing.
 */
export async function checkServiceable(
  pincode: string,
): Promise<ServiceabilityResult> {
  const { data } = await supabase
    .from("pincodes")
    .select("pincode, district, state, serviceable")
    .eq("pincode", pincode)
    .maybeSingle();
  const row = data as PincodeRow | null;
  return {
    known: !!row,
    serviceable: row?.serviceable === true,
    label: row ? (row.district ?? row.state) : null,
  };
}
