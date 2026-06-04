---
name: verify-before-done
description: Always click-test buttons and check edge function logs before claiming a feature is done. Spell out failure-mode behavior up front.
type: preference
---
Before telling the user a feature with buttons, edge functions, or external API calls is "done":

1. Open the preview and actually click every button/link added or changed.
2. Check edge function logs (supabase--edge_function_logs) for errors or timeouts on any function invoked.
3. Confirm failure cases show a real, actionable message — never silent "pending" or infinite spinners.
4. If something can't be tested (requires login, real PHI, paid API, etc.), say so explicitly and tell the user exactly what to verify on their end.
5. In the closing message, state what was tested and what was not.

When designing a new feature, proactively ask/decide:
- Where the user clicks it
- What success looks like (visible state)
- What failure looks like (visible state + recovery action)
- Timeout / retry behavior for any network call

**Why:** User repeatedly finds broken buttons, edge function errors, and cosmetic-only features after I claim work is complete. This erodes trust and risks their HIPAA-regulated business.
