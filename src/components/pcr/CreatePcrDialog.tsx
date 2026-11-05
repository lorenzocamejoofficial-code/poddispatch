import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";
import { checkDuplicateTrip } from "@/lib/duplicate-trip-check";
import { TRANSPORT_KINDS, TRANSPORT_KIND_LABELS, normalizeTransportKind, type TransportKind } from "@/lib/transport-vocabulary";
import {
  createManualPcr, isTruckOutOfService, validateManualPcrSetup,
  type ManualPcrErrors, type ManualPcrSetup,
} from "@/lib/manual-pcr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PatientOpt {
  id: string; first_name: string; last_name: string; dob: string | null;
  transport_type: string | null; primary_payer: string | null;
  pickup_address: string | null; dropoff_facility: string | null; icd10_codes: string[] | null;
}
interface TruckOpt { id: string; name: string; service_level: string | null }
interface ProfileOpt { id: string; full_name: string; cert_level: string | null }
interface CrewRow { id: string; member1?: { full_name: string } | null; member2?: { full_name: string } | null }

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const empty = (): ManualPcrSetup => ({
  patientId: "", transportKind: "", runDate: localToday(), pickupTime: "", legType: "A",
  truckId: "", existingCrewId: null, member1Id: "", member2Id: "",
  pickupLocation: "", destinationLocation: "", serviceLevel: "BLS",
});

const errCls = "border-destructive focus-visible:ring-destructive";

export function CreatePcrDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<ManualPcrSetup>(empty);
  const [errors, setErrors] = useState<ManualPcrErrors>({});
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [trucks, setTrucks] = useState<TruckOpt[]>([]);
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [crew, setCrew] = useState<CrewRow | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [dupWarned, setDupWarned] = useState(false);
  const [dupMessage, setDupMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setForm(empty()); setErrors({}); setSearch(""); setDupWarned(false); setDupMessage(null); setCrew(null); return; }
    (async () => {
      const cid = (await getActiveCompanyId()) ?? NO_COMPANY;
      const [p, t, pr] = await Promise.all([
        supabase.from("patients").select("id, first_name, last_name, dob, transport_type, primary_payer, pickup_address, dropoff_facility, icd10_codes").eq("company_id", cid).order("last_name").limit(1000),
        supabase.from("trucks").select("id, name, service_level").eq("company_id", cid).eq("active", true).order("name"),
        supabase.from("profiles").select("id, full_name, cert_level").eq("company_id", cid).eq("active", true).order("full_name"),
      ]);
      setPatients((p.data ?? []) as any);
      setTrucks((t.data ?? []) as any);
      setProfiles((pr.data ?? []) as any);
    })();
  }, [open]);

  // Existing crew on the selected truck/date
  useEffect(() => {
    if (!form.truckId || !form.runDate) { setCrew(null); setForm(f => ({ ...f, existingCrewId: null })); return; }
    (async () => {
      const cid = (await getActiveCompanyId()) ?? NO_COMPANY;
      const { data } = await supabase.from("crews")
        .select("id, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)")
        .eq("company_id", cid).eq("truck_id", form.truckId).eq("active_date", form.runDate).maybeSingle();
      setCrew((data as any) ?? null);
      setForm(f => ({ ...f, existingCrewId: (data as any)?.id ?? null }));
    })();
  }, [form.truckId, form.runDate]);

  const patient = patients.find(p => p.id === form.patientId) ?? null;
  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? patients.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) : patients;
  }, [patients, search]);

  const set = <K extends keyof ManualPcrSetup>(k: K, v: ManualPcrSetup[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined, ...(k === "patientId" || k === "transportKind" ? { icd10: undefined } : {}) }));
    if (k === "patientId" || k === "runDate" || k === "pickupTime") { setDupWarned(false); setDupMessage(null); }
  };

  const pickPatient = (id: string) => {
    const p = patients.find(x => x.id === id);
    set("patientId", id);
    if (!p) return;
    const kind = normalizeTransportKind(p.transport_type);
    setForm(f => ({
      ...f, patientId: id,
      transportKind: kind ?? f.transportKind,
      pickupLocation: f.legType === "A" ? (p.pickup_address ?? "") : (p.dropoff_facility ?? ""),
      destinationLocation: f.legType === "A" ? (p.dropoff_facility ?? "") : (p.pickup_address ?? ""),
    }));
  };

  const pickLeg = (leg: "A" | "B") => {
    setForm(f => leg === f.legType ? f : ({ ...f, legType: leg, pickupLocation: f.destinationLocation, destinationLocation: f.pickupLocation }));
  };

  const pickTruck = (id: string) => {
    const t = trucks.find(x => x.id === id);
    set("truckId", id);
    if (t?.service_level === "ALS" || t?.service_level === "BLS") setForm(f => ({ ...f, truckId: id, serviceLevel: t.service_level as any }));
  };

  const submit = async () => {
    const oos = form.truckId && form.runDate ? await isTruckOutOfService(form.truckId, form.runDate) : false;
    const errs = validateManualPcrSetup(form, { today: localToday(), patientIcd10: patient?.icd10_codes, truckOutOfService: oos });
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    if (!dupWarned) {
      const dup = await checkDuplicateTrip(form.patientId, form.runDate, form.pickupTime);
      if (dup.isDuplicate) {
        setDupWarned(true);
        setDupMessage(`This patient already has ${dup.existingTrips.length} trip(s) near this time on ${form.runDate}. Click Create PCR again to continue anyway.`);
        return;
      }
    }

    setSaving(true);
    try {
      const companyId = await getActiveCompanyId();
      if (!companyId) throw new Error("No active company");
      const tripId = await createManualPcr(form, companyId);
      sessionStorage.setItem("pcr_leg_type", form.legType);
      toast.success("PCR created");
      onOpenChange(false);
      navigate(`/pcr-office?tripId=${tripId}&mode=manual`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create the PCR");
    } finally {
      setSaving(false);
    }
  };

  const fieldErr = (k: keyof ManualPcrErrors) => errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create PCR</DialogTitle>
          <DialogDescription>Set up the run, then the PCR form opens pre-filled. It's documented and signed as the selected crew.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Patient</Label>
            <Input placeholder="Search patients…" value={search} onChange={e => setSearch(e.target.value)} className="mb-2" />
            <Select value={form.patientId} onValueChange={pickPatient}>
              <SelectTrigger aria-invalid={!!errors.patientId} className={errors.patientId ? errCls : ""}><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>
                {filteredPatients.map(p => <SelectItem key={p.id} value={p.id}>{p.last_name}, {p.first_name}{p.dob ? ` · ${p.dob}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {fieldErr("patientId")}
            {patient && (
              <p className="text-xs text-muted-foreground mt-1">
                Payer: {patient.primary_payer || "—"} · ICD-10: {patient.icd10_codes?.length ? patient.icd10_codes.join(", ") : "none"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Transport type</Label>
              <Select value={form.transportKind} onValueChange={v => set("transportKind", v as TransportKind)}>
                <SelectTrigger aria-invalid={!!errors.transportKind} className={errors.transportKind ? errCls : ""}><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{TRANSPORT_KINDS.map(k => <SelectItem key={k} value={k}>{TRANSPORT_KIND_LABELS[k]}</SelectItem>)}</SelectContent>
              </Select>
              {fieldErr("transportKind")}
            </div>
            <div>
              <Label>Direction</Label>
              <Select value={form.legType} onValueChange={v => pickLeg(v as "A" | "B")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A leg (to destination)</SelectItem>
                  <SelectItem value="B">B leg (return)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {errors.icd10 && <p className="text-xs text-destructive">{errors.icd10}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Run date</Label>
              <Input type="date" value={form.runDate} max={localToday()} onChange={e => set("runDate", e.target.value)} aria-invalid={!!errors.runDate} className={errors.runDate ? errCls : ""} />
              {fieldErr("runDate")}
            </div>
            <div>
              <Label>Pickup time</Label>
              <Input type="time" value={form.pickupTime} onChange={e => set("pickupTime", e.target.value)} aria-invalid={!!errors.pickupTime} className={errors.pickupTime ? errCls : ""} />
              {fieldErr("pickupTime")}
            </div>
          </div>

          <div>
            <Label>Truck</Label>
            <Select value={form.truckId} onValueChange={pickTruck}>
              <SelectTrigger aria-invalid={!!errors.truckId} className={errors.truckId ? errCls : ""}><SelectValue placeholder="Select truck" /></SelectTrigger>
              <SelectContent>{trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.service_level ? ` · ${t.service_level}` : ""}</SelectItem>)}</SelectContent>
            </Select>
            {fieldErr("truckId")}
          </div>

          <div>
            <Label>Crew</Label>
            {crew ? (
              <p className="text-sm text-foreground mt-1">
                Using the crew already on this truck that day: {crew.member1?.full_name ?? "—"}{crew.member2 ? ` & ${crew.member2.full_name}` : ""}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <Select value={form.member1Id} onValueChange={v => set("member1Id", v)} disabled={!form.truckId}>
                    <SelectTrigger aria-invalid={!!errors.member1Id} className={errors.member1Id ? errCls : ""}><SelectValue placeholder="Crew member 1" /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}{p.cert_level ? ` · ${p.cert_level}` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                  {fieldErr("member1Id")}
                </div>
                <div>
                  <Select value={form.member2Id} onValueChange={v => set("member2Id", v)} disabled={!form.truckId}>
                    <SelectTrigger aria-invalid={!!errors.member2Id} className={errors.member2Id ? errCls : ""}><SelectValue placeholder="Crew member 2" /></SelectTrigger>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}{p.cert_level ? ` · ${p.cert_level}` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                  {fieldErr("member2Id")}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Pickup location</Label>
            <Input value={form.pickupLocation} onChange={e => set("pickupLocation", e.target.value)} aria-invalid={!!errors.pickupLocation} className={errors.pickupLocation ? errCls : ""} />
            {fieldErr("pickupLocation")}
          </div>
          <div>
            <Label>Destination</Label>
            <Input value={form.destinationLocation} onChange={e => set("destinationLocation", e.target.value)} aria-invalid={!!errors.destinationLocation} className={errors.destinationLocation ? errCls : ""} />
            {fieldErr("destinationLocation")}
          </div>

          {dupMessage && (
            <div className="rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-2 text-xs text-[hsl(var(--status-yellow))]">
              {dupMessage}
            </div>
          )}

          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create PCR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
