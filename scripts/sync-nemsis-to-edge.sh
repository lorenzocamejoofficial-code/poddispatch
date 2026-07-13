#!/usr/bin/env bash
# Sync the app-side NEMSIS exporter into supabase/functions/_shared so the
# submit-gemsis-pcr edge function can bundle it (Supabase's edge bundler only
# uploads files under supabase/functions/). Run after any edit to
# src/lib/nemsis/** or src/lib/nemsis-{code-sets,translate}.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p supabase/functions/_shared/nemsis/states
cp src/lib/nemsis-code-sets.ts        supabase/functions/_shared/nemsis-code-sets.ts
cp src/lib/nemsis-translate.ts        supabase/functions/_shared/nemsis-translate.ts
cp src/lib/nemsis/xml-utils.ts        supabase/functions/_shared/nemsis/xml-utils.ts
cp src/lib/nemsis/exporter.ts         supabase/functions/_shared/nemsis/exporter.ts
cp src/lib/nemsis/states/ga.ts        supabase/functions/_shared/nemsis/states/ga.ts

# Deno requires explicit .ts extensions on relative imports. The app source
# omits them (Vite/TS resolve without). Add them in the copies only.
add_ts_ext() {
  # Match `from "./foo"` or `from "../bar/baz"` (no extension) and append .ts.
  sed -i -E 's#(from "\.{1,2}/[^"]+)"#\1.ts"#g' "$1"
}
for f in \
  supabase/functions/_shared/nemsis-translate.ts \
  supabase/functions/_shared/nemsis/exporter.ts \
  supabase/functions/_shared/nemsis/states/ga.ts; do
  add_ts_ext "$f"
done

echo "NEMSIS exporter synced to supabase/functions/_shared/"