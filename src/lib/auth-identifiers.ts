// DebitManager auth identifiers: les comptes téléphone utilisent un e-mail interne non délivrable comme identifiant technique de secours.
export function normalizePhoneIdentifier(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const withPlus = compact.startsWith("+") ? compact : `+${compact}`;
  return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : "";
}

export function syntheticEmailForPhone(phone: string) {
  const normalized = normalizePhoneIdentifier(phone);
  if (!normalized) throw new Error("PHONE_IDENTIFIER_INVALID");
  return `phone-${normalized.slice(1)}@accounts.debitmanager.local`;
}
