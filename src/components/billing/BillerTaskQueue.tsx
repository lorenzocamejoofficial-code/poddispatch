import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle, Play, XCircle, Calendar, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

interface BillerTask {
  id: string;
  claim_id: string | null;
  task_type: string;
  priority: number;
  title: string;
  description: string | null;
  status: string;
  due_date: string;
  completed_at: string | null;
  dismiss_reason: string | null;
  // joined
  patient_name?: string;
  payer_name?: string;
}

const PRIORITY_CONFIG: Record<number, { label: string; variant: string; icon: React.ReactNode }> = {
  1: { label: "Critical", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
  2: { label: "Urgent", variant: "warning", icon: <Clock className="h-3 w-3" /> },
  3: { label: "Normal", variant: "secondary", icon: <Calendar className="h-3 w-3" /> },
  4: { label: "Low", variant: "outline", icon: <Calendar className="h-3 w-3" /> },
  5: { label: "Info", variant: "outline", icon: <Calendar className="h-3 w-3" /> },
};

export function BillerTaskQueue() {
  const { activeCompanyId, user } = useAuth();
  const [tasks, setTasks] = useState<BillerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissingTask, setDismissingTask] = useState<BillerTask | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!activeCompanyId) return;
    const statuses = showResolved
      ? ["pending", "in_progress", "completed", "dismissed"]
      : ["pending", "in_progress"];

    const { data } = await supabase
      .from("biller_tasks")
      .select("*")
      .eq("company_id", activeCompanyId)
      .in("status", statuses)
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true })
      .limit(200);

    if (!data?.length) { setTasks([]); setLoading(false); return; }

    // Join claim → patient info
    const claimIds = [...new Set((data as any[]).map((t: any) => t.claim_id).filter(Boolean))];
    let claimMap: Record<string, { patient_name: string; payer_name: string | null }> = {};

    if (claimIds.length > 0) {
      const { data: claims } = await supabase
        .from("claim_records")
        .select("id, patient_id, payer_name")
        .in("id", claimIds);

      const patientIds = [...new Set((claims ?? []).map((c: any) => c.patient_id).filter(Boolean))];
      let patientMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        const { data: patients } = await supabase
          .from("patients")
          .select("id, first_name, last_name")
          .in("id", patientIds);
        for (const p of patients ?? []) {
          patientMap[p.id] = `${p.first_name} ${p.last_name}`;
        }
      }

      for (const c of (claims ?? []) as any[]) {
        claimMap[c.id] = {
          patient_name: patientMap[c.patient_id] ?? "Unknown",
          payer_name: c.payer_name,
        };
      }
    }

    setTasks((data as any[]).map((t: any) => ({
      ...t,
      patient_name: t.claim_id ? claimMap[t.claim_id]?.patient_name : undefined,
      payer_name: t.claim_id ? claimMap[t.claim_id]?.payer_name : undefined,
    })));
    setLoading(false);
  }, [activeCompanyId, showResolved]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const startTask = async (task: BillerTask) => {
    setSaving(true);
    await supabase.from("biller_tasks").update({ status: "in_progress" } as any).eq("id", task.id);
    toast.success("Task started");
    await fetchTasks();
    setSaving(false);
  };

  const completeTask = async (task: BillerTask) => {
    setSaving(true);
    await supabase.from("biller_tasks").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user?.id ?? null,
    } as any).eq("id", task.id);
    toast.success("Task completed");
    await fetchTasks();
    setSaving(false);
  };

  const dismissTask = async () => {
    if (!dismissingTask || !dismissReason.trim()) return;
    setSaving(true);
    await supabase.from("biller_tasks").update({
      status: "dismissed",
      dismiss_reason: dismissReason.trim(),
    } as any).eq("id", dismissingTask.id);
    toast.success("Task dismissed");
    setDismissOpen(false);
    setDismissingTask(null);
    setDismissReason("");
    await fetchTasks();
    setSaving(false);
  };

  const activeTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const resolvedTasks = tasks.filter(t => t.status === "completed" || t.status === "dismissed");

  if (loading) return null;
  if (activeTasks.length === 0 && !showResolved) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          My Tasks
          {activeTasks.length > 0 && (
            <Badge variant="destructive" className="text-xs">{activeTasks.length}</Badge>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="show-resolved" className="text-xs text-muted-foreground">Show Resolved</Label>
          <Switch id="show-resolved" checked={showResolved} onCheckedChange={setShowResolved} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        These tasks were auto-generated based on claim activity. Working a claim in Today's Work does not automatically complete its task — mark tasks complete after you have taken action.
      </p>

      <div className="grid gap-2">
        {activeTasks.map(task => {
          const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[3];
          return (
            <Card key={task.id} className="border-l-4" style={{ borderLeftColor: task.priority <= 1 ? 'hsl(var(--destructive))' : task.priority <= 2 ? 'hsl(var(--status-yellow, 45 93% 47%))' : 'hsl(var(--muted-foreground))' }}>
              <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={pri.variant as any} className="text-[10px] gap-1">
                      {pri.icon}{pri.label}
                    </Badge>
                    {task.status === "in_progress" && (
                      <Badge variant="outline" className="text-[10px] text-primary">In Progress</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-1">{task.title}</p>
                  {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                  {task.patient_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {task.patient_name}{task.payer_name ? ` · ${task.payer_name}` : ""}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">Due: {task.due_date}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {task.status === "pending" && (
                    <Button variant="outline" size="sm" disabled={saving} onClick={() => startTask(task)} className="text-xs h-7 px-2">
                      <Play className="h-3 w-3 mr-1" />Start
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => completeTask(task)} className="text-xs h-7 px-2">
                    <CheckCircle className="h-3 w-3 mr-1" />Complete
                  </Button>
                  <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setDismissingTask(task); setDismissOpen(true); }} className="text-xs h-7 px-2 text-muted-foreground">
                    <XCircle className="h-3 w-3 mr-1" />Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {showResolved && resolvedTasks.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground pt-2">Resolved</p>
            {resolvedTasks.map(task => (
              <Card key={task.id} className="opacity-60">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{task.status}</Badge>
                    <p className="text-sm">{task.title}</p>
                  </div>
                  {task.dismiss_reason && <p className="text-xs text-muted-foreground mt-1">Reason: {task.dismiss_reason}</p>}
                  {task.patient_name && <p className="text-xs text-muted-foreground">{task.patient_name}</p>}
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Dismiss dialog */}
      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{dismissingTask?.title}</p>
          <Input
            value={dismissReason}
            onChange={e => setDismissReason(e.target.value)}
            placeholder="Reason for dismissing (required)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button disabled={!dismissReason.trim() || saving} onClick={dismissTask}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
