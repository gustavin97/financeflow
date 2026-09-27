"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/** Campo de senha com botão para mostrar/ocultar o que foi digitado. */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  className = "field pr-10",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-faint hover:text-ink"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
