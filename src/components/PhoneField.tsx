"use client";

import { phoneCountries } from "@/lib/phone-countries";

type PhoneFieldProps = { label: string; countryCode: string; nationalNumber: string; onCountryChange: (value: string) => void; onNumberChange: (value: string) => void; required?: boolean; autoComplete?: string; hint?: string; dark?: boolean };

export function PhoneField({ label, countryCode, nationalNumber, onCountryChange, onNumberChange, required = true, autoComplete = "tel-national", hint, dark = false }: PhoneFieldProps) {
  const country = phoneCountries.find((item) => item.code === countryCode) ?? phoneCountries[0];
  return <div><label className={`block text-sm font-bold ${dark ? "text-white" : "text-[var(--ink)]"}`}>{label}</label><div className="mt-2 grid grid-cols-[minmax(150px,0.9fr)_1fr] gap-2"><select aria-label="Pays du numéro" value={country.code} onChange={(event) => onCountryChange(event.target.value)} className={`h-12 rounded-lg border px-3 text-sm font-bold ${dark ? "border-white/20 bg-white text-[var(--primary)]" : "border-[var(--line)] bg-[var(--background)] text-[var(--primary)]"}`}>{phoneCountries.map((item) => <option key={item.code} value={item.code}>{item.flag} {item.name} ({item.dialCode})</option>)}</select><div className="relative"><span className={`absolute inset-y-0 left-3 flex items-center text-sm font-black ${dark ? "text-[var(--primary)]" : "text-[var(--muted)]"}`} aria-hidden>{country.dialCode}</span><input value={nationalNumber} onChange={(event) => onNumberChange(event.target.value.replace(/[^\d\s()-]/g, ""))} required={required} type="tel" inputMode="tel" autoComplete={autoComplete} placeholder="Numéro national" className={`h-12 w-full rounded-lg border pl-14 pr-4 text-sm font-bold ${dark ? "border-white/20 bg-white text-[var(--primary)]" : "border-[var(--line)] bg-[var(--background)] text-[var(--primary)]"}`} /></div></div>{hint && <span className={`mt-2 block text-xs font-normal ${dark ? "text-white/65" : "text-[var(--muted)]"}`}>{hint}</span>}</div>;
}
