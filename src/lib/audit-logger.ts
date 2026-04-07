import { supabase } from "@/integrations/supabase/client";

type AuditAction = "view" | "edit" | "delete" | "export" | "duplicate_override" | "incident_report" | "vehicle_inspection" | "edi_837p_export" | "emergency_billing_accept" | "emergency_billing_override" | "emergency_billing_escalate" | "emergency_upgrade" | "emergency_void" | "emergency_resolve" | "dispatcher_cancellation" | "cancellation_documented";

export async function logAuditEvent({
  action,
  tableName,
  recordId,
  oldData,
  newData,
  notes,
}: {
  action: AuditAction;
  tableName: string;
  recordId?: string;
  oldData?: any;
  newData?: any;
  notes?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    await supabase.from("audit_logs").insert({
      action,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      company_id: companyId,
      table_name: tableName,
      record_id: recordId ?? null,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      notes: notes ?? null,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
