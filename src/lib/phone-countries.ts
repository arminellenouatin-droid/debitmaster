export type PhoneCountry = { code: string; name: string; dialCode: string; flag: string };

export const phoneCountries: PhoneCountry[] = [
  { code: "BJ", name: "Bénin", dialCode: "+229", flag: "🇧🇯" },
  { code: "CI", name: "Côte d’Ivoire", dialCode: "+225", flag: "🇨🇮" },
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫" },
  { code: "SN", name: "Sénégal", dialCode: "+221", flag: "🇸🇳" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "CM", name: "Cameroun", dialCode: "+237", flag: "🇨🇲" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "US", name: "États-Unis", dialCode: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
];

export const defaultPhoneCountry = phoneCountries[0];
export function composePhone(countryCode: string, nationalNumber: string) {
  const country = phoneCountries.find((item) => item.code === countryCode) ?? defaultPhoneCountry;
  return `${country.dialCode}${nationalNumber.replace(/[^\d]/g, "")}`;
}
