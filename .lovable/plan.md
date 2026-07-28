Plan
====
1. Edit only `src/pages/CompanySignup.tsx`.
2. Replace the catch block at lines 215-223 with the simplified version below.

Before:
```ts
    } catch (err: any) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("already") && (msg.includes("exist") || msg.includes("register"))) {
        setEmailExists(true);
        setStep("info");
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
    }
```

After:
```ts
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    }
```

3. Keep the earlier specific-code handling unchanged:
   - `body.code === "email_exists"` still sets `emailExists(true)` and `setStep("info")`.
   - `body.code === "npi_exists"` still throws `new Error("A company with this NPI is already registered.")`.

4. Verify the NPI duplicate path now surfaces as a normal error toast/UI instead of the email-exists panel.

Scope: one file, one block. No edge-function, employee, or routing changes.