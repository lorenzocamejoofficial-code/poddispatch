import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ExternalLink, Loader2, Shield, FolderOpen, Zap, Eye, EyeOff,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

interface ClearinghouseRow {
  id: string;
  company_id: string;
  sftp_username: string | null;
  sftp_password_encrypted: string | null;
  outbound_folder: string;
  inbound_folder: string;
  is_configured: boolean;
  is_active: boolean;
  auto_send_enabled: boolean;
  auto_receive_enabled: boolean;
  last_send_at: string | null;
  last_receive_at: string | null;
  last_error: string | null;
}

export function ClearinghouseSettings() {
  const { activeCompanyId } = useAuth();
  const [settings, setSettings] = useState<ClearinghouseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState<Step>(1);

  // Step 1
  const [accountCreated, setAccountCreated] = useState(false);

  // Step 2
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "failed">("idle");

  // Step 3
  const [outbound, setOutbound] = useState("/upload");
  const [inbound, setInbound] = useState("/download");

  // Step 4
  const [autoSend, setAutoSend] = useState(false);
  const [autoReceive, setAutoReceive] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    loadSettings();
  }, [activeCompanyId]);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clearinghouse_settings" as any)
      .select("*")
      .eq("company_id", activeCompanyId!)
      .maybeSingle();

    if (data) {
      const row = data as any as ClearinghouseRow;
      setSettings(row);
      setUsername(row.sftp_username ?? "");
      setPassword(row.sftp_password_encrypted ?? "");
      setOutbound(row.outbound_folder);
      setInbound(row.inbound_folder);
      setAutoSend(row.auto_send_enabled);
      setAutoReceive(row.auto_receive_enabled);
      if (row.is_configured) {
        setAccountCreated(true);
        setConnectionStatus("success");
        setActiveStep(4);
      } else if (row.sftp_username) {
        setAccountCreated(true);
        setActiveStep(2);
      }
    }
    setLoading(false);
  };

  const saveStep = async (stepData: Record<string, any>) => {
    setSaving(true);
    try {
      if (settings) {
        await supabase
          .from("clearinghouse_settings" as any)
          .update(stepData)
          .eq("id", settings.id);
      } else {
        await supabase
          .from("clearinghouse_settings" as any)
          .insert({ company_id: activeCompanyId, ...stepData });
      }
      toast.success("Settings saved");
      await loadSettings();
    } catch {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  const testConnection = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Username and password are required");
      return;
    }
    setTesting(true);
    setConnectionStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke("test-officeally-connection", {
        body: { company_id: activeCompanyId, sftp_username: username, sftp_password: password },
      });
      if (error) throw error;
      if (data?.success) {
        setConnectionStatus("success");
        toast.success("Connection successful!");
        // Save credentials and mark configured
        await saveStep({
          sftp_username: username,
          sftp_password_encrypted: password,
          is_configured: true,
        });
      } else {
        setConnectionStatus("failed");
        toast.error(data?.error || "Connection failed");
      }
    } catch (err: any) {
      setConnectionStatus("failed");
      toast.error(err.message || "Connection test failed");
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const STEPS: { step: Step; label: string; icon: React.ReactNode }[] = [
    { step: 1, label: "Create Account", icon: <ExternalLink className="h-4 w-4" /> },
    { step: 2, label: "Account Credentials", icon: <Shield className="h-4 w-4" /> },
    { step: 3, label: "Configure Folders", icon: <FolderOpen className="h-4 w-4" /> },
    { step: 4, label: "Enable Automation", icon: <Zap className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Office Ally Integration</h3>
        <p className="text-sm text-muted-foreground">
          Connect your Office Ally account to automatically send claims and receive payment responses.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map(({ step, label, icon }, i) => {
          const isActive = activeStep === step;
          const isDone = activeStep > step || (step <= 2 && settings?.is_configured);
          return (
            <div key={step} className="flex items-center gap-1">
              <button
                onClick={() => setActiveStep(step)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))]"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone && !isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : icon}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{step}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-4 ${isDone ? "bg-[hsl(var(--status-green))]" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        {activeStep === 1 && (
          <>
            <h4 className="font-semibold text-foreground">Step 1 — Create your Office Ally account</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>Go to <strong>officeally.com</strong> and click <strong>Get Started</strong>.</li>
                <li>Select <strong>Provider</strong> as your account type.</li>
                <li>Enter your NPI number, practice name, and contact information.</li>
                <li>Complete registration.</li>
                <li>Check your email for confirmation.</li>
                <li>Once confirmed, come back here and continue.</li>
              </ol>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.officeally.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Office Ally
                </Button>
              </a>
            </div>
            <label className="flex items-center gap-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={accountCreated}
                onChange={(e) => setAccountCreated(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm text-foreground">I have created my Office Ally account</span>
            </label>
            <Button
              disabled={!accountCreated}
              onClick={() => setActiveStep(2)}
              size="sm"
            >
              Continue to Step 2
            </Button>
          </>
        )}

        {activeStep === 2 && (
          <>
            <h4 className="font-semibold text-foreground">Step 2 — Enter your Office Ally credentials</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>Log into your Office Ally account.</li>
                <li>Use the same username and password you use to sign into Office Ally.</li>
                <li>Enter your Office Ally account login credentials below.</li>
                <li>Click <strong>Test Connection</strong> to verify your credentials.</li>
              </ol>
            </div>
            <div className="grid gap-3 max-w-sm">
              <div className="space-y-1.5">
                <Label>Office Ally Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your Office Ally username"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Office Ally Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your Office Ally password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={testConnection} disabled={testing} size="sm" className="gap-2">
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                {testing ? "Testing..." : "Test Connection"}
              </Button>
              {connectionStatus === "success" && (
                <Badge className="bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
              )}
              {connectionStatus === "failed" && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Connection Failed
                </Badge>
              )}
            </div>
            {connectionStatus === "success" && (
              <Button onClick={() => setActiveStep(3)} size="sm">
                Continue to Step 3
              </Button>
            )}
          </>
        )}

        {activeStep === 3 && (
          <>
            <h4 className="font-semibold text-foreground">Step 3 — Configure your folders</h4>
            <p className="text-sm text-muted-foreground">
              Your outbound folder is where PodDispatch sends your 837P claim files. Your inbound folder is where
              Office Ally deposits your 835 payment response files. The default paths below are correct for most
              accounts. Only change these if Office Ally support tells you to use different paths.
            </p>
            <div className="grid gap-3 max-w-sm">
              <div className="space-y-1.5">
                <Label>Outbound Folder (837P claims)</Label>
                <Input value={outbound} onChange={(e) => setOutbound(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Inbound Folder (835 payments)</Label>
                <Input value={inbound} onChange={(e) => setInbound(e.target.value)} />
              </div>
            </div>
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                await saveStep({ outbound_folder: outbound, inbound_folder: inbound });
                setActiveStep(4);
              }}
            >
              {saving ? "Saving..." : "Save & Continue"}
            </Button>
          </>
        )}

        {activeStep === 4 && (
          <>
            <h4 className="font-semibold text-foreground">Step 4 — Enable automatic processing</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Automatic Claim Submission</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PodDispatch will automatically send new 837P files to Office Ally every 4 hours.
                  </p>
                </div>
                <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Automatic Payment Import</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PodDispatch will automatically check for new 835 payment files every 4 hours and import them.
                  </p>
                </div>
                <Switch checked={autoReceive} onCheckedChange={setAutoReceive} />
              </div>

              {/* Status info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Last Send</p>
                  <p className="font-medium text-foreground">
                    {settings?.last_send_at
                      ? new Date(settings.last_send_at).toLocaleString()
                      : "Never"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Last Receive</p>
                  <p className="font-medium text-foreground">
                    {settings?.last_receive_at
                      ? new Date(settings.last_receive_at).toLocaleString()
                      : "Never"}
                  </p>
                </div>
              </div>

              {settings?.last_error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive">Last Error</p>
                  <p className="text-xs text-destructive/80 mt-1">{settings.last_error}</p>
                </div>
              )}

              <Button
                size="sm"
                disabled={saving}
                onClick={async () => {
                  await saveStep({
                    auto_send_enabled: autoSend,
                    auto_receive_enabled: autoReceive,
                    is_active: autoSend || autoReceive,
                  });
                }}
              >
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
