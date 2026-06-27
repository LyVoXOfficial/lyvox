"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal Switch component (role="switch").
 * Renders a toggle button compatible with aria-checked, aria-disabled.
 * Uses role="switch" so RTL `getByRole("switch")` works and
 * jest-dom's `toBeChecked()` / `toBeDisabled()` work via aria-checked / disabled attr.
 */
interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
}

function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  id,
  ...rest
}: SwitchProps) {
  return (
    <button
      role="switch"
      id={id}
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export { Switch };
