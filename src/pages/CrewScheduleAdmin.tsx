import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, RefreshCw, Link2, Trash2, Truck, Users } from "lucide-react";
import { toast } from "sonner";

interface ShareToken {
  id: string;
  token: string;
  truck_id: string;
  truck_name: string;
  valid_from: string;
  valid_until: string;
  active: boolean;
}

export default function CrewScheduleAdmin() {
  const { user } = useAuth();
  const { trucks, selectedDate } = useSchedulingStore();
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [selectedTruck, setSelectedTruck] = useState("");

  const fetchTokens = useCallback(async () => {
    const { data } = await supabase
      .from("crew_share_tokens")
      .select("*, truck:trucks!crew_share_tokens_truck_id_fkey(name)")
      .eq("active", true)
      .order("created_at", { ascending: false });

    setTokens((data ?? []).map((t: any) => ({
      id: t.id,
      token: t.token,
      truck_id: t.truck_id,
      truck_name: t.truck?.name ?? "Unknown",
      valid_from: t.valid_from,
      valid_until: t.valid_until,
      active: t.active,
    })));
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const generateToken = async () => {
    if (!selectedTruck) { toast.error("Select a truck"); return; }

    // Calculate valid_until as tomorrow
    const validFrom = selectedDate;
    const until = new Date(selectedDate + "T12:00:00");
    until.setDate(until.getDate() + 1);
    const validUntil = until.toISOString().split("T")[0];

    const { error } = await supabase.from("crew_share_tokens").insert({
      truck_id: selectedTruck,
      valid_from: validFrom,
      valid_until: validUntil,
      created_by: user?.id,
    } as any);

    if (error) { toast.error("Failed to create share link"); return; }
    toast.success("Share link created");
    setSelectedTruck("");
    fetchTokens();
  };

  const revokeToken = async (id: string) => {
    await supabase.from("crew_share_tokens").update({ active: false } as any).eq("id", id);
    toast.success("Link revoked");
    fetchTokens();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/crew/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Generate new link */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Generate Crew Share Link
          </h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-xs">
              <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                <SelectContent>
                  {trucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateToken}>
              <Link2 className="mr-1.5 h-4 w-4" /> Generate Link
            </Button>
          </div>
        </section>

        {/* Active links */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Active Share Links
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchTokens}>
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {tokens.length === 0 && (
              <p className="text-sm text-muted-foreground">No active share links.</p>
            )}
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-card-foreground">{t.truck_name}</span>
                    <p className="text-xs text-muted-foreground">{t.valid_from} → {t.valid_until}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(t.token)}>
                    <Copy className="mr-1 h-3 w-3" /> Copy Link
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => revokeToken(t.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
