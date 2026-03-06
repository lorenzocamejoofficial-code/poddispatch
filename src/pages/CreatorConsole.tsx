import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Building2, Search, CheckCircle2, Ban, RefreshCw, Loader2, Trash2, KeyRound, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreatorLayout } from "@/components/layout/CreatorLayout";

interface CompanyRecord {
  id: string;
  name: string;
  onboarding_status: string;
  owner_email: string | null;
  created_at: string;
  approved_at: string | null;
  suspended_reason: string | null;
  suspended_at: string | null;
  rejected_reason: string | null;
  deleted_at: string | null;
}

const isSoftDeleted = (c: CompanyRecord) =>
  !!c.deleted_at && c.suspended_reason?.startsWith("SOFT_DELETED:");


type ModalAction = 
  | { type: "suspend"; company: CompanyRecord }
  | { type: "soft_delete"; company: CompanyRecord }
  | { type: "delete"; company: CompanyRecord }
  | { type: "edit"; company: CompanyRecord }
  | { type: "reset_password"; company: CompanyRecord }
  | null;

export default function CreatorConsole() {
  const { user, isSystemCreator } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modal, setModal] = useState<ModalAction>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (!isSystemCreator) { navigate("/"); return; }
    loadCompanies();
  }, [isSystemCreator, navigate]);

  const loadCompanies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("id, name, onboarding_status, owner_email, created_at, approved_at, suspended_reason, suspended_at, rejected_reason, deleted_at")
      .order("created_at", { ascending: false });
    setCompanies((data as unknown as CompanyRecord[]) ?? []);
    setLoading(false);
  };

  const invokeAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!modal) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: { companyId: modal.company.id, action, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === "force_password_reset" && data?.reset_link) {
        toast.success("Password reset link generated. Check audit logs.");
      } else {
        toast.success("Action completed successfully.");
      }
      setModal(null);
      setConfirmText("");
      setReasonText("");
      await loadCompanies();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
    setActionLoading(false);
  };

  const filtered = (status: string) =>
    companies.filter((c) => {
      if (c.onboarding_status !== status) return false;
      const q = search.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || (c.owner_email ?? "").toLowerCase().includes(q);
    });

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]",
      pending_approval: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
      suspended: "bg-destructive/15 text-destructive",
      rejected: "bg-destructive/15 text-destructive",
    };
    return colors[s] || "bg-muted text-muted-foreground";
  };

  const CompanyTable = ({ items }: { items: CompanyRecord[] }) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">No companies in this category.</p>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Owner Email</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{c.owner_email || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusBadge(c.onboarding_status)}>
                  {c.onboarding_status.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  {/* Pending actions */}
                  {c.onboarding_status === "pending_approval" && (
                    <Button size="sm" variant="default" className="gap-1 text-xs" onClick={() => invokeDirectApprove(c.id)}>
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </Button>
                  )}

                  {/* Active actions */}
                  {c.onboarding_status === "active" && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive" onClick={() => { setModal({ type: "suspend", company: c }); setReasonText(""); setConfirmText(""); }}>
                        <Ban className="h-3 w-3" /> Suspend
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => { setModal({ type: "soft_delete", company: c }); setReasonText(""); setConfirmText(""); }}>
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </>
                  )}

                  {/* Suspended actions */}
                  {c.onboarding_status === "suspended" && !isSoftDeleted(c) && (
                    <Button size="sm" variant="default" className="gap-1 text-xs" onClick={() => invokeDirectUnsuspend(c.id)}>
                      <RefreshCw className="h-3 w-3" /> Unsuspend
                    </Button>
                  )}

                  {/* Soft-deleted actions */}
                  {isSoftDeleted(c) && (
                    <>
                      <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                        Marked for deletion
                      </Badge>
                      <Button size="sm" variant="default" className="gap-1 text-xs" onClick={() => invokeDirectRestore(c.id)}>
                        <RefreshCw className="h-3 w-3" /> Restore
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => { setModal({ type: "delete", company: c }); setConfirmText(""); }}>
                        <Trash2 className="h-3 w-3" /> Delete Forever
                      </Button>
                    </>
                  )}

                  {/* Common actions for active/suspended (not soft-deleted) */}
                  {(c.onboarding_status === "active" || (c.onboarding_status === "suspended" && !isSoftDeleted(c))) && (
                    <>
                      <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => { setModal({ type: "reset_password", company: c }); setConfirmText(""); }}>
                        <KeyRound className="h-3 w-3" /> Reset PW
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => { setModal({ type: "edit", company: c }); setEditName(c.name); }}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                    </>
                  )}

                  {/* Delete for pending/rejected only */}
                  {(c.onboarding_status === "pending_approval" || c.onboarding_status === "rejected") && (
                    <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => { setModal({ type: "delete", company: c }); setConfirmText(""); }}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const invokeDirectApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", { body: { companyId: id, action: "approve" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Company approved!");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message); }
    setActionLoading(false);
  };

  const invokeDirectUnsuspend = async (id: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", { body: { companyId: id, action: "unsuspend" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Company reactivated!");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message); }
    setActionLoading(false);
  };

  const invokeDirectRestore = async (id: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", { body: { companyId: id, action: "restore" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Company restored from deletion!");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message); }
    setActionLoading(false);
  };

  return (
    <CreatorLayout title="Company Console">
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by company name or email..." className="pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading companies...
        </div>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending {filtered("pending_approval").length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{filtered("pending_approval").length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="active">Active ({filtered("active").length})</TabsTrigger>
            <TabsTrigger value="suspended">
              Suspended {filtered("suspended").length > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">{filtered("suspended").length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({filtered("rejected").length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card><CardContent className="pt-4"><CompanyTable items={filtered("pending_approval")} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="active">
            <Card><CardContent className="pt-4"><CompanyTable items={filtered("active")} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="suspended">
            <Card><CardContent className="pt-4"><CompanyTable items={filtered("suspended")} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="rejected">
            <Card><CardContent className="pt-4"><CompanyTable items={filtered("rejected")} /></CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Suspend Modal */}
      <Dialog open={modal?.type === "suspend"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Company</DialogTitle>
            <DialogDescription>Suspend "{modal?.company.name}" — all users will be locked out until unsuspended.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Reason for suspension (required)..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="h-20" />
            <p className="text-xs text-muted-foreground">Type <strong>OVERRIDE</strong> to confirm:</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="OVERRIDE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "OVERRIDE" || !reasonText.trim() || actionLoading} onClick={() => invokeAction("suspend", { reason: reasonText.trim() })}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Modal */}
      <Dialog open={modal?.type === "soft_delete"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription>
              "{modal?.company.name}" will be marked for deletion and hidden from login. You have a 30-day recovery window to restore it before permanent deletion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Reason for deletion (required)..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="h-20" />
            <p className="text-xs text-muted-foreground">Type <strong>OVERRIDE</strong> to confirm:</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="OVERRIDE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "OVERRIDE" || !reasonText.trim() || actionLoading} onClick={() => invokeAction("soft_delete", { reason: reasonText.trim() })}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Mark for Deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={modal?.type === "delete"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Company Permanently</DialogTitle>
            <DialogDescription>This will permanently delete "{modal?.company.name}" and all associated data. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Type <strong>CONFIRM</strong> to proceed:</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CONFIRM" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "CONFIRM" || actionLoading} onClick={() => invokeAction("delete", { reason: "Deleted by system creator" })}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={modal?.type === "reset_password"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Owner Password Reset</DialogTitle>
            <DialogDescription>Generate a password reset link for the owner of "{modal?.company.name}" ({modal?.company.owner_email}). A reset email will be triggered.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Type <strong>OVERRIDE</strong> to confirm:</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="OVERRIDE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button disabled={confirmText !== "OVERRIDE" || actionLoading} onClick={() => invokeAction("force_password_reset")}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Send Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Modal */}
      <Dialog open={modal?.type === "edit"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company Profile</DialogTitle>
            <DialogDescription>Update company details for "{modal?.company.name}".</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button disabled={!editName.trim() || actionLoading} onClick={() => invokeAction("update_profile", { patch: { name: editName.trim() } })}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorLayout>
  );
}
