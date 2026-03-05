import { Button } from "@/components/ui/button";
import { Truck, ArrowLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export default function ForgotEmail() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Find Your Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We can help you recover access to your account.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground space-y-2">
                <p>For security reasons, we cannot look up email addresses through this form.</p>
                <p><strong className="text-foreground">Try these steps:</strong></p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Check for the original invitation email from your company</li>
                  <li>Ask your company owner or dispatcher for your login email</li>
                  <li>Contact your company admin to resend your invite</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground text-center">
            <p className="font-medium mb-1">Still can't find your email?</p>
            <p>
              Contact your company owner/admin or reach out to{" "}
              <span className="font-medium text-foreground">support@poddispatch.com</span>
            </p>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
