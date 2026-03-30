import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PartnerInfo {
  partnerName: string;
  loading: boolean;
}

export function useCrewPartner(): PartnerInfo {
  const { profileId } = useAuth();
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(true);

  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  const fetchPartner = useCallback(async () => {
    if (!profileId) { setLoading(false); return; }

    const { data: crewRow } = await supabase
      .from("crews")
      .select("member1_id, member2_id, member3_id, member1:profiles!crews_member1_id_fkey(id, full_name), member2:profiles!crews_member2_id_fkey(id, full_name), member3:profiles!crews_member3_id_fkey(id, full_name)")
      .eq("active_date", today)
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
      .maybeSingle();

    if (!crewRow) {
      setPartnerName("");
    } else {
      const allMembers = [crewRow.member1, crewRow.member2, crewRow.member3]
        .filter(Boolean) as Array<{ id: string; full_name: string }>;
      const partners = allMembers
        .filter((m) => m.id !== profileId)
        .map((m) => m.full_name);
      setPartnerName(partners.join(" & ") || "");
    }
    setLoading(false);
  }, [profileId, today]);

  useEffect(() => {
    fetchPartner();

    const channel = supabase
      .channel(`crew-partner-${today}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crews" }, () => fetchPartner())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPartner, today]);

  return { partnerName, loading };
}
