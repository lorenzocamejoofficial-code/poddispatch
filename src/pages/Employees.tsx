import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Pencil, Trash2, Copy, KeyRound, MoreHorizontal, Send, ShieldCheck, Archive, RotateCcw } from "lucide-react";
import { CrewCertificationsDialog } from "@/components/crew/CrewCertificationsDialog";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/table-pagination";
import { normalizePhone } from "@/lib/phone";
import { CERT_LEVELS } from "@/lib/cert-levels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Employee {
  id: string;
  full_name: string;
  sex: string;
  cert_level: string;
  user_id: string | null;
  phone_number: string | null;
  email: string | null;
  active: boolean;
  role?: string;
  employment_type?: string;
  invitation_status?: "active" | "invited" | "pending_invite" | "inactive";
  archived_at?: string | null;
  pending_role?: string | null;
  invite_token?: string | null;
  stair_chair_trained?: boolean;
  bariatric_trained?: boolean;
  oxygen_handling_trained?: boolean;
  lift_assist_ok?: boolean;
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
  const [certsTarget, setCertsTarget] = useState<Employee | null>(null);
  // Combined Add flow: 'invite' (recommended) or 'credentials' (legacy direct create).
  const [addMode, setAddMode] = useState<"invite" | "credentials">("invite");
  const [sendingInviteFor, setSendingInviteFor] = useState<string | null>(null);
  const [pendingCertCount, setPendingCertCount] = useState<number>(0);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-archive state
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Upcoming-shift count shown in the archive warning (null = still checking)
  const [upcomingShifts, setUpcomingShifts] = useState<number | null>(null);

  // Bulk-delete state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [createEmailError, setCreateEmailError] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "crew" as "manager" | "dispatcher" | "crew" | "biller",
    sex: "M" as "M" | "F", cert_level: "EMT-B", phone_number: "",
    employment_type: "full_time" as "full_time" | "part_time" | "prn",
    stair_chair_trained: false, bariatric_trained: false,
    oxygen_handling_trained: false, lift_assist_ok: false,
    active: true,
  });
  const [editForm, setEditForm] = useState({
    full_name: "", email: "", phone_number: "", sex: "M" as "M" | "F",
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
      .select("*, company_invites(token)")
      .eq("company_id", activeCompanyId)
      .order("full_name");
    const { data: memberships } = await supabase
      .from("company_memberships")
      .select("user_id, role")
      .eq("company_id", activeCompanyId);

    // Fetch emails from auth via edge function or profiles
    // We'll use the user_id to look up emails from auth metadata stored in profiles
    const empList: Employee[] = (profiles ?? []).map((p: any) => {
      const membership = p.user_id ? memberships?.find((m) => m.user_id === p.user_id) : null;
      // For invited / pending rows there's no membership yet — fall back to pending_role.
      const roleLabel = membership?.role === "owner"
        ? "Owner"
        : membership?.role ?? p.pending_role ?? "crew";
      const inv = Array.isArray(p.company_invites) ? p.company_invites[0] : p.company_invites;
      return {
        id: p.id,
        full_name: p.full_name,
        sex: p.sex,
        cert_level: p.cert_level,
        user_id: p.user_id,
        phone_number: p.phone_number ?? null,
        email: p.email ?? null,
        active: p.active ?? true,
        role: roleLabel,
        employment_type: p.employment_type ?? "full_time",
        invitation_status: p.invitation_status ?? "active",
        pending_role: p.pending_role ?? null,
        invite_token: inv?.token ?? null,
        stair_chair_trained: p.stair_chair_trained ?? false,
        bariatric_trained: p.bariatric_trained ?? false,
        oxygen_handling_trained: p.oxygen_handling_trained ?? false,
        lift_assist_ok: p.lift_assist_ok ?? false,
        archived_at: p.archived_at ?? null,
      };
    });

    setEmployees(empList);
    return empList;
  };

  // Backfill emails from auth (profiles table doesn't store email)
  const fetchEmployeeEmails = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("list-company-emails");
      if (error || !data?.emails) return;
      const map = data.emails as Record<string, string | null>;
      setEmployees((prev) => prev.map((e) => ({ ...e, email: (e.user_id && map[e.user_id]) ?? e.email })));
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!activeCompanyId) return;
    ensureOwnerProfile().then(() => {
      fetchEmployees().then(() => fetchEmployeeEmails());
    });
    // Pending cert count for the queue badge.
    (async () => {
      const { count } = await supabase
        .from("crew_certifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("company_id", activeCompanyId)
        .eq("status", "pending_review");
      setPendingCertCount(count ?? 0);
    })();
  }, [activeCompanyId]);

  const handleCreate = async () => {
    if (addMode === "invite") return handleInvite();
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    // Issue #1: Duplicate phone check
    if (normalizePhone(form.phone_number)) {
      const normalized = normalizePhone(form.phone_number);
      const existingPhone = employees.find(
        (e) => e.phone_number && normalizePhone(e.phone_number) === normalized
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
        phone_number: normalizePhone(form.phone_number),
        employment_type: form.employment_type,
        
        stair_chair_trained: form.stair_chair_trained,
        bariatric_trained: form.bariatric_trained,
        oxygen_handling_trained: form.oxygen_handling_trained,
        lift_assist_ok: form.lift_assist_ok,
        active: form.active,
      },
    });

    if (error || data?.error) {
      let body: any = null;
      try {
        const ctx: any = (error as any)?.context;
        if (ctx && typeof ctx.json === "function") body = await ctx.json();
        else if (ctx && typeof ctx.text === "function") body = JSON.parse(await ctx.text());
      } catch {
        /* body stays null */
      }

      const raw = (body?.error || data?.error || error?.message || "") as string;
      const isEmailDup =
        typeof raw === "string" && /already.*(registered|exist)/i.test(raw);
      if (isEmailDup) setCreateEmailError(true);
      toast.error(
        isEmailDup
          ? "An account with this email already exists."
          : (raw || "Failed to create user"),
      );
    } else {
      toast.success(`${form.full_name} created successfully`);
      setDialogOpen(false);
      setCreateEmailError(false);
      const createdEmail = form.email.trim().toLowerCase();
      const createdName = form.full_name.trim();
      setForm({ full_name: "", email: "", password: "", role: "crew" as "manager" | "dispatcher" | "crew" | "biller", sex: "M", cert_level: "EMT-B", phone_number: "", employment_type: "full_time" as "full_time" | "part_time" | "prn", stair_chair_trained: false, bariatric_trained: false, oxygen_handling_trained: false, lift_assist_ok: false, active: true });
      const refreshed = await fetchEmployees();
      fetchEmployeeEmails();
      // Auto-open the certifications dialog for the new employee so admins can
      // add license numbers, expiries, NREMT, etc. right away.
      const list = Array.isArray(refreshed) ? refreshed : employees;
      const created = list.find((e: any) => (e.email || "").toLowerCase() === createdEmail)
        || { user_id: (data as any)?.user_id, full_name: createdName } as any;
      if (created?.user_id) {
        setCertsTarget(created as Employee);
      }
    }
    setCreating(false);
  };

  // ── Invite handler — creates a pending_invite profile row, then sends ──
  const handleInvite = async () => {
    if (!form.email.trim() || !activeCompanyId) {
      toast.error("Email is required");
      return;
    }
    setCreating(true);
    const emailLower = form.email.trim().toLowerCase();
    // Create the placeholder profile row in 'invited' state. The send-employee-invite
    // edge function will issue the token + email below.
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .insert({
        company_id: activeCompanyId,
        email: emailLower,
        full_name: form.full_name.trim() || emailLower.split("@")[0],
        invitation_status: "invited",
        pending_role: form.role as any,
        active: true,
        phone_number: normalizePhone(form.phone_number),
        sex: form.sex,
        cert_level: form.cert_level,
        employment_type: form.employment_type,
        stair_chair_trained: form.stair_chair_trained,
        bariatric_trained: form.bariatric_trained,
        oxygen_handling_trained: form.oxygen_handling_trained,
        lift_assist_ok: form.lift_assist_ok,
      } as any)
      .select("id")
      .single();
    if (profileErr || !profileRow) {
      toast.error(profileErr?.message?.includes("duplicate") ? "This email already has a pending invite" : "Failed to create invite");
      setCreating(false);
      return;
    }
    await sendInviteFor(profileRow.id, emailLower);
    setDialogOpen(false);
    setForm({ full_name: "", email: "", password: "", role: "crew", sex: "M", cert_level: "EMT-B", phone_number: "", employment_type: "full_time", stair_chair_trained: false, bariatric_trained: false, oxygen_handling_trained: false, lift_assist_ok: false, active: true });
    await fetchEmployees();
    setCreating(false);
  };

  // Issues a token (or rotates) and emails the invite link via edge function.
  // Always shows a copy-link toast as a fallback in case email delivery fails.
  const sendInviteFor = async (profileId: string, emailForToast?: string) => {
    setSendingInviteFor(profileId);
    const { data, error } = await supabase.functions.invoke("send-employee-invite", {
      body: { profile_id: profileId },
    });
    setSendingInviteFor(null);
    const link = (data as any)?.action_link as string | undefined;
    if (error || (data as any)?.error || !link) {
      toast.error((data as any)?.error || error?.message || "Failed to send invite");
      return;
    }
    if (link) {
      try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
    }
    const delivered = (data as any)?.email_delivered;
    toast.success(
      delivered
        ? `Invite sent to ${emailForToast ?? (data as any)?.email}. Link copied to clipboard.`
        : `Invite link copied to clipboard (email delivery failed, share the link directly).`,
    );
    fetchEmployees();
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invite?token=${token}`;
    try { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); }
    catch { toast.error("Could not copy link"); }
  };

  const handleResetPassword = async (emp: Employee) => {
    if (!emp.user_id) return;
    const { data, error } = await supabase.functions.invoke("admin-trigger-password-reset", {
      body: { user_id: emp.user_id },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to send reset email");
      return;
    }
    toast.success((data as any)?.email_delivered ? "Password reset email sent" : "Reset link generated (email delivery failed)");
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditForm({
      full_name: emp.full_name,
      email: emp.email ?? "",
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
    if (normalizePhone(editForm.phone_number)) {
      const normalized = normalizePhone(editForm.phone_number);
      const existingPhone = employees.find(
        (e) => e.id !== editingEmployee.id && e.phone_number && normalizePhone(e.phone_number) === normalized
      );
      if (existingPhone) {
        toast.error(`Phone number already in use by ${existingPhone.full_name}`);
        return;
      }
    }

    // Validate email if changed
    const trimmedEmail = editForm.email.trim().toLowerCase();
    const emailChanged = trimmedEmail && trimmedEmail !== (editingEmployee.email ?? "").toLowerCase();
    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    // Pending/invited rows have no auth user yet — update profile directly.
    if (!editingEmployee.user_id) {
      setSaving(true);
      const { error } = await supabase.from("profiles").update({
        full_name: editForm.full_name.trim(),
        phone_number: normalizePhone(editForm.phone_number),
        sex: editForm.sex,
        cert_level: editForm.cert_level,
        employment_type: editForm.employment_type,
        active: editForm.active,
        pending_role: editForm.role as any,
        ...(emailChanged ? { email: trimmedEmail } : {}),
        stair_chair_trained: editForm.stair_chair_trained,
        bariatric_trained: editForm.bariatric_trained,
        oxygen_handling_trained: editForm.oxygen_handling_trained,
        lift_assist_ok: editForm.lift_assist_ok,
      } as any).eq("id", editingEmployee.id);
      if (error) { toast.error("Failed to update invite"); setSaving(false); return; }
      toast.success(`${editForm.full_name} updated`);
      setEditDialogOpen(false);
      await fetchEmployees();
      setSaving(false);
      return;
    }
    // Active toggle still goes direct (edge function doesn't cover it)
    setSaving(true);

    // Single source of truth: route through edge function so auth.users
    // and profiles stay in sync (email change updates the login identity).
    const { data: efData, error: efErr } = await supabase.functions.invoke("update-crew-member", {
      body: {
        target_user_id: editingEmployee.user_id,
        full_name: editForm.full_name.trim(),
        phone_number: normalizePhone(editForm.phone_number),
        sex: editForm.sex,
        cert_level: editForm.cert_level,
        employment_type: editForm.employment_type,
        stair_chair_trained: editForm.stair_chair_trained,
        bariatric_trained: editForm.bariatric_trained,
        oxygen_handling_trained: editForm.oxygen_handling_trained,
        lift_assist_ok: editForm.lift_assist_ok,
        ...(emailChanged ? { email: trimmedEmail } : {}),
        ...(editForm.role !== "owner" && editForm.role !== "Owner" ? { role: editForm.role } : {}),
      },
    });

    if (efErr || (efData as any)?.error) {
      toast.error((efData as any)?.error || efErr?.message || "Failed to update employee");
      setSaving(false);
      return;
    }

    // Active flag isn't part of the edge function contract — update profile directly.
    if (editForm.active !== editingEmployee.active) {
      await supabase.from("profiles").update({ active: editForm.active } as any).eq("id", editingEmployee.id);
    }

    toast.success(`${editForm.full_name} updated${emailChanged ? ", login email changed" : ""}`);
    setEditDialogOpen(false);
    await fetchEmployees();
    fetchEmployeeEmails();
    setSaving(false);
  };

  // ── Single archive ──
  // Archiving never deletes the profile or the login account: it revokes company
  // access, blocks sign-in, and leaves every historical record attributed.
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("manage-employee", {
      body: { action: "archive", profile_id: deleteTarget.id },
    });
    const errMsg = (data as any)?.error || error?.message;
    if (errMsg || !(data as any)?.ok) {
      toast.error("Couldn't archive this employee", { description: errMsg || "Nothing was changed — try again." });
    } else {
      const cleared = (data as any)?.clearedShifts ?? 0;
      toast.success(`${deleteTarget.full_name} archived`, {
        description: cleared > 0
          ? `${cleared} upcoming shift${cleared > 1 ? "s" : ""} cleared. Past records are unchanged.`
          : "They can no longer sign in. Past records are unchanged.",
      });
      setDeleteTarget(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
      fetchEmployees();
    }
    setDeleting(false);
  };

  // ── Reactivate (owner/creator only, enforced server-side) ──
  const handleReactivate = async (emp: Employee) => {
    const { data, error } = await supabase.functions.invoke("manage-employee", {
      body: { action: "unarchive", profile_id: emp.id },
    });
    const errMsg = (data as any)?.error || error?.message;
    if (errMsg || !(data as any)?.ok) {
      toast.error("Couldn't reactivate this employee", { description: errMsg || "Nothing was changed — try again." });
      return;
    }
    toast.success(`${emp.full_name} reactivated`, {
      description: "Their access is back. Upcoming shifts must be re-assigned.",
    });
    fetchEmployees();
  };

  // ── Bulk archive ──
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { data, error } = await supabase.functions.invoke("manage-employee", {
      body: { action: "archive_bulk", profile_ids: ids },
    });
    const errMsg = (data as any)?.error || error?.message;
    if (errMsg && !(data as any)?.results) {
      toast.error("Couldn't archive these employees", { description: errMsg });
    } else {
      const results = ((data as any)?.results ?? []) as any[];
      const okCount = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      if (okCount > 0) {
        toast.success(`${okCount} employee${okCount > 1 ? "s" : ""} archived`);
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} couldn't be archived`, {
          description: failed.map((f) => f.error).slice(0, 3).join(" · "),
        });
      }
      setSelected(new Set());
      setBulkDeleteOpen(false);
      fetchEmployees();
    }
    setBulkDeleting(false);
  };

  const filtered = useMemo(() => employees.filter((e) => {
    if (!showInactive && !e.active) return false;
    return e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.phone_number ?? "").includes(search);
  }), [employees, showInactive, search]);

  // Pagination — keeps DOM small as employee directories grow
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(1); }, [search, showInactive, pageSize]);
  const pageStart = (page - 1) * pageSize;
  const paginated = useMemo(() => filtered.slice(pageStart, pageStart + pageSize), [filtered, pageStart, pageSize]);

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

  const isAdmin = userRole === "owner" || userRole === "creator" || userRole === "manager";
  // Reactivating restores access, so it's owner/creator only (also enforced server-side).
  const canReactivate = userRole === "owner" || userRole === "creator";

  // Opens the archive confirmation and asks the server how many upcoming shifts
  // this person is on, so the warning shows a real count before anything changes.
  const openArchive = (e: Employee) => {
    setDeleteTarget(e);
    setUpcomingShifts(null);
    supabase.functions
      .invoke("manage-employee", { body: { action: "preview", profile_id: e.id } })
      .then(({ data }) => setUpcomingShifts(((data as any)?.upcoming_shifts ?? 0) as number))
      .catch(() => setUpcomingShifts(0));
  };
  const statusBadge = (e: Employee) => {
    if (e.invitation_status === "invited") return { label: "Invited", cls: "bg-[hsl(var(--status-amber-bg))] text-[hsl(var(--status-amber))]" };
    if (e.invitation_status === "pending_invite") return { label: "Pending", cls: "bg-muted text-muted-foreground" };
    return e.active
      ? { label: "Active", cls: "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]" }
      : { label: "Inactive", cls: "bg-muted text-muted-foreground" };
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
            <Link to="/certification-queue">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Cert Review Queue
                {pendingCertCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                    {pendingCertCount}
                  </Badge>
                )}
              </Button>
            </Link>
            {someSelected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive {selected.size} selected
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1.5 h-4 w-4" /> Add Employee</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Add Employee</DialogTitle>
                  <DialogDescription>
                    Send an invite link (recommended) or create the account with a temporary password.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setAddMode("invite")}
                    className={`flex-1 rounded-md px-3 py-1.5 font-medium ${addMode === "invite" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                  >
                    Send invite
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode("credentials")}
                    className={`flex-1 rounded-md px-3 py-1.5 font-medium ${addMode === "credentials" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                  >
                    Create with password
                  </button>
                </div>
                <div className="grid gap-3 py-2">
                  <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                  <div><Label>Phone Number</Label><Input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="(555) 123-4567" /></div>
                  <div><Label>Email * <span className="text-xs text-muted-foreground">(for login)</span></Label><Input type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); if (createEmailError) setCreateEmailError(false); }} aria-invalid={createEmailError} className={createEmailError ? "border-destructive focus-visible:ring-destructive" : ""} /></div>
                  {addMode === "credentials" && (
                  <div>
                    <Label>Temporary Password *</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(p => !p)}>
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Role</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
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
                          {CERT_LEVELS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <strong className="text-foreground">Detailed certifications</strong> (license #, NREMT, state license, expiry dates, CPR, etc.) {addMode === "credentials" ? "will open in a follow-up dialog right after you create the account." : "can be added from the employee row once they accept the invite."}
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
                    {creating ? (addMode === "invite" ? "Sending..." : "Creating...") : (addMode === "invite" ? "Send Invite" : "Create Account")}
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
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Cert</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((e) => {
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
                      <td className="px-4 py-3 text-muted-foreground text-xs">{e.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.phone_number || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          e.role === "Owner" || e.role === "owner"
                            ? "bg-primary/10 text-primary"
                            : e.role === "dispatcher"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-accent text-accent-foreground"
                        }`}>
                          {e.role === "Owner" || e.role === "owner" ? "Owner" : e.role === "manager" ? "Manager" : e.role === "dispatcher" ? "Dispatcher" : e.role === "biller" ? "Billing" : "Crew"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.cert_level}</td>
                      <td className="px-4 py-3">
                        {(() => { const sb = statusBadge(e); return (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${sb.cls}`}>{sb.label}</span>
                        ); })()}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Invite-related actions for non-active rows */}
                            {(e.invitation_status === "invited" || e.invitation_status === "pending_invite") && isAdmin && (
                              <>
                                <DropdownMenuItem
                                  disabled={sendingInviteFor === e.id}
                                  onClick={() => sendInviteFor(e.id, e.email ?? undefined)}
                                >
                                  <Send className="mr-2 h-3.5 w-3.5" />
                                  {e.invitation_status === "invited" ? "Resend invite" : "Send invite"}
                                </DropdownMenuItem>
                                {e.invite_token && (
                                  <DropdownMenuItem onClick={() => copyInviteLink(e.invite_token!)}>
                                    <Copy className="mr-2 h-3.5 w-3.5" />Copy invite link
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {/* Reset password — only for active accounts with an auth user */}
                            {e.user_id && e.email && isAdmin && e.invitation_status === "active" && (
                              <DropdownMenuItem onClick={() => handleResetPassword(e)}>
                                <KeyRound className="mr-2 h-3.5 w-3.5" />Reset password
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEdit(e)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                            </DropdownMenuItem>
                            {e.user_id && (
                              <DropdownMenuItem onClick={() => setCertsTarget(e)}>
                                <ShieldCheck className="mr-2 h-3.5 w-3.5" />Certifications
                              </DropdownMenuItem>
                            )}
                            {e.role !== "Owner" && e.archived_at && canReactivate && (
                              <DropdownMenuItem onClick={() => handleReactivate(e)}>
                                <RotateCcw className="mr-2 h-3.5 w-3.5" />Reactivate
                              </DropdownMenuItem>
                            )}
                            {e.role !== "Owner" && !e.archived_at && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openArchive(e)}
                              >
                                <Archive className="mr-2 h-3.5 w-3.5" />
                                {e.invitation_status === "invited" || e.invitation_status === "pending_invite" ? "Revoke invite" : "Archive"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader><DialogTitle>Edit Employee</DialogTitle><DialogDescription>Update employee information. Deactivate instead of deleting.</DialogDescription></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Full Name *</Label><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
              <div>
                <Label>Email <span className="text-xs text-muted-foreground">(login identity — changes apply immediately)</span></Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="employee@company.com"
                />
              </div>
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
                      <SelectItem value="manager">Manager</SelectItem>
                      {(editForm.role === "owner" || editForm.role === "Owner") && (
                        <SelectItem value="owner">Owner</SelectItem>
                      )}
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
                      {CERT_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                      ))}
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

      {/* Single archive confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.full_name}</strong> will no longer be able to sign in and will disappear from active lists and crew pickers.
              Their record, signed charts and past shifts stay exactly as they are.
              {upcomingShifts === null
                ? " Checking upcoming shifts..."
                : upcomingShifts > 0
                  ? ` They are on ${upcomingShifts} upcoming shift${upcomingShifts > 1 ? "s" : ""} — archiving removes them from ${upcomingShifts > 1 ? "those" : "it"}; any truck left short will show as an incomplete shift on the board.`
                  : " They have no upcoming shifts."}
              {" "}An owner can reactivate them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Archiving..." : "Archive Employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk archive confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selected.size} Employee{selected.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              These <strong>{selected.size}</strong> people will no longer be able to sign in and will drop off active lists and crew pickers.
              Upcoming shifts they are on are cleared; past shifts, signed charts and every historical record stay attributed to them.
              An owner can reactivate anyone later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Archiving..." : `Archive ${selected.size} Employee${selected.size > 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {certsTarget?.user_id && (
        <CrewCertificationsDialog
          open={!!certsTarget}
          onOpenChange={(o) => { if (!o) setCertsTarget(null); }}
          userId={certsTarget.user_id}
          displayName={certsTarget.full_name}
          adminMode
        />
      )}
    </AdminLayout>
  );
}
