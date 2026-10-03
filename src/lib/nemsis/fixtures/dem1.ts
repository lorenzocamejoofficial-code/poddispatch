/**
 * NEMSIS CTA 2026 DEM 1 test-case fixture (2026-DEM-1-FullSet_v351).
 * Static reference data only: no tenant, company or PHI data.
 * The raw text is the source of truth. The parser keeps every line in order and
 * never removes repeated element codes, because those are NEMSIS repeating groups.
 */

export const DEM1_META = {
  testCase: "2026-DEM-1-FullSet_v351",
  schemaVersion: "3.5.1",
  expected: "PASS",
} as const;

export const STATE_PLACEHOLDER = "[Value from StateDataSet]";
/** Fields the creator filled with PodDispatch software identity values. */
export const SOFTWARE_IDENTITY_CODES = ["dRecord.01", "dRecord.02", "dRecord.03"];

export interface FixtureField { code: string; value: string }
export interface FixtureEntity { label: string; fields: FixtureField[] }
export interface FixtureSection { name: string; entities: FixtureEntity[] }

const RAW = String.raw`
## dRecord
-- #1
dRecord.01 = PodDispatch
dRecord.02 = PodDispatch
dRecord.03 = 1.0

## dAgency
-- #1
dAgency.01 = 04568
dAgency.02 = 351-073-92
dAgency.03 = [Value from StateDataSet]
dAgency.04 = Georgia
dAgency.05 = Georgia
dAgency.06 = Elbert County
dAgency.07 = 13105000100
dAgency.08 = 30516
dAgency.05 = South Carolina
dAgency.06 = Anderson County
dAgency.07 = 45007010900
dAgency.08 = 29625
dAgency.09 = 911 Response (Scene) with Transport Capability
dAgency.10 = ALS Intercept
dAgency.11 = Paramedic
dAgency.12 = Mixed
dAgency.13 = Private, Nonhospital
dAgency.14 = Not For Profit
dAgency.15 = 2023
dAgency.16 = 659
dAgency.17 = 52774
dAgency.18 = 8451
dAgency.19 = 6905
dAgency.20 = 5009
dAgency.21 = 5501
dAgency.22 = 5866
dAgency.15 = 2024
dAgency.16 = 841
dAgency.17 = 67349
dAgency.18 = 10887
dAgency.19 = 8468
dAgency.20 = 6401
dAgency.21 = 7277
dAgency.22 = 7309
dAgency.23 = GMT-05:00 Eastern Time
dAgency.24 = Yes
dAgency.25 = 1465644320
dAgency.26 = [NV = Not Applicable]
dAgency.27 = Yes

## dContact
-- #1
dContact.01 = EMS Agency Director/Chief/Lead Administrator/CEO
dContact.02 = Runolfsson
dContact.03 = Arvilla
dContact.04 = Juliet
dContact.05 = 41 Benson Street
dContact.06 = Hartwell
dContact.07 = Georgia
dContact.08 = 30643
dContact.09 = United States
dContact.10 = [PhoneNumberType = Work] 706-376-0010
dContact.11 = [EmailAddressType = Work] director@s-h-ems.example.org
dContact.12 = https://s-h-ems.example.org/
-- #2
dContact.01 = EMS Medical Director
dContact.02 = Friesen
dContact.03 = Preston
dContact.04 = Michael
dContact.05 = 605 E Franklin Street
dContact.06 = Hartwell
dContact.07 = Georgia
dContact.08 = 30643
dContact.09 = United States
dContact.10 = [PhoneNumberType = Pager] 706-349-4187
dContact.11 = [EmailAddressType = Work] pmfriesen@s-h-ems.example.org
dContact.13 = Doctor of Osteopathy
dContact.14 = None (Not Board Certified)
dContact.15 = Compensated
dContact.16 = No
-- #3
dContact.01 = EMS Training/Education Specialist
dContact.02 = Boyle
dContact.03 = Duncan
dContact.05 = [StreetAddress2 = "PO Box 120"] 159 Gin Avenue
dContact.06 = Bowersville
dContact.07 = Georgia
dContact.08 = 30516-0120
dContact.09 = United States

## dConfiguration
-- #1
dConfiguration.01 = Georgia
dConfiguration.06 = Emergency Medical Technician - Intermediate
dConfiguration.07 = 128968000 - Vagal stimulation
dConfiguration.06 = Emergency Medical Technician (EMT)
dConfiguration.07 = 128968000 - Vagal stimulation
dConfiguration.06 = Paramedic
dConfiguration.07 = 103744005 - Administration of intravenous fluids
dConfiguration.06 = Community Paramedicine
dConfiguration.07 = 128968000 - Vagal stimulation
dConfiguration.08 = Emergency Medical Technician - Intermediate
dConfiguration.09 = [CodeType = RxNorm] 10368 - terbutaline
dConfiguration.08 = Emergency Medical Technician (EMT)
dConfiguration.09 = [CodeType = RxNorm] 1191 - aspirin
dConfiguration.08 = Paramedic
dConfiguration.09 = [CodeType = RxNorm] 1008377 - calcium chloride / lactate / potassium chloride / sodium chloride
dConfiguration.08 = Community Paramedicine
dConfiguration.09 = [CodeType = RxNorm] 10368 - terbutaline
dConfiguration.10 = Airway
dConfiguration.11 = Community Health Medicine
dConfiguration.12 = Yes
dConfiguration.13 = Yes, Less than 100% of the EMS Agency's Service Area
dConfiguration.14 = King EMD
dConfiguration.15 = Capnography-Waveform
dConfiguration.16 = Ambulance-11
dConfiguration.17 = Elbert County Dispatch Center
-- #2
dConfiguration.01 = South Carolina
dConfiguration.06 = Emergency Medical Technician - Intermediate
dConfiguration.07 = 128968000 - Vagal stimulation
dConfiguration.06 = Emergency Medical Technician (EMT)
dConfiguration.07 = 128968000 - Vagal stimulation
dConfiguration.06 = Paramedic
dConfiguration.07 = 103744005 - Administration of intravenous fluids
dConfiguration.08 = Emergency Medical Technician - Intermediate
dConfiguration.09 = [CodeType = RxNorm] 10368 - terbutaline
dConfiguration.08 = Emergency Medical Technician (EMT)
dConfiguration.09 = [CodeType = RxNorm] 1191 - aspirin
dConfiguration.08 = Paramedic
dConfiguration.09 = [CodeType = RxNorm] 1008377 - calcium chloride / lactate / potassium chloride / sodium chloride
dConfiguration.10 = Airway
dConfiguration.11 = Dive Rescue
dConfiguration.12 = Yes
dConfiguration.13 = No
dConfiguration.14 = Berge LLC
dConfiguration.15 = Capnography-Waveform
dConfiguration.16 = Ambulance-11
dConfiguration.17 = Oconee County Sheriff's Dispatch

## dLocation
-- #1
dLocation.01 = EMS Agency Headquarters
dLocation.02 = Hartwell Main Station
dLocation.03 = SH01
dLocation.04 = 34.351,-82.932
dLocation.05 = 17SLU2230902766
dLocation.06 = 41 Benson Street
dLocation.07 = Hartwell
dLocation.08 = Georgia
dLocation.09 = 30643
dLocation.10 = Hart County
dLocation.11 = United States
dLocation.12 = [PhoneNumberType = Work] 706-376-0010
-- #2
dLocation.01 = EMS Staging Area
dLocation.02 = Junction 77
dLocation.03 = SH91
dLocation.04 = 34.411,-83.024
dLocation.05 = 17SLU1397909586
dLocation.06 = 2183 Junction 77 Road
dLocation.07 = Hartwell
dLocation.08 = Georgia
dLocation.09 = 30643
dLocation.10 = Hart County
dLocation.11 = United States
-- #3
dLocation.01 = EMS Station
dLocation.02 = Elberton Station
dLocation.03 = SH02
dLocation.04 = 34.094,-82.847
dLocation.05 = 17SLT2961174118
dLocation.06 = 924 Elbert St
dLocation.07 = Elberton
dLocation.08 = Georgia
dLocation.09 = 30635
dLocation.10 = Elbert County
dLocation.11 = United States
dLocation.12 = [PhoneNumberType = Work] 864-392-7714

## dVehicle
-- #1
dVehicle.01 = ASR3471
dVehicle.02 = 1GDC4E1977F420160
dVehicle.03 = Ambulance-18
dVehicle.04 = Ambulance
dVehicle.05 = Emergency Medical Technician (EMT)
dVehicle.06 = 1
dVehicle.08 = 1
dVehicle.05 = Paramedic
dVehicle.06 = 1
dVehicle.08 = 1
dVehicle.10 = 2007
-- #2
dVehicle.01 = GA-6866-GF
dVehicle.03 = Water-22
dVehicle.04 = Watercraft
dVehicle.09 = 23900
dVehicle.10 = 1999
dVehicle.11 = 2023
dVehicle.12 = 52
dVehicle.11 = 2023
dVehicle.12 = 61
-- #3
dVehicle.01 = LSP4322
dVehicle.02 = 1FMJU1FTXGEF36883
dVehicle.03 = Chief-1
dVehicle.04 = Personal Vehicle
dVehicle.10 = 2016
-- #4
dVehicle.01 = MSP1633
dVehicle.02 = 3D73Y4CL0BG623030
dVehicle.03 = Ambulance-11
dVehicle.04 = Ambulance
dVehicle.05 = Paramedic
dVehicle.06 = 2
dVehicle.08 = 2
dVehicle.09 = 98500
dVehicle.10 = 2011
dVehicle.11 = 2023
dVehicle.13 = [DistanceUnit = Miles] 22099
dVehicle.11 = 2024
dVehicle.13 = [DistanceUnit = Miles] 24780
-- #5
dVehicle.01 = MSP5331
dVehicle.02 = 1FM5K8AB9LGB43096
dVehicle.03 = Mobile-32
dVehicle.04 = Other
dVehicle.09 = 45010
dVehicle.10 = 2020

## dPersonnel
-- #1
dPersonnel.01 = Hartmann
dPersonnel.02 = Aliza
dPersonnel.03 = Tava
dPersonnel.04 = 104 Cr-5-1-141
dPersonnel.05 = Calhoun Falls
dPersonnel.06 = South Carolina
dPersonnel.07 = 45001
dPersonnel.08 = United States
dPersonnel.09 = [PhoneNumberType = Mobile] 864-447-1344
dPersonnel.10 = [EmailAddressType = Work] athartmann@s-h-ems.example.org
dPersonnel.11 = December 18, 1981
dPersonnel.12 = [NV = Not Recorded]
dPersonnel.13 = Black or African American
dPersonnel.14 = CA
dPersonnel.15 = Bachelor's Degree
dPersonnel.16 = Biological and Biomedical Sciences
dPersonnel.17 = Operator Class D (Normal)
dPersonnel.20 = Persian
dPersonnel.21 = sh-12-322
dPersonnel.22 = Georgia
dPersonnel.23 = P149752
dPersonnel.24 = Paramedic
dPersonnel.25 = February 11, 2025
dPersonnel.26 = June 14, 2005
dPersonnel.27 = March 31, 2027
dPersonnel.22 = South Carolina
dPersonnel.23 = SC165478
dPersonnel.24 = Paramedic
dPersonnel.28 = P4746774
dPersonnel.29 = Paramedic
dPersonnel.30 = March 31, 2027
dPersonnel.31 = Full Time Paid Employee
dPersonnel.32 = July 1, 2013
dPersonnel.33 = March 18, 2012
dPersonnel.34 = Patient Care Provider
dPersonnel.36 = 13
dPersonnel.37 = March 31, 2025
dPersonnel.38 = Paramedic
dPersonnel.39 = March 18, 2012
dPersonnel.40 = Female
-- #2
dPersonnel.01 = Kassulke
dPersonnel.02 = Elinor
dPersonnel.03 = Daugherty
dPersonnel.04 = 200 Bo Hill Estate
dPersonnel.05 = Hartwell
dPersonnel.06 = Georgia
dPersonnel.07 = 30643
dPersonnel.08 = United States
dPersonnel.09 = [PhoneNumberType = Mobile] 706-367-8410
dPersonnel.10 = [EmailAddressType = Work] edkassulke@s-h-ems.example.org
dPersonnel.11 = February 29, 2000
dPersonnel.12 = [NV = Not Recorded]
dPersonnel.13 = White
dPersonnel.14 = US
dPersonnel.15 = Some College Credit, but Less than 1 Year
dPersonnel.17 = Operator Class D (Normal)
dPersonnel.21 = sh-18-012
dPersonnel.22 = Georgia
dPersonnel.23 = I325541
dPersonnel.24 = Emergency Medical Technician - Intermediate
dPersonnel.25 = February 24, 2025
dPersonnel.26 = January 9, 2021
dPersonnel.27 = March 31, 2027
dPersonnel.31 = Full Time Paid Employee
dPersonnel.32 = August 19, 2019
dPersonnel.33 = August 1, 2018
dPersonnel.34 = Patient Care Provider
dPersonnel.35 = Driver/Pilot
dPersonnel.36 = 7
dPersonnel.37 = August 1, 2025
dPersonnel.38 = Emergency Medical Technician - Intermediate
dPersonnel.39 = February 2, 2021
dPersonnel.38 = Emergency Medical Technician (EMT)
dPersonnel.39 = August 19, 2019
dPersonnel.40 = Female
-- #3
dPersonnel.01 = McCullough
dPersonnel.02 = William
dPersonnel.11 = May 16, 1968
dPersonnel.12 = [NV = Not Recorded]
dPersonnel.17 = Motorcycle-Class M
dPersonnel.18 = None
dPersonnel.21 = sh-07-401
dPersonnel.22 = Georgia
dPersonnel.23 = E014925
dPersonnel.24 = Emergency Medical Technician (EMT)
dPersonnel.25 = February 18, 2025
dPersonnel.27 = March 31, 2027
dPersonnel.22 = South Carolina
dPersonnel.23 = SC056908
dPersonnel.24 = Emergency Medical Technician (EMT)
dPersonnel.28 = E1690651
dPersonnel.29 = Emergency Medical Technician (EMT)
dPersonnel.30 = March 31, 2027
dPersonnel.31 = Full Time Paid Employee
dPersonnel.33 = December 3, 2007
dPersonnel.34 = Other
dPersonnel.35 = Driver/Pilot
dPersonnel.38 = Emergency Medical Technician (EMT)
dPersonnel.40 = Male
-- #4
dPersonnel.01 = Roob
dPersonnel.02 = André
dPersonnel.04 = [StreetAddress2 = "Apt 32"] 396 N Broad Street
dPersonnel.05 = Bowman
dPersonnel.06 = Georgia
dPersonnel.07 = 30624
dPersonnel.08 = United States
dPersonnel.09 = [PhoneNumberType = Work] 706-376-0081
dPersonnel.10 = [EmailAddressType = Work] aroob@s-h-ems.example.org
dPersonnel.11 = August 7, 1999
dPersonnel.12 = [NV = Not Recorded]
dPersonnel.13 = White
dPersonnel.14 = US
dPersonnel.15 = Associate Degree
dPersonnel.17 = Operator Class D (Normal)
dPersonnel.21 = sh-25-231
dPersonnel.22 = Georgia
dPersonnel.23 = P355418
dPersonnel.24 = Paramedic
dPersonnel.25 = October 19, 2025
dPersonnel.26 = October 19, 2025
dPersonnel.27 = March 31, 2027
dPersonnel.22 = South Carolina
dPersonnel.23 = SC288908
dPersonnel.24 = Paramedic
dPersonnel.28 = P7809225
dPersonnel.29 = Paramedic
dPersonnel.30 = September 30, 2027
dPersonnel.31 = Full Time Paid Employee
dPersonnel.32 = October 29, 2025
dPersonnel.33 = October 29, 2025
dPersonnel.34 = Patient Care Provider
dPersonnel.36 = 0
dPersonnel.37 = October 29, 2025
dPersonnel.38 = Paramedic
dPersonnel.39 = October 30, 2025
dPersonnel.38 = Community Paramedicine
dPersonnel.39 = October 30, 2025
dPersonnel.40 = Male
-- #5
dPersonnel.01 = Ward
dPersonnel.02 = Audrey
dPersonnel.03 = C
dPersonnel.09 = 706-345-5225
dPersonnel.10 = acward@s-h-ems.example.org
dPersonnel.12 = [NV = Not Recorded]
dPersonnel.15 = Master's Degree
dPersonnel.16 = Health Professions and Related Clinical Sciences, Not Including Emergency Medical Services
dPersonnel.18 = Hepatitis B
dPersonnel.19 = 2018
dPersonnel.18 = Varicella (Chickenpox)
dPersonnel.19 = 2023
dPersonnel.20 = Spanish
dPersonnel.21 = sh-25-243
dPersonnel.22 = Georgia
dPersonnel.23 = P480510
dPersonnel.24 = Paramedic
dPersonnel.28 = P6145648
dPersonnel.29 = Paramedic
dPersonnel.30 = June 30, 2027
dPersonnel.31 = Neither an Employee Nor a Volunteer
dPersonnel.33 = January 25, 2025
dPersonnel.34 = Patient Care Provider
dPersonnel.35 = Administrator/Manager
dPersonnel.38 = Community Paramedicine
dPersonnel.39 = January 29, 2025
dPersonnel.40 = Female

## dDevice
-- #1
dDevice.01 = DI42095
dDevice.02 = Blood Cooler A
dDevice.03 = Other
dDevice.04 = Delta Development Team
dDevice.05 = Delta ICE 2L Smart Blood Cooler
dDevice.06 = December 8, 2023
-- #2
dDevice.01 = G20-45493
dDevice.02 = Glucometer A
dDevice.03 = Chemistry Measurement-Glucometer
dDevice.04 = Links Medical Products, Inc.
dDevice.05 = Fora G20
-- #3
dDevice.01 = LF-2F541
dDevice.02 = Infusion A
dDevice.03 = Medication Infusion Pump
dDevice.04 = LifeFlow
dDevice.05 = LifeFlow PLUS
dDevice.06 = October 22, 2023
-- #4
dDevice.01 = M500.23561
dDevice.02 = EKG B
dDevice.03 = ECG-Less than 12 Lead (Cardiac Monitor)
dDevice.04 = Weber Medical Technologies, Inc.
dDevice.05 = MoniTech 500
-- #5
dDevice.01 = W2.30321E
dDevice.02 = eCPR C
dDevice.03 = CPR-External Device
dDevice.04 = Walsh
dDevice.05 = eCPR
dDevice.06 = July 11, 2023

## dFacility
-- #1
dFacility.01 = Assisted Living Facility
dFacility.02 = Hart Care Center
dFacility.03 = LTC10731132
dFacility.05 = [Value from StateDataSet]
dFacility.07 = [Value from StateDataSet]
dFacility.08 = [Value from StateDataSet]
dFacility.09 = [Value from StateDataSet]
dFacility.10 = [Value from StateDataSet]
dFacility.11 = [Value from StateDataSet]
dFacility.12 = [Value from StateDataSet]
dFacility.15 = [PhoneNumberType = [Value from StateDataSet]] [Value from StateDataSet]
-- #2 (type Hospital, two facilities)
dFacility.01 = Hospital
dFacility.02 = AnMed Health Medical Center
dFacility.03 = F00035711
dFacility.04 = [Value from StateDataSet]
dFacility.05 = [Value from StateDataSet]
dFacility.07 = [Value from StateDataSet]
dFacility.08 = [Value from StateDataSet]
dFacility.09 = [Value from StateDataSet]
dFacility.10 = [Value from StateDataSet]
dFacility.11 = [Value from StateDataSet]
dFacility.12 = [Value from StateDataSet]
dFacility.13 = [Value from StateDataSet]
dFacility.14 = [Value from StateDataSet]
dFacility.15 = [Value from StateDataSet]
dFacility.02 = Northeast Georgia Medical Center Gainesville
dFacility.03 = HOSPA0025
dFacility.04 = [Value from StateDataSet]
dFacility.05 = [Value from StateDataSet]
dFacility.07 = [Value from StateDataSet]
dFacility.08 = [Value from StateDataSet]
dFacility.09 = [Value from StateDataSet]
dFacility.10 = [Value from StateDataSet]
dFacility.11 = [Value from StateDataSet]
dFacility.12 = [Value from StateDataSet]
dFacility.13 = [Value from StateDataSet]
dFacility.14 = [Value from StateDataSet]
dFacility.15 = [PhoneNumberType = [Value from StateDataSet]] [Value from StateDataSet]
-- #3
dFacility.01 = Other EMS Responder (air)
dFacility.02 = Air Evac EMS
dFacility.03 = 148A01
-- #4
dFacility.01 = Skilled Nursing Facility
dFacility.02 = Brookdale Hartwell
dFacility.03 = PCH007787
dFacility.07 = [Value from StateDataSet]
dFacility.08 = [Value from StateDataSet]
dFacility.09 = [Value from StateDataSet]
dFacility.10 = [Value from StateDataSet]
dFacility.11 = [Value from StateDataSet]
dFacility.12 = [Value from StateDataSet]
dFacility.13 = [Value from StateDataSet]
dFacility.14 = [Value from StateDataSet]
dFacility.15 = [PhoneNumberType = [Value from StateDataSet]] [Value from StateDataSet]
`;

/** Order-preserving parse. Repeated codes are kept as separate entries. */
export function parseFixture(raw: string): FixtureSection[] {
  const sections: FixtureSection[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("## ")) { sections.push({ name: t.slice(3).trim(), entities: [] }); continue; }
    const sec = sections[sections.length - 1];
    if (t.startsWith("-- ")) { sec.entities.push({ label: t.slice(3).trim(), fields: [] }); continue; }
    const i = t.indexOf(" = ");
    if (i < 0) throw new Error(`Bad fixture line: ${t}`);
    sec.entities[sec.entities.length - 1].fields.push({ code: t.slice(0, i), value: t.slice(i + 3) });
  }
  return sections;
}

export const DEM1_SECTIONS: FixtureSection[] = parseFixture(RAW);

export interface StateResolution {
  stateId: string;
  name: string;
  registry: "sFacility" | "sAgency";
  /** Ordered `sFacility.NN` / `sAgency.NN` values. dFacility.NN maps to sFacility.NN. */
  fields: FixtureField[];
}

export const DEM1_STATE_RESOLUTIONS: StateResolution[] = [
  { stateId: "LTC10731132", name: "Hart Care Center", registry: "sFacility", fields: [
    { code: "sFacility.05", value: "1124386917" },
    { code: "sFacility.07", value: "261 Fairview Avenue" },
    { code: "sFacility.08", value: "331924" },
    { code: "sFacility.09", value: "13" },
    { code: "sFacility.10", value: "30643" },
    { code: "sFacility.11", value: "13147" },
    { code: "sFacility.12", value: "US" },
    { code: "sFacility.15", value: "[PhoneNumberType = 9913009] 706-376-7121" },
  ] },
  { stateId: "F00035711", name: "AnMed Health Medical Center", registry: "sFacility", fields: [
    { code: "sFacility.04", value: "9908005" },
    { code: "sFacility.04", value: "9908007" },
    { code: "sFacility.05", value: "1295755536" },
    { code: "sFacility.05", value: "1417919531" },
    { code: "sFacility.05", value: "1649290982" },
    { code: "sFacility.07", value: "800 North Fant Street" },
    { code: "sFacility.08", value: "1244878" },
    { code: "sFacility.09", value: "45" },
    { code: "sFacility.10", value: "29621" },
    { code: "sFacility.11", value: "45007" },
    { code: "sFacility.12", value: "US" },
    { code: "sFacility.13", value: "34.512,-82.646" },
    { code: "sFacility.14", value: "17SLU4890620158" },
    { code: "sFacility.15", value: "864-512-1000" },
  ] },
  { stateId: "HOSPA0025", name: "Northeast Georgia Medical Center Gainesville", registry: "sFacility", fields: [
    { code: "sFacility.04", value: "9908001" },
    { code: "sFacility.04", value: "9908021" },
    { code: "sFacility.04", value: "9908033" },
    { code: "sFacility.04", value: "9908043" },
    { code: "sFacility.05", value: "1427055821" },
    { code: "sFacility.05", value: "1437185261" },
    { code: "sFacility.05", value: "1720015993" },
    { code: "sFacility.07", value: "743 Spring Street NE" },
    { code: "sFacility.08", value: "355972" },
    { code: "sFacility.09", value: "13" },
    { code: "sFacility.10", value: "30501" },
    { code: "sFacility.11", value: "13139" },
    { code: "sFacility.12", value: "US" },
    { code: "sFacility.13", value: "34.304,-83.817" },
    { code: "sFacility.14", value: "17SKT4074899457" },
    { code: "sFacility.15", value: "[PhoneNumberType = 9913001] 770-219-6206" },
    { code: "sFacility.15", value: "[PhoneNumberType = 9913009] 770-219-9000" },
  ] },
  { stateId: "PCH007787", name: "Brookdale Hartwell", registry: "sFacility", fields: [
    { code: "sFacility.07", value: "45 Walnut Street" },
    { code: "sFacility.08", value: "331924" },
    { code: "sFacility.09", value: "13" },
    { code: "sFacility.10", value: "30643" },
    { code: "sFacility.11", value: "13147" },
    { code: "sFacility.12", value: "US" },
    { code: "sFacility.13", value: "34.355,-82.918" },
    { code: "sFacility.14", value: "17SLU23600318" },
    { code: "sFacility.15", value: "[PhoneNumberType = 9913009] 706-376-6166" },
  ] },
  { stateId: "148A01", name: "Air Evac EMS", registry: "sAgency", fields: [
    { code: "sAgency.01", value: "57514" },
    { code: "sAgency.02", value: "148A01" },
    { code: "sAgency.03", value: "Air Evac EMS" },
  ] },
];

/** Resolved values for a dFacility.NN placeholder, by the facility's state id (dFacility.03). */
export function resolveFacilityField(stateId: string | undefined, dCode: string): string[] {
  if (!stateId) return [];
  const r = DEM1_STATE_RESOLUTIONS.find((x) => x.stateId === stateId && x.registry === "sFacility");
  if (!r) return [];
  const s = dCode.replace("dFacility.", "sFacility.");
  return r.fields.filter((f) => f.code === s).map((f) => f.value);
}
