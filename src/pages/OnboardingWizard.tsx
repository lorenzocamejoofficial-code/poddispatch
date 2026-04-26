import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { US_STATES } from "@/lib/us-states";
import {
  Building2, DollarSign, Network, Truck, Users, UserPlus,
  CheckCircle2, ArrowRight, ArrowLeft, Lock, Pencil, Trash2, PartyPopper, Mail,
} from "lucide-react";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STEPS = [
  { icon: Building2, title: "Verify Your Company Info", description: "Confirm your billing identity, NPI, EIN, and address." },
  { icon: DollarSign, title: "Verify Your Rates", description: "Confirm or edit your charge master rates by payer." },
  { icon: Network, title: "Connect Your Clearinghouse", description: "Link PodDispatch to Office Ally for electronic claims." },
  { icon: Truck, title: "Add Your Trucks", description: "Set up at least one truck with equipment flags." },
  { icon: UserPlus, title: "Add Your Crew", description: "Invite dispatchers, billers, or crew members." },
  { icon: Users, title: "Add Your First Patient", description: "Create a patient record so you can schedule a run." },
];

const PAYER_OPTIONS = [
  { value: "default", label: "Default (CMS)" },
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
  { value: "commercial", label: "Commercial" },
  { value: "self_pay", label: "Self Pay" },
];

const TRANSPORT_TYPES = [
  { value: "ift", label: "BLS / IFT" },
  { value: "outpatient", label: "Wheelchair / Outpatient" },
  { value: "dialysis", label: "Dialysis" },
  { value: "discharge", label: "Discharge" },
  { value: "private_pay", label: "Private Pay" },
];

const CERT_LEVELS = ["EMT-B", "EMT-A", "AEMT", "EMT-P", "Other"];
const EMT_CAPABLE = new Set(["EMT-B", "EMT-A", "AEMT", "EMT-P"]);
const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "per_diem", label: "Per Diem" },
  { value: "contractor", label: "Contractor" },
];
const ROLE_OPTIONS = [
  { value: "dispatcher", label: "Dispatcher" },
  { value: "biller", label: "Biller" },
  { value: "crew", label: "Crew" },
];
const SEX_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

const emptyPatient = () => ({
  first_name: "", last_name: "", dob: "", sex: "",
  pickup_address: "", primary_payer: "", member_id: "",
  secondary_payer: "", secondary_member_id: "",
  mobility: "ambulatory", oxygen_required: false,
  standing_order: false, pcs_on_file: false,
  pcs_signed_date: "", pcs_expiration_date: "",
  prior_auth_number: "", prior_auth_expiration: "", notes: "",
  transport_type: "", facility_id: "", icd10_codes: "",
});

const emptyCrew = () => ({
  email: "", first_name: "", last_name: "", sex: "M",
  cert_level: "EMT-B", employment_type: "full_time", role: "crew",
  stair_chair_trained: false, bariatric_trained: false,
  oxygen_handling_trained: false, lift_assist_ok: false,
  max_safe_team_lift_lbs: 250,
});

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { activeCompanyId, user } = useAuth();
  const progress = useOnboardingProgress();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 — company info
  const [company, setCompany] = useState({
    name: "", npi_number: "", ein_number: "", state_of_operation: "",
    address_street: "", address_city: "", address_state: "", address_zip: "",
  });
  const [companySaving, setCompanySaving] = useState(false);

  // Step 2 — rates
  const [rates, setRates] = useState<any[]>([]);
  const [newRatePayer, setNewRatePayer] = useState("medicare");
  const [newRate, setNewRate] = useState({ base_rate: "", mileage_rate: "", oxygen_fee: "", extra_attendant_fee: "", bariatric_fee: "" });

  // Step 3 — clearinghouse
  const [ch, setCh] = useState({
    clearinghouse_name: "Office Ally",
    submitter_id: "", submitter_name: "", receiver_id: "OFFICEALLY",
    contact_name: "", contact_phone: "",
    sftp_host: "ftp10.officeally.com", sftp_port: 22,
    inbound_folder: "inbound", outbound_folder: "outbound",
    sftp_username: "", sftp_password: "",
  });
  const [chSaving, setChSaving] = useState(false);

  // Step 4 — trucks
  const [trucks, setTrucks] = useState<any[]>([]);
  const [newTruck, setNewTruck] = useState({
    name: "", vehicle_id: "",
    has_power_stretcher: false, has_stair_chair: false,
    has_oxygen_mount: false, has_bariatric_kit: false, has_bariatric_stretcher: false,
  });
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);

  // Step 5 — crew
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newCrew, setNewCrew] = useState(emptyCrew());
  const [crewSaving, setCrewSaving] = useState(false);
  const [editingCrew, setEditingCrew] = useState<any | null>(null);
  const [crewEditSaving, setCrewEditSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Step 6 — patient
  const [patients, setPatients] = useState<any[]>([]);
  const [newPatient, setNewPatient] = useState(emptyPatient());
  const [facilities, setFacilities] = useState<any[]>([]);
  const [patientSaving, setPatientSaving] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      const [cmp, rt, chr, tk, pf, pt, fc] = await Promise.all([
        supabase.from("companies").select("name, npi_number, ein_number, state_of_operation, address_street, address_city, address_state, address_zip").eq("id", activeCompanyId).maybeSingle(),
        supabase.from("charge_master").select("*").eq("company_id", activeCompanyId),
        supabase.from("clearinghouse_settings" as any).select("*").eq("company_id", activeCompanyId).maybeSingle(),
        supabase.from("trucks").select("*").eq("company_id", activeCompanyId).eq("is_simulated", false),
        supabase.from("profiles").select("id, full_name, cert_level, user_id, sex, employment_type, max_safe_team_lift_lbs, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok").eq("company_id", activeCompanyId).eq("is_simulated", false),
        supabase.from("patients").select("id, first_name, last_name, transport_type, primary_payer").eq("company_id", activeCompanyId).eq("is_simulated", false).limit(20),
        supabase.from("facilities").select("id, name").eq("company_id", activeCompanyId).limit(50),
      ]);
      if (cmp.data) setCompany({
        name: cmp.data.name ?? "",
        npi_number: cmp.data.npi_number ?? "",
        ein_number: (cmp.data as any).ein_number ?? "",
        state_of_operation: cmp.data.state_of_operation ?? "",
        address_street: (cmp.data as any).address_street ?? "",
        address_city: (cmp.data as any).address_city ?? "",
        address_state: (cmp.data as any).address_state ?? "",
        address_zip: (cmp.data as any).address_zip ?? "",
      });
      setRates(rt.data ?? []);
      if (chr.data) {
        const r = chr.data as any;
        setCh(prev => ({
          ...prev,
          clearinghouse_name: r.clearinghouse_name ?? prev.clearinghouse_name,
          submitter_id: r.submitter_id ?? "",
          submitter_name: r.submitter_name ?? "",
          receiver_id: r.receiver_id ?? "OFFICEALLY",
          contact_name: r.contact_name ?? "",
          contact_phone: r.contact_phone ?? "",
          sftp_host: r.sftp_host ?? prev.sftp_host,
          sftp_port: r.sftp_port ?? 22,
          inbound_folder: r.inbound_folder ?? "inbound",
          outbound_folder: r.outbound_folder ?? "outbound",
          sftp_username: r.sftp_username ?? "",
          sftp_password: "",
        }));
      }
      setTrucks(tk.data ?? []);
      setProfiles(pf.data ?? []);
      setPatients(pt.data ?? []);
      setFacilities(fc.data ?? []);
    })();
  }, [activeCompanyId]);

  // Step completion derived from useOnboardingProgress
  const stepDone = [
    progress.step_company_info_verified,
    progress.step_rates_verified,
    progress.step_clearinghouse_connected,
    progress.step_trucks_added,
    progress.step_team_invited,
    progress.step_patients_added,
  ];
  const completedCount = stepDone.filter(Boolean).length;
  const progressPct = (completedCount / 6) * 100;
  const allDone = completedCount === 6;

  // First incomplete step on load
  useEffect(() => {
    if (progress.loading) return;
    const first = stepDone.findIndex(d => !d);
    if (first >= 0) setCurrentStep(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.loading]);

  // Hard-locked navigation: can only open step N if all previous are done
  const canOpen = (i: number) => i === 0 || stepDone.slice(0, i).every(Boolean);

  const StepIcon = STEPS[currentStep].icon;

  // ---------- Step 1: Company ----------
  const validateCompany = (): string | null => {
    if (!company.name.trim()) return "Company name required";
    if (!/^\d{10}$/.test(company.npi_number)) return "NPI must be exactly 10 digits";
    const einDigits = company.ein_number.replace(/\D/g, "");
    if (einDigits.length !== 9) return "EIN must be exactly 9 digits";
    if (!company.state_of_operation) return "State required";
    if (!company.address_street.trim()) return "Street address required";
    if (!company.address_city.trim()) return "City required";
    if (!company.address_state) return "Address state required";
    const zipDigits = company.address_zip.replace(/\D/g, "");
    if (zipDigits.length !== 5 && zipDigits.length !== 9) return "ZIP must be 5 or 9 digits";
    return null;
  };
  const saveCompany = async () => {
    const err = validateCompany();
    if (err) { toast.error(err); return; }
    setCompanySaving(true);
    const { error } = await supabase.from("companies").update({
      name: company.name.trim(),
      npi_number: company.npi_number,
      ein_number: company.ein_number.replace(/\D/g, ""),
      state_of_operation: company.state_of_operation,
      address_street: company.address_street.trim(),
      address_city: company.address_city.trim(),
      address_state: company.address_state,
      address_zip: company.address_zip.replace(/\D/g, ""),
    } as any).eq("id", activeCompanyId!);
    if (error) { toast.error("Save failed: " + error.message); setCompanySaving(false); return; }
    await progress.markStep("step_company_info_verified", true);
    toast.success("Company info saved");
    setCompanySaving(false);
    setCurrentStep(1);
  };

  // ---------- Step 2: Rates ----------
  const updateRate = async (id: string, field: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    await supabase.from("charge_master").update({ [field]: num } as any).eq("id", id);
    setRates(rs => rs.map(r => r.id === id ? { ...r, [field]: num } : r));
  };
  const addRate = async () => {
    const base = parseFloat(newRate.base_rate);
    const mileage = parseFloat(newRate.mileage_rate);
    if (!(base > 0)) { toast.error("Base rate must be > 0"); return; }
    if (!(mileage > 0)) { toast.error("Mileage rate must be > 0"); return; }
    if (rates.some(r => r.payer_type === newRatePayer)) {
      toast.error(`A rate row already exists for ${newRatePayer}`);
      return;
    }
    const { data, error } = await supabase.from("charge_master").insert({
      company_id: activeCompanyId,
      payer_type: newRatePayer,
      base_rate: base,
      mileage_rate: mileage,
      oxygen_fee: parseFloat(newRate.oxygen_fee) || 0,
      extra_attendant_fee: parseFloat(newRate.extra_attendant_fee) || 0,
      bariatric_fee: parseFloat(newRate.bariatric_fee) || 0,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    setRates(rs => [...rs, data]);
    setNewRate({ base_rate: "", mileage_rate: "", oxygen_fee: "", extra_attendant_fee: "", bariatric_fee: "" });
    toast.success("Rate added");
  };
  const confirmRates = async () => {
    if (rates.length === 0) { toast.error("Add at least one rate row first"); return; }
    const bad = rates.find(r => !(r.base_rate > 0) || !(r.mileage_rate > 0));
    if (bad) { toast.error("All rates need base_rate > 0 and mileage_rate > 0"); return; }
    await progress.markStep("step_rates_verified", true);
    toast.success("Rates verified");
    setCurrentStep(2);
  };

  // ---------- Step 3: Clearinghouse ----------
  const saveClearinghouse = async () => {
    if (!ch.submitter_id.trim() || !ch.submitter_name.trim() || !ch.contact_name.trim() ||
        !ch.contact_phone.trim() || !ch.sftp_username.trim() || !ch.sftp_password.trim() ||
        !ch.receiver_id.trim()) {
      toast.error("All fields are required");
      return;
    }
    setChSaving(true);
    // Upsert clearinghouse_settings (NO password — that goes to credentials table)
    const { data: existing } = await supabase.from("clearinghouse_settings" as any)
      .select("id").eq("company_id", activeCompanyId).maybeSingle();
    const settingsRow = {
      company_id: activeCompanyId,
      clearinghouse_name: ch.clearinghouse_name,
      submitter_id: ch.submitter_id.trim(),
      submitter_name: ch.submitter_name.trim(),
      receiver_id: ch.receiver_id.trim(),
      contact_name: ch.contact_name.trim(),
      contact_phone: ch.contact_phone.trim(),
      sftp_host: ch.sftp_host,
      sftp_port: ch.sftp_port,
      inbound_folder: ch.inbound_folder,
      outbound_folder: ch.outbound_folder,
      sftp_username: ch.sftp_username.trim(),
      is_configured: true,
    };
    let chErr;
    if (existing) {
      ({ error: chErr } = await supabase.from("clearinghouse_settings" as any).update(settingsRow as any).eq("id", (existing as any).id));
    } else {
      ({ error: chErr } = await supabase.from("clearinghouse_settings" as any).insert(settingsRow as any));
    }
    if (chErr) { toast.error("Save failed: " + chErr.message); setChSaving(false); return; }

    // Password goes to server-only credentials table via edge function.
    // RLS denies direct client writes by design — only the service role
    // (running inside the edge function) may write to clearinghouse_credentials.
    const { data: credData, error: credInvokeErr } = await supabase.functions.invoke(
      "save-clearinghouse-credentials",
      { body: { sftp_password: ch.sftp_password } }
    );
    const credError = credInvokeErr?.message || (credData as any)?.error;
    if (credError) {
      console.error("credential save failed", credError);
      toast.error("Could not store password securely: " + credError);
      setChSaving(false);
      // Step is NOT marked complete — credentials are required.
      return;
    }
    setCh(prev => ({ ...prev, sftp_password: "" })); // never keep in memory
    await progress.markStep("step_clearinghouse_connected", true);
    toast.success("Clearinghouse connected");
    setChSaving(false);
    setCurrentStep(3);
  };

  // ---------- Step 4: Trucks ----------
  const saveTruck = async () => {
    if (!newTruck.name.trim()) { toast.error("Truck name required"); return; }
    const payload = {
      name: newTruck.name.trim(),
      vehicle_id: newTruck.vehicle_id.trim() || null,
      has_power_stretcher: newTruck.has_power_stretcher,
      has_stair_chair: newTruck.has_stair_chair,
      has_oxygen_mount: newTruck.has_oxygen_mount,
      has_bariatric_kit: newTruck.has_bariatric_kit,
      has_bariatric_stretcher: newTruck.has_bariatric_stretcher,
    };
    if (editingTruckId) {
      const { data, error } = await supabase.from("trucks").update(payload as any).eq("id", editingTruckId).select().single();
      if (error) { toast.error(error.message); return; }
      setTrucks(t => t.map(x => x.id === editingTruckId ? data : x));
      setEditingTruckId(null);
      toast.success("Truck updated");
    } else {
      const { data, error } = await supabase.from("trucks").insert({ ...payload, company_id: activeCompanyId } as any).select().single();
      if (error) { toast.error(error.message); return; }
      setTrucks(t => [...t, data]);
      await progress.markStep("step_trucks_added", true);
      toast.success("Truck added");
    }
    setNewTruck({ name: "", vehicle_id: "", has_power_stretcher: false, has_stair_chair: false, has_oxygen_mount: false, has_bariatric_kit: false, has_bariatric_stretcher: false });
  };
  const startEditTruck = (t: any) => {
    setEditingTruckId(t.id);
    setNewTruck({
      name: t.name ?? "",
      vehicle_id: t.vehicle_id ?? "",
      has_power_stretcher: !!t.has_power_stretcher,
      has_stair_chair: !!t.has_stair_chair,
      has_oxygen_mount: !!t.has_oxygen_mount,
      has_bariatric_kit: !!t.has_bariatric_kit,
      has_bariatric_stretcher: !!t.has_bariatric_stretcher,
    });
  };
  const cancelEditTruck = () => {
    setEditingTruckId(null);
    setNewTruck({ name: "", vehicle_id: "", has_power_stretcher: false, has_stair_chair: false, has_oxygen_mount: false, has_bariatric_kit: false, has_bariatric_stretcher: false });
  };
  const deleteTruck = async (id: string) => {
    if (trucks.length <= 1) {
      toast.error("You need at least one truck to complete this step. Add a replacement before deleting.");
      return;
    }
    const { error } = await supabase.from("trucks").delete().eq("id", id);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    setTrucks(t => t.filter(x => x.id !== id));
    if (editingTruckId === id) cancelEditTruck();
    toast.success("Truck deleted");
  };

  // ---------- Step 5: Crew ----------
  const addCrew = async () => {
    const email = newCrew.email.trim().toLowerCase();
    if (!email || !newCrew.first_name.trim() || !newCrew.last_name.trim()) {
      toast.error("Email, first name, last name required");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      toast.error("Enter a valid email address (e.g. name@example.com)");
      return;
    }
    setCrewSaving(true);
    const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email,
        password: tempPassword,
        full_name: `${newCrew.first_name.trim()} ${newCrew.last_name.trim()}`,
        role: newCrew.role,
        sex: newCrew.sex,
        cert_level: newCrew.cert_level,
        employment_type: newCrew.employment_type,
        max_safe_team_lift_lbs: newCrew.max_safe_team_lift_lbs,
        stair_chair_trained: newCrew.stair_chair_trained,
        bariatric_trained: newCrew.bariatric_trained,
        oxygen_handling_trained: newCrew.oxygen_handling_trained,
        lift_assist_ok: newCrew.lift_assist_ok,
        active: true,
      },
    });
    if (error || (data as any)?.error) {
      toast.error("Failed to add crew: " + (error?.message || (data as any)?.error));
      setCrewSaving(false);
      return;
    }
    // Reload profiles list
    await reloadProfiles();
    setNewCrew(emptyCrew());
    toast.success("Crew member added — login email sent");
    setCrewSaving(false);
  };

  const reloadProfiles = async () => {
    const { data: pf } = await supabase
      .from("profiles")
      .select("id, full_name, cert_level, user_id, sex, employment_type, max_safe_team_lift_lbs, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok")
      .eq("company_id", activeCompanyId)
      .eq("is_simulated", false);
    setProfiles(pf ?? []);
  };

  const startEditCrew = (p: any) => {
    const [first, ...rest] = (p.full_name ?? "").split(" ");
    setEditingCrew({
      id: p.id,
      user_id: p.user_id,
      first_name: first ?? "",
      last_name: rest.join(" "),
      sex: p.sex ?? "M",
      cert_level: p.cert_level ?? "EMT-B",
      employment_type: p.employment_type ?? "full_time",
      max_safe_team_lift_lbs: p.max_safe_team_lift_lbs ?? 250,
      stair_chair_trained: !!p.stair_chair_trained,
      bariatric_trained: !!p.bariatric_trained,
      oxygen_handling_trained: !!p.oxygen_handling_trained,
      lift_assist_ok: !!p.lift_assist_ok,
      role: "crew", // role lives in company_memberships; we update separately
    });
    // Fetch current role from membership
    (async () => {
      const { data: m } = await supabase.from("company_memberships").select("role").eq("user_id", p.user_id).maybeSingle();
      if (m) setEditingCrew((c: any) => c ? { ...c, role: m.role } : c);
    })();
  };

  const saveEditCrew = async () => {
    if (!editingCrew) return;
    if (!editingCrew.first_name.trim() || !editingCrew.last_name.trim()) {
      toast.error("First and last name required"); return;
    }
    setCrewEditSaving(true);
    const full_name = `${editingCrew.first_name.trim()} ${editingCrew.last_name.trim()}`;
    const { error: pErr } = await supabase.from("profiles").update({
      full_name,
      sex: editingCrew.sex,
      cert_level: editingCrew.cert_level,
      employment_type: editingCrew.employment_type,
      max_safe_team_lift_lbs: editingCrew.max_safe_team_lift_lbs,
      stair_chair_trained: editingCrew.stair_chair_trained,
      bariatric_trained: editingCrew.bariatric_trained,
      oxygen_handling_trained: editingCrew.oxygen_handling_trained,
      lift_assist_ok: editingCrew.lift_assist_ok,
    } as any).eq("id", editingCrew.id);
    if (pErr) { toast.error("Save failed: " + pErr.message); setCrewEditSaving(false); return; }
    if (editingCrew.role && ["dispatcher", "biller", "crew"].includes(editingCrew.role)) {
      await supabase.from("company_memberships").update({ role: editingCrew.role } as any).eq("user_id", editingCrew.user_id);
    }
    await reloadProfiles();
    setEditingCrew(null);
    setCrewEditSaving(false);
    toast.success("Crew member updated");
  };

  const deleteCrew = async (p: any) => {
    const otherCount = profiles.filter(x => x.user_id !== user?.id).length;
    if (otherCount <= 1 && !progress.step_team_invited) {
      toast.error("You need at least one invited crew member to complete this step. Add a replacement before deleting.");
      return;
    }
    const { data, error } = await supabase.functions.invoke("delete-pending-crew-member", {
      body: { target_user_id: p.user_id },
    });
    if (error || (data as any)?.error) {
      toast.error("Delete failed: " + (error?.message || (data as any)?.error));
      return;
    }
    await reloadProfiles();
    toast.success("Crew member removed");
  };

  const resendInvite = async (p: any) => {
    setResendingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-crew-invite", {
        body: { target_user_id: p.user_id, redirect_to: `${window.location.origin}/reset-password` },
      });
      if (error || (data as any)?.error) {
        toast.error("Resend failed: " + (error?.message || (data as any)?.error));
        return;
      }
      toast.success(`Invite link sent to ${(data as any)?.email ?? "user"}`);
    } finally {
      setResendingId(null);
    }
  };

  const hasEmtCapable = useMemo(
    () => profiles.some(p => EMT_CAPABLE.has(p.cert_level)),
    [profiles]
  );

  const completeCrewStep = async () => {
    if (!hasEmtCapable) {
      toast.error("Need at least one EMT-or-above profile (yourself counts if cert is set)");
      return;
    }
    await progress.markStep("step_team_invited", true);
    setCurrentStep(5);
  };

  // ---------- Step 6: Patient ----------
  const addPatient = async () => {
    const p = newPatient;
    if (!p.first_name.trim() || !p.last_name.trim()) { toast.error("Name required"); return; }
    if (!p.dob) { toast.error("DOB required"); return; }
    if (new Date(p.dob) > new Date()) { toast.error("DOB must be a past date"); return; }
    if (!p.sex) { toast.error("Sex required"); return; }
    if (!p.pickup_address.trim()) { toast.error("Pickup address required"); return; }
    if (!p.primary_payer) { toast.error("Primary payer required"); return; }
    if (!p.member_id.trim()) { toast.error("Member ID required"); return; }
    if (!p.transport_type) { toast.error("Transport type required"); return; }
    const icd = p.icd10_codes.split(",").map(s => s.trim()).filter(Boolean);
    if (p.transport_type === "dialysis" && icd.length === 0) {
      toast.error("ICD-10 codes required for dialysis");
      return;
    }
    setPatientSaving(true);
    const { data, error } = await supabase.from("patients").insert({
      first_name: p.first_name.trim(),
      last_name: p.last_name.trim(),
      dob: p.dob,
      sex: p.sex,
      pickup_address: p.pickup_address.trim(),
      primary_payer: p.primary_payer,
      member_id: p.member_id.trim(),
      secondary_payer: p.secondary_payer || null,
      secondary_member_id: p.secondary_member_id || null,
      mobility: p.mobility,
      oxygen_required: p.oxygen_required,
      standing_order: p.standing_order,
      pcs_on_file: p.pcs_on_file,
      pcs_signed_date: p.pcs_signed_date || null,
      pcs_expiration_date: p.pcs_expiration_date || null,
      prior_auth_number: p.prior_auth_number || null,
      prior_auth_expiration: p.prior_auth_expiration || null,
      notes: p.notes || null,
      transport_type: p.transport_type,
      facility_id: p.facility_id || null,
      icd10_codes: icd.length > 0 ? icd : null,
      company_id: activeCompanyId,
    } as any).select().single();
    if (error) { toast.error("Failed: " + error.message); setPatientSaving(false); return; }
    setPatients(ps => [...ps, data]);
    setNewPatient(emptyPatient());
    await progress.markStep("step_patients_added", true);
    toast.success("Patient added");
    setPatientSaving(false);
  };

  // ---------- Render ----------
  if (progress.loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  // Completion screen
  if (allDone) {
    return (
      <AdminLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <PartyPopper className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">You're set up.</CardTitle>
              <CardDescription>Your company is fully configured and ready to operate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))]" />
                    <span>{s.title}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t">
                <Button onClick={async () => {
                  await supabase.from("migration_settings").update({ wizard_completed: true } as any).eq("company_id", activeCompanyId!);
                  navigate("/scheduling");
                }} className="gap-2">
                  Next: Schedule Your First Run <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={async () => {
                  await supabase.from("migration_settings").update({ wizard_completed: true } as any).eq("company_id", activeCompanyId!);
                  navigate("/owner-dashboard");
                }}>
                  View Owner Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Getting Started</h1>
          <p className="text-sm text-muted-foreground">Complete each step in order. Steps unlock as you finish the one before.</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{completedCount} of 6 steps complete</span>
            <span className="font-medium">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {STEPS.map((s, i) => {
            const open = canOpen(i);
            const done = stepDone[i];
            return (
              <button
                key={i}
                onClick={() => open && setCurrentStep(i)}
                disabled={!open}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  currentStep === i
                    ? "border-primary bg-primary/5 text-primary"
                    : done
                    ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 text-[hsl(var(--status-green))]"
                    : !open
                    ? "border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : !open ? <Lock className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{i + 1}. {s.title}</span>
                <span className="md:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Step {currentStep + 1} — {STEPS[currentStep].title}</CardTitle>
                <CardDescription>{STEPS[currentStep].description}</CardDescription>
              </div>
              {stepDone[currentStep] && (
                <Badge variant="outline" className="ml-auto text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30">Complete</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* STEP 1: COMPANY INFO */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Company Name *</Label>
                  <Input value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>NPI * (10 digits)</Label>
                    <Input value={company.npi_number} onChange={e => setCompany(c => ({ ...c, npi_number: e.target.value.replace(/\D/g, "").slice(0, 10) }))} maxLength={10} placeholder="1234567890" />
                  </div>
                  <div className="space-y-1">
                    <Label>EIN * (XX-XXXXXXX)</Label>
                    <Input value={company.ein_number} onChange={e => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setCompany(c => ({ ...c, ein_number: raw.length > 2 ? `${raw.slice(0, 2)}-${raw.slice(2)}` : raw }));
                    }} maxLength={10} placeholder="12-3456789" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>State of Operation *</Label>
                  <Select value={company.state_of_operation} onValueChange={v => setCompany(c => ({ ...c, state_of_operation: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>{US_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Street Address *</Label>
                  <Input value={company.address_street} onChange={e => setCompany(c => ({ ...c, address_street: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>City *</Label>
                    <Input value={company.address_city} onChange={e => setCompany(c => ({ ...c, address_city: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>State *</Label>
                    <Select value={company.address_state} onValueChange={v => setCompany(c => ({ ...c, address_state: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{US_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>ZIP *</Label>
                    <Input value={company.address_zip} onChange={e => setCompany(c => ({ ...c, address_zip: e.target.value.replace(/\D/g, "").slice(0, 9) }))} placeholder="12345" />
                  </div>
                </div>
                <Button onClick={saveCompany} disabled={companySaving}>
                  {companySaving ? "Saving..." : "Save & Continue"} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* STEP 2: RATES */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {rates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rates yet. Add your first rate row below.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium">Payer</th>
                          <th className="px-2 py-2 text-right font-medium">Base</th>
                          <th className="px-2 py-2 text-right font-medium">Mileage</th>
                          <th className="px-2 py-2 text-right font-medium">Oxygen</th>
                          <th className="px-2 py-2 text-right font-medium">Extra Att.</th>
                          <th className="px-2 py-2 text-right font-medium">Bariatric</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.map(r => (
                          <tr key={r.id} className="border-t">
                            <td className="px-2 py-2 capitalize">{r.payer_type}</td>
                            <td className="px-2 py-1"><Input className="h-7 text-right text-xs" defaultValue={r.base_rate} onBlur={e => updateRate(r.id, "base_rate", e.target.value)} /></td>
                            <td className="px-2 py-1"><Input className="h-7 text-right text-xs" defaultValue={r.mileage_rate} onBlur={e => updateRate(r.id, "mileage_rate", e.target.value)} /></td>
                            <td className="px-2 py-1"><Input className="h-7 text-right text-xs" defaultValue={r.oxygen_fee ?? 0} onBlur={e => updateRate(r.id, "oxygen_fee", e.target.value)} /></td>
                            <td className="px-2 py-1"><Input className="h-7 text-right text-xs" defaultValue={r.extra_attendant_fee ?? 0} onBlur={e => updateRate(r.id, "extra_attendant_fee", e.target.value)} /></td>
                            <td className="px-2 py-1"><Input className="h-7 text-right text-xs" defaultValue={r.bariatric_fee ?? 0} onBlur={e => updateRate(r.id, "bariatric_fee", e.target.value)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium">Add rate row</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newRatePayer} onValueChange={setNewRatePayer}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Base rate *" value={newRate.base_rate} onChange={e => setNewRate(r => ({ ...r, base_rate: e.target.value }))} />
                    <Input placeholder="Mileage rate *" value={newRate.mileage_rate} onChange={e => setNewRate(r => ({ ...r, mileage_rate: e.target.value }))} />
                    <Input placeholder="Oxygen fee" value={newRate.oxygen_fee} onChange={e => setNewRate(r => ({ ...r, oxygen_fee: e.target.value }))} />
                    <Input placeholder="Extra attendant" value={newRate.extra_attendant_fee} onChange={e => setNewRate(r => ({ ...r, extra_attendant_fee: e.target.value }))} />
                    <Input placeholder="Bariatric fee" value={newRate.bariatric_fee} onChange={e => setNewRate(r => ({ ...r, bariatric_fee: e.target.value }))} />
                  </div>
                  <Button size="sm" variant="outline" onClick={addRate}>Add</Button>
                </div>
                <Button onClick={confirmRates}>Confirm Rates & Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </div>
            )}

            {/* STEP 3: CLEARINGHOUSE */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Clearinghouse *</Label>
                  <Select value={ch.clearinghouse_name} onValueChange={v => setCh(c => ({ ...c, clearinghouse_name: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Office Ally">Office Ally</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Submitter ID *</Label><Input value={ch.submitter_id} onChange={e => setCh(c => ({ ...c, submitter_id: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Submitter Name *</Label><Input value={ch.submitter_name} onChange={e => setCh(c => ({ ...c, submitter_name: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Receiver ID *</Label><Input value={ch.receiver_id} onChange={e => setCh(c => ({ ...c, receiver_id: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Contact Name *</Label><Input value={ch.contact_name} onChange={e => setCh(c => ({ ...c, contact_name: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Contact Phone *</Label><Input value={ch.contact_phone} onChange={e => setCh(c => ({ ...c, contact_phone: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>SFTP Host</Label><Input value={ch.sftp_host} onChange={e => setCh(c => ({ ...c, sftp_host: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>SFTP Port</Label><Input type="number" value={ch.sftp_port} onChange={e => setCh(c => ({ ...c, sftp_port: parseInt(e.target.value) || 22 }))} /></div>
                  <div className="space-y-1"><Label>Inbound Folder</Label><Input value={ch.inbound_folder} onChange={e => setCh(c => ({ ...c, inbound_folder: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Outbound Folder</Label><Input value={ch.outbound_folder} onChange={e => setCh(c => ({ ...c, outbound_folder: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>SFTP Username *</Label><Input value={ch.sftp_username} onChange={e => setCh(c => ({ ...c, sftp_username: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>SFTP Password *</Label><Input type="password" value={ch.sftp_password} onChange={e => setCh(c => ({ ...c, sftp_password: e.target.value }))} placeholder="••••••••" /></div>
                </div>
                <p className="text-xs text-muted-foreground">Password is stored server-side and cannot be retrieved later. Re-enter to update.</p>
                <Button onClick={saveClearinghouse} disabled={chSaving}>
                  {chSaving ? "Saving..." : "Save & Continue"} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* STEP 4: TRUCKS */}
            {currentStep === 3 && (
              <div className="space-y-4">
                {trucks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your trucks ({trucks.length})</p>
                    {trucks.map(t => (
                      <div key={t.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <Truck className="h-4 w-4 text-primary" />
                        <span className="flex-1">{t.name}{t.vehicle_id ? ` (${t.vehicle_id})` : ""}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTruck(t.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-sm font-medium">Add a truck</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Name *</Label><Input value={newTruck.name} onChange={e => setNewTruck(t => ({ ...t, name: e.target.value }))} placeholder="Unit 101" /></div>
                    <div className="space-y-1"><Label>Vehicle ID</Label><Input value={newTruck.vehicle_id} onChange={e => setNewTruck(t => ({ ...t, vehicle_id: e.target.value }))} placeholder="VIN or unit #" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: "has_power_stretcher", l: "Power Stretcher" },
                      { k: "has_stair_chair", l: "Stair Chair" },
                      { k: "has_oxygen_mount", l: "Oxygen Mount" },
                      { k: "has_bariatric_kit", l: "Bariatric Kit" },
                      { k: "has_bariatric_stretcher", l: "Bariatric Stretcher" },
                    ].map(eq => (
                      <label key={eq.k} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={(newTruck as any)[eq.k]} onCheckedChange={v => setNewTruck(t => ({ ...t, [eq.k]: v === true }))} />
                        {eq.l}
                      </label>
                    ))}
                  </div>
                  <Button size="sm" onClick={addTruck}>Add Truck</Button>
                </div>
                {trucks.length > 0 && (
                  <Button onClick={async () => { await progress.markStep("step_trucks_added", true); setCurrentStep(4); }}>
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            )}

            {/* STEP 5: CREW */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Team ({profiles.length})</p>
                  {profiles.map(p => (
                    <div key={p.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                      <UserPlus className="h-4 w-4 text-primary" />
                      <span className="flex-1">
                        {p.full_name}
                        {p.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(You — Owner)</span>}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{p.cert_level}</Badge>
                    </div>
                  ))}
                </div>
                {!hasEmtCapable && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800">
                    No EMT-or-above profile yet. You either need to set your own cert level (Account Settings) or invite someone certified before continuing.
                  </div>
                )}
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-sm font-medium">Invite a team member</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Email *</Label><Input type="email" value={newCrew.email} onChange={e => setNewCrew(c => ({ ...c, email: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Role *</Label>
                      <Select value={newCrew.role} onValueChange={v => setNewCrew(c => ({ ...c, role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>First Name *</Label><Input value={newCrew.first_name} onChange={e => setNewCrew(c => ({ ...c, first_name: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Last Name *</Label><Input value={newCrew.last_name} onChange={e => setNewCrew(c => ({ ...c, last_name: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Sex *</Label>
                      <Select value={newCrew.sex} onValueChange={v => setNewCrew(c => ({ ...c, sex: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SEX_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Cert Level *</Label>
                      <Select value={newCrew.cert_level} onValueChange={v => setNewCrew(c => ({ ...c, cert_level: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CERT_LEVELS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Employment *</Label>
                      <Select value={newCrew.employment_type} onValueChange={v => setNewCrew(c => ({ ...c, employment_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EMPLOYMENT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Max Team Lift (lbs)</Label><Input type="number" value={newCrew.max_safe_team_lift_lbs} onChange={e => setNewCrew(c => ({ ...c, max_safe_team_lift_lbs: parseInt(e.target.value) || 250 }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: "stair_chair_trained", l: "Stair Chair Trained" },
                      { k: "bariatric_trained", l: "Bariatric Trained" },
                      { k: "oxygen_handling_trained", l: "Oxygen Trained" },
                      { k: "lift_assist_ok", l: "Lift Assist OK" },
                    ].map(c => (
                      <label key={c.k} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={(newCrew as any)[c.k]} onCheckedChange={v => setNewCrew(p => ({ ...p, [c.k]: v === true }))} />
                        {c.l}
                      </label>
                    ))}
                  </div>
                  <Button size="sm" onClick={addCrew} disabled={crewSaving}>
                    {crewSaving ? "Adding..." : "Add & Send Invite"}
                  </Button>
                </div>
                <Button onClick={completeCrewStep} disabled={!hasEmtCapable}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* STEP 6: PATIENT */}
            {currentStep === 5 && (
              <div className="space-y-4">
                {patients.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Patients ({patients.length})</p>
                    {patients.map(p => (
                      <div key={p.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="flex-1">{p.first_name} {p.last_name}</span>
                        <Badge variant="outline" className="text-[10px]">{p.transport_type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-sm font-medium">Add a patient</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>First Name *</Label><Input value={newPatient.first_name} onChange={e => setNewPatient(p => ({ ...p, first_name: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Last Name *</Label><Input value={newPatient.last_name} onChange={e => setNewPatient(p => ({ ...p, last_name: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>DOB *</Label><Input type="date" value={newPatient.dob} onChange={e => setNewPatient(p => ({ ...p, dob: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Sex *</Label>
                      <Select value={newPatient.sex} onValueChange={v => setNewPatient(p => ({ ...p, sex: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{SEX_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Pickup Address *</Label>
                    <Input value={newPatient.pickup_address} onChange={e => setNewPatient(p => ({ ...p, pickup_address: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Transport Type *</Label>
                      <Select value={newPatient.transport_type} onValueChange={v => setNewPatient(p => ({ ...p, transport_type: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{TRANSPORT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Facility (optional)</Label>
                      <Select value={newPatient.facility_id || "none"} onValueChange={v => setNewPatient(p => ({ ...p, facility_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {facilities.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Primary Payer *</Label>
                      <Select value={newPatient.primary_payer} onValueChange={v => setNewPatient(p => ({ ...p, primary_payer: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{PAYER_OPTIONS.filter(o => o.value !== "default").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Member ID *</Label><Input value={newPatient.member_id} onChange={e => setNewPatient(p => ({ ...p, member_id: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Secondary Payer</Label>
                      <Select value={newPatient.secondary_payer || "none"} onValueChange={v => setNewPatient(p => ({ ...p, secondary_payer: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {PAYER_OPTIONS.filter(o => o.value !== "default").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Secondary Member ID</Label><Input value={newPatient.secondary_member_id} onChange={e => setNewPatient(p => ({ ...p, secondary_member_id: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1">
                    <Label>ICD-10 Codes (comma-separated{newPatient.transport_type === "dialysis" ? ", required" : ""})</Label>
                    <Input value={newPatient.icd10_codes} onChange={e => setNewPatient(p => ({ ...p, icd10_codes: e.target.value }))} placeholder="N18.6, I12.0" />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={newPatient.oxygen_required} onCheckedChange={v => setNewPatient(p => ({ ...p, oxygen_required: v === true }))} />Oxygen Required</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={newPatient.standing_order} onCheckedChange={v => setNewPatient(p => ({ ...p, standing_order: v === true }))} />Standing Order</label>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>PCS on File</Label>
                    <Switch checked={newPatient.pcs_on_file} onCheckedChange={v => setNewPatient(p => ({ ...p, pcs_on_file: v }))} />
                  </div>
                  {newPatient.pcs_on_file && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>PCS Signed</Label><Input type="date" value={newPatient.pcs_signed_date} onChange={e => setNewPatient(p => ({ ...p, pcs_signed_date: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>PCS Expires</Label><Input type="date" value={newPatient.pcs_expiration_date} onChange={e => setNewPatient(p => ({ ...p, pcs_expiration_date: e.target.value }))} /></div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Prior Auth #</Label><Input value={newPatient.prior_auth_number} onChange={e => setNewPatient(p => ({ ...p, prior_auth_number: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Auth Expires</Label><Input type="date" value={newPatient.prior_auth_expiration} onChange={e => setNewPatient(p => ({ ...p, prior_auth_expiration: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1"><Label>Notes</Label><Textarea value={newPatient.notes} onChange={e => setNewPatient(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
                  <Button onClick={addPatient} disabled={patientSaving}>
                    {patientSaving ? "Saving..." : "Add Patient"}
                  </Button>
                </div>
              </div>
            )}

            {/* Back button */}
            {currentStep > 0 && (
              <div className="flex justify-between mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(s => s - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
