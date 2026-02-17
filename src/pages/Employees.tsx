import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Pencil } from "lucide-react";
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
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "crew" as "admin" | "crew",
    sex: "M" as "M" | "F", cert_level: "EMT-B", phone_number: "",
  });
  const [editForm, setEditForm] = useState({
    full_name: "", phone_number: "", sex: "M" as "M" | "F",
    cert_level: "EMT-B", active: true,
  });

  const fetchEmployees = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("full_name");
    const { data: roles } = await supabase.from("user_roles").select("*");

    const empList: Employee[] = (profiles ?? []).map((p: any) => {
      const userRole = roles?.find((r) => r.user_id === p.user_id);
      return {
        id: p.id,
        full_name: p.full_name,
        sex: p.sex,
        cert_level: p.cert_level,
        user_id: p.user_id,
        phone_number: p.phone_number ?? null,
        active: p.active ?? true,
        role: userRole?.role ?? "crew",
      };
    });

    setEmployees(empList);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleCreate = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
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
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to create user");
    } else {
      toast.success(`${form.full_name} created successfully`);
      setDialogOpen(false);
      setForm({ full_name: "", email: "", password: "", role: "crew", sex: "M", cert_level: "EMT-B", phone_number: "" });
      fetchEmployees();
    }
    setCreating(false);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditForm({
      full_name: emp.full_name,
      phone_number: emp.phone_number ?? "",
      sex: emp.sex as "M" | "F",
      cert_level: emp.cert_level,
      active: emp.active,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    if (!editForm.full_name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name.trim(),
      phone_number: editForm.phone_number.trim() || null,
      sex: editForm.sex,
      cert_level: editForm.cert_level,
      active: editForm.active,
    } as any).eq("id", editingEmployee.id);

    if (error) {
      toast.error("Failed to update employee");
    } else {
      toast.success(`${editForm.full_name} updated`);
      setEditDialogOpen(false);
      fetchEmployees();
    }
    setSaving(false);
  };

  const filtered = employees.filter((e) => {
    if (!showInactive && !e.active) return false;
    return e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.phone_number ?? "").includes(search);
  });

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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1.5 h-4 w-4" /> Add Employee</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create Employee Account</DialogTitle><DialogDescription>Add a new employee with credentials and role.</DialogDescription></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                  <div><Label>Phone Number</Label><Input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="(555) 123-4567" /></div>
                  <div><Label>Email * <span className="text-xs text-muted-foreground">(for login)</span></Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Temporary Password *</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Role</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "crew" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Cert</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className={`border-b last:border-0 ${!e.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-card-foreground">{e.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.phone_number || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        e.role === "admin" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                      }`}>
                        {e.role === "admin" ? "Admin" : "Crew"}
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Employee Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Employee</DialogTitle><DialogDescription>Update employee information. Deactivate instead of deleting.</DialogDescription></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Full Name *</Label><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
              <div><Label>Phone Number</Label><Input type="tel" value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} placeholder="(555) 123-4567" /></div>
              <div className="grid grid-cols-2 gap-3">
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
    </AdminLayout>
  );
}
