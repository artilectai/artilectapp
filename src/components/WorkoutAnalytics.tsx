"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Calendar, Flame, Target, TrendingUp, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

/* ----------------------------- Types & Helpers ---------------------------- */

interface WorkoutMetrics {
  completedWorkouts: number;             // sessions = finished workouts
  totalPlannedWorkouts: number;          // sum of program frequencies
  totalCaloriesBurned: number;
  averageWorkoutDuration: number;        // minutes
  currentStreak: number;                 // days
  longestStreak: number;                 // days
  workoutTypes: {
    cardio: number;
    strength: number;
    flexibility: number;
    sports: number;
  };
  weeklyFrequency: number[];             // Mon..Sun sessions
  progressMetrics: {
    totalWeightLifted: number;
    totalDistanceRun: number;
    averageHeartRate: number;
  };
  weeklyCalories: number[];              // last 4 weeks
  monthlyWorkouts: number[];             // Jan..Dec (this year)
}

interface WorkoutAnalyticsProps {
  metrics?: Partial<WorkoutMetrics>;     // optional overrides
}

const formatNumber = (v?: number | null) =>
  v === undefined || v === null || isNaN(v as number) ? "0" : Number(v).toLocaleString();

const n = (v?: number | null) => (v === undefined || v === null || isNaN(v as number) ? 0 : Number(v));

const parseJSON = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

type Program = {
  id: string;
  sportType: "strength" | "cardio" | "sports" | "flexibility";
  frequency?: number;
};
type History = { programId: string; startedAt: string; endedAt: string; durationMin: number };
type TodayTracker = { date: string; steps: number; water: number; weightKg: number; activeMinutes: number };

const mondayStartOfWeek = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7; // 0=Sun -> 6; 1=Mon -> 0
  date.setDate(date.getDate() - diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
};

const sameDay = (a: Date, b: Date) => {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

// Locale will be derived from i18n in the component

const computeStreaks = (history: History[]) => {
  const days = Array.from(
    new Set(
      history
        .map((h) => new Date(h.startedAt))
        .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
    )
  ).sort((a, b) => a - b);

  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1,
    current = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const cur = new Date(days[i]);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(days[days.length - 1]);
  const gap = Math.round((today.getTime() - last.getTime()) / 86400000);
  const normalizedCurrent = gap <= 1 ? current : 0;
  return { current: normalizedCurrent, longest };
};

const initialMetrics: WorkoutMetrics = {
  completedWorkouts: 0,
  totalPlannedWorkouts: 0,
  totalCaloriesBurned: 0,
  averageWorkoutDuration: 0,
  currentStreak: 0,
  longestStreak: 0,
  workoutTypes: { cardio: 0, strength: 0, flexibility: 0, sports: 0 },
  weeklyFrequency: [0, 0, 0, 0, 0, 0, 0],
  progressMetrics: { totalWeightLifted: 0, totalDistanceRun: 0, averageHeartRate: 0 },
  weeklyCalories: [0, 0, 0, 0],
  monthlyWorkouts: Array(12).fill(0),
};

/* -------------------------------- Component ------------------------------- */

export const WorkoutAnalytics: React.FC<WorkoutAnalyticsProps> = ({ metrics }) => {
  const { t, i18n } = useTranslation("app");
  const [live, setLive] = useState<WorkoutMetrics>(initialMetrics);
  const lastLiveRef = useRef<WorkoutMetrics>(initialMetrics);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartKey, setChartKey] = useState(0); // force chart resize re-render on container size change
  const [programsState, setProgramsState] = useState<Program[]>([]);
  const [historyState, setHistoryState] = useState<History[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => mondayStartOfWeek(new Date()));
  const todayIdx = (d: Date) => (d.getDay() + 6) % 7; // Monday=0
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => todayIdx(new Date()));

  // Map app language to Intl locale
  const locale: string = useMemo(() => {
    const lang = i18n.resolvedLanguage || i18n.language || "en";
    if (lang.startsWith("ru")) return "ru-RU";
    if (lang.startsWith("uz")) return "uz-UZ";
    return "en-US";
  }, [i18n.resolvedLanguage, i18n.language]);

  // Recompute metrics from localStorage so analytics reflects real progress
  useEffect(() => {
    const compute = () => {
      const programs = parseJSON<Program[]>(
        typeof window !== "undefined" ? localStorage.getItem("workout_programs") : null,
        []
      );
      const history = parseJSON<History[]>(
        typeof window !== "undefined" ? localStorage.getItem("workout_history") : null,
        []
      );
      const today = parseJSON<TodayTracker>(
        typeof window !== "undefined" ? localStorage.getItem("today_tracker") : null,
        { date: "", steps: 0, water: 0, weightKg: 0, activeMinutes: 0 }
      );

      // Planned workouts per week from programs
      const totalPlannedWorkouts = programs.reduce((sum, p) => sum + (p.frequency || 0), 0);

      // Completed sessions & durations
      const completedWorkouts = history.length;
      const totalDuration = history.reduce((sum, h) => sum + (h.durationMin || 0), 0);
      const averageWorkoutDuration = completedWorkouts ? Math.round(totalDuration / completedWorkouts) : 0;

      // Calories estimate: base * minutes + bonus for active minutes
      const totalCaloriesBurned = Math.round(totalDuration * 3 + (today.activeMinutes || 0) * 2);

      // Types distribution from programs
      const workoutTypes = programs.reduce(
        (acc, p) => {
          acc[p.sportType] = (acc[p.sportType] || 0) + 1;
          return acc;
        },
        { cardio: 0, strength: 0, flexibility: 0, sports: 0 } as WorkoutMetrics["workoutTypes"]
      );

      // Weekly frequency for current week (Mon→Sun)
  const start = mondayStartOfWeek(weekStart);
      const weeklyFrequency = [0, 0, 0, 0, 0, 0, 0];
      history.forEach((h) => {
        const d = new Date(h.startedAt);
        if (d >= start) {
          const idx = (d.getDay() + 6) % 7; // Monday=0
          weeklyFrequency[idx] += 1;
        }
      });

      // Weekly calories (last 4 weeks)
      const weeklyCalories = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        const weekStart = mondayStartOfWeek(new Date(Date.now() - i * 7 * 86400000));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        const minutes = history
          .filter((h) => new Date(h.startedAt) >= weekStart && new Date(h.startedAt) < weekEnd)
          .reduce((s, h) => s + (h.durationMin || 0), 0);
        weeklyCalories[3 - i] = Math.round(minutes * 3);
      }

      // Monthly workouts (this calendar year)
      const currentYear = new Date().getFullYear();
      const monthlyWorkouts = Array(12).fill(0);
      history.forEach((h) => {
        const d = new Date(h.startedAt);
        if (d.getFullYear() === currentYear) monthlyWorkouts[d.getMonth()] += 1;
      });

      // Streaks
      const { current, longest } = computeStreaks(history);

      const next: WorkoutMetrics = {
        completedWorkouts,
        totalPlannedWorkouts,
        totalCaloriesBurned,
        averageWorkoutDuration,
        currentStreak: current,
        longestStreak: longest,
        workoutTypes,
        weeklyFrequency,
        progressMetrics: { totalWeightLifted: 0, totalDistanceRun: 0, averageHeartRate: 0 },
        weeklyCalories,
        monthlyWorkouts,
      };

      // Only update state if something actually changed
      const sameArrays = (a: number[] = [], b: number[] = []) => a.length === b.length && a.every((v, i) => v === b[i]);
      const prev = lastLiveRef.current;
      const equal =
        prev.completedWorkouts === next.completedWorkouts &&
        prev.totalPlannedWorkouts === next.totalPlannedWorkouts &&
        prev.totalCaloriesBurned === next.totalCaloriesBurned &&
        prev.averageWorkoutDuration === next.averageWorkoutDuration &&
        prev.currentStreak === next.currentStreak &&
        prev.longestStreak === next.longestStreak &&
        prev.workoutTypes.cardio === next.workoutTypes.cardio &&
        prev.workoutTypes.strength === next.workoutTypes.strength &&
        prev.workoutTypes.flexibility === next.workoutTypes.flexibility &&
        prev.workoutTypes.sports === next.workoutTypes.sports &&
        sameArrays(prev.weeklyFrequency, next.weeklyFrequency) &&
        sameArrays(prev.weeklyCalories, next.weeklyCalories) &&
        sameArrays(prev.monthlyWorkouts, next.monthlyWorkouts);

      if (!equal) {
        lastLiveRef.current = next;
        setLive(next);
      }
  setProgramsState(programs);
  setHistoryState(history);
    };

    compute();

    // Debounced schedule
    let t: number | null = null;
    const schedule = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        t = null;
        compute();
      }, 120);
    };

    // Listen to local storage changes, custom events, tab visibility & BroadcastChannel
    window.addEventListener("storage", schedule);
    window.addEventListener("workout:data-updated", schedule as EventListener);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) schedule();
    });

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel("workout");
      bc.onmessage = schedule;
    }

    // Resize observer to relayout charts responsively
    const ro = new ResizeObserver(() => setChartKey((k) => k + 1));
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener("storage", schedule);
      window.removeEventListener("workout:data-updated", schedule as EventListener);
      if (bc) bc.close();
      ro.disconnect();
    };
  }, [weekStart]);

  // Merge external metrics if provided (they override specific fields)
  const merged: WorkoutMetrics = useMemo(
    () => ({
      ...live,
      ...(metrics || {}),
      workoutTypes: { ...(live.workoutTypes || {}), ...(metrics?.workoutTypes || {}) },
      progressMetrics: { ...(live.progressMetrics || {}), ...(metrics?.progressMetrics || {}) },
      weeklyFrequency: metrics?.weeklyFrequency ?? live.weeklyFrequency,
      weeklyCalories: metrics?.weeklyCalories ?? live.weeklyCalories,
      monthlyWorkouts: metrics?.monthlyWorkouts ?? live.monthlyWorkouts,
    }),
    [live, metrics]
  );

  // Safe reads
  const completed = n(merged.completedWorkouts);
  const planned = n(merged.totalPlannedWorkouts) || 1;
  const completionRate = Math.round((completed / planned) * 100);

  const totalCalories = n(merged.totalCaloriesBurned);
  const currentStreak = n(merged.currentStreak);
  const longestStreak = n(merged.longestStreak);
  const avgDuration = n(merged.averageWorkoutDuration);

  const types = {
    cardio: n(merged.workoutTypes?.cardio),
    strength: n(merged.workoutTypes?.strength),
    flexibility: n(merged.workoutTypes?.flexibility),
    sports: n(merged.workoutTypes?.sports),
  };

  const weeklyFreq = merged.weeklyFrequency ?? [0, 0, 0, 0, 0, 0, 0];
  const weeklyCals = merged.weeklyCalories ?? [0, 0, 0, 0];

  /* -------------------------------- Charts -------------------------------- */

  const completionChartData = useMemo(
    () => ({
      labels: [t("workout.analytics.labels.completed"), t("workout.analytics.labels.missed")],
      datasets: [
        {
          data: [completed, Math.max(0, planned - completed)],
          backgroundColor: ["#10B981", "#374151"],
          borderColor: ["#10B981", "#4B5563"],
          borderWidth: 2,
        },
      ],
    }),
    [completed, planned, t]
  );

  const workoutTypeData = useMemo(
    () => ({
      labels: [
        t("workout.types.cardio"),
        t("workout.types.strength"),
        t("workout.types.flexibility"),
        t("workout.types.sports"),
      ],
      datasets: [
        {
          data: [types.cardio, types.strength, types.flexibility, types.sports],
          backgroundColor: ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0"],
          borderColor: ["#059669", "#10B981", "#34D399", "#6EE7B7"],
          borderWidth: 2,
        },
      ],
    }),
    [types.cardio, types.strength, types.flexibility, types.sports, t]
  );

  const weeklyTrendData = useMemo(
    () => ({
      labels: [
        t("planner.calendar.weekdayShort.mo"),
        t("planner.calendar.weekdayShort.tu"),
        t("planner.calendar.weekdayShort.we"),
        t("planner.calendar.weekdayShort.th"),
        t("planner.calendar.weekdayShort.fr"),
        t("planner.calendar.weekdayShort.sa"),
        t("planner.calendar.weekdayShort.su"),
      ],
      datasets: [
        {
          label: t("workout.analytics.units.workoutsLabel"),
          data: weeklyFreq,
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        },
      ],
    }),
    [weeklyFreq, t]
  );

  const caloriesTrendData = useMemo(
    () => ({
      labels: [1, 2, 3, 4].map((num) => t("workout.analytics.time.weekN", { num })),
      datasets: [
        {
          label: t("workout.analytics.units.caloriesLabel"),
          data: weeklyCals,
          backgroundColor: "#10B981",
          borderColor: "#059669",
          borderWidth: 1,
        },
      ],
    }),
    [weeklyCals, t]
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1F2937",
        titleColor: "#F9FAFB",
        bodyColor: "#F9FAFB",
        borderColor: "#10B981",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#9CA3AF" },
      },
      y: {
        grid: { color: "rgba(55,65,81,0.5)" },
        ticks: { color: "#9CA3AF", precision: 0 },
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1F2937",
        titleColor: "#F9FAFB",
        bodyColor: "#F9FAFB",
        borderColor: "#10B981",
        borderWidth: 1,
      },
    },
    cutout: "70%",
  };

  /* ------------------------------- UI pieces ------------------------------ */

  const StatCard = ({
    icon: Icon,
    title,
    value,
    subtitle,
    trend,
  }: {
    icon: React.ElementType;
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: "up" | "down" | "neutral";
  }) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-[#10B981]/20 rounded-lg">
          <Icon className="w-4 h-4 text-[#10B981]" />
        </div>
        {trend && (
          <div
            className={`flex items-center text-xs ${
              trend === "up" ? "text-[#10B981]" : trend === "down" ? "text-red-400" : "text-gray-400"
            }`}
          >
            <TrendingUp className="w-3 h-3 mr-1" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400">{title}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </motion.div>
  );

  /* --------------------------------- Render -------------------------------- */

  return (
    <div
      ref={containerRef}
      className="space-y-6 p-4 max-w-7xl mx-auto pb-[calc(env(safe-area-inset-bottom,0px)+96px)]"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
  <h2 className="text-2xl font-bold text-white mb-1 break-words">{t("workout.analytics.header")}</h2>
  <p className="text-gray-400">{t("workout.analytics.subheader")}</p>
      </motion.div>

      {/* Week Navigator (like planner) */}
      {(() => {
        const days: Date[] = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          return d;
        });
  const fmt = (d: Date) => d.toLocaleDateString(locale, { month: "short", day: "numeric" });
        const rangeLabel = `${fmt(days[0])} – ${fmt(days[6])}`;
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">{t("workout.analytics.labels.week")}</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date(weekStart);
                    d.setDate(d.getDate() - 7);
                    setWeekStart(d);
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-sm text-gray-300 min-w-[120px] max-w-[180px] text-center font-medium tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">{rangeLabel}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date(weekStart);
                    d.setDate(d.getDate() + 7);
                    setWeekStart(d);
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((d, idx) => {
                const isSelected = idx === selectedDayIndex;
                const isToday = sameDay(d, new Date());
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className={`rounded-lg px-2 py-1.5 justify-center border-gray-600/60 overflow-hidden ${
                      isSelected ? "border-[#10B981] bg-[#10B981]/10 text-white" : ""
                    } ${isToday ? "ring-1 ring-[#10B981]/60" : ""}`}
                    onClick={() => setSelectedDayIndex(idx)}
                  >
                    <div className="flex flex-col items-center leading-tight">
                      <span className={`text-[10px] ${isToday ? "text-[#10B981]" : "text-gray-400"}`}>
                        {d.toLocaleDateString(locale, { weekday: "short" })}
                      </span>
                      <span className="text-sm leading-none">{d.getDate()}</span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Key stats (phone → 2 cols, tablet → 3, desktop → 4) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Target}
          title={t("workout.analytics.cards.completionRate.title")}
          value={`${completionRate}%`}
          subtitle={t("workout.analytics.cards.completionRate.subtitle", { completed, total: planned })}
          trend="up"
        />
        <StatCard
          icon={Flame}
          title={t("workout.analytics.cards.calories.title")}
          value={formatNumber(totalCalories)}
          subtitle={t("workout.analytics.cards.calories.subtitle")}
          trend="up"
        />
        <StatCard
          icon={Calendar}
          title={t("workout.analytics.cards.streak.title")}
          value={`${currentStreak} ${t("workout.analytics.units.days")}`}
          subtitle={t("workout.analytics.cards.streak.best", { days: longestStreak })}
          trend={currentStreak > 0 ? "up" : "neutral"}
        />
        <StatCard
          icon={Activity}
          title={t("workout.analytics.cards.avgDuration.title")}
          value={`${avgDuration} ${t("workout.analytics.units.min")}`}
          subtitle={t("workout.analytics.cards.avgDuration.subtitle")}
          trend="neutral"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Completion donut */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-5 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Target className="w-5 h-5 text-[#10B981] mr-2" />
            {t("workout.analytics.sections.completion.title")}
          </h3>
          <div className="h-48 sm:h-56 relative" key={chartKey + 1}>
            <Doughnut data={completionChartData} options={doughnutOptions} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#10B981]">{completionRate}%</div>
                <div className="text-xs text-gray-400">{t("workout.analytics.labels.complete")}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Types donut */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-5 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Zap className="w-5 h-5 text-[#10B981] mr-2" />
            {t("workout.analytics.sections.types.title")}
          </h3>
          <div className="h-48 sm:h-56" key={chartKey + 2}>
            <Doughnut data={workoutTypeData} options={doughnutOptions} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {Object.entries(types).map(([type, count], i) => (
              <div key={type} className="flex items-center text-sm">
                <span
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0"][i] }}
                />
                <span className="text-gray-300 capitalize">
                  {t(`workout.types.${type}` as any)}: {count}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

  {/* Progress metrics removed per request */}

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Calendar className="w-5 h-5 text-[#10B981] mr-2" />
            {t("workout.analytics.sections.weeklyFrequency.title")}
          </h3>
          <div className="h-48 sm:h-56" key={chartKey + 3}>
            <Line data={weeklyTrendData} options={chartOptions} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Flame className="w-5 h-5 text-[#10B981] mr-2" />
            {t("workout.analytics.sections.caloriesTrend.title")}
          </h3>
          <div className="h-48 sm:h-56" key={chartKey + 4}>
            <Bar data={caloriesTrendData} options={chartOptions} />
          </div>
        </motion.div>
      </div>

      {/* Selected Day Workouts */}
      {(() => {
        const selectedDate = new Date(weekStart);
        selectedDate.setDate(weekStart.getDate() + selectedDayIndex);
        selectedDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(selectedDate);
        nextDay.setDate(selectedDate.getDate() + 1);
        const dayList = historyState
          .filter((h) => {
            const d = new Date(h.startedAt);
            return d >= selectedDate && d < nextDay;
          })
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const fmtDate = selectedDate.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
        return (
          <div className="glass-card p-4 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-2">{t("workout.analytics.selectedDay.title", { date: fmtDate })}</h3>
            {dayList.length === 0 ? (
              <p className="text-sm text-gray-400">{t("workout.analytics.selectedDay.empty")}</p>
            ) : (
              <div className="space-y-2">
                {dayList.map((h, i) => {
                  const p = programsState.find((x) => x.id === h.programId);
                  const label =
                    p?.sportType === "strength"
                      ? t("workout.types.strength")
                      : p?.sportType === "cardio"
                      ? t("workout.types.cardio")
                      : p?.sportType === "flexibility"
                      ? t("workout.types.flexibility")
                      : p?.sportType === "sports"
                      ? t("workout.types.sports")
                      : t("workout.common.workout");
                  return (
                    <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 text-sm">
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(h.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {h.durationMin} {t("workout.analytics.units.min")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Streak progress */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
          <Target className="w-5 h-5 text-[#10B981] mr-2" />
          {t("workout.analytics.streakProgress.title")}
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">{t("workout.analytics.streakProgress.current")}</span>
            <span className="text-[#10B981] font-semibold">{currentStreak} {t("workout.analytics.units.days")}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((currentStreak / (longestStreak || 1)) * 100, 100)}%` }}
              transition={{ duration: 0.9 }}
              className="bg-gradient-to-r from-[#10B981] to-[#34D399] h-3 rounded-full"
            />
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>{t("workout.analytics.streakProgress.zeroDays")}</span>
            <span>{t("workout.analytics.streakProgress.best", { days: longestStreak })}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* -------------------------- Update helper (optional) -------------------------- */
/** Call these when you write to localStorage so analytics updates instantly */
export const workoutAnalyticsSignal = {
  broadcast() {
    // Custom event for same-tab
    window.dispatchEvent(new Event("workout:data-updated"));
    // Cross-tab
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("workout");
      bc.postMessage("updated");
      bc.close();
    }
  },
};
