"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const hasTopMargin = /(?:^|\s)mt-2(?:\s|$)/.test(className);
  const inputClassName = className.replace(/(?:^|\s)mt-2(?=\s|$)/, " ").replace(/\s+/g, " ").trim();
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${hasTopMargin ? "mt-2" : ""}`}>
      <input {...props} type={visible ? "text" : "password"} className={`${inputClassName} pr-14`} />
      <button
        type="button"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-current transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--secondary)]"
      >
        <span aria-hidden="true" className="relative h-3.5 w-5 rounded-[65%_35%] border-2 border-current">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
        </span>
      </button>
    </div>
  );
}
