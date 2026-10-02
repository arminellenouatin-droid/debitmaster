"use client";

import { useState, type ReactNode } from "react";

export type PasswordFieldProps = {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  hint?: ReactNode;
  dark?: boolean;
  disabled?: boolean;
};

export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  required = true,
  minLength = 8,
  autoComplete = "current-password",
  className = "",
  inputClassName = "",
  hint,
  dark = false,
  disabled = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id || (name ? `field-${name}` : undefined);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-bold ${dark ? "text-white" : "text-[var(--ink,text-slate-900)]"}`}
        >
          {label}
        </label>
      )}
      <div className={`relative ${label ? "mt-2" : ""}`}>
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-12 w-full rounded-xl border px-4 pr-12 text-sm outline-none transition focus:ring-2 ${
            dark
              ? "border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-amber-400/20"
              : "border-[var(--line,#e2e8f0)] bg-[var(--background,#ffffff)] text-[var(--primary,#0f172a)] placeholder:text-slate-400 focus:border-[var(--primary,#063327)] focus:ring-[var(--primary,#063327)]/15"
          } ${inputClassName}`}
        />
        <button
          type="button"
          tabIndex={0}
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className={`absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl transition ${
            dark
              ? "text-slate-400 hover:text-white focus-visible:outline-amber-400"
              : "text-slate-500 hover:text-[var(--primary,#063327)] focus-visible:outline-[var(--primary,#063327)]"
          }`}
        >
          {visible ? (
            // Eye slashed (hide password)
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
              />
            </svg>
          ) : (
            // Eye open (show password)
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          )}
        </button>
      </div>
      {hint && (
        <span
          className={`mt-2 block text-xs ${
            dark ? "text-slate-400" : "font-medium text-[var(--muted,#64748b)]"
          }`}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
