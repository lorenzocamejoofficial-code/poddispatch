Plan: Fix authenticated deep-link routing for /login and /signup in src/App.tsx only.

Current state (verified in src/App.tsx lines 370-559):
- System creator branch has /login -> /system, but no /signup -> falls to NotFound (404).
- Owner/admin branch has /login -> /, but no /signup -> falls to NotFound (404).
- Dispatcher branch has /login -> /, catch-all -> /; /signup is not explicit.
- Biller branch has /login -> /, catch-all -> /; /signup is not explicit.
- Crew branch has no explicit /login or /signup; both currently fall through catch-all -> /.

Changes (only additions, no removals or alterations of existing routes):

1. System creator branch (~line 413): Add `<Route path="/signup" element={<Navigate to="/system" replace />} />` immediately after the existing /login redirect.
   - Redirect target: /system (matches that branch's /login target).

2. Owner/admin branch (~line 554): Add `<Route path="/signup" element={<Navigate to="/" replace />} />` immediately after the existing /login redirect.
   - Redirect target: / (matches that branch's /login target).

3. Dispatcher branch (~line 471): Add `<Route path="/signup" element={<Navigate to="/" replace />} />` immediately after the existing /login redirect.
   - Redirect target: / (matches that branch's /login target).

4. Biller branch (~line 505): Add `<Route path="/signup" element={<Navigate to="/" replace />} />` immediately after the existing /login redirect.
   - Redirect target: / (matches that branch's /login target).

5. Crew branch (~line 437): Add explicit `<Route path="/login" element={<Navigate to="/" replace />} />` and `<Route path="/signup" element={<Navigate to="/" replace />} />` before the catch-all.
   - Redirect target: / (matches that branch's home).

The unauthenticated branch is untouched. No new components are created. The catch-all routes for other unknown paths remain unchanged.

Deliverable confirmation by branch:
- System creator /signup -> /system
- Owner/admin /signup -> /
- Dispatcher /signup -> /
- Biller /signup -> /
- Crew /login -> /, /signup -> /