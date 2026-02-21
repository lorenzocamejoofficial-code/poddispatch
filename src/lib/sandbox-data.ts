/**
 * Synthetic data engine for Creator Sandbox Mode.
 * All data is fake — no PHI, no real company data.
 */

export const SANDBOX_COMPANY = {
  id: "00000000-0000-0000-0000-000000sandbox",
  name: "SandboxCo",
};

export interface SandboxTruck {
  id: string;
  name: string;
  crewNames: string[];
  runs: SandboxRun[];
}

export interface SandboxRun {
  id: string;
  patientName: string;
  pickupAddress: string;
  destination: string;
  pickupTime: string;
  status: "pending" | "en_route" | "arrived" | "with_patient" | "transporting" | "completed";
  tripType: string;
  chairTime?: string;
  notes?: string;
}

export interface SandboxPatient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  pickupAddress: string;
  dropoffFacility: string;
  transportType: string;
  scheduleDays: string;
  status: string;
  primaryPayer: string;
}

export interface SandboxTrip {
  id: string;
  patientName: string;
  runDate: string;
  pickupLocation: string;
  destination: string;
  status: string;
  loadedMiles: number;
  crewNames: string;
  documentationComplete: boolean;
  claimReady: boolean;
  tripType: string;
}

export interface SandboxClaim {
  id: string;
  patientName: string;
  runDate: string;
  payerName: string;
  totalCharge: number;
  status: string;
  submittedAt: string | null;
  paidAt: string | null;
}

export interface SandboxFacility {
  id: string;
  name: string;
  address: string;
  type: string;
  phone: string;
  active: boolean;
}

export interface SandboxEmployee {
  id: string;
  fullName: string;
  certLevel: string;
  phone: string;
  active: boolean;
}

// ─── Generators ───────────────────────────────────────────

export function generateTrucks(): SandboxTruck[] {
  return [
    {
      id: "truck-1", name: "Truck 101",
      crewNames: ["Alex Demo", "Jordan Test"],
      runs: [
        { id: "run-1", patientName: "Test Patient A", pickupAddress: "100 Demo Ave", destination: "Demo Dialysis Center", pickupTime: "06:30", status: "completed", tripType: "dialysis", chairTime: "07:00" },
        { id: "run-2", patientName: "Test Patient B", pickupAddress: "200 Sample St", destination: "Demo Dialysis Center", pickupTime: "06:45", status: "transporting", tripType: "dialysis", chairTime: "07:00" },
        { id: "run-3", patientName: "Test Patient C", pickupAddress: "300 Example Blvd", destination: "Demo Dialysis Center", pickupTime: "07:00", status: "en_route", tripType: "dialysis", chairTime: "07:30" },
      ],
    },
    {
      id: "truck-2", name: "Truck 102",
      crewNames: ["Casey Sandbox", "Morgan Mock"],
      runs: [
        { id: "run-4", patientName: "Test Patient D", pickupAddress: "400 Fake Ln", destination: "Sample Hospital", pickupTime: "08:00", status: "pending", tripType: "outpatient" },
        { id: "run-5", patientName: "Test Patient E", pickupAddress: "500 Test Dr", destination: "Demo Medical Center", pickupTime: "09:30", status: "pending", tripType: "discharge", notes: "Bariatric — need extra crew" },
      ],
    },
    {
      id: "truck-3", name: "Truck 103",
      crewNames: ["Riley Tester"],
      runs: [
        { id: "run-6", patientName: "Test Patient F", pickupAddress: "600 Mock Rd", destination: "Demo Dialysis Center", pickupTime: "06:15", status: "completed", tripType: "dialysis", chairTime: "06:45" },
        { id: "run-7", patientName: "Test Patient G", pickupAddress: "700 Pretend Way", destination: "Demo Dialysis Center", pickupTime: "06:30", status: "completed", tripType: "dialysis", chairTime: "07:00" },
        { id: "run-8", patientName: "Test Patient H", pickupAddress: "800 Sandbox Ct", destination: "Sample Clinic", pickupTime: "10:00", status: "pending", tripType: "outpatient" },
      ],
    },
    {
      id: "truck-4", name: "Truck 104",
      crewNames: ["Taylor Demo", "Sam Fake"],
      runs: [
        { id: "run-9", patientName: "Test Patient I", pickupAddress: "900 Example Ave", destination: "Demo Rehab Facility", pickupTime: "11:00", status: "pending", tripType: "hospital" },
      ],
    },
    {
      id: "truck-5", name: "Truck 105",
      crewNames: ["Pat Synthetic", "Drew Mockson"],
      runs: [],
    },
  ];
}

export function generatePatients(): SandboxPatient[] {
  return [
    { id: "p-1", firstName: "Test", lastName: "Patient A", dob: "1955-03-15", phone: "(555) 100-0001", pickupAddress: "100 Demo Ave", dropoffFacility: "Demo Dialysis Center", transportType: "dialysis", scheduleDays: "MWF", status: "active", primaryPayer: "Medicare" },
    { id: "p-2", firstName: "Test", lastName: "Patient B", dob: "1948-07-22", phone: "(555) 100-0002", pickupAddress: "200 Sample St", dropoffFacility: "Demo Dialysis Center", transportType: "dialysis", scheduleDays: "MWF", status: "active", primaryPayer: "Medicaid" },
    { id: "p-3", firstName: "Test", lastName: "Patient C", dob: "1960-11-08", phone: "(555) 100-0003", pickupAddress: "300 Example Blvd", dropoffFacility: "Demo Dialysis Center", transportType: "dialysis", scheduleDays: "TTS", status: "active", primaryPayer: "Medicare" },
    { id: "p-4", firstName: "Test", lastName: "Patient D", dob: "1972-01-30", phone: "(555) 100-0004", pickupAddress: "400 Fake Ln", dropoffFacility: "Sample Hospital", transportType: "outpatient", scheduleDays: "MWF", status: "active", primaryPayer: "Private Pay" },
    { id: "p-5", firstName: "Test", lastName: "Patient E", dob: "1965-05-12", phone: "(555) 100-0005", pickupAddress: "500 Test Dr", dropoffFacility: "Demo Medical Center", transportType: "outpatient", scheduleDays: "MWF", status: "in_hospital", primaryPayer: "Medicare" },
    { id: "p-6", firstName: "Test", lastName: "Patient F", dob: "1950-09-19", phone: "(555) 100-0006", pickupAddress: "600 Mock Rd", dropoffFacility: "Demo Dialysis Center", transportType: "dialysis", scheduleDays: "TTS", status: "active", primaryPayer: "Medicaid" },
    { id: "p-7", firstName: "Test", lastName: "Patient G", dob: "1958-12-03", phone: "(555) 100-0007", pickupAddress: "700 Pretend Way", dropoffFacility: "Demo Dialysis Center", transportType: "dialysis", scheduleDays: "TTS", status: "vacation", primaryPayer: "Medicare" },
    { id: "p-8", firstName: "Test", lastName: "Patient H", dob: "1970-04-25", phone: "(555) 100-0008", pickupAddress: "800 Sandbox Ct", dropoffFacility: "Sample Clinic", transportType: "outpatient", scheduleDays: "MWF", status: "active", primaryPayer: "Private Pay" },
  ];
}

export function generateTrips(): SandboxTrip[] {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { id: "t-1", patientName: "Test Patient A", runDate: today, pickupLocation: "100 Demo Ave", destination: "Demo Dialysis Center", status: "completed", loadedMiles: 12.4, crewNames: "Alex Demo, Jordan Test", documentationComplete: true, claimReady: true, tripType: "dialysis" },
    { id: "t-2", patientName: "Test Patient B", runDate: today, pickupLocation: "200 Sample St", destination: "Demo Dialysis Center", status: "en_route", loadedMiles: 0, crewNames: "Alex Demo, Jordan Test", documentationComplete: false, claimReady: false, tripType: "dialysis" },
    { id: "t-3", patientName: "Test Patient F", runDate: today, pickupLocation: "600 Mock Rd", destination: "Demo Dialysis Center", status: "completed", loadedMiles: 8.7, crewNames: "Riley Tester", documentationComplete: true, claimReady: true, tripType: "dialysis" },
    { id: "t-4", patientName: "Test Patient G", runDate: today, pickupLocation: "700 Pretend Way", destination: "Demo Dialysis Center", status: "completed", loadedMiles: 15.1, crewNames: "Riley Tester", documentationComplete: false, claimReady: false, tripType: "dialysis" },
    { id: "t-5", patientName: "Test Patient D", runDate: today, pickupLocation: "400 Fake Ln", destination: "Sample Hospital", status: "scheduled", loadedMiles: 0, crewNames: "Casey Sandbox, Morgan Mock", documentationComplete: false, claimReady: false, tripType: "outpatient" },
  ];
}

export function generateClaims(): SandboxClaim[] {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return [
    { id: "c-1", patientName: "Test Patient A", runDate: yesterday, payerName: "Medicare", totalCharge: 285.50, status: "submitted", submittedAt: yesterday, paidAt: null },
    { id: "c-2", patientName: "Test Patient F", runDate: yesterday, payerName: "Medicaid", totalCharge: 195.00, status: "paid", submittedAt: yesterday, paidAt: today },
    { id: "c-3", patientName: "Test Patient C", runDate: yesterday, payerName: "Medicare", totalCharge: 310.25, status: "denied", submittedAt: yesterday, paidAt: null },
    { id: "c-4", patientName: "Test Patient A", runDate: today, payerName: "Medicare", totalCharge: 285.50, status: "ready_to_bill", submittedAt: null, paidAt: null },
    { id: "c-5", patientName: "Test Patient G", runDate: today, payerName: "Medicare", totalCharge: 270.00, status: "needs_correction", submittedAt: null, paidAt: null },
  ];
}

export function generateFacilities(): SandboxFacility[] {
  return [
    { id: "f-1", name: "Demo Dialysis Center", address: "1000 Healthcare Way, Demo City", type: "dialysis", phone: "(555) 200-0001", active: true },
    { id: "f-2", name: "Sample Hospital", address: "2000 Medical Blvd, Demo City", type: "hospital", phone: "(555) 200-0002", active: true },
    { id: "f-3", name: "Demo Medical Center", address: "3000 Clinic Dr, Demo City", type: "hospital", phone: "(555) 200-0003", active: true },
    { id: "f-4", name: "Sample Clinic", address: "4000 Wellness St, Demo City", type: "clinic", phone: "(555) 200-0004", active: true },
    { id: "f-5", name: "Demo Rehab Facility", address: "5000 Recovery Ln, Demo City", type: "rehab", phone: "(555) 200-0005", active: false },
  ];
}

export function generateEmployees(): SandboxEmployee[] {
  return [
    { id: "e-1", fullName: "Alex Demo", certLevel: "EMT-B", phone: "(555) 300-0001", active: true },
    { id: "e-2", fullName: "Jordan Test", certLevel: "EMT-B", phone: "(555) 300-0002", active: true },
    { id: "e-3", fullName: "Casey Sandbox", certLevel: "EMT-A", phone: "(555) 300-0003", active: true },
    { id: "e-4", fullName: "Morgan Mock", certLevel: "EMT-B", phone: "(555) 300-0004", active: true },
    { id: "e-5", fullName: "Riley Tester", certLevel: "EMT-P", phone: "(555) 300-0005", active: true },
    { id: "e-6", fullName: "Taylor Demo", certLevel: "EMT-B", phone: "(555) 300-0006", active: true },
    { id: "e-7", fullName: "Sam Fake", certLevel: "AEMT", phone: "(555) 300-0007", active: true },
    { id: "e-8", fullName: "Pat Synthetic", certLevel: "EMT-B", phone: "(555) 300-0008", active: true },
    { id: "e-9", fullName: "Drew Mockson", certLevel: "EMT-B", phone: "(555) 300-0009", active: false },
  ];
}
