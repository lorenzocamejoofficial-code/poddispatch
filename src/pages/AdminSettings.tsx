import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminSettings() {
  const [companyName, setCompanyName] = useState("");
  const [settingsId, setSettingsId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("company_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setCompanyName(data.company_name);
        setSettingsId(data.id);
      }
    });
  }, []);

  const save = async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    await supabase.from("company_settings").update({ company_name: companyName.trim() }).eq("id", settingsId);
    toast.success("Company name updated");
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="max-w-md space-y-6">
        <div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">Company Settings</h3>
          <p className="text-sm text-muted-foreground">Manage your company display name and preferences.</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Company Display Name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
    </AdminLayout>
  );
}
