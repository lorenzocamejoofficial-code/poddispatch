import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, ArrowLeft, Shield, FileText, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const AGREEMENTS = [
  {
    key: "terms_of_service",
    label: "I agree to the Terms of Service",
    icon: FileText,
    summary:
      "You agree to use PodDispatch in accordance with our operating guidelines, acceptable use policies, and service limitations.",
  },
  {
    key: "privacy_policy",
    label: "I agree to the Privacy Policy",
    icon: Lock,
    summary:
      "We collect only the data necessary to provide the service. Your company's patient data is encrypted and never shared with third parties.",
  },
  {
    key: "hipaa_responsibilities",
    label: "I accept the Customer Security & HIPAA Responsibilities",
    icon: Shield,
    summary:
      "You acknowledge your responsibility to maintain HIPAA compliance within your organization, including proper user access controls, device security, and workforce training.",
  },
] as const;

export default function CompanySignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"info" | "agreements" | "confirm">("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Agreements
  const [accepted, setAccepted] = useState<Record<string, boolean>>({
    terms_of_service: false,
    privacy_policy: false,
    hipaa_responsibilities: false,
  });

  const allAccepted = AGREEMENTS.every((a) => accepted[a.key]);

  const validateInfo = () => {
    setError("");
    if (!companyName.trim()) return setError("Company name is required.");
    if (!fullName.trim()) return setError("Your full name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (!password || password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setStep("agreements");
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "company-signup",
        {
          body: {
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            companyName: companyName.trim(),
            phone: phone.trim() || null,
            agreements: accepted,
            clientIp: null, // Could fetch from external service
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      // Auto-login the newly created user so they don't have to sign in manually
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw new Error(signInError.message);

      // Auth state change will trigger useAuth which routes pending companies to /pending-approval
      navigate("/pending-approval");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create Your Company
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            PodDispatch Standard
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Company Info */}
        {step === "info" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Ambulance LLC"
              />
            </div>
            <div className="space-y-2">
              <Label>Your Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            <Button className="w-full" onClick={validateInfo}>
              Continue to Agreements
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* Step 2: Legal Agreements */}
        {step === "agreements" && (
          <div className="space-y-4">
            <button
              onClick={() => setStep("info")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to info
            </button>

            <div className="space-y-3">
              {AGREEMENTS.map((agreement) => (
                <div
                  key={agreement.key}
                  className="rounded-lg border bg-card p-4 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={agreement.key}
                      checked={accepted[agreement.key]}
                      onCheckedChange={(v) =>
                        setAccepted((prev) => ({
                          ...prev,
                          [agreement.key]: v === true,
                        }))
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={agreement.key}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {agreement.label}
                      </Label>
                      <Collapsible>
                        <CollapsibleTrigger className="text-xs text-primary hover:underline mt-1">
                          View summary
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 text-xs text-muted-foreground">
                          {agreement.summary}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                    <agreement.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              disabled={!allAccepted}
              onClick={() => setStep("confirm")}
            >
              Continue to Review
            </Button>
          </div>
        )}

        {/* Step 3: Final Confirmation */}
        {step === "confirm" && (
          <div className="space-y-4">
            <button
              onClick={() => setStep("agreements")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to agreements
            </button>

            <div className="rounded-lg border bg-card p-4 space-y-3 text-sm">
              <h3 className="font-semibold text-foreground">Review Your Signup</h3>
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <span className="text-foreground font-medium">Company:</span>{" "}
                  {companyName}
                </p>
                <p>
                  <span className="text-foreground font-medium">Owner:</span>{" "}
                  {fullName}
                </p>
                <p>
                  <span className="text-foreground font-medium">Email:</span>{" "}
                  {email}
                </p>
                <p>
                  <span className="text-foreground font-medium">Plan:</span>{" "}
                  PodDispatch Standard (Build Mode — No Payment Required)
                </p>
              </div>
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground">
                  ✅ Terms of Service accepted
                  <br />
                  ✅ Privacy Policy accepted
                  <br />
                  ✅ HIPAA Responsibilities accepted
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What happens next:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Your account and company will be created</li>
                <li>Your account will be reviewed and activated by the PodDispatch team</li>
              </ol>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Company & Continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
