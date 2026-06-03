import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  refetch?: () => Promise<void> | void;
}

const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Other",
  "Unknown / Unable to determine",
];

const ETHNICITY_OPTIONS = [
  "Hispanic or Latino",
  "Not Hispanic or Latino",
  "Unknown / Unable to determine",
];

const SEX_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "U", label: "Unknown" },
];

const ADVANCE_DIRECTIVES = ["None", "DNR", "POLST / MOLST", "Living Will", "Unknown"];

const HISTORY_SOURCES = [
  "Patient",
  "Family member",
  "Bystander",
  "Healthcare provider",
  "Law enforcement",
  "Unable to obtain",
];

const BARRIERS = [
  "None",
  "Language",
  "Hearing impaired",
  "Visually impaired",
  "Cognitive / developmental",
  "Altered mental status",
  "Unconscious",
  "Physical",
  "Cultural / religious",
];

export function UnidentifiedPatientEmergencyCard({ trip, updateField, refetch }: Props) {
  const data = trip.unidentified_patient_json || {};
  const [confirmedUnidentified, setConfirmedUnidentified] = useState<boolean>(!!data.confirmed_unidentified);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);

  const save = (patch: Record<string, any>) =>
    updateField("unidentified_patient_json", { ...data, ...patch });

  const val = (k: string) => data[k] ?? "";

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      toast.info("Type at least 2 characters to search");
      return;
    }
    setSearching(true);
    const { data: rows, error } = await supabase
      .from("patients")
      .select("id, first_name, last_name, dob, sex, primary_payer, member_id")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,member_id.ilike.%${q}%`)
      .order("last_name", { ascending: true })
      .limit(25);
    setSearching(false);
    if (error) {
      toast.error("Search failed");
      return;
    }
    setResults(rows || []);
    if ((rows || []).length === 0) toast.info("No matching patients on file");
  };

  const linkPatient = async (patientId: string) => {
    setLinking(true);
    const { error } = await supabase
      .from("trip_records")
      .update({ patient_id: patientId, updated_at: new Date().toISOString() })
      .eq("id", trip.id);
    setLinking(false);
    if (error) {
      toast.error("Failed to link patient");
      return;
    }
    toast.success("Patient linked — PCR will prefill");
    await refetch?.();
  };

  // Gate: ask first before showing the full unidentified form
  if (!confirmedUnidentified) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">Emergency</Badge>
          <Badge variant="outline" className="text-xs">No patient linked</Badge>
        </div>

        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Is this patient already in your system?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Search by name or member ID. If found, link them and the PCR will prefill.
              Otherwise mark unidentified and capture the demographics manually.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
              placeholder="Last name, first name, or member ID"
              className="h-10 text-sm"
            />
            <Button type="button" onClick={runSearch} disabled={searching} className="h-10">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">Search</span>
            </Button>
          </div>

          {results.length > 0 && (
            <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
              {results.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 hover:bg-muted/40">
                  <div className="text-sm">
                    <div className="font-medium">{p.last_name}, {p.first_name}</div>
                    <div className="text-xs text-muted-foreground">
                      DOB {p.dob || "—"} · {p.sex || "—"} · {p.primary_payer || "No payer"} {p.member_id ? `· ${p.member_id}` : ""}
                    </div>
                  </div>
                  <Button type="button" size="sm" onClick={() => linkPatient(p.id)} disabled={linking}>
                    Link
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmedUnidentified(true);
                save({ confirmed_unidentified: true });
              }}
              className="h-10"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Not in system — document as unidentified
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="text-xs">Emergency</Badge>
        <Badge variant="outline" className="text-xs">Unidentified / Not on File</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-xs h-7"
          onClick={() => { setConfirmedUnidentified(false); save({ confirmed_unidentified: false }); }}
        >
          Search system again
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Patient is not in the system. Capture what you can — NEMSIS / state EMS aligned.
      </p>

      {/* Identity */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input value={val("first_name")} onChange={(e) => save({ first_name: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Last name">
            <Input value={val("last_name")} onChange={(e) => save({ last_name: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Middle / alias">
            <Input value={val("middle_name")} onChange={(e) => save({ middle_name: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="DOB">
            <Input type="date" value={val("dob")} onChange={(e) => save({ dob: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Approx. age (if DOB unknown)">
            <Input type="number" value={val("approx_age")} onChange={(e) => save({ approx_age: e.target.value })} placeholder="years" className="h-9 text-sm" />
          </Field>
          <Field label="Sex">
            <Select value={val("sex")} onValueChange={(v) => save({ sex: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{SEX_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Race">
            <Select value={val("race")} onValueChange={(v) => save({ race: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{RACE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ethnicity">
            <Select value={val("ethnicity")} onValueChange={(v) => save({ ethnicity: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{ETHNICITY_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Preferred language">
            <Input value={val("language")} onChange={(e) => save({ language: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="SSN (last 4)">
            <Input value={val("ssn_last4")} onChange={(e) => save({ ssn_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="h-9 text-sm" />
          </Field>
        </div>
      </section>

      {/* Contact / Address */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact &amp; Address</h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={val("phone")} onChange={(e) => save({ phone: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Street">
            <Input value={val("address_street")} onChange={(e) => save({ address_street: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="City">
            <Input value={val("address_city")} onChange={(e) => save({ address_city: e.target.value })} className="h-9 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="State">
              <Input value={val("address_state")} onChange={(e) => save({ address_state: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} className="h-9 text-sm" />
            </Field>
            <Field label="ZIP">
              <Input value={val("address_zip")} onChange={(e) => save({ address_zip: e.target.value })} className="h-9 text-sm" />
            </Field>
          </div>
        </div>
      </section>

      {/* Emergency contact / next of kin */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emergency Contact / Next of Kin</h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={val("nok_name")} onChange={(e) => save({ nok_name: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Relationship">
            <Input value={val("nok_relationship")} onChange={(e) => save({ nok_relationship: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Phone">
            <Input value={val("nok_phone")} onChange={(e) => save({ nok_phone: e.target.value })} className="h-9 text-sm" />
          </Field>
        </div>
      </section>

      {/* Clinical history */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinical History</h4>
        <Field label="Allergies (medications, food, environmental)">
          <Textarea value={val("allergies")} onChange={(e) => save({ allergies: e.target.value })} placeholder="e.g. NKDA, Penicillin, latex…" rows={2} className="text-sm" />
        </Field>
        <Field label="Current medications">
          <Textarea value={val("current_medications")} onChange={(e) => save({ current_medications: e.target.value })} placeholder="List meds, doses if known" rows={2} className="text-sm" />
        </Field>
        <Field label="Pertinent past medical / surgical history">
          <Textarea value={val("past_medical_history")} onChange={(e) => save({ past_medical_history: e.target.value })} rows={2} className="text-sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Advance directive">
            <Select value={val("advance_directive")} onValueChange={(v) => save({ advance_directive: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{ADVANCE_DIRECTIVES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Last oral intake (time / what)">
            <Input value={val("last_oral_intake")} onChange={(e) => save({ last_oral_intake: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Barriers to care">
            <Select value={val("barriers")} onValueChange={(v) => save({ barriers: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{BARRIERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="History source">
            <Select value={val("history_source")} onValueChange={(v) => save({ history_source: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{HISTORY_SOURCES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      {/* Insurance (optional in emergency) */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insurance <span className="text-muted-foreground/70 font-normal normal-case">(if known)</span></h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary payer">
            <Input value={val("primary_payer")} onChange={(e) => save({ primary_payer: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Member ID">
            <Input value={val("member_id")} onChange={(e) => save({ member_id: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Secondary payer">
            <Input value={val("secondary_payer")} onChange={(e) => save({ secondary_payer: e.target.value })} className="h-9 text-sm" />
          </Field>
          <Field label="Secondary member ID">
            <Input value={val("secondary_member_id")} onChange={(e) => save({ secondary_member_id: e.target.value })} className="h-9 text-sm" />
          </Field>
        </div>
      </section>

      {/* Physical */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Physical</h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight (lbs)">
            <Input
              type="number"
              value={trip.weight_lbs ?? ""}
              onChange={(e) => updateField("weight_lbs", e.target.value ? Number(e.target.value) : null)}
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Height">
            <Input value={val("height")} onChange={(e) => save({ height: e.target.value })} placeholder="e.g. 5'10&quot;" className="h-9 text-sm" />
          </Field>
        </div>
      </section>

      {/* Scene pickup address */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scene</h4>
        <Field label="Pickup / scene address">
          <Input
            value={trip.pickup_location ?? ""}
            onChange={(e) => updateField("pickup_location", e.target.value)}
            placeholder="Street, City, ST ZIP"
            className="h-9 text-sm"
          />
        </Field>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}