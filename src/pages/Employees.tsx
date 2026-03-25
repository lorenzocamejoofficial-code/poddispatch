import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Pencil, Trash2, Mail, Copy, Check, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  full_name: string;
  sex: string;
  cert_level: string;
  user_id: string;
  phone_number: string | null;
  active: boolean;
  role?: string;
  employment_type?: string;
  
  stair_chair_trained?: boolean;
  bariatric_trained?: boolean;
  oxygen_handling_trained?: boolean;
  lift_assist_ok?: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  created_at: string;
}

export default function Employees() {
  const { activeCompanyId, role: userRole } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-delete state
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk-delete state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Invite state
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("dispatcher");
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "crew" as "admin" | "dispatcher" | "crew" | "biller",
    sex: "M" as "M" | "F", cert_level: "EMT-B", phone_number: "",
    employment_type: "full_time" as "full_time" | "part_time" | "prn",
    stair_chair_trained: false, bariatric_trained: false,
    oxygen_handling_trained: false, lift_assist_ok: false,
    active: true,
  });
  const [editForm, setEditForm] = useState({
    full_name: "", phone_number: "", sex: "M" as "M" | "F",
    cert_level: "EMT-B", active: true,
    employment_type: "full_time" as "full_time" | "part_time" | "prn",
    role: "crew" as string,
    stair_chair_trained: false,
    bariatric_trained: false, oxygen_handling_trained: false, lift_assist_ok: false,
  });

  const ensureOwnerProfile = async () => {
    if (!activeCompanyId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Check if current user already has a profile for this company
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", activeCompanyId)
      .maybeSingle();
    if (!existing) {
      // Upsert owner profile
      await supabase.from("profiles").upsert({
        user_id: user.id,
        company_id: activeCompanyId,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Owner",
      } as any, { onConflict: "user_id" });
    }
  };

  const fetchEmployees = async () => {
    if (!activeCompanyId) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("full_name");
    const { data: memberships } = await supabase
      .from("company_memberships")
      .select("user_id, role")
      .eq("company_id", activeCompanyId);

    const empList: Employee[] = (profiles ?? []).map((p: any) => {
      const membership = memberships?.find((m) => m.user_id === p.user_id);
      const roleLabel = membership?.role === "owner" ? "Owner" : membership?.role ?? "crew";
      return {
        id: p.id,
        full_name: p.full_name,
        sex: p.sex,
        cert_level: p.cert_level,
        user_id: p.user_id,
        phone_number: p.phone_number ?? null,
        active: p.active ?? true,
        role: roleLabel,
        employment_type: p.employment_type ?? "full_time",
        
        stair_chair_trained: p.stair_chair_trained ?? false,
        bariatric_trained: p.bariatric_trained ?? false,
        oxygen_handling_trained: p.oxygen_handling_trained ?? false,
        lift_assist_ok: p.lift_assist_ok ?? false,
      };
    });

    setEmployees(empList);
  };


  const fetchInvites = async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from("company_invites")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("created_at", { ascending: false });
    setInvites((data as any[]) ?? []);
  };

  useEffect(() => {
    if (!activeCompanyId) return;
    ensureOwnerProfile().then(() => {
      fetchEmployees();
      fetchInvites();
    });
  }, [activeCompanyId]);

  const handleCreate = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    // Issue #1: Duplicate phone check
    if (form.phone_number.trim()) {
      const existingPhone = employees.find(
        (e) => e.phone_number && e.phone_number === form.phone_number.trim()
      );
      if (existingPhone) {
        toast.error(`Phone number already in use by ${existingPhone.full_name}`);
        return;
      }
    }

    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        sex: form.sex,
        cert_level: form.cert_level,
        phone_number: form.phone_number.trim() || null,
        employment_type: form.employment_type,
        
        stair_chair_trained: form.stair_chair_trained,
        bariatric_trained: form.bariatric_trained,
        oxygen_handling_trained: form.oxygen_handling_trained,
        lift_assist_ok: form.lift_assist_ok,
        active: form.active,
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to create user");
    } else {
      toast.success(`${form.full_name} created successfully`);
      setDialogOpen(false);
      setForm({ full_name: "", email: "", password: "", role: "crew" as "admin" | "dispatcher" | "crew" | "biller", sex: "M", cert_level: "EMT-B", phone_number: "", employment_type: "full_time" as "full_time" | "part_time" | "prn", stair_chair_trained: false, bariatric_trained: false, oxygen_handling_trained: false, lift_assist_ok: false, active: true });
      fetchEmployees();
    }
    setCreating(false);
  };

  // ── Invite handler ──
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeCompanyId) {
      toast.error("Email is required");
      return;
    }
    setInviting(true);
    const { error } = await supabase.from("company_invites").insert({
      company_id: activeCompanyId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: (await supabase.auth.getUser()).data.user?.id,
    } as any);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "This email already has a pending invite" : "Failed to create invite");
    } else {
      toast.success(`Invite created for ${inviteEmail}`);
      setInviteEmail("");
      setInviteDialogOpen(false);
      fetchInvites();
    }
    setInviting(false);
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const revokeInvite = async (id: string) => {
    await supabase.from("company_invites").update({ status: "revoked" } as any).eq("id", id);
    toast.success("Invite revoked");
    fetchInvites();
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditForm({
      full_name: emp.full_name,
      phone_number: emp.phone_number ?? "",
      sex: emp.sex as "M" | "F",
      cert_level: emp.cert_level,
      active: emp.active,
      employment_type: (emp.employment_type ?? "full_time") as "full_time" | "part_time" | "prn",
      role: emp.role === "Owner" ? "owner" : (emp.role ?? "crew"),
      
      stair_chair_trained: emp.stair_chair_trained ?? false,
      bariatric_trained: emp.bariatric_trained ?? false,
      oxygen_handling_trained: emp.oxygen_handling_trained ?? false,
      lift_assist_ok: emp.lift_assist_ok ?? false,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    if (!editForm.full_name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Issue #1: Duplicate phone check on edit
    if (editForm.phone_number.trim()) {
      const existingPhone = employees.find(
        (e) => e.id !== editingEmployee.id && e.phone_number && e.phone_number === editForm.phone_number.trim()
      );
      if (existingPhone) {
        toast.error(`Phone number already in use by ${existingPhone.full_name}`);
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name.trim(),
      phone_number: editForm.phone_number.trim() || null,
      sex: editForm.sex,
      cert_level: editForm.cert_level,
      active: editForm.active,
      employment_type: editForm.employment_type,
      
      stair_chair_trained: editForm.stair_chair_trained,
      bariatric_trained: editForm.bariatric_trained,
      oxygen_handling_trained: editForm.oxygen_handling_trained,
      lift_assist_ok: editForm.lift_assist_ok,
    } as any).eq("id", editingEmployee.id);

    // Update role in company_memberships if changed and not owner
    if (editForm.role !== "owner" && editForm.role !== "Owner") {
      await supabase.from("company_memberships")
        .update({ role: editForm.role } as any)
        .eq("user_id", editingEmployee.user_id)
        .eq("company_id", activeCompanyId!);
    }

    if (error) {
      toast.error("Failed to update employee");
    } else {
      toast.success(`${editForm.full_name} updated`);
      setEditDialogOpen(false);
      fetchEmployees();
    }
    setSaving(false);
  };

  // ── Single delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("profiles").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Failed to delete employee");
    } else {
      toast.success(`${deleteTarget.full_name} deleted`);
      setDeleteTarget(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
      fetchEmployees();
    }
    setDeleting(false);
  };

  // ── Bulk delete ──
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("profiles").delete().in("id", ids);
    if (error) {
      toast.error("Failed to delete employees");
    } else {
      toast.success(`${ids.length} employee${ids.length > 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      fetchEmployees();
    }
    setBulkDeleting(false);
  };

  const filtered = employees.filter((e) => {
    if (!showInactive && !e.active) return false;
    return e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.phone_number ?? "").includes(search);
  });

  // ── Selection helpers ──
  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((e) => n.delete(e.id));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((e) => n.add(e.id));
        return n;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              Show inactive
            </label>
            {someSelected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selected.size} selected
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1.5 h-4 w-4" /> Add Employee</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader><DialogTitle>Create Employee Account</DialogTitle><DialogDescription>Add a new employee with credentials and role.</DialogDescription></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                  <div><Label>Phone Number</Label><Input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="(555) 123-4567" /></div>
                  <div><Label>Email * <span className="text-xs text-muted-foreground">(for login)</span></Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div>
                    <Label>Temporary Password *</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(p => !p)}>
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Role</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="dispatcher">Dispatcher</SelectItem>
                          <SelectItem value="biller">Billing</SelectItem>
                          <SelectItem value="crew">Crew</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sex</Label>
                      <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v as "M" | "F" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Male</SelectItem>
                          <SelectItem value="F">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cert Level</Label>
                      <Select value={form.cert_level} onValueChange={(v) => setForm({ ...form, cert_level: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMT-B">EMT-B</SelectItem>
                          <SelectItem value="EMT-A">EMT-A</SelectItem>
                          <SelectItem value="EMT-P">EMT-P</SelectItem>
                          <SelectItem value="AEMT">AEMT</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Employment Type</Label>
                    <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="prn">PRN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Crew Capability Toggles */}
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crew Capabilities</p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { key: "stair_chair_trained" as const, label: "Stair Chair Trained" },
                        { key: "bariatric_trained" as const, label: "Bariatric Trained" },
                        { key: "oxygen_handling_trained" as const, label: "Oxygen Handling" },
                        { key: "lift_assist_ok" as const, label: "Lift Assist OK" },
                      ].map(f => (
                        <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.checked })} className="accent-primary" />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label className="text-sm font-medium">Active Status</Label>
                      <p className="text-xs text-muted-foreground">Inactive employees won't appear in crew assignments</p>
                    </div>
                    <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  </div>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? "Creating..." : "Create Account"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Cert</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isChecked = selected.has(e.id);
                  return (
                    <tr key={e.id} className={`border-b last:border-0 transition-colors ${!e.active ? "opacity-50" : ""} ${isChecked ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(e.id)}
                          aria-label={`Select ${e.full_name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-card-foreground">{e.full_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.phone_number || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          e.role === "Owner"
                            ? "bg-primary/10 text-primary"
                            : e.role === "admin" || e.role === "owner"
                            ? "bg-primary/10 text-primary"
                            : e.role === "dispatcher"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-accent text-accent-foreground"
                        }`}>
                          {e.role === "Owner" ? "Owner" : e.role === "owner" ? "Owner" : e.role === "admin" ? "Admin" : e.role === "dispatcher" ? "Dispatcher" : e.role === "biller" ? "Billing" : "Crew"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.cert_level}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          e.active ? "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]" : "bg-muted text-muted-foreground"
                        }`}>
                          {e.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pending Invites Section ── */}
        {(userRole === "owner" || userRole === "creator") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" /> Pending Invites
              </h3>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Mail className="mr-1.5 h-3.5 w-3.5" /> Invite User</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>Send an invite link. They'll create their own account.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div>
                      <Label>Email *</Label>
                      <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jane@example.com" />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dispatcher">Dispatcher</SelectItem>
                          <SelectItem value="biller">Billing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleInvite} disabled={inviting}>
                      {inviting ? "Creating..." : "Create Invite"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {invites.filter(i => i.status === "pending").length > 0 ? (
              <div className="rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Sent</th>
                      <th className="px-4 py-3 w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.filter(i => i.status === "pending").map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{inv.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground capitalize">
                            {inv.role === "biller" ? "Billing" : inv.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Copy invite link"
                              onClick={() => copyInviteLink(inv.token)}
                            >
                              {copiedToken === inv.token ? <Check className="h-3.5 w-3.5 text-[hsl(var(--status-green))]" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Revoke invite"
                              onClick={() => revokeInvite(inv.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No pending invites. Click "Invite User" to add team members.</p>
            )}
          </div>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Employee</DialogTitle><DialogDescription>Update employee information. Deactivate instead of deleting.</DialogDescription></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Full Name *</Label><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
              <div><Label>Phone Number</Label><Input type="tel" value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} placeholder="(555) 123-4567" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })} disabled={editForm.role === "owner" || editForm.role === "Owner"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crew">Crew</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                      <SelectItem value="biller">Biller</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sex</Label>
                  <Select value={editForm.sex} onValueChange={(v) => setEditForm({ ...editForm, sex: v as "M" | "F" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cert Level</Label>
                  <Select value={editForm.cert_level} onValueChange={(v) => setEditForm({ ...editForm, cert_level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMT-B">EMT-B</SelectItem>
                      <SelectItem value="EMT-A">EMT-A</SelectItem>
                      <SelectItem value="EMT-P">EMT-P</SelectItem>
                      <SelectItem value="AEMT">AEMT</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <Select value={editForm.employment_type} onValueChange={(v) => setEditForm({ ...editForm, employment_type: v as "full_time" | "part_time" | "prn" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="prn">PRN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Crew Capability Toggles */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crew Capabilities</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { key: "stair_chair_trained" as const, label: "Stair Chair Trained" },
                    { key: "bariatric_trained" as const, label: "Bariatric Trained" },
                    { key: "oxygen_handling_trained" as const, label: "Oxygen Handling" },
                    { key: "lift_assist_ok" as const, label: "Lift Assist OK" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={editForm[f.key]} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.checked })} className="accent-primary" />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Active Status</Label>
                  <p className="text-xs text-muted-foreground">Inactive employees won't appear in crew assignments</p>
                </div>
                <Switch checked={editForm.active} onCheckedChange={(v) => setEditForm({ ...editForm, active: v })} />
              </div>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.full_name}</strong> and their profile. Consider deactivating instead to preserve scheduling history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Employee{selected.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{selected.size}</strong> employee{selected.size > 1 ? "s" : ""} and their profiles. Consider deactivating instead to preserve scheduling history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Deleting..." : `Delete ${selected.size} Employee${selected.size > 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
