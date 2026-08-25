/** Accepted image/document types for certification photos. */
export const CERT_PHOTO_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/** File-input accept string — kept broad so phone cameras and scans both work. */
export const CERT_PHOTO_ACCEPT = "image/*,.heic,.heif,application/pdf";

export const CERT_PHOTO_MAX_MB = 15;

export const CERT_PHOTO_HELP =
  `Photo or scan of the physical card. Accepted: JPG, PNG, WEBP, GIF, HEIC (iPhone photos) or PDF, up to ${CERT_PHOTO_MAX_MB}MB. ` +
  `Make sure the name, number, and expiration date are readable — reviewers approve or reject based on this image.`;

export const CERT_TOOLTIPS: Record<string, string> = {
  level:
    "Your certification level (EMR, EMT-B, EMT-A, EMT-P). This drives what runs you can be assigned to and whether the unit counts as BLS or ALS.",
  medic_number:
    "The state-issued Medic/EMT license number printed on your certification card. Enter it exactly as shown, including any letters.",
  card_number:
    "The ID or license number printed on the card (CPR card number, or driver's license number). Used to verify the document during review.",
  issue_date:
    "The date the card was issued. Optional, but it helps reviewers confirm the document is the current version.",
  expiration_date:
    "The date the card expires. Required. The system warns at 90, 60, and 30 days out and blocks truck assignment once it passes.",
  photo: CERT_PHOTO_HELP,
  medic_number_purpose:
    "Proves you are licensed at the level you are being scheduled at. Required before you can be assigned as the attendant on a truck.",
  cpr_purpose:
    "Current CPR/BLS card. Required by state EMS rules for anyone staffing a transport unit.",
  drivers_license_purpose:
    "Valid driver's license for anyone who may operate the unit. Kept on file for insurance and audit purposes.",
};

/** Returns a friendly reason if the file is not acceptable, otherwise null. */
export function validateCertPhoto(file: File): string | null {
  if (file.size > CERT_PHOTO_MAX_MB * 1024 * 1024) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. Please use one under ${CERT_PHOTO_MAX_MB}MB.`;
  }
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const okType = type.startsWith("image/") || type === "application/pdf";
  const okExt = /\.(jpe?g|png|webp|gif|heic|heif|pdf)$/.test(name);
  if (!okType && !okExt) {
    return "That file type isn't supported. Use a photo (JPG, PNG, WEBP, HEIC) or a PDF.";
  }
  return null;
}

/** Safe storage extension for a given file. */
export function certPhotoExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^(jpe?g|png|webp|gif|heic|heif|pdf)$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  if ((file.type || "").toLowerCase() === "application/pdf") return "pdf";
  const sub = (file.type || "").split("/")[1]?.toLowerCase();
  return sub && /^[a-z0-9]+$/.test(sub) ? sub : "jpg";
}
