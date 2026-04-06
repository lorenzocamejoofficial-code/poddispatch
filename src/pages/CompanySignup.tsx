import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Truck, ArrowLeft, Shield, FileText, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { US_STATES } from "@/lib/us-states";

const AGREEMENTS = [
  {
    key: "terms_of_service",
    label: "I agree to the",
    linkText: "Terms of Service",
    linkTab: "terms",
    icon: FileText,
    summary:
      "You agree to use PodDispatch in accordance with our operating guidelines, acceptable use policies, and service limitations.",
  },
  {
    key: "privacy_policy",
    label: "I agree to the",
    linkText: "Privacy Policy",
    linkTab: "privacy",
    icon: Lock,
    summary:
      "We collect only the data necessary to provide the service. Your company's patient data is encrypted and never shared with third parties.",
  },
  {
    key: "hipaa_responsibilities",
    label: "I accept the",
    linkText: "Customer Security & HIPAA Responsibilities",
    linkTab: "baa",
    icon: Shield,
    summary:
      "You acknowledge your responsibility to maintain HIPAA compliance within your organization, including proper user access controls, device security, and workforce training.",
  },
] as const;

export default function CompanySignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"info" | "profile" | "agreements" | "confirm">("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailExists, setEmailExists] = useState(false);

  // Step 1: Account fields
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Company profile fields
  const [npiNumber, setNpiNumber] = useState("");
  const [stateOfOperation, setStateOfOperation] = useState("");
  const [serviceAreaType, setServiceAreaType] = useState("");
  const [truckCount, setTruckCount] = useState("");
  const [payerMix, setPayerMix] = useState({ medicare: 40, medicaid: 30, facility: 20, private: 10 });

  // Optional context fields
  const [currentSoftware, setCurrentSoftware] = useState("");
  const [yearsInOperation, setYearsInOperation] = useState("");
  const [hasInhouseBiller, setHasInhouseBiller] = useState(false);
  const [hipaaPrivacyOfficer, setHipaaPrivacyOfficer] = useState("");

  // Agreements
  const [accepted, setAccepted] = useState<Record<string, boolean>>({
    terms_of_service: false,
    privacy_policy: false,
    hipaa_responsibilities: false,
  });

  const allAccepted = AGREEMENTS.every((a) => accepted[a.key]);
  const payerTotal = payerMix.medicare + payerMix.medicaid + payerMix.facility + payerMix.private;

  const validateInfo = () => {
    setError("");
    setEmailExists(false);
    if (!companyName.trim()) return setError("Company name is required.");
    if (!fullName.trim()) return setError("Your full name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (!password || password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setStep("profile");
  };

  const validateProfile = () => {
    setError("");
    if (!npiNumber.trim()) return setError("NPI number is required.");
    if (npiNumber.trim().length !== 10 || !/^\d{10}$/.test(npiNumber.trim()))
      return setError("NPI number must be exactly 10 digits.");
    if (!stateOfOperation) return setError("State of operation is required.");
    if (!serviceAreaType) return setError("Service area type is required.");
    if (!truckCount || parseInt(truckCount) < 1) return setError("Number of active trucks is required.");
    if (payerTotal !== 100) return setError(`Payer mix must add up to 100%. Currently ${payerTotal}%.`);
    setStep("agreements");
  };

  const updatePayerSlider = (key: keyof typeof payerMix, value: number) => {
    setPayerMix(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setError("");
    setEmailExists(false);
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
            clientIp: null,
            npiNumber: npiNumber.trim(),
            stateOfOperation,
            serviceAreaType,
            truckCount: parseInt(truckCount),
            payerMix,
            currentSoftware: currentSoftware || null,
            yearsInOperation: yearsInOperation ? parseInt(yearsInOperation) : null,
            hasInhouseBiller,
            hipaaPrivacyOfficer: hipaaPrivacyOfficer.trim() || null,
          },
        }
      );

      if (fnError) {
        try {
          const body = JSON.parse(fnError.message);
          if (body?.code === "email_exists") {
            setEmailExists(true);
            setStep("info");
            setLoading(false);
            return;
          }
          throw new Error(body?.error || fnError.message);
        } catch {
          throw new Error(fnError.message);
        }
      }

      if (data?.error) {
        if (data?.code === "email_exists") {
          setEmailExists(true);
          setStep("info");
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw new Error(signInError.message);
      navigate("/pending-approval");
    } catch (err: any) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("already") && (msg.includes("exist") || msg.includes("register"))) {
        setEmailExists(true);
        setStep("info");
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
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

        {emailExists && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <p>An account with this email already exists. Please sign in instead.</p>
            <Link
              to={`/login?email=${encodeURIComponent(email.trim())}`}
              className="mt-2 inline-block font-medium text-primary hover:underline"
            >
              Go to Sign In →
            </Link>
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex gap-1 mb-6">
          {["info", "profile", "agreements", "confirm"].map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
              ["info", "profile", "agreements", "confirm"].indexOf(step) >= i
                ? "bg-primary"
                : "bg-muted"
            }`} />
          ))}
        </div>

        {/* Step 1: Account Info */}
        {step === "info" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Step 1 of 4 — Account Information</p>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Ambulance LLC" />
            </div>
            <div className="space-y-2">
              <Label>Your Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
            </div>
            <Button className="w-full" onClick={validateInfo}>Continue</Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        )}

        {/* Step 2: Company Profile */}
        {step === "profile" && (
          <div className="space-y-4">
            <button onClick={() => setStep("info")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <p className="text-sm font-medium text-foreground">Step 2 of 4 — Company Profile</p>

            <div className="space-y-2">
              <Label>NPI Number *</Label>
              <Input value={npiNumber} onChange={(e) => setNpiNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="1234567890" maxLength={10} />
              <p className="text-xs text-muted-foreground">Your 10-digit National Provider Identifier</p>
            </div>

            <div className="space-y-2">
              <Label>State of Operation *</Label>
              <Select value={stateOfOperation} onValueChange={setStateOfOperation}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service Area Type *</Label>
              <Select value={serviceAreaType} onValueChange={setServiceAreaType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urban">Urban</SelectItem>
                  <SelectItem value="suburban">Suburban</SelectItem>
                  <SelectItem value="rural">Rural</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determines which Medicare rate tier applies</p>
            </div>

            <div className="space-y-2">
              <Label>Number of Active Trucks *</Label>
              <Input type="number" min="1" max="200" value={truckCount} onChange={(e) => setTruckCount(e.target.value)} placeholder="e.g. 5" />
            </div>

            <div className="space-y-3">
              <Label>Primary Payer Mix *</Label>
              <p className="text-xs text-muted-foreground">
                Approximate percentage of revenue by payer type. Must total 100%.
                {payerTotal !== 100 && (
                  <span className="text-destructive font-medium"> Currently {payerTotal}%</span>
                )}
                {payerTotal === 100 && (
                  <span className="text-[hsl(var(--status-green))] font-medium"> ✓ 100%</span>
                )}
              </p>
              {(["medicare", "medicaid", "facility", "private"] as const).map(key => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize">{key === "private" ? "Private Pay" : key === "facility" ? "Facility Contract" : key}</span>
                    <span className="font-medium">{payerMix[key]}%</span>
                  </div>
                  <Slider
                    value={[payerMix[key]]}
                    onValueChange={([v]) => updatePayerSlider(key, v)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            {/* Optional context fields */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Optional — helps us review your application faster</p>

              <div className="space-y-2">
                <Label>Current Software</Label>
                <Select value={currentSoftware} onValueChange={setCurrentSoftware}>
                  <SelectTrigger><SelectValue placeholder="Select current software" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="angeltrack">AngelTrack</SelectItem>
                    <SelectItem value="zoll">Zoll</SelectItem>
                    <SelectItem value="manual_spreadsheet">Manual / Spreadsheet</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Years in Operation</Label>
                <Input type="number" min="0" max="100" value={yearsInOperation} onChange={(e) => setYearsInOperation(e.target.value)} placeholder="e.g. 5" />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox checked={hasInhouseBiller} onCheckedChange={(v) => setHasInhouseBiller(v === true)} id="inhouse-biller" />
                <Label htmlFor="inhouse-biller" className="cursor-pointer text-sm">We have an in-house biller</Label>
              </div>

              <div className="space-y-2">
                <Label>HIPAA Privacy Officer Name</Label>
                <Input value={hipaaPrivacyOfficer} onChange={(e) => setHipaaPrivacyOfficer(e.target.value)} placeholder="Full name" />
              </div>
            </div>

            <Button className="w-full" onClick={validateProfile}>Continue to Agreements</Button>
          </div>
        )}

        {/* Step 3: Legal Agreements */}
        {step === "agreements" && (
          <div className="space-y-4">
            <button onClick={() => setStep("profile")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <p className="text-sm font-medium text-foreground">Step 3 of 4 — Legal Agreements</p>

            <div className="space-y-3">
              {AGREEMENTS.map((agreement) => (
                <div key={agreement.key} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={agreement.key}
                      checked={accepted[agreement.key]}
                      onCheckedChange={(v) => setAccepted((prev) => ({ ...prev, [agreement.key]: v === true }))}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor={agreement.key} className="text-sm font-medium cursor-pointer">
                        {agreement.label}{" "}
                        <a
                          href={`/legal?tab=${agreement.linkTab}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {agreement.linkText}
                        </a>
                      </Label>
                      <Collapsible>
                        <CollapsibleTrigger className="text-xs text-primary hover:underline mt-1">View summary</CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 text-xs text-muted-foreground">{agreement.summary}</CollapsibleContent>
                      </Collapsible>
                    </div>
                    <agreement.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </div>
              ))}
            </div>

            <Button className="w-full" disabled={!allAccepted} onClick={() => setStep("confirm")}>Continue to Review</Button>
          </div>
        )}

        {/* Step 4: Final Confirmation */}
        {step === "confirm" && (
          <div className="space-y-4">
            <button onClick={() => setStep("agreements")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <p className="text-sm font-medium text-foreground">Step 4 of 4 — Review & Submit</p>

            <div className="rounded-lg border bg-card p-4 space-y-3 text-sm">
              <h3 className="font-semibold text-foreground">Review Your Signup</h3>
              <div className="space-y-1 text-muted-foreground">
                <p><span className="text-foreground font-medium">Company:</span> {companyName}</p>
                <p><span className="text-foreground font-medium">Owner:</span> {fullName}</p>
                <p><span className="text-foreground font-medium">Email:</span> {email}</p>
                <p><span className="text-foreground font-medium">NPI:</span> {npiNumber}</p>
                <p><span className="text-foreground font-medium">State:</span> {US_STATES.find(s => s.value === stateOfOperation)?.label}</p>
                <p><span className="text-foreground font-medium">Service Area:</span> {serviceAreaType}</p>
                <p><span className="text-foreground font-medium">Trucks:</span> {truckCount}</p>
                <p><span className="text-foreground font-medium">Payer Mix:</span> Medicare {payerMix.medicare}% / Medicaid {payerMix.medicaid}% / Facility {payerMix.facility}% / Private {payerMix.private}%</p>
                {currentSoftware && <p><span className="text-foreground font-medium">Current Software:</span> {currentSoftware}</p>}
                {yearsInOperation && <p><span className="text-foreground font-medium">Years in Operation:</span> {yearsInOperation}</p>}
                <p><span className="text-foreground font-medium">In-house Biller:</span> {hasInhouseBiller ? "Yes" : "No"}</p>
                {hipaaPrivacyOfficer && <p><span className="text-foreground font-medium">HIPAA Privacy Officer:</span> {hipaaPrivacyOfficer}</p>}
                <p><span className="text-foreground font-medium">Plan:</span> PodDispatch Standard (Build Mode — No Payment Required)</p>
              </div>
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground">
                  ✅ Terms of Service accepted<br />
                  ✅ Privacy Policy accepted<br />
                  ✅ HIPAA Responsibilities accepted
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What happens next:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Your account and company will be created</li>
                <li>Your account will be reviewed and activated by the PodDispatch team</li>
                <li>After approval, a guided setup wizard will help you get operational</li>
              </ol>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={loading}>
              {loading ? "Creating account..." : "Create Company & Continue"}
            </Button>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/legal?tab=terms" className="hover:underline">Terms of Service</a>
          <span className="mx-1.5">·</span>
          <a href="/legal?tab=privacy" className="hover:underline">Privacy Policy</a>
          <span className="mx-1.5">·</span>
          <a href="mailto:support@poddispatch.com" className="hover:underline">Contact</a>
        </div>
      </div>
    </div>
  );
}
