import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FacilitySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function FacilitySelect({ value, onChange }: FacilitySelectProps) {
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("facilities")
      .select("id, name")
      .eq("active", true)
      .order("name");
    setFacilities((data ?? []) as { id: string; name: string }[]);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <Select value={value || "none"} onValueChange={v => onChange(v === "none" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select facility…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— None —</SelectItem>
        {facilities.map(f => (
          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
