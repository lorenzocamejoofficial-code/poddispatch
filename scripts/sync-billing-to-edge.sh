#!/usr/bin/env bash
# Sync the app-side 835 remittance libraries into supabase/functions/_shared so
# the retrieve-remittance-officeally edge function can bundle them (Supabase's
# edge bundler only uploads files under supabase/functions/). Run after any edit
# to src/lib/edi-835-parser.ts, denial-code-translations.ts, payer-compliance.ts,
# remittance-match.ts, or remittance-post.ts.
#
# src/lib stays the SINGLE source of truth. The copies are generated artifacts.
# src/lib/remittance-parity.test.ts fails if a copy drifts from its source.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p supabase/functions/_shared

HEADER='// GENERATED FILE — DO NOT EDIT.'
HEADER2='// Source of truth: src/lib/%s — regenerate with scripts/sync-billing-to-edge.sh'

for f in edi-835-parser denial-code-translations payer-compliance remittance-match remittance-post; do
  out="supabase/functions/_shared/$f.ts"
  {
    echo "$HEADER"
    printf "$HEADER2\n" "$f.ts"
    cat "src/lib/$f.ts"
  } > "$out"
  # Deno requires explicit .ts extensions on relative imports; app source omits them.
  sed -i -E 's#(from "\.{1,2}/[^"]+)"#\1.ts"#g' "$out"
done

echo "Billing/835 libs synced to supabase/functions/_shared/"
