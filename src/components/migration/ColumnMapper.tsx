import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ArrowRight, SkipForward } from "lucide-react";

const FIELD_MAPS: Record<string, { value: string; label: string }[]> = {
  patients: [
    { value: "first_name", label: "First Name" },
    { value: "last_name", label: "Last Name" },
    { value: "phone", label: "Phone" },
    { value: "dob", label: "Date of Birth" },
    { value: "pickup_address", label: "Pickup Address" },
    { value: "dropoff_facility", label: "Dropoff Facility" },
    { value: "primary_payer", label: "Primary Payer" },
    { value: "secondary_payer", label: "Secondary Payer" },
    { value: "member_id", label: "Member ID" },
    { value: "mobility", label: "Mobility" },
    { value: "weight_lbs", label: "Weight (lbs)" },
    { value: "schedule_days", label: "Schedule Days (MWF/TTS)" },
    { value: "chair_time", label: "Chair Time" },
    { value: "notes", label: "Notes" },
    { value: "transport_type", label: "Transport Type" },
    { value: "special_handling", label: "Special Handling" },
  ],
  facilities: [
    { value: "name", label: "Facility Name" },
    { value: "facility_type", label: "Type (dialysis/hospital)" },
    { value: "address", label: "Address" },
    { value: "phone", label: "Phone" },
    { value: "contact_name", label: "Contact Name" },
    { value: "notes", label: "Notes" },
  ],
  crews: [
    { value: "full_name", label: "Full Name" },
    { value: "phone_number", label: "Phone" },
    { value: "cert_level", label: "Cert Level" },
    { value: "sex", label: "Sex" },
  ],
  trip_history: [
    { value: "patient_name", label: "Patient Name" },
    { value: "run_date", label: "Trip Date" },
    { value: "pickup_location", label: "Pickup Location" },
    { value: "destination_location", label: "Destination" },
    { value: "loaded_miles", label: "Loaded Miles" },
    { value: "trip_type", label: "Trip Type" },
    { value: "notes", label: "Notes" },
  ],
  schedules: [
    { value: "patient_name", label: "Patient Name" },
    { value: "schedule_days", label: "Days (MWF/TTS)" },
    { value: "pickup_time", label: "Pickup Time" },
    { value: "pickup_address", label: "Pickup Address" },
    { value: "dropoff_facility", label: "Facility" },
    { value: "chair_time", label: "Chair Time" },
  ],
  mixed: [
    { value: "auto", label: "Auto-detect" },
  ],
};

// Simple fuzzy matching for auto-suggestions
function suggestMapping(header: string): string | null {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hints: Record<string, string[]> = {
    first_name: ["firstname", "fname", "first", "ptfirst", "patientfirst"],
    last_name: ["lastname", "lname", "last", "ptlast", "patientlast", "ptname", "patientname", "name"],
    phone: ["phone", "tel", "mobile", "cell"],
    dob: ["dob", "dateofbirth", "birthdate", "birthday", "birth"],
    pickup_address: ["puaddr", "pickupaddr", "pickupaddress", "address", "homeaddress", "homeaddr", "pickup"],
    dropoff_facility: ["facility", "dialysis", "dropoff", "destination", "dest", "dialysiscenter", "center"],
    primary_payer: ["payer", "insurance", "primarypayer", "primaryinsurance", "ins"],
    member_id: ["memberid", "insuranceid", "policynum", "policynumber", "memberno"],
    mobility: ["mobility", "ambulatory", "wheelchair", "stretcher"],
    weight_lbs: ["weight", "weightlbs", "wt"],
    schedule_days: ["days", "scheduledays", "dialdays", "recurringdays", "scheduleddays"],
    chair_time: ["chairtime", "chair", "treatmenttime"],
    notes: ["notes", "comments", "memo", "note"],
    full_name: ["fullname", "name", "employee", "crewmember", "crew"],
    run_date: ["date", "tripdate", "rundate", "servicedate"],
    loaded_miles: ["miles", "loadedmiles", "mileage", "distance"],
  };
  for (const [field, patterns] of Object.entries(hints)) {
    if (patterns.some(p => h.includes(p) || p.includes(h))) return field;
  }
  return null;
}

interface ColumnMapperProps {
  headers: string[];
  dataType: string;
  rows: Record<string, string>[];
  onComplete: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

export function ColumnMapper({ headers, dataType, rows, onComplete, onBack }: ColumnMapperProps) {
  const fields = FIELD_MAPS[dataType] || FIELD_MAPS.patients;

  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const auto: Record<string, string> = {};
    headers.forEach(h => {
      const suggested = suggestMapping(h);
      if (suggested && fields.some(f => f.value === suggested)) {
        auto[h] = suggested;
      }
    });
    return auto;
  });

  const mappedCount = Object.values(mapping).filter(v => v && v !== "_skip").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Map Your Columns</h3>
          <p className="text-sm text-muted-foreground">
            Match your spreadsheet columns to PodDispatch fields. We've auto-matched what we could.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {mappedCount} of {headers.length} mapped
        </Badge>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Preview (first 3 rows)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {headers.slice(0, 8).map(h => (
                    <th key={h} className="px-2 py-1 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {headers.slice(0, 8).map(h => (
                      <td key={h} className="px-2 py-1 text-foreground truncate max-w-[150px]">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mapping */}
      <div className="space-y-2">
        {headers.map(header => (
          <div key={header} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{header}</p>
              <p className="text-xs text-muted-foreground truncate">
                e.g. "{rows[0]?.[header] || "—"}"
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
              value={mapping[header] || "_skip"}
              onValueChange={val => setMapping(prev => ({ ...prev, [header]: val }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Skip this column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_skip">
                  <span className="flex items-center gap-2"><SkipForward className="h-3 w-3" /> Skip</span>
                </SelectItem>
                {fields.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mapping[header] && mapping[header] !== "_skip" && (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={() => onComplete(mapping)} disabled={mappedCount === 0}>
          Continue — Import {rows.length} rows
        </Button>
      </div>
    </div>
  );
}
