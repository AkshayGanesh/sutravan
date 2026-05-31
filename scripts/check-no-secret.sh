#!/usr/bin/env bash
# Secret-leak guard (threat T-01-SECRET): the service_role key must NEVER reach
# the public client bundle. Vite inlines only VITE_*-prefixed env, so a correctly
# configured project leaves no service_role token in dist/. This builds the bundle
# and fails if "service_role" appears anywhere in the output.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[check-no-secret] building bundle..."
npm run build

echo "[check-no-secret] scanning dist/ for service_role..."
if grep -rIl "service_role" dist/ 2>/dev/null; then
  echo "FAIL: 'service_role' found in built bundle (dist/). A secret key leaked into the public client." >&2
  exit 1
fi

echo "PASS: no service_role token in dist/."
exit 0
