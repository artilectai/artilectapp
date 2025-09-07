"use client";

import React from "react";
import { PhoneInput as BasePhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import "./phone-input.css";
import { cn } from "@/lib/utils";

export type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  defaultCountry?: string; // e.g. "us"
  placeholder?: string;
};

export function PhoneInput({
  value,
  onChange,
  id,
  disabled,
  className,
  inputClassName,
  defaultCountry,
  placeholder,
}: PhoneInputProps) {
  return (
  <BasePhoneInput
      value={value}
      onChange={onChange}
      defaultCountry={defaultCountry}
      disabled={disabled}
      placeholder={placeholder ?? "+1 415 555 2671"}
      inputProps={{
    id,
    name: id,
        autoComplete: "tel",
        inputMode: "tel",
      }}
      // Tailwind-friendly classes to match our Input styles
      className={cn("w-full", className)}
      inputClassName={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        inputClassName
      )}
      countrySelectorStyleProps={{
        buttonClassName: "h-9 border-input bg-transparent rounded-l-md",
        dropdownStyleProps: {
          className: "react-international-phone-country-selector-dropdown art-phone-dropdown",
        },
      }}
    />
  );
}

export default PhoneInput;
