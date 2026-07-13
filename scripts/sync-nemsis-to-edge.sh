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
echo "NEMSIS exporter synced to supabase/functions/_shared/"