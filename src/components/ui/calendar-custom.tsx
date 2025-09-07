"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { enUS, ru, uz } from "date-fns/locale";

type CustomCalendarProps = React.ComponentProps<typeof DayPicker> & {
  className?: string;
  showOutsideDays?: boolean;
};

export const CustomCalendar = React.forwardRef<
  HTMLDivElement,
  CustomCalendarProps
>(({ className, showOutsideDays = true, ...props }, ref) => {
  const { i18n } = useTranslation('app');
  const locale = React.useMemo(() => {
    const lang = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
    if (lang.startsWith('ru')) return ru;
    if (lang.startsWith('uz')) return uz;
    return enUS;
  }, [i18n.language, i18n.resolvedLanguage]);
  return (
    <div
      ref={ref}
      className={cn(
        // Base container styling with glass-card effect
        "glass-card rounded-xl p-4 select-none",
        "bg-surface-1/70 backdrop-blur-xl border-money-green/10",
        "shadow-lg shadow-black/20",
        className
      )}
    >
  <DayPicker
        showOutsideDays={showOutsideDays}
  locale={locale}
        className={cn(
          "p-0 w-full",
          "text-foreground font-sans"
        )}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4 w-full",
          caption: "flex justify-center pt-1 relative items-center mb-4",
          caption_label: "text-base font-semibold text-foreground tracking-tight",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            "h-8 w-8 bg-transparent p-0 rounded-lg",
            "hover:bg-money-green/20 hover:text-foreground",
            "focus:bg-money-green/20 focus:text-foreground focus:outline-none focus:ring-2 focus:ring-money-green/30",
            "disabled:pointer-events-none disabled:opacity-50",
            "transition-all duration-200 ios-spring",
            "border border-transparent hover:border-money-green/20",
            "flex items-center justify-center"
          ),
          nav_button_previous: "absolute left-0",
          nav_button_next: "absolute right-0",
          table: "w-full border-collapse space-y-1",
          head_row: "flex mb-2",
          head_cell: cn(
            "text-muted-foreground rounded-md w-10 h-10",
            "font-medium text-xs uppercase tracking-wider",
            "flex items-center justify-center"
          ),
          row: "flex w-full mt-1",
          cell: cn(
            "relative p-0 text-center text-sm",
            "focus-within:relative focus-within:z-20",
            "w-10 h-10 flex items-center justify-center"
          ),
          day: cn(
            "h-9 w-9 p-0 font-medium text-sm rounded-lg",
            "hover:bg-money-green/20 hover:text-foreground transition-all duration-200 ios-spring",
            "focus:bg-money-green/20 focus:text-foreground focus:outline-none focus:ring-2 focus:ring-money-green/30 focus:ring-offset-0",
            "cursor-pointer select-none",
            "flex items-center justify-center",
            "active:scale-95 transform"
          ),
          day_range_end: "day-range-end",
          day_selected: cn(
            "bg-money-green text-black font-semibold",
            "hover:bg-money-green hover:text-black",
            "focus:bg-money-green focus:text-black",
            "shadow-sm shadow-money-green/30"
          ),
          day_today: cn(
            "bg-surface-2 text-foreground font-semibold",
            "hover:bg-money-green/20",
            "border border-money-green/30"
          ),
          day_outside: cn(
            "day-outside text-muted-foreground/60 opacity-50",
            "hover:bg-muted/50 hover:text-muted-foreground/60"
          ),
          day_disabled: cn(
            "text-muted-foreground/40 opacity-40 cursor-not-allowed",
            "hover:bg-transparent hover:text-muted-foreground/40"
          ),
          day_range_middle: cn(
            "aria-selected:bg-money-green/10 aria-selected:text-foreground",
            "rounded-none border-l border-r border-money-green/20"
          ),
          day_hidden: "invisible",
        }}
        {...props}
      />
    </div>
  );
});

CustomCalendar.displayName = "CustomCalendar";

// Export with additional utilities for common use cases
export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export interface CalendarState {
  selected: Date | Date[] | DateRange | undefined;
  month: Date;
}

// Hook for managing calendar state
export const useCalendarState = (initialDate?: Date) => {
  const [selected, setSelected] = React.useState<Date | undefined>(initialDate);
  const [month, setMonth] = React.useState<Date>(initialDate || new Date());

  return {
    selected,
    setSelected,
    month,
    setMonth,
  };
};

// Hook for managing date range state
export const useDateRangeState = (initialRange?: DateRange) => {
  const [selected, setSelected] = React.useState<DateRange | undefined>(initialRange);
  const [month, setMonth] = React.useState<Date>(
    initialRange?.from || new Date()
  );

  return {
    selected,
    setSelected,
    month,
    setMonth,
  };
};

// Utility function to disable past dates
export const disablePastDates = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// Utility function to disable future dates
export const disableFutureDates = (date: Date) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
};

// Utility function to disable weekends
export const disableWeekends = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

// Utility function to disable specific dates
export const disableDates = (dates: Date[]) => (date: Date) => {
  return dates.some(disabledDate => 
    date.getTime() === disabledDate.getTime()
  );
};