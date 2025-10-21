"use client";
import React from "react";
import { SlideUpModal } from "@/components/iOSAnimations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type InputModalFieldProps = {
  id?: string;
  label?: string;
  type?: "text" | "number" | "date" | "email" | "tel" | "url" | "search" | "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Renders a read-only input lookalike that, on mobile, opens a keyboard-aware modal
 * with a focused input. On desktop it renders a regular input inline.
 */
export default function InputModalField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  className = "",
  disabled,
}: InputModalFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [temp, setTemp] = React.useState<string>(value);
  const isMobile = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    try { return window.matchMedia("(max-width: 767px)").matches; } catch { return false; }
  }, []);

  React.useEffect(() => {
    if (!open) setTemp(value);
  }, [open, value]);

  if (!isMobile) {
    if (type === "textarea") {
      return (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
        />
      );
    }
    return (
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    );
  }

  // Mobile: open a modal on tap; render a read-only lookalike inline
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`w-full text-left rounded-md border border-input bg-surface-1 px-3 py-2 min-h-[40px] ${disabled ? "opacity-50" : ""} ${className}`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder || (type === "date" ? "YYYY-MM-DD" : "")}
        </span>
      </button>

      <SlideUpModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label || placeholder || "Edit"}
        height="half"
        keyboardAware
      >
        <div className="space-y-4">
          {type === "textarea" ? (
            <Textarea
              id={id}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder={placeholder}
              className="bg-surface-1"
              autoFocus
            />
          ) : (
            <Input
              id={id}
              type={type}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder={placeholder}
              className="bg-surface-1"
              autoFocus
            />
          )}

          {/* Spacer so fixed footer doesn't overlap content */}
          <div className="h-28" />
        </div>

        {/* Fixed footer above keyboard and safe-area */}
        <div className="fixed-container px-5 py-3">
          <div className="mx-auto max-w-md">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} className="h-11">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onChange(temp);
                  setOpen(false);
                }}
                className="h-11 bg-money-green text-black"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </SlideUpModal>
    </>
  );
}
