/**
 * Georgia DPH Pre-Trip Vehicle Inspection Master Checklist
 * State-required items — stored as a constant, not in the database.
 */

export interface InspectionItem {
  key: string;
  label: string;
  category: string;
}

export const INSPECTION_CATEGORIES = [
  "Exterior",
  "Interior Cab",
  "Patient Compartment",
  "Respiratory Equipment",
  "Diagnostic Equipment",
  "Bandaging and Dressings",
  "Immobilization and Extraction",
  "Patient Safety and Comfort",
  "Provider Safety",
  "Miscellaneous",
] as const;

export const MASTER_INSPECTION_ITEMS: InspectionItem[] = [
  // Exterior
  { key: "ext_horn", label: "Vehicle Horn Operational", category: "Exterior" },
  { key: "ext_siren", label: "Siren Operational", category: "Exterior" },
  { key: "ext_warning_lights", label: "All Warning Lights Operational", category: "Exterior" },
  { key: "ext_hazard_lights", label: "Hazard Lights Operational", category: "Exterior" },
  { key: "ext_headlights", label: "Headlights Operational High and Low Beam", category: "Exterior" },
  { key: "ext_turn_signals", label: "Turn Signals Operational Front and Rear", category: "Exterior" },
  { key: "ext_brake_lights", label: "Brake Lights Operational", category: "Exterior" },
  { key: "ext_reverse_light", label: "Reverse Light Operational", category: "Exterior" },
  { key: "ext_tail_lights", label: "Tail Lights Operational", category: "Exterior" },
  { key: "ext_scene_flood_lights", label: "Scene and Flood Lights Operational", category: "Exterior" },
  { key: "ext_wipers", label: "Wipers Operational", category: "Exterior" },
  { key: "ext_mirrors", label: "Mirrors Visible and Without Defect", category: "Exterior" },
  { key: "ext_backup_alarm", label: "Reverse Backup Alarm Operational", category: "Exterior" },
  { key: "ext_rear_bumper", label: "Rear Bumper and Step Intact", category: "Exterior" },
  { key: "ext_doors", label: "All Doors Operational Inside and Outside", category: "Exterior" },
  { key: "ext_tire_fl", label: "Tire Tread Depth Front Left", category: "Exterior" },
  { key: "ext_tire_fr", label: "Tire Tread Depth Front Right", category: "Exterior" },
  { key: "ext_tire_rli", label: "Tire Tread Depth Rear Left Inside", category: "Exterior" },
  { key: "ext_tire_rlo", label: "Tire Tread Depth Rear Left Outside", category: "Exterior" },
  { key: "ext_tire_rri", label: "Tire Tread Depth Rear Right Inside", category: "Exterior" },
  { key: "ext_tire_rro", label: "Tire Tread Depth Rear Right Outside", category: "Exterior" },
  { key: "ext_brakes", label: "Brakes Operational", category: "Exterior" },
  { key: "ext_windshield", label: "Windshield Free of Cracks Greater Than 3 Inches", category: "Exterior" },
  { key: "ext_service_name", label: "Service Name Displayed on Both Sides", category: "Exterior" },
  { key: "ext_vid_number", label: "VID Number Displayed on Both Sides", category: "Exterior" },
  { key: "ext_insurance", label: "Proof of Insurance Present", category: "Exterior" },
  { key: "ext_two_way_comm", label: "Two-Way Communication System Operational", category: "Exterior" },

  // Interior Cab
  { key: "cab_ac", label: "Air Conditioner Operational Front", category: "Interior Cab" },
  { key: "cab_heat", label: "Heating Operational Front", category: "Interior Cab" },
  { key: "cab_door_locks", label: "Door Locks Operational Front", category: "Interior Cab" },
  { key: "cab_seatbelt_driver", label: "Seatbelts Operational Driver", category: "Interior Cab" },
  { key: "cab_seatbelt_passenger", label: "Seatbelts Operational Passenger", category: "Interior Cab" },

  // Patient Compartment
  { key: "pc_ac", label: "Air Conditioner Operational Rear", category: "Patient Compartment" },
  { key: "pc_heat", label: "Heating Operational Rear", category: "Patient Compartment" },
  { key: "pc_exhaust_fan", label: "Exhaust Fan Operational", category: "Patient Compartment" },
  { key: "pc_lights", label: "All Patient Compartment Lights Operational", category: "Patient Compartment" },
  { key: "pc_door_locks", label: "All Door Locks Operational Rear", category: "Patient Compartment" },
  { key: "pc_seatbelts", label: "All Seatbelts Operational Patient Compartment", category: "Patient Compartment" },
  { key: "pc_cleanliness", label: "Cleanliness of Interior Free of Blood Dirt and Debris", category: "Patient Compartment" },
  { key: "pc_stretcher", label: "Multi-Level Stretcher with Straps and Safety Hook Functional", category: "Patient Compartment" },
  { key: "pc_mattress", label: "Mattress Impervious and Free of Rips", category: "Patient Compartment" },

  // Respiratory Equipment
  { key: "resp_fixed_suction", label: "Fixed Suction Unit Operational Minimum 300mmHg", category: "Respiratory Equipment" },
  { key: "resp_portable_suction", label: "Portable Suction Mechanical or Battery Powered", category: "Respiratory Equipment" },
  { key: "resp_suction_catheters", label: "Sterile Suction Catheters Assorted Sizes", category: "Respiratory Equipment" },
  { key: "resp_rigid_catheters", label: "Rigid Suction Catheters Sealed Packaging", category: "Respiratory Equipment" },
  { key: "resp_suction_tubing", label: "Suction Tubing Sealed Packaging", category: "Respiratory Equipment" },
  { key: "resp_bvm_adult", label: "Bag Valve Mask Adult Disposable", category: "Respiratory Equipment" },
  { key: "resp_bvm_pedi", label: "Pediatric BVM with Infant and Pediatric Masks", category: "Respiratory Equipment" },
  { key: "resp_o2_mask_adult", label: "Adult Oxygen Mask with Reservoir", category: "Respiratory Equipment" },
  { key: "resp_o2_mask_pedi", label: "Pediatric Oxygen Mask with Reservoir", category: "Respiratory Equipment" },
  { key: "resp_nasal_cannula", label: "Nasal Cannula", category: "Respiratory Equipment" },
  { key: "resp_npa", label: "Nasopharyngeal Airways Assorted Sizes with Lubricant", category: "Respiratory Equipment" },
  { key: "resp_opa", label: "Oropharyngeal Airways Assorted Sizes", category: "Respiratory Equipment" },
  { key: "resp_biad", label: "Blind Insertion Airway Devices Assorted Adult Sizes", category: "Respiratory Equipment" },
  { key: "resp_nebulizer", label: "Nebulizer Kit Adult and Pediatric", category: "Respiratory Equipment" },
  { key: "resp_o2_fixed", label: "Oxygen Fixed System Minimum 2000 Liters Each Cylinder at Least 600 PSI", category: "Respiratory Equipment" },
  { key: "resp_o2_portable", label: "Oxygen Portable Unit D Cylinder Minimum 600 PSI", category: "Respiratory Equipment" },
  { key: "resp_o2_spare", label: "Oxygen Spare Cylinder for Portable Unit", category: "Respiratory Equipment" },

  // Diagnostic Equipment
  { key: "diag_bp_cuffs", label: "Manual Aneroid Sphygmomanometer with Pediatric Adult and Large Adult Cuffs", category: "Diagnostic Equipment" },
  { key: "diag_stethoscope", label: "Stethoscope", category: "Diagnostic Equipment" },
  { key: "diag_pulse_ox", label: "Pulse Oximetry Device with Adult and Pediatric Clips", category: "Diagnostic Equipment" },
  { key: "diag_glucose", label: "Glucose Monitoring Instrument with Strips Lancets and Alcohol Preps", category: "Diagnostic Equipment" },
  { key: "diag_thermometer", label: "Non-Mercury Thermometer with Disposable Covers", category: "Diagnostic Equipment" },
  { key: "diag_penlight", label: "Penlight", category: "Diagnostic Equipment" },

  // Bandaging and Dressings
  { key: "band_tape", label: "Adhesive Tape Assorted Sizes", category: "Bandaging and Dressings" },
  { key: "band_triangular", label: "Triangular Bandages", category: "Bandaging and Dressings" },
  { key: "band_universal", label: "Universal Dressings 10x30 Inches", category: "Bandaging and Dressings" },
  { key: "band_gauze", label: "Sterile Gauze Pads 4x4 Non-Sterile 12 Count", category: "Bandaging and Dressings" },
  { key: "band_roller", label: "Soft Roller Bandages Self-Adhering Assorted Sizes", category: "Bandaging and Dressings" },
  { key: "band_elastic", label: "Elastic Bandages Assorted Sizes", category: "Bandaging and Dressings" },
  { key: "band_occlusive", label: "Occlusive Dressing Sterile Individually Wrapped", category: "Bandaging and Dressings" },
  { key: "band_tourniquet", label: "Commercially Made Arterial Tourniquet", category: "Bandaging and Dressings" },
  { key: "band_shears", label: "Heavy Duty Bandage Shears", category: "Bandaging and Dressings" },

  // Immobilization and Extraction
  { key: "imm_cervical_collars", label: "Cervical Collars Hard Type 4 Adult Assorted and 2 Pediatric", category: "Immobilization and Extraction" },
  { key: "imm_lateral_cervical", label: "Lateral Cervical Immobilization Devices", category: "Immobilization and Extraction" },
  { key: "imm_long_spine", label: "Long Spine Boards 16x72 Inches with 3 Straps", category: "Immobilization and Extraction" },
  { key: "imm_ked", label: "Short Spinal Extrication Device KED or Equivalent", category: "Immobilization and Extraction" },
  { key: "imm_pedi_device", label: "Pediatric Immobilization Device with 3 Straps", category: "Immobilization and Extraction" },
  { key: "imm_traction_splint", label: "Traction Splints Universal Lower Extremity", category: "Immobilization and Extraction" },
  { key: "imm_extremity", label: "Extremity Immobilization 2 Full Arms and 2 Full Legs", category: "Immobilization and Extraction" },
  { key: "imm_pedi_transport", label: "Pediatric Patient Transport Equipment", category: "Immobilization and Extraction" },

  // Patient Safety and Comfort
  { key: "psc_blankets", label: "Blankets", category: "Patient Safety and Comfort" },
  { key: "psc_waterproof_covers", label: "Waterproof Patient Covers", category: "Patient Safety and Comfort" },
  { key: "psc_mattress_covers", label: "Mattress Covers Disposable or Fabric", category: "Patient Safety and Comfort" },
  { key: "psc_pillow", label: "Pillow or Rolled Sheets", category: "Patient Safety and Comfort" },
  { key: "psc_emesis", label: "Emesis Basins or Bags", category: "Patient Safety and Comfort" },
  { key: "psc_urinal", label: "Urinal", category: "Patient Safety and Comfort" },
  { key: "psc_bedpan", label: "Bedpan", category: "Patient Safety and Comfort" },
  { key: "psc_restraints", label: "Restraints 2 Ankle and 2 Wrist", category: "Patient Safety and Comfort" },
  { key: "psc_infant_insulating", label: "Nonporous Infant Insulating Device", category: "Patient Safety and Comfort" },
  { key: "psc_ob_kit", label: "Obstetrical Kit Complete", category: "Patient Safety and Comfort" },
  { key: "psc_sharps", label: "Sharps Container Minimum 1 Quart", category: "Patient Safety and Comfort" },

  // Provider Safety
  { key: "ps_gloves", label: "Nitrile Exam Gloves 30 Each of 2 Sizes", category: "Provider Safety" },
  { key: "ps_ppe", label: "Personal Protection Equipment Face Shield Gown Mask", category: "Provider Safety" },
  { key: "ps_n95", label: "N95 Particulate Masks Minimum 2 Sizes", category: "Provider Safety" },
  { key: "ps_surgical_masks", label: "Surgical Face Masks", category: "Provider Safety" },
  { key: "ps_reflective", label: "ANSI Reflective Safety Wear for Each Crew Member", category: "Provider Safety" },
  { key: "ps_fire_extinguisher", label: "Fire Extinguisher 10 Pound ABC Charged with Current NFPA Tag", category: "Provider Safety" },
  { key: "ps_flashlight", label: "Flashlight", category: "Provider Safety" },
  { key: "ps_center_punch", label: "Spring Loaded Center Punch", category: "Provider Safety" },
  { key: "ps_screwdrivers", label: "Flathead and Phillips Screwdriver Minimum 6 Inches", category: "Provider Safety" },
  { key: "ps_work_gloves", label: "Work Gloves or Leather Gloves", category: "Provider Safety" },

  // Miscellaneous
  { key: "misc_aed", label: "AED with Adult and Pediatric Pads", category: "Miscellaneous" },
  { key: "misc_disinfectant", label: "Disinfectant Solution", category: "Miscellaneous" },
  { key: "misc_irrigation", label: "Irrigation Liquids 1000ml", category: "Miscellaneous" },
  { key: "misc_triage_tags", label: "Triage Tags SMART Compliant", category: "Miscellaneous" },
  { key: "misc_erg", label: "US DOT Emergency Response Guidebook Current Edition", category: "Miscellaneous" },
  { key: "misc_fema", label: "FEMA Job Aid or Resource Handbook Chemical Biological Nuclear", category: "Miscellaneous" },
  { key: "misc_protocol", label: "Agency Protocol Manual Hard Copy or Electronic", category: "Miscellaneous" },
];

/** Get all items for a category */
export function getItemsByCategory(category: string): InspectionItem[] {
  return MASTER_INSPECTION_ITEMS.filter(i => i.category === category);
}

/** Get all item keys */
export function getAllItemKeys(): string[] {
  return MASTER_INSPECTION_ITEMS.map(i => i.key);
}
