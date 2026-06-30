/**
 * One-time CSV → normalized NDJSON transform for the pincode serviceability
 * dataset (DLVR-05 / SC5, Phase 6 Plan 02 Task 2).
 *
 * Reads the transient India Post All-India Pincode Directory dump
 * (`scripts/data/pincodes-raw.csv`, ~165k post-office rows, gitignored) and emits
 * `scripts/data/pincodes.ndjson` — one normalized JSON object per UNIQUE pincode:
 *
 *   { pincode, state, district, circle, region, is_metro, is_remote }
 *
 * Normalization is load-bearing (06-RESEARCH Pitfall A): the source `StateName`
 * is canonicalized (`&` → `and`, title-case) so Plan 03's zone-derivation
 * adjacency/remote-set comparisons cannot silently miss. A transform-time
 * assertion fails the run (non-zero exit) if any distinct normalized state is
 * outside the known canonical India states/UTs set — preventing silent mis-zoning.
 *
 * The raw CSV header is lowercase & comma-delimited with double-quoted fields
 * (embedded commas), so columns are resolved case-insensitively from the header
 * row and rows are parsed with a quote-aware CSV reader (not split(',')).
 *
 * Native Node 22 runner (no tsx, no dotenv):
 *   node scripts/transform-pincodes.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_PATH = join(__dirname, 'data', 'pincodes-raw.csv');
const OUT_PATH = join(__dirname, 'data', 'pincodes.ndjson');

// 8-metro first-three-digit prefix set (06-RESEARCH "Per-pincode facts", D-15):
//   110 Delhi · 400 Mumbai · 700 Kolkata · 600 Chennai
//   560 Bengaluru · 500 Hyderabad · 380 Ahmedabad · 411 Pune
const METRO_PREFIXES = new Set(['110', '400', '700', '600', '560', '500', '380', '411']);

// Canonical remote states/UTs (06-RESEARCH "Per-pincode facts" / Pitfall A).
const REMOTE_STATES = new Set([
  'Arunachal Pradesh',
  'Assam',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Tripura',
  'Sikkim',
  'Jammu and Kashmir',
  'Ladakh',
  'Andaman and Nicobar Islands',
  'Lakshadweep',
]);

// Known canonical set = remote set ∪ every other Indian state/UT in canonical
// title-case form. Any distinct normalized state outside this set trips the
// Pitfall A guard (T-6-04 mitigation) so mis-spelled / un-normalized state
// strings can never reach the seed and silently break zone derivation.
const KNOWN_STATES = new Set<string>([
  ...REMOTE_STATES,
  'Andhra Pradesh',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'The Dadra and Nagar Haveli and Daman and Diu',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]);

// Connector words kept lowercase mid-string when title-casing (so
// "JAMMU & KASHMIR" → "Jammu and Kashmir", not "Jammu And Kashmir").
const MINOR_WORDS = new Set(['and', 'of']);

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((word, i) => (i > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function normalizeState(raw: string): string {
  return titleCase(raw.replace(/&/g, ' and ').replace(/\s+/g, ' ').trim());
}

// Quote-aware CSV line parser: respects double-quoted fields with embedded
// commas and escaped ("") quotes. Returns one string per column.
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

// 'NA' (and blanks) are the source's missing-value sentinel — store NULL, not "NA".
function cleanNullable(value: string | undefined): string | null {
  const v = clean(value);
  return v === '' || v.toUpperCase() === 'NA' ? null : v;
}

interface RawRow {
  pincode: string;
  stateRaw: string;
  district: string | null;
  circle: string | null;
  region: string | null;
}

function main(): void {
  const raw = readFileSync(RAW_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) {
    console.error('FAIL: raw CSV has no data rows');
    process.exit(1);
  }

  // Resolve columns case-insensitively from the actual header (lowercase on disk).
  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx === -1) {
      console.error(`FAIL: column "${name}" not found in header: ${header.join(',')}`);
      process.exit(1);
    }
    return idx;
  };
  const iPin = col('pincode');
  const iState = col('statename');
  const iDistrict = col('district');
  const iCircle = col('circlename');
  const iRegion = col('regionname');

  // Dedupe by pincode keeping the FIRST representative, but PREFER a row whose
  // state is not the 'NA' sentinel so a junk first occurrence can't poison the
  // canonical-state assertion (the raw dump has ~715 'NA'-state rows; 238 of
  // those pincodes also appear with a real state — recover those, drop the rest).
  const byPin = new Map<string, RawRow>();
  let dataRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const f = parseLine(line);
    const pincode = clean(f[iPin]);
    if (!/^[0-9]{6}$/.test(pincode)) continue; // skip malformed pincodes
    dataRows++;
    const stateRaw = clean(f[iState]);
    const stateMissing = stateRaw === '' || stateRaw.toUpperCase() === 'NA';

    const existing = byPin.get(pincode);
    if (!existing) {
      byPin.set(pincode, {
        pincode,
        stateRaw,
        district: cleanNullable(f[iDistrict]),
        circle: cleanNullable(f[iCircle]),
        region: cleanNullable(f[iRegion]),
      });
      continue;
    }
    // Upgrade a previously-stored 'NA'-state representative to a real one.
    const existingMissing = existing.stateRaw === '' || existing.stateRaw.toUpperCase() === 'NA';
    if (existingMissing && !stateMissing) {
      byPin.set(pincode, {
        pincode,
        stateRaw,
        district: cleanNullable(f[iDistrict]),
        circle: cleanNullable(f[iCircle]),
        region: cleanNullable(f[iRegion]),
      });
    }
  }

  const outLines: string[] = [];
  const distinctStates = new Set<string>();
  const unknownStates = new Set<string>();
  let droppedNoState = 0;
  let metroCount = 0;
  let remoteCount = 0;

  for (const row of byPin.values()) {
    const stateMissing = row.stateRaw === '' || row.stateRaw.toUpperCase() === 'NA';
    if (stateMissing) {
      droppedNoState++; // NA-only pincode — unclassifiable, drop it
      continue;
    }
    const state = normalizeState(row.stateRaw);
    distinctStates.add(state);
    if (!KNOWN_STATES.has(state)) {
      unknownStates.add(state);
      continue; // collect for the assertion below
    }
    const is_metro = METRO_PREFIXES.has(row.pincode.slice(0, 3));
    const is_remote = REMOTE_STATES.has(state);
    if (is_metro) metroCount++;
    if (is_remote) remoteCount++;
    outLines.push(
      JSON.stringify({
        pincode: row.pincode,
        state,
        district: row.district,
        circle: row.circle,
        region: row.region,
        is_metro,
        is_remote,
      }),
    );
  }

  // Pitfall A guard (T-6-04): every distinct normalized state must be canonical.
  if (unknownStates.size > 0) {
    console.error(`FAIL: ${unknownStates.size} un-canonical state value(s) — not in the known set:`);
    for (const s of [...unknownStates].sort()) console.error(`  - "${s}"`);
    process.exit(1);
  }

  writeFileSync(OUT_PATH, outLines.join('\n') + '\n', 'utf8');

  console.log(
    `OK: ${dataRows} data rows → ${byPin.size} unique pincodes → ` +
      `${outLines.length} written (${droppedNoState} dropped as state-less); ` +
      `${distinctStates.size} distinct states; ${metroCount} metro, ${remoteCount} remote.`,
  );
  process.exit(0);
}

main();
