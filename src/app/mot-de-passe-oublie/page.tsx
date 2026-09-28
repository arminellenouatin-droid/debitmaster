import Link from "next/link";
import type { Metadata } from "next";
import { ResetRequestForm } from "./ResetRequestForm";

export const metadata: Metadata = {
  title: "Mot de passe oublié | DebitManager",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-[var(--primary)]">← <span>DebitManager</span></Link>
        <div className="mx-auto max-w-xl py-12 sm:py-20"><ResetRequestForm /></div>
      </div>
    </main>
  );
}
