import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AccountSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation email sent to your new address. Check your inbox.");
      setNewEmail("");
    }
    setEmailLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-base font-semibold text-foreground">Account Settings</h1>
      </header>

      <div className="max-w-lg mx-auto p-4 lg:p-8 space-y-6">
        {/* Current info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </CardContent>
        </Card>

        {/* Change Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Change Email</CardTitle>
            <CardDescription className="text-xs">A confirmation link will be sent to both your current and new email addresses.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailChange} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-email" className="text-xs">New Email</Label>
                <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@company.com" />
              </div>
              <Button type="submit" size="sm" disabled={emailLoading || !newEmail.trim()}>
                {emailLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                Update Email
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Change Password</CardTitle>
            <CardDescription className="text-xs">Must be at least 8 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-xs">New Password</Label>
                <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-xs">Confirm Password</Label>
                <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" size="sm" disabled={pwLoading || !newPassword}>
                {pwLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Legal & Compliance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Legal & Compliance</CardTitle>
            <CardDescription className="text-xs">Terms of Service, Privacy Policy, BAA, Acceptable Use, Clearinghouse Disclaimer, Data Retention, and Incident Response.</CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="/legal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View Legal & Compliance documents →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
