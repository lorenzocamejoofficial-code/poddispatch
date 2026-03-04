import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";
import { toast } from "sonner";

export default function CreateCompany() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!user) return;

    setCreating(true);

    const { data, error } = await supabase.functions.invoke("create-company", {
      body: {
        companyName: companyName.trim(),
        fullName: fullName.trim() || undefined,
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to create company");
      setCreating(false);
      return;
    }

    toast.success("Company created! Redirecting...");
    // Full reload to pick up new membership data
    setTimeout(() => { window.location.href = "/"; }, 500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Create Your Company</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your dispatch company to get started.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Your Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Medical Transport"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={creating}>
            {creating ? "Creating..." : "Create Company"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You'll be the owner and can invite team members afterward.
          </p>
        </form>
      </div>
    </div>
  );
}
