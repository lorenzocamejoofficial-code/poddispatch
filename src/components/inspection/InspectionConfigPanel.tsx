import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ClipboardCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { MASTER_INSPECTION_ITEMS, INSPECTION_CATEGORIES, getAllItemKeys } from "@/lib/vehicle-inspection-items";
import { cn } from "@/lib/utils";

interface Props {
  truckId: string;
  companyId: string;
}

export function InspectionConfigPanel({ truckId, companyId }: Props) {
  const [open, setOpen] = useState(false);
  const [gateEnabled, setGateEnabled] = useState(false);
  const [enabledItems, setEnabledItems] = useState<string[]>(getAllItemKeys());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      const { data } = await supabase
        .from("vehicle_inspection_templates" as any)
        .select("*")
        .eq("truck_id", truckId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        setGateEnabled((data as any).gate_enabled ?? false);
        const items = (data as any).enabled_items;
        if (Array.isArray(items) && items.length > 0) {
          setEnabledItems(items);
        }
      }
      setLoaded(true);
    })();
  }, [open, truckId, companyId, loaded]);

  const toggleItem = (key: string) => {
    setEnabledItems(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleCategory = (category: string) => {
    const catItems = MASTER_INSPECTION_ITEMS.filter(i => i.category === category).map(i => i.key);
    const allEnabled = catItems.every(k => enabledItems.includes(k));
    if (allEnabled) {
      setEnabledItems(prev => prev.filter(k => !catItems.includes(k)));
    } else {
      setEnabledItems(prev => [...new Set([...prev, ...catItems])]);
    }
  };

  const save = async () => {
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      company_id: companyId,
      truck_id: truckId,
      enabled_items: enabledItems,
      gate_enabled: gateEnabled,
      updated_by: user.user?.id ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("vehicle_inspection_templates" as any)
      .upsert(payload, { onConflict: "company_id,truck_id" });

    if (error) {
      toast.error("Failed to save inspection settings");
    } else {
      toast.success("Inspection settings saved");
    }
    setSaving(false);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full pl-6 pt-1">
          <ClipboardCheck className="h-3 w-3" />
          <span>Vehicle Inspection</span>
          <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-2 pt-2 space-y-3">
        {/* Gate toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Require inspection before PCR access</Label>
          <Switch checked={gateEnabled} onCheckedChange={setGateEnabled} />
        </div>

        {/* Categorized items */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2 bg-background">
          {INSPECTION_CATEGORIES.map(cat => {
            const catItems = MASTER_INSPECTION_ITEMS.filter(i => i.category === cat);
            const enabledCount = catItems.filter(i => enabledItems.includes(i.key)).length;
            return (
              <div key={cat}>
                <button
                  className="flex items-center gap-2 text-[11px] font-semibold text-foreground w-full hover:text-primary transition-colors"
                  onClick={() => toggleCategory(cat)}
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded accent-primary"
                    checked={enabledCount === catItems.length}
                    readOnly
                  />
                  {cat}
                  <span className="text-muted-foreground font-normal ml-auto">{enabledCount}/{catItems.length}</span>
                </button>
                <div className="pl-5 space-y-0.5 mt-0.5">
                  {catItems.map(item => (
                    <label key={item.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        className="h-2.5 w-2.5 rounded accent-primary"
                        checked={enabledItems.includes(item.key)}
                        onChange={() => toggleItem(item.key)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <Button size="sm" className="w-full h-7 text-xs" onClick={save} disabled={saving}>
          <Save className="h-3 w-3 mr-1" />
          {saving ? "Saving…" : "Save Inspection Settings"}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
