"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface DateStepperProps {
  value?: Date;
  onChange: (date: Date) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
  defaultToCurrentYear?: boolean;
  onDone?: (date: Date) => void;
}

const clampDayToMonth = (year: number, month: number, day: number) => {
  const last = new Date(year, month + 1, 0).getDate();
  return Math.min(day, last);
};

const monthKeys = [
  "jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"
];

export const DateStepper: React.FC<DateStepperProps> = ({
  value,
  onChange,
  className,
  minYear = new Date().getFullYear() - 6,
  maxYear = new Date().getFullYear() + 6,
  defaultToCurrentYear = true,
  onDone,
}) => {
  const { t, i18n } = useTranslation('app');
  const initial = value ?? new Date();
  const [step, setStep] = useState<"day" | "month" | "year">("day");
  const [selDay, setSelDay] = useState<number>(initial.getDate());
  const [selMonth, setSelMonth] = useState<number>(initial.getMonth());
  const [selYear, setSelYear] = useState<number>(
    defaultToCurrentYear ? new Date().getFullYear() : initial.getFullYear()
  );

  // Localized month labels
  const monthLabels = useMemo(
    () => monthKeys.map((k) => t(`app:dates.monthsShort.${k}`)),
    // re-compute on language changes
    [t, i18n.language, i18n.resolvedLanguage]
  );

  // keep internal selection in sync if parent changes value
  useEffect(() => {
    if (!value) return;
    setSelDay(value.getDate());
    setSelMonth(value.getMonth());
    setSelYear(defaultToCurrentYear ? new Date().getFullYear() : value.getFullYear());
  }, [value, defaultToCurrentYear]);

  // scroll selected year into view
  useEffect(() => {
    if (step !== "year") return;
    const el = document.querySelector<HTMLButtonElement>(`button[data-year='${selYear}']`);
    el?.scrollIntoView({ block: "center" });
  }, [step, selYear]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = minYear; y <= maxYear; y++) ys.push(y);
    return ys;
  }, [minYear, maxYear]);

  const commit = (y: number, m: number, d: number) => {
    const day = clampDayToMonth(y, m, d);
    const date = new Date(y, m, day);
    date.setHours(0, 0, 0, 0);

    // update parent + notify immediately
    onChange(date);
    onDone?.(date);

    // blur AFTER commit so popovers can close without swallowing the click
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
  };

  return (
  <div
      className={cn(
    "glass-card rounded-xl p-3 sm:p-4 select-none w-[280px] sm:w-[320px] pointer-events-auto relative z-[100]",
        "bg-surface-1/80 backdrop-blur-xl border border-money-green/10 shadow-lg shadow-black/20",
        className
      )}
  onPointerDownCapture={(e) => e.stopPropagation()}
  style={{ touchAction: "manipulation" }}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          {step === "day" && t('app:dateStepper.step', { current: 1, total: 3, phase: t('app:dateStepper.phases.day') })}
          {step === "month" && t('app:dateStepper.step', { current: 2, total: 3, phase: t('app:dateStepper.phases.month') })}
          {step === "year" && t('app:dateStepper.step', { current: 3, total: 3, phase: t('app:dateStepper.phases.year') })}
        </div>
        <div className="text-xs text-foreground/80">
          {selDay.toString().padStart(2, "0")} · {monthLabels[selMonth]} · {selYear}
        </div>
      </div>

      {step === "day" && (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <Button
              key={d}
              type="button"
              variant={selDay === d ? "default" : "outline"}
              className={cn(
                "h-8 px-0 text-xs rounded-md",
                selDay === d ? "bg-money-green text-black hover:bg-money-green" : ""
              )}
              onClick={() => {
                setSelDay(d);
                setStep("month");
              }}
            >
              {d}
            </Button>
          ))}
        </div>
      )}

      {step === "month" && (
        <div className="grid grid-cols-3 gap-2">
          {monthLabels.map((label, idx) => (
            <Button
              key={label}
              type="button"
              variant={selMonth === idx ? "default" : "outline"}
              className={cn(
                "h-9 text-xs rounded-md",
                selMonth === idx ? "bg-money-green text-black hover:bg-money-green" : ""
              )}
              onClick={() => {
                setSelMonth(idx);
                setStep("year");
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {step === "year" && (
        <div className="max-h-48 overflow-y-auto pr-2 pb-12 overscroll-contain">
          <div className="grid grid-cols-4 gap-2">
            {years.map((y) => (
              <Button
                key={y}
                type="button"
                variant={selYear === y ? "default" : "outline"}
                className={cn(
                  "h-9 text-xs rounded-md",
                  selYear === y ? "bg-money-green text-black hover:bg-money-green" : ""
                )}
                data-year={y}
                onClick={() => {
                  setSelYear(y);
                  // immediate commit also works by tapping a year
                  commit(y, selMonth, selDay);
                }}
              >
                {y}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* footer controls */}
      <div className="mt-3 flex items-center justify-between sticky bottom-0 bg-surface-1/95 backdrop-blur px-3 sm:px-4 py-2 border-t border-money-green/10 z-10">
        <Button
          type="button"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => {
            const now = value ?? new Date();
            setSelDay(now.getDate());
            setSelMonth(now.getMonth());
            setSelYear(defaultToCurrentYear ? new Date().getFullYear() : now.getFullYear());
            setStep("day");
          }}
        >
          {t('app:dateStepper.reset')}
        </Button>

        <div className="flex gap-2">
          {step === "day" && (
            <Button type="button" className="h-8 text-xs" onClick={() => setStep("month")}> 
              {t('app:dateStepper.next')}
            </Button>
          )}

          {step === "month" && (
            <>
              <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setStep("day")}>
                {t('app:dateStepper.back')}
              </Button>
              <Button type="button" className="h-8 text-xs" onClick={() => setStep("year")}>
                {t('app:dateStepper.next')}
              </Button>
            </>
          )}

          {step === "year" && (
  <Button
    type="button"
    className="h-8 text-xs"
    onClick={() => {
      commit(selYear, selMonth, selDay);      // calls onChange + onDone
    }}
  >
  {t('app:dateStepper.save')}
  </Button>
)}
        </div>
      </div>
    </div>
  );
};

export default DateStepper;
