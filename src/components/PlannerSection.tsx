"use client";

import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar as CalendarIcon, 
  CalendarDays, 
  ListTodo, 
  ListChecks, 
  ChartGantt,
  PanelsLeftBottom,
  ListFilterPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  TrendingUp,
  Filter,
  History,
  Clock,
  Lock,
  Crown,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { DateStepper } from "@/components/ui/date-stepper";
import { PlannerAnalytics } from "@/components/PlannerAnalytics";
import { supabase } from "@/lib/supabase/client";
import { createTask as createTaskAction, updateTask as updateTaskAction } from "@/app/actions/tasks";

// Helper: normalize a date to start of day
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
import { ScaleButton, SlideUpModal, iosSpring } from "@/components/iOSAnimations";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done" | "skipped";
  priority: "low" | "medium" | "high";
  startDate?: Date;
  dueDate?: Date;
  estimateHours?: number;
  tags: string[];
  checklist: ChecklistItem[];
  progress: number;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: "image" | "pdf" | "other";
}

// New Goal interfaces for weekly/monthly/yearly planning
interface Goal {
  id: string;
  title: string;
  description?: string;
  status: "planning" | "in_progress" | "completed" | "paused";
  priority: "low" | "medium" | "high";
  targetDate: Date;
  milestones: Milestone[];
  progress: number;
  type: "weekly" | "monthly" | "yearly";
  createdAt: Date;
  updatedAt: Date;
  // Parity with Task for UI reuse
  tags?: string[];
  checklist?: ChecklistItem[];
  estimateHours?: number;
}

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: Date;
  status?: 'todo' | 'doing' | 'done';
  notes?: string;
}

type ViewMode = "daily" | "weekly" | "monthly" | "yearly";
type FilterStatus = "all" | "todo" | "doing" | "done" | "skipped";
type FilterPriority = "all" | "low" | "medium" | "high";
type FilterTimeRange = "all" | "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "last_year" | "custom";
type FilterCompletion = "all" | "completed" | "incomplete" | "overdue";

interface PlannerSectionProps {
  subscriptionPlan?: 'free' | 'lite' | 'pro';
  onUpgrade?: () => void;
  onAddTask?: () => void;
  telegramUser?: string;
  userData?: any;
}

// Date helpers and interaction guard
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const stepByView = (d: Date, mode: "daily"|"weekly"|"monthly"|"yearly", dir: 1|-1) => {
  switch (mode) {
    case "daily":   return addDays(d, 1 * dir);
    case "weekly":  return addDays(d, 7 * dir);
    case "monthly": return new Date(d.getFullYear(), d.getMonth() + 1 * dir, d.getDate());
    case "yearly":  return new Date(d.getFullYear() + 1 * dir, d.getMonth(), d.getDate());
  }
};

const isInteractive = (el: HTMLElement | null) =>
  !!el && (["INPUT","TEXTAREA","SELECT","BUTTON","A","LABEL"].includes(el.tagName) || el.closest("[data-no-swipe]" as any));

// Status mapping between Goal and Task semantics for UI parity
const goalStatusToTask = (s: Goal["status"]): Task["status"] => (
  s === 'completed' ? 'done' : s === 'in_progress' ? 'doing' : s === 'paused' ? 'skipped' : 'todo'
);
const taskStatusToGoal = (s: Task["status"]): Goal["status"] => (
  s === 'done' ? 'completed' : s === 'doing' ? 'in_progress' : s === 'skipped' ? 'paused' : 'planning'
);

// Global-listener swipe hook: works even when nested components capture events.
function useWholeAreaSwipe(
  zoneRef: React.RefObject<HTMLElement | null>,
  getMode: () => ViewMode,
  step: (dir: 1 | -1, mode: ViewMode) => void
) {
  useEffect(() => {
    const THRESH = 60, RATIO = 1.2;
    let active = false, sx = 0, sy = 0;

    const inZone = (x: number, y: number) => {
  const el = zoneRef.current;
  if (!el) return false;
  const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    const start = (x: number, y: number, target: EventTarget | null) => {
      if (!inZone(x, y) || isInteractive(target as HTMLElement)) return;
      active = true; sx = x; sy = y;
    };
    const move = (x: number, y: number) => {
      if (!active) return;
      const dx = x - sx, dy = y - sy;
      if (Math.abs(dx) > THRESH && Math.abs(dx) > Math.abs(dy) * RATIO) {
        const dir: 1 | -1 = dx < 0 ? 1 : -1; // left = next, right = prev
        const mode = getMode();
        step(dir, mode);
        active = false; // one step per gesture
      }
    };
    const end = () => { active = false; };

    const ts = (e: TouchEvent) => start(e.touches[0].clientX, e.touches[0].clientY, e.target);
    const tm = (e: TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY);
    const te = () => end();

    const pd = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.buttons !== 1) return;
      start(e.clientX, e.clientY, e.target);
    };
    const pm = (e: PointerEvent) => move(e.clientX, e.clientY);
    const pu = () => end();

  window.addEventListener("touchstart", ts, { passive: true, capture: true });
  window.addEventListener("touchmove",  tm, { passive: true, capture: true });
  window.addEventListener("touchend",   te, { capture: true } as AddEventListenerOptions);
  window.addEventListener("pointerdown", pd, { capture: true });
  window.addEventListener("pointermove", pm, { capture: true });
  window.addEventListener("pointerup",   pu, { capture: true });
  window.addEventListener("pointercancel", pu, { capture: true });

    return () => {
  window.removeEventListener("touchstart", ts, { capture: true } as EventListenerOptions);
  window.removeEventListener("touchmove",  tm, { capture: true } as EventListenerOptions);
  window.removeEventListener("touchend",   te, { capture: true } as EventListenerOptions);
  window.removeEventListener("pointerdown", pd, { capture: true } as EventListenerOptions);
  window.removeEventListener("pointermove", pm, { capture: true } as EventListenerOptions);
  window.removeEventListener("pointerup",   pu, { capture: true } as EventListenerOptions);
  window.removeEventListener("pointercancel", pu, { capture: true } as EventListenerOptions);
    };
  }, [zoneRef, getMode, step]);
}

// Define ref interface
export interface PlannerSectionRef {
  handleNewTask: () => void;
}

export const PlannerSection = forwardRef<PlannerSectionRef, PlannerSectionProps>(({ 
  subscriptionPlan,
  onUpgrade,
  telegramUser,
  userData
}, ref) => {
  const { t, i18n } = useTranslation('app');
  // Daily tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Goals state for weekly/monthly/yearly
  const [weeklyGoals, setWeeklyGoals] = useState<Goal[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<Goal[]>([]);
  const [yearlyGoals, setYearlyGoals] = useState<Goal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  // Web-only project mode for monthly/yearly views
  const [projectMode, setProjectMode] = useState(false);
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  // Search removed
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [editingGoal, setEditingGoal] = useState<Partial<Goal> | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [filterTimeRange, setFilterTimeRange] = useState<FilterTimeRange>("all");
  const [filterCompletion, setFilterCompletion] = useState<FilterCompletion>("all");
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null);
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(true);
  // Header-level file input for project import when no project is selected
  const headerFileInputRef = useRef<HTMLInputElement | null>(null);

  // i18n-aware date formatters
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();

  // --- Supabase-backed storage for weekly/monthly/yearly goals ---
  const loadGoals = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) {
        setWeeklyGoals([]); setMonthlyGoals([]); setYearlyGoals([]);
        return;
      }
      const { data, error } = await supabase
        .from('planner_items')
        .select('*')
        .in('type', ['weekly','monthly','yearly'])
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const allGoals: Goal[] = rows.map((row) => ({
        id: String(row.id),
        title: row.title || '',
        description: row.description || undefined,
        status: (row.status || 'planning') as Goal['status'],
        priority: (row.priority || 'medium') as Goal['priority'],
        type: (row.type || 'weekly') as Goal['type'],
        targetDate: row.target_date ? new Date(row.target_date) : new Date(),
        milestones: Array.isArray(row.milestones)
          ? row.milestones.map((m: any) => ({ ...m, dueDate: m?.dueDate ? new Date(m.dueDate) : undefined }))
          : [],
  checklist: Array.isArray(row.checklist) ? row.checklist : [],
  tags: Array.isArray(row.tags) ? row.tags : [],
  estimateHours: typeof row.estimate_hours === 'number' ? row.estimate_hours : undefined,
        progress: typeof row.progress === 'number' ? row.progress : 0,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      }));
      setWeeklyGoals(allGoals.filter(g => g.type === 'weekly'));
      setMonthlyGoals(allGoals.filter(g => g.type === 'monthly'));
      setYearlyGoals(allGoals.filter(g => g.type === 'yearly'));
    } catch (e) {
  console.error('Failed to load planner goals/items:', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadGoals();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      const ch = supabase
        .channel('planner-goals-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_items', filter: userId ? `user_id=eq.${userId}` : undefined as any }, () => loadGoals())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
  }, [loadGoals]);

  // One-time migration: import localStorage goals into Supabase if user is signed-in and no rows exist yet
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;
        if (!userId) return; // only migrate for signed-in users

        const { count, error: cntErr } = await supabase
          .from('planner_items')
          .select('id', { count: 'exact', head: true })
          .in('type', ['weekly','monthly','yearly']);
        if (cntErr) throw cntErr;
        if ((count ?? 0) > 0) return; // already in DB, skip migration

        // read any legacy local storage
        const legacyKey = (() => {
          const uid = (userData?.id || userData?.email || 'anon') as string;
          return `planner_goals_${uid}`;
        })();
        const raw = typeof window !== 'undefined' ? localStorage.getItem(legacyKey) : null;
        if (!raw) return;
        const parsed = JSON.parse(raw) as { weekly?: any[]; monthly?: any[]; yearly?: any[] };
        const toRows: any[] = [];
        const pushGoals = (arr: any[] | undefined, type: 'weekly'|'monthly'|'yearly') => {
          (arr || []).forEach(g => {
            toRows.push({
              user_id: userId,
              title: g.title || '',
              description: g.description || null,
              status: g.status || 'planning',
              priority: g.priority || 'medium',
              type,
              target_date: g.targetDate ? new Date(g.targetDate).toISOString() : new Date().toISOString(),
              milestones: Array.isArray(g.milestones) ? g.milestones : [],
              progress: typeof g.progress === 'number' ? g.progress : 0,
              created_at: g.createdAt ? new Date(g.createdAt).toISOString() : new Date().toISOString(),
              updated_at: g.updatedAt ? new Date(g.updatedAt).toISOString() : new Date().toISOString(),
            });
          });
        };
        pushGoals(parsed.weekly, 'weekly');
        pushGoals(parsed.monthly, 'monthly');
        pushGoals(parsed.yearly, 'yearly');
        if (toRows.length === 0) return;

  const { error: insErr } = await supabase.from('planner_items').insert(toRows);
        if (insErr) throw insErr;
        // Clear legacy and reload
        localStorage.removeItem(legacyKey);
        await loadGoals();
        toast.success(t('toasts.planner.goalSaved', { defaultValue: 'Goals synced to cloud' }));
      } catch (e) {
        // silent
      }
    })();
  }, [userData?.id, userData?.email, t, loadGoals]);
  const intlLocale = lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-UZ' : 'en-US';
  const fmt = useMemo(() => ({
    md: new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' }),
    wd: new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }),
    m:  new Intl.DateTimeFormat(intlLocale, { month: 'short' }),
    wmd: new Intl.DateTimeFormat(intlLocale, { weekday: 'short', month: 'short', day: 'numeric' }),
  }), [intlLocale]);

  // i18n-based weekday short labels (avoid Intl fallback to English on environments without full ICU)
  const wdShort = useCallback((d: Date) => {
    const keys = ["su","mo","tu","we","th","fr","sa"] as const;
    const key = keys[d.getDay()];
    // Prefer global dates.weekdaysShort translations
    return t(`dates.weekdaysShort.${key}`);
  }, [t]);

  // Helper function to format dates
  const formatDateRange = (startDate: Date, endDate: Date) => {
    const start = fmt.md.format(startDate);
    const end = fmt.md.format(endDate);
    return `${start} - ${end}`;
  };

  // Helper function to get week range
  const getWeekRange = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return { startOfWeek, endOfWeek };
  };

  // Generate 7 days around selected date (for daily view)
  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - 3); // 3 days before
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  }, [selectedDate]);

  // Generate weeks around selected date (for weekly view)
  const weekRanges = useMemo(() => {
    const weeks = [];
    const currentWeekStart = new Date(selectedDate);
    currentWeekStart.setDate(selectedDate.getDate() - selectedDate.getDay()); // Start from Sunday
    
    // Generate 5 weeks: 2 before + current + 2 after
    for (let i = -2; i <= 2; i++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weeks.push({ start: weekStart, end: weekEnd });
    }
    return weeks;
  }, [selectedDate]);

  // Generate months around selected date (for monthly view)
  const monthRanges = useMemo(() => {
    const months = [];
    const currentYear = selectedDate.getFullYear();
    
    // Generate 5 months: 2 before + current + 2 after
    const currentMonth = selectedDate.getMonth();
    for (let i = -2; i <= 2; i++) {
      const month = new Date(currentYear, currentMonth + i, 1);
      months.push(month);
    }
    return months;
  }, [selectedDate]);

  // Generate years around selected date (for yearly view)
  const yearRanges = useMemo(() => {
    const years = [];
    const currentYear = selectedDate.getFullYear();
    
    // Generate 3 years: previous, current, next
    for (let i = -1; i <= 1; i++) {
      years.push(currentYear + i);
    }
    return years;
  }, [selectedDate]);

  // Get current period for goals
  const getCurrentPeriod = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    
    // Get week start (Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(day - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // Get month start
    const monthStart = new Date(year, month, 1);
    
    // Get year start
    const yearStart = new Date(year, 0, 1);
    
    return {
      week: weekStart,
      month: monthStart,
      year: yearStart
    };
  }, []);

  // Enhanced date range helper
  const getTimeRangeFilter = useCallback((range: FilterTimeRange) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case "today":
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
      
      case "yesterday": {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1) };
      }
      
      case "this_week": {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      }
      
      case "last_week": {
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        endOfLastWeek.setHours(23, 59, 59, 999);
        return { start: startOfLastWeek, end: endOfLastWeek };
      }
      
      case "this_month": {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      }
      
      case "last_month": {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        endOfLastMonth.setHours(23, 59, 59, 999);
        return { start: startOfLastMonth, end: endOfLastMonth };
      }
      
      case "this_year": {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        endOfYear.setHours(23, 59, 59, 999);
        return { start: startOfYear, end: endOfYear };
      }
      
      case "last_year": {
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        endOfLastYear.setHours(23, 59, 59, 999);
        return { start: startOfLastYear, end: endOfLastYear };
      }
      
      case "custom":
        if (customDateStart && customDateEnd) {
          const end = new Date(customDateEnd);
          end.setHours(23, 59, 59, 999);
          return { start: customDateStart, end };
        }
        return null;
      
      default:
        return null;
    }
  }, [customDateStart, customDateEnd]);

  // Enhanced filtered items with new filters
  const filteredItems = useMemo(() => {
    const period = getCurrentPeriod();
    const timeRangeFilter = getTimeRangeFilter(filterTimeRange);
    
    const filterByCommon = (item: Task | Goal) => {
  // Search removed

      // Status filter
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "todo" && (item.status === "todo" || item.status === "planning")) ||
        (filterStatus === "doing" && (item.status === "doing" || item.status === "in_progress")) ||
        (filterStatus === "done" && (item.status === "done" || item.status === "completed")) ||
        (filterStatus === "skipped" && item.status === "skipped");

      // Priority filter
      const matchesPriority = filterPriority === "all" || item.priority === filterPriority;

      // Time range filter
      let matchesTimeRange = true;
      if (timeRangeFilter) {
        const itemDate = (item as Task).dueDate || (item as Task).startDate || (item as Goal).targetDate || item.createdAt;
        matchesTimeRange = itemDate >= timeRangeFilter.start && itemDate <= timeRangeFilter.end;
      }

      // Completion filter
      let matchesCompletion = true;
      if (filterCompletion !== "all") {
        const isCompleted = item.status === "done" || item.status === "completed";
        const isOverdue = (item as Task).dueDate ? (item as Task).dueDate! < new Date() && !isCompleted : false;
        
        switch (filterCompletion) {
          case "completed":
            matchesCompletion = isCompleted;
            break;
          case "incomplete":
            matchesCompletion = !isCompleted;
            break;
          case "overdue":
            matchesCompletion = isOverdue;
            break;
        }
      }

      // Show completed tasks toggle
      if (!showCompletedTasks && (item.status === "done" || item.status === "completed")) {
        return false;
      }

  return matchesStatus && matchesPriority && matchesTimeRange && matchesCompletion;
    };
    
    switch (viewMode) {
      case "daily":
        return tasks.filter(task => {
          if (!filterByCommon(task)) return false;
          
          // For "all" time range, don't filter by selected date
          if (filterTimeRange !== "all") return true;
          
          // Daily tasks for selected date (only when no time range filter is applied)
          const taskDate = task.dueDate || task.startDate || task.createdAt;
          const matchesDate = taskDate ? taskDate.toDateString() === selectedDate.toDateString() : true;
          
          return matchesDate;
        });
        
      case "weekly":
        return weeklyGoals.filter(goal => {
          if (!filterByCommon(goal)) return false;
          
          // For "all" time range, don't filter by selected week
          if (filterTimeRange !== "all") return true;
          
          // Goals for current/selected week
          const goalWeek = new Date(goal.targetDate);
          goalWeek.setDate(goalWeek.getDate() - goalWeek.getDay());
          goalWeek.setHours(0, 0, 0, 0);
          
          const selectedWeek = new Date(selectedDate);
          selectedWeek.setDate(selectedWeek.getDate() - selectedWeek.getDay());
          selectedWeek.setHours(0, 0, 0, 0);
          
          const matchesWeek = goalWeek.getTime() === selectedWeek.getTime();
          
          return matchesWeek;
        });
        
      case "monthly":
        return monthlyGoals.filter(goal => {
          if (!filterByCommon(goal)) return false;
          
          // For "all" time range, don't filter by selected month
          if (filterTimeRange !== "all") return true;
          
          // Goals for current/selected month
          const matchesMonth = goal.targetDate.getMonth() === selectedDate.getMonth() && 
                              goal.targetDate.getFullYear() === selectedDate.getFullYear();
          
          return matchesMonth;
        });
        
      case "yearly":
        return yearlyGoals.filter(goal => {
          if (!filterByCommon(goal)) return false;
          
          // For "all" time range, don't filter by selected year
          if (filterTimeRange !== "all") return true;
          
          // Goals for current/selected year
          const matchesYear = goal.targetDate.getFullYear() === selectedDate.getFullYear();
          
          return matchesYear;
        });
        
      default:
        return [];
    }
  }, [tasks, weeklyGoals, monthlyGoals, yearlyGoals, viewMode, filterStatus, filterPriority, filterTimeRange, filterCompletion, showCompletedTasks, selectedDate, getCurrentPeriod, getTimeRangeFilter]);

  // Metrics calculation adapted for each view mode
  const metrics = useMemo(() => {
    // ── replace metrics with completedAt-based analytics
    // helpers
    const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (viewMode === "daily") {
      // tasks for the selected day (for status pie + counts)
      const dailyTasks = tasks.filter(t => {
        const base = t.dueDate || t.startDate || t.createdAt;
        return base ? sameDay(dayStart(base), dayStart(selectedDate)) : false;
      });

      const completed = dailyTasks.filter(t => t.status === "done").length;
      const total = dailyTasks.length;
      const inProgress = dailyTasks.filter(t => t.status === "doing").length;
      const todo = dailyTasks.filter(t => t.status === "todo").length;

      // 7-day completions ending at selectedDate
      const weeklyData: number[] = [];
      const weeklyLabels: string[] = [];
      const anchor = dayStart(selectedDate);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() - i);
        const count = tasks.reduce((acc, t) => {
          if (!t.completedAt) return acc;
          const cd = dayStart(new Date(t.completedAt));
          return sameDay(cd, d) ? acc + 1 : acc;
        }, 0);
        weeklyData.push(count);
  weeklyLabels.push(wdShort(d));
      }

      // streak = consecutive days up to selectedDate with >=1 completion
      let streak = 0;
      while (true) {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() - streak);
        const has = tasks.some(t => t.completedAt && sameDay(dayStart(new Date(t.completedAt)), d));
        if (has) streak++; else break;
      }

      const priorityDistribution = {
        high: dailyTasks.filter(t => t.priority === "high").length,
        medium: dailyTasks.filter(t => t.priority === "medium").length,
        low: dailyTasks.filter(t => t.priority === "low").length,
      };

      const totalCompleted = tasks.filter(t => t.status === "done").length;

      return {
        streak,
        completed,
        total,
        inProgress,
        todo,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        weeklyTasks: weeklyData,
        weeklyLabels,
        priorityDistribution,
        totalCompleted,
      };
    }

    // ── goals views unchanged
    const currentGoals = viewMode === "weekly" ? weeklyGoals :
                         viewMode === "monthly" ? monthlyGoals : yearlyGoals;

    const periodGoals = currentGoals.filter(goal => {
      if (viewMode === "weekly") {
        const gs = dayStart(new Date(goal.targetDate));
        gs.setDate(gs.getDate() - gs.getDay());
        const sel = dayStart(new Date(selectedDate));
        sel.setDate(sel.getDate() - sel.getDay());
        return gs.getTime() === sel.getTime();
      } else if (viewMode === "monthly") {
        return goal.targetDate.getMonth() === selectedDate.getMonth() &&
               goal.targetDate.getFullYear() === selectedDate.getFullYear();
      } else {
        return goal.targetDate.getFullYear() === selectedDate.getFullYear();
      }
    });

    const completed = periodGoals.filter(g => g.status === "completed").length;
    const total = periodGoals.length;
    const inProgress = periodGoals.filter(g => g.status === "in_progress").length;
    const todo = periodGoals.filter(g => g.status === "planning").length;

    const priorityDistribution = {
      high: periodGoals.filter(g => g.priority === 'high').length,
      medium: periodGoals.filter(g => g.priority === 'medium').length,
      low: periodGoals.filter(g => g.priority === 'low').length,
    };

    const trendData: number[] = [];
    const trendLabels: string[] = [];

    if (viewMode === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const ws = dayStart(new Date(selectedDate));
        ws.setDate(ws.getDate() - ws.getDay() - i * 7);
        const completedThisWeek = weeklyGoals.filter(g => {
          const gs = dayStart(new Date(g.targetDate));
          gs.setDate(gs.getDate() - gs.getDay());
          return g.status === "completed" && gs.getTime() === ws.getTime();
        }).length;
        trendData.push(completedThisWeek);
        trendLabels.push(`W${ws.getDate()}`);
      }
    } else if (viewMode === "monthly") {
      for (let i = 5; i >= 0; i--) {
        const m = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1);
        const count = monthlyGoals.filter(g =>
          g.status === "completed" &&
          g.targetDate.getFullYear() === m.getFullYear() &&
          g.targetDate.getMonth() === m.getMonth()
        ).length;
        trendData.push(count);
  trendLabels.push(fmt.m.format(m));
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const y = selectedDate.getFullYear() - i;
        const count = yearlyGoals.filter(g =>
          g.status === "completed" && g.targetDate.getFullYear() === y
        ).length;
        trendData.push(count);
        trendLabels.push(String(y));
      }
    }

    const totalCompleted = currentGoals.filter(g => g.status === "completed").length;

    return {
      streak: completed,
      completed,
      total,
      inProgress,
      todo,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      weeklyTasks: trendData,
      weeklyLabels: trendLabels,
      priorityDistribution,
      totalCompleted,
    };
  }, [viewMode, tasks, weeklyGoals, monthlyGoals, yearlyGoals, selectedDate]);

  // Swipe gesture handlers
  const handleDragEnd = useCallback((event: any, info: any) => {
    const threshold = 50;
    
    if (Math.abs(info.offset.x) > threshold) {
      if (info.offset.x > 0) {
        // Swipe right - previous period
        if (viewMode === "daily") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() - 1);
            return newDate;
          });
        } else if (viewMode === "weekly") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() - 7);
            return newDate;
          });
        } else if (viewMode === "monthly") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() - 1);
            return newDate;
          });
        } else if (viewMode === "yearly") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setFullYear(prev.getFullYear() - 1);
            return newDate;
          });
        }
      } else {
        // Swipe left - next period
        if (viewMode === "daily") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + 1);
            return newDate;
          });
        } else if (viewMode === "weekly") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + 7);
            return newDate;
          });
        } else if (viewMode === "monthly") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + 1);
            return newDate;
          });
        } else if (viewMode === "yearly") {
          setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setFullYear(prev.getFullYear() + 1);
            return newDate;
          });
        }
      }
    }
  }, [viewMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case "n":
        case "N":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (viewMode === "daily") {
              handleNewTask();
            } else {
              handleNewGoal();
            }
          }
          break;
        case "Escape":
          setIsEditorOpen(false);
          setIsGoalEditorOpen(false);
          setSelectedTask(null);
          setSelectedGoal(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode]);

  const handleNewTask = useCallback(() => {
    const newTask: Partial<Task> = {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      startDate: selectedDate,
      dueDate: selectedDate,
      tags: [],
      checklist: [],
      progress: 0,
      attachments: []
    };
    setEditingTask(newTask);
    setIsEditorOpen(true);
  }, [selectedDate]);

  const handleNewGoal = useCallback(() => {
    const newGoal: Partial<Goal> = {
      title: "",
      description: "",
      status: "planning",
      priority: "medium",
      targetDate: selectedDate,
      milestones: [],
      progress: 0,
      type: viewMode as "weekly" | "monthly" | "yearly"
    };
    setEditingGoal(newGoal);
    setIsGoalEditorOpen(true);
  }, [selectedDate, viewMode]);

  useImperativeHandle(ref, () => ({
    handleNewTask: viewMode === "daily" ? handleNewTask : handleNewGoal
  }), [handleNewTask, handleNewGoal, viewMode]);

  // Load tasks from Supabase and subscribe to realtime
  const loadTasks = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = (auth as any)?.user?.id as string | undefined;
      if (!userId) { setTasks([]); return; }
      let { data, error } = await supabase
        .from('planner_items')
        .select('*')
        .eq('type', 'daily')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      // If the column 'type' is missing in DB or query fails, fallback to fetching all and filtering client-side
      if (error) {
        const msg = (error as any)?.message || '';
        const missingType = /column .*type.* does not exist/i.test(msg);
        if (missingType) {
          const fb = await supabase
            .from('planner_items')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          data = (fb as any).data || [];
        } else {
          throw error;
        }
      }
      // Filter rows to 'daily' if the 'type' column exists; otherwise include all
      const rowsToUse = Array.isArray(data)
        ? (data as any[]).filter((row: any) => (typeof row?.type === 'undefined') || row?.type === 'daily')
        : [];
      const mapped = rowsToUse.map((row: any) => ({
        id: String(row.id),
        title: row.title || '',
        description: row.description || undefined,
        status: (row.status || 'todo') as Task['status'],
        priority: (row.priority || 'medium') as Task['priority'],
        startDate: row.start_date ? new Date(row.start_date) : undefined,
        dueDate: row.due_date ? new Date(row.due_date) : undefined,
        estimateHours: typeof row.estimate_hours === 'number' ? row.estimate_hours : undefined,
        tags: Array.isArray(row.tags) ? row.tags : [],
        checklist: Array.isArray(row.checklist) ? row.checklist : [],
        progress: typeof row.progress === 'number' ? row.progress : 0,
        attachments: [],
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
  })) as Task[];
  setTasks(mapped);
    } catch (e) {
      console.error('Failed to load tasks:', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadTasks();
      const { data: auth } = await supabase.auth.getUser();
      const userId = (auth as any)?.user?.id as string | undefined;
      const ch = supabase
        .channel('planner-tasks-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_items', filter: userId ? `user_id=eq.${userId}` : undefined as any }, () => loadTasks())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
  }, [loadTasks]);

  const handleSaveTask = useCallback(async (taskData: Partial<Task>) => {
    setIsLoading(true);
    
    try {
      // Optimistic update
      if (taskData.id) {
        // Update existing task
        setTasks(prev => prev.map(t => {
          if (t.id !== taskData.id) return t;
          const nextStatus = taskData.status ?? t.status;
          const nextCompletedAt = nextStatus === "done"
            ? (t.completedAt ?? (viewMode === "daily"
              ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
              : new Date()))
            : null;
          return { ...t, ...taskData, completedAt: nextCompletedAt, updatedAt: new Date() };
        }));
        // Also persist server-side
        try {
          await updateTaskAction({
            id: taskData.id,
            title: taskData.title,
            description: taskData.description,
            status: taskData.status as any,
            priority: taskData.priority as any,
            start_date: taskData.startDate ? taskData.startDate.toISOString() : undefined,
            due_date: taskData.dueDate ? taskData.dueDate.toISOString() : undefined,
            estimate_hours: typeof taskData.estimateHours === 'number' ? taskData.estimateHours : undefined,
            tags: taskData.tags || undefined as any,
            ...(Array.isArray(taskData.checklist) ? { checklist: taskData.checklist as any } : {}),
            ...(typeof taskData.progress === 'number' ? { progress: taskData.progress } : {}),
          } as any);
        } catch {}
      } else {
        // Persist new task via server action and refresh
        await createTaskAction({
          title: taskData.title || (t('planner.default.untitledTask') as string),
          description: taskData.description,
          status: (taskData.status as any) || 'todo',
          priority: (taskData.priority as any) || 'medium',
          start_date: taskData.startDate ? taskData.startDate.toISOString() : undefined,
          due_date: taskData.dueDate ? taskData.dueDate.toISOString() : undefined,
          estimate_hours: typeof taskData.estimateHours === 'number' ? taskData.estimateHours : undefined,
          tags: taskData.tags || [],
          ...(typeof taskData.progress === 'number' ? { progress: taskData.progress } : {}),
          ...(Array.isArray(taskData.checklist) ? { checklist: taskData.checklist as any } : {}),
        } as any);
        await loadTasks();
      }
      
      setIsEditorOpen(false);
      setEditingTask(null);
  toast.success(t('toasts.planner.taskSaved'));
      
  // Realtime/refresh handles updates; no artificial delay
      
    } catch (error) {
      // Rollback on error
  toast.error(t('toasts.planner.taskSaveFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, viewMode, t, loadTasks]);

  const handleDeleteTask = useCallback((taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    if (!taskToDelete) return;

    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
    
    // Show undo option
  toast.success(t('toasts.planner.taskDeleted'), {
      action: {
    label: t('common.undo', { defaultValue: 'Undo' }),
        onClick: () => {
          setTasks(prev => [...prev, taskToDelete]);
        }
      }
    });
  }, [tasks]);

  const handleToggleComplete = useCallback(async (itemId: string) => {
    if (viewMode === "daily") {
      // Toggle task completion
      let nextStatus: Task['status'] | null = null;
      let completedAtToSave: Date | null = null;
      setTasks(prev => prev.map(task => {
        if (task.id !== itemId) return task;
        nextStatus = task.status === "done" ? "todo" : "done";
        completedAtToSave = nextStatus === "done" ? startOfDay(selectedDate) : null;
        return {
          ...task,
          status: nextStatus,
          progress: nextStatus === "done" ? 100 : 0,
          completedAt: completedAtToSave,
          updatedAt: new Date(),
        };
      }));
      // Persist
      try {
        const completedISO = completedAtToSave ? (completedAtToSave as Date).toISOString() : null;
        // Ensure we have a signed-in user
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;
        if (!userId) throw new Error('Not signed in');

        // Use browser Supabase client; also filter by user_id to be explicit
        const { error } = await supabase
          .from('planner_items')
          .update({
            status: nextStatus as any,
            completed_at: completedISO,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .eq('user_id', userId);
        if (error) throw error as any;
      } catch (e) {
        // Try server API fallback (uses server-side auth cookies)
        try {
          const completedISO = completedAtToSave ? (completedAtToSave as Date).toISOString() : null;
          const res = await fetch(`/api/tasks/list?id=${encodeURIComponent(itemId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus, completedAt: completedISO })
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `HTTP ${res.status}`);
          }
        } catch (e2) {
          // On error, reload from server to reconcile and show a hint
          const msg = (e2 as any)?.message || (e as any)?.message || (e as any)?.error_description || 'Unknown error';
          console.error('Failed to update task status (both client and API fallback):', e, e2);
          toast.error(`${t('toasts.planner.taskSaveFailed', { defaultValue: 'Failed to save task' })}: ${msg}`);
          await loadTasks();
        }
      }
    } else if (viewMode === "weekly") {
      // Toggle weekly goal completion and persist
      let next: Goal | undefined;
      setWeeklyGoals(prev => prev.map(g => {
        if (g.id !== itemId) return g;
        const toggled = {
          ...g,
          status: g.status === 'completed' ? 'in_progress' : 'completed',
          progress: g.status === 'completed' ? 0 : 100,
          updatedAt: new Date(),
        } as Goal;
        next = toggled; return toggled;
      }));
      try {
        if (next) {
          await supabase.from('planner_items').update({
            status: next.status,
            progress: next.progress,
            updated_at: new Date().toISOString(),
          }).eq('id', next.id);
        }
      } catch (e) { /* reload on error */ await loadGoals(); }
    } else if (viewMode === "monthly") {
      let next: Goal | undefined;
      setMonthlyGoals(prev => prev.map(g => {
        if (g.id !== itemId) return g;
        const toggled = {
          ...g,
          status: g.status === 'completed' ? 'in_progress' : 'completed',
          progress: g.status === 'completed' ? 0 : 100,
          updatedAt: new Date(),
        } as Goal;
        next = toggled; return toggled;
      }));
      try {
        if (next) {
          await supabase.from('planner_items').update({
            status: next.status,
            progress: next.progress,
            updated_at: new Date().toISOString(),
          }).eq('id', next.id);
        }
      } catch (e) { await loadGoals(); }
    } else {
      let next: Goal | undefined;
      setYearlyGoals(prev => prev.map(g => {
        if (g.id !== itemId) return g;
        const toggled = {
          ...g,
          status: g.status === 'completed' ? 'in_progress' : 'completed',
          progress: g.status === 'completed' ? 0 : 100,
          updatedAt: new Date(),
        } as Goal;
        next = toggled; return toggled;
      }));
      try {
        if (next) {
          await supabase.from('planner_items').update({
            status: next.status,
            progress: next.progress,
            updated_at: new Date().toISOString(),
          }).eq('id', next.id);
        }
      } catch (e) { await loadGoals(); }
    }
  }, [selectedDate, viewMode, loadTasks, loadGoals]);

  // Toggle a checklist item inside a task (details pane on desktop)
  const handleToggleChecklistItem = useCallback(async (taskId: string, checklistItemId: string) => {
    let updatedTask: Task | null = null;
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const nextChecklist = (t.checklist || []).map(ci => ci.id === checklistItemId ? { ...ci, completed: !ci.completed } : ci);
      const nextProgress = nextChecklist.length > 0 ? Math.round((nextChecklist.filter(ci => ci.completed).length / nextChecklist.length) * 100) : t.progress;
      updatedTask = { ...t, checklist: nextChecklist, progress: nextProgress, updatedAt: new Date() };
      return updatedTask;
    }));
    if (selectedTask?.id === taskId && updatedTask) {
      setSelectedTask(updatedTask);
    }
    // Persist checklist and progress to Supabase
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId || !updatedTask) return;
      const prog = (updatedTask as Task).progress;
      const checklist = (updatedTask as Task).checklist;
      await supabase
        .from('planner_items')
        .update({ progress: prog, checklist, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId);
    } catch (e) {
      console.warn('Failed to persist checklist/progress:', e);
    }
  }, [selectedTask]);

  const handleSaveGoal = useCallback(async (goalData: Partial<Goal>) => {
    setIsLoading(true);
    
    try {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error('Not signed in');
      // Persist to Supabase with optimistic UI
    if (goalData.id) {
        const payload = {
          title: goalData.title,
          description: goalData.description ?? null,
          status: goalData.status,
          priority: goalData.priority,
          type: goalData.type,
          target_date: goalData.targetDate ? goalData.targetDate.toISOString() : undefined,
          milestones: goalData.milestones || [],
      progress: typeof goalData.progress === 'number' ? goalData.progress : undefined,
      checklist: Array.isArray(goalData.checklist) ? goalData.checklist : undefined,
      tags: Array.isArray(goalData.tags) ? goalData.tags : undefined,
      estimate_hours: typeof goalData.estimateHours === 'number' ? goalData.estimateHours : undefined,
          updated_at: new Date().toISOString(),
        } as any;
  await supabase.from('planner_items').update(payload).eq('id', goalData.id);
      } else {
        const toInsert = {
          user_id: userId,
          title: goalData.title || t('planner.default.untitledGoal'),
          description: goalData.description || null,
          status: goalData.status || 'planning',
          priority: goalData.priority || 'medium',
          type: (goalData.type as any) || (viewMode as any),
          target_date: (goalData.targetDate || selectedDate).toISOString(),
          milestones: goalData.milestones || [],
          progress: typeof goalData.progress === 'number' ? goalData.progress : 0,
          checklist: Array.isArray(goalData.checklist) ? goalData.checklist : [],
          tags: Array.isArray(goalData.tags) ? goalData.tags : [],
          estimate_hours: typeof goalData.estimateHours === 'number' ? goalData.estimateHours : null,
        } as any;
  await supabase.from('planner_items').insert(toInsert);
      }
      
      setIsGoalEditorOpen(false);
      setEditingGoal(null);
  toast.success(t('toasts.planner.goalSaved'));
      
      await loadGoals();
      
    } catch (error) {
      // Rollback on error
  toast.error(t('toasts.planner.goalSaveFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, selectedDate, t, loadGoals]);

  const handleDeleteGoal = useCallback((goalId: string) => {
  const goalToDelete = viewMode === "weekly" ? weeklyGoals.find(g => g.id === goalId) : 
             viewMode === "monthly" ? monthlyGoals.find(g => g.id === goalId) : 
             yearlyGoals.find(g => g.id === goalId);
    
    if (!goalToDelete) return;

    // Optimistic update
    if (viewMode === "weekly") {
      setWeeklyGoals(prev => prev.filter(g => g.id !== goalId));
    } else if (viewMode === "monthly") {
      setMonthlyGoals(prev => prev.filter(g => g.id !== goalId));
    } else {
      setYearlyGoals(prev => prev.filter(g => g.id !== goalId));
    }
    
    setSelectedGoal(null);
    
    // Persist deletion
    (async () => {
      try {
  await supabase.from('planner_items').delete().eq('id', goalId);
      } catch (e) {
        toast.error(t('toasts.planner.goalSaveFailed'));
        await loadGoals();
        return;
      }
      // Undo option (recreate)
      toast.success(t('toasts.planner.goalDeleted'), {
        action: {
          label: t('common.undo', { defaultValue: 'Undo' }),
          onClick: async () => {
            try {
              if (!goalToDelete) return;
              const { data: auth } = await supabase.auth.getUser();
              const userId = auth?.user?.id;
              if (!userId) return;
              await supabase.from('planner_items').insert({
                user_id: userId,
                title: goalToDelete.title,
                description: goalToDelete.description || null,
                status: goalToDelete.status,
                priority: goalToDelete.priority,
                type: goalToDelete.type,
                target_date: goalToDelete.targetDate.toISOString(),
                milestones: goalToDelete.milestones || [],
                progress: goalToDelete.progress,
                created_at: goalToDelete.createdAt.toISOString(),
                updated_at: new Date().toISOString(),
              });
              await loadGoals();
            } catch {}
          }
        }
      });
    })();
  }, [viewMode, weeklyGoals, monthlyGoals, yearlyGoals, t, loadGoals]);

  // Toggle milestone completion for a goal in the details pane
  const handleToggleMilestone = useCallback(async (goalId: string, milestoneId: string) => {
    let updated: Goal | null = null;
    if (viewMode === 'weekly') {
      setWeeklyGoals(prev => prev.map(g => {
        if (g.id !== goalId) return g;
        const nextMilestones = (g.milestones || []).map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
        const nextProgress = nextMilestones.length > 0 ? Math.round((nextMilestones.filter(m => m.completed).length / nextMilestones.length) * 100) : g.progress;
        updated = { ...g, milestones: nextMilestones, progress: nextProgress, updatedAt: new Date() };
        return updated;
      }));
    } else if (viewMode === 'monthly') {
      setMonthlyGoals(prev => prev.map(g => {
        if (g.id !== goalId) return g;
        const nextMilestones = (g.milestones || []).map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
        const nextProgress = nextMilestones.length > 0 ? Math.round((nextMilestones.filter(m => m.completed).length / nextMilestones.length) * 100) : g.progress;
        updated = { ...g, milestones: nextMilestones, progress: nextProgress, updatedAt: new Date() };
        return updated;
      }));
    } else {
      setYearlyGoals(prev => prev.map(g => {
        if (g.id !== goalId) return g;
        const nextMilestones = (g.milestones || []).map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
        const nextProgress = nextMilestones.length > 0 ? Math.round((nextMilestones.filter(m => m.completed).length / nextMilestones.length) * 100) : g.progress;
        updated = { ...g, milestones: nextMilestones, progress: nextProgress, updatedAt: new Date() };
        return updated;
      }));
    }
    if (selectedGoal?.id === goalId && updated) {
      setSelectedGoal(updated);
    }
  // Persist progress only (milestones kept client-side for now)
    try {
      if (!updated) return;
      const prog = (updated as Goal).progress;
      await supabase
        .from('planner_items')
        .update({ progress: prog, updated_at: new Date().toISOString() })
        .eq('id', goalId);
    } catch (e) {
      console.warn('Failed to persist goal progress:', e);
    }
  }, [viewMode, selectedGoal]);

  const formatDate = (date: Date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return t('planner.labels.today');
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return t('planner.labels.tomorrow');
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return t('planner.labels.yesterday');
    
  return fmt.wmd.format(date);
  };

  // Reset filters function
  const resetFilters = useCallback(() => {
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterTimeRange("all");
    setFilterCompletion("all");
    setCustomDateStart(null);
    setCustomDateEnd(null);
    setShowCompletedTasks(true);
  toast.success(t('toasts.planner.filtersReset'));
  }, []);

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== "all") count++;
    if (filterPriority !== "all") count++;
    if (filterTimeRange !== "all") count++;
    if (filterCompletion !== "all") count++;
    if (!showCompletedTasks) count++;
    return count;
  }, [filterStatus, filterPriority, filterTimeRange, filterCompletion, showCompletedTasks]);

  // Check if view mode is allowed for current subscription - FIXED MAPPING
  const isViewModeAllowed = useCallback((mode: ViewMode) => {
    switch (subscriptionPlan) {
      case 'free':
        return mode === 'daily';
      case 'lite':  // Changed from 'pro'
        return mode === 'daily' || mode === 'weekly' || mode === 'monthly';
      case 'pro':   // Changed from 'premium'
        return true;
      default:
        return mode === 'daily';
    }
  }, [subscriptionPlan]);

  // Handle restricted view mode selection - FIXED MAPPING
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (!isViewModeAllowed(mode)) {
  const modeLabel = t(`planner.views.${mode}`);
  const tierLabel = mode === 'yearly' ? t('plans.pro') : t('plans.lite');
  toast.error(t('toasts.planner.subscriptionRequired', { mode: modeLabel, tier: tierLabel }));
      onUpgrade?.();
      return;
    }
    setViewMode(mode);
  }, [isViewModeAllowed, onUpgrade]);

  // Define subscription limits - FIXED MAPPING
  const limits = useMemo(() => ({
    maxTasks: subscriptionPlan === 'free' ? 50 : subscriptionPlan === 'lite' ? 500 : Infinity,
    weeklyView: subscriptionPlan !== 'free',
    monthlyView: subscriptionPlan !== 'free',  // Changed from 'pro' to 'lite' access
    yearlyView: subscriptionPlan === 'pro',    // Changed from 'pro' to 'pro' (was premium)
    analyticsBlurred: subscriptionPlan === 'free',
    aiSummaries: subscriptionPlan === 'pro',   // Changed from 'pro' to 'pro' (was premium)
    exportFeatures: subscriptionPlan !== 'free',
    pdfReports: subscriptionPlan === 'pro'     // Changed from 'pro' to 'pro' (was premium)
  }), [subscriptionPlan]);

  // Add missing renderLockedTab function
  const renderLockedTab = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground cursor-not-allowed opacity-50">
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <Lock className="h-3 w-3" />
    </div>
  );

  // Swipe zone ref and hook — captures horizontal swipes across the whole planner area
  const swipeZoneRef = useRef<HTMLDivElement>(null);
  useWholeAreaSwipe(
    swipeZoneRef,
    () => viewMode,
    (dir, mode) => setSelectedDate(prev => stepByView(prev, mode, dir))
  );

  // Helpers to allow export/import even when no project is selected
  const slug = useCallback((s: string) => (s || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-'), []);

  const serializeGoal = useCallback((g: Goal) => ({
    version: 1,
    exported_at: new Date().toISOString(),
    title: g.title,
    description: g.description || null,
    status: g.status,
    priority: g.priority,
    type: g.type,
    target_date: g.targetDate ? new Date(g.targetDate).toISOString() : null,
    progress: typeof g.progress === 'number' ? g.progress : 0,
    checklist: Array.isArray(g.checklist) ? g.checklist : [],
    tags: Array.isArray(g.tags) ? g.tags : [],
    estimate_hours: typeof g.estimateHours === 'number' ? g.estimateHours : null,
    milestones: Array.isArray(g.milestones)
      ? g.milestones.map(m => ({
          id: m.id,
          title: m.title,
          completed: !!m.completed,
          status: m.status || 'todo',
          notes: m.notes || '',
          dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : null,
        }))
      : [],
  }), []);

  const headerExport = useCallback(() => {
    try {
      if (selectedGoal) {
        const data = serializeGoal(selectedGoal);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `artilect-project-${slug(selectedGoal.title)}-${ts}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success(t('toasts.planner.exported', { defaultValue: 'Project exported' }));
        return;
      }
      // Export all visible projects for current period if none selected
      if ((viewMode === 'monthly' || viewMode === 'yearly')) {
        const goals = (filteredItems as Goal[]) || [];
        if (!goals.length) return; // nothing to export
        const data = goals.map(serializeGoal);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `artilect-projects-${viewMode}-${ts}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success(t('toasts.planner.exported', { defaultValue: 'Project exported' }));
      }
    } catch {
      toast.error(t('toasts.planner.exportFailed', { defaultValue: 'Failed to export project' }));
    }
  }, [selectedGoal, filteredItems, viewMode, t, slug, serializeGoal]);

  const normalizeImportedProject = useCallback((obj: any, fallbackType: Goal['type']) => {
    const title = typeof obj?.title === 'string' && obj.title.trim() ? obj.title.trim() : (t('planner.default.untitledGoal') as string);
    const description = typeof obj?.description === 'string' ? obj.description : null;
    const status = (obj?.status === 'planning' || obj?.status === 'in_progress' || obj?.status === 'completed' || obj?.status === 'paused')
      ? obj.status : 'planning';
    const priority = (obj?.priority === 'low' || obj?.priority === 'medium' || obj?.priority === 'high') ? obj.priority : 'medium';
    const type = (obj?.type === 'weekly' || obj?.type === 'monthly' || obj?.type === 'yearly') ? obj.type : fallbackType;
    const target_date = obj?.target_date ? new Date(obj.target_date).toISOString() : new Date().toISOString();
    const tags = Array.isArray(obj?.tags) ? obj.tags.filter((x: any) => typeof x === 'string') : [];
    const checklist = Array.isArray(obj?.checklist) ? obj.checklist : [];
    const estimate_hours = typeof obj?.estimate_hours === 'number' ? obj.estimate_hours : null;
    const milestones = Array.isArray(obj?.milestones) ? obj.milestones.map((m: any) => ({
      id: typeof m?.id === 'string' && m.id ? m.id : String(Date.now() + Math.random()),
      title: typeof m?.title === 'string' ? m.title : '',
      completed: !!m?.completed,
      status: (m?.status === 'todo' || m?.status === 'doing' || m?.status === 'done') ? m.status : 'todo',
      notes: typeof m?.notes === 'string' ? m.notes : '',
      dueDate: m?.dueDate ? m.dueDate : null,
    })) : [];
    const progress = typeof obj?.progress === 'number'
      ? obj.progress
      : (milestones.length ? Math.round((milestones.filter((m: any) => m.completed).length / milestones.length) * 100) : 0);
    return { title, description, status, priority, type, target_date, milestones, progress, checklist, tags, estimate_hours } as any;
  }, [t]);

  const headerImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error('Not signed in');
      const fallbackType: Goal['type'] = (viewMode === 'yearly' ? 'yearly' : 'monthly');
      const records = Array.isArray(json) ? json.map((o: any) => normalizeImportedProject(o, fallbackType)) : [normalizeImportedProject(json, fallbackType)];
      const payload = records.map(r => ({
        user_id: userId,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority,
        type: r.type,
        target_date: r.target_date,
        milestones: r.milestones,
        progress: r.progress,
        checklist: r.checklist,
        tags: r.tags,
        estimate_hours: r.estimate_hours,
      }));
      const { data: inserted, error } = await supabase.from('planner_items').insert(payload).select('*');
      if (error) throw error;
      await loadGoals();
      // Auto-select the first imported project
      const row = Array.isArray(inserted) && inserted[0];
      if (row) {
        const g: Goal = {
          id: String(row.id),
          title: row.title || '',
          description: row.description || undefined,
          status: (row.status || 'planning'),
          priority: (row.priority || 'medium'),
          type: (row.type || fallbackType),
          targetDate: row.target_date ? new Date(row.target_date) : new Date(),
          milestones: Array.isArray(row.milestones) ? row.milestones : [],
          checklist: Array.isArray(row.checklist) ? row.checklist : [],
          tags: Array.isArray(row.tags) ? row.tags : [],
          estimateHours: typeof row.estimate_hours === 'number' ? row.estimate_hours : undefined,
          progress: typeof row.progress === 'number' ? row.progress : 0,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        } as any;
        setSelectedGoal(g);
        setProjectMode(true);
      }
      toast.success(t('toasts.planner.imported', { defaultValue: 'Project imported' }));
    } catch (err: any) {
      const msg = err?.message || err?.error_description || String(err);
      toast.error(`${t('toasts.planner.importFailed', { defaultValue: 'Failed to import project' })}: ${msg}`);
    } finally {
      if (headerFileInputRef.current) headerFileInputRef.current.value = '';
    }
  }, [viewMode, normalizeImportedProject, t, loadGoals]);

  const triggerHeaderImport = useCallback(() => {
    const el = headerFileInputRef.current;
    if (!el) return;
    // @ts-ignore
    if (typeof el.showPicker === 'function') el.showPicker(); else el.click();
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
        <div ref={swipeZoneRef} className="w-full touch-pan-y select-none">
  {/* Header with View Mode Switch and Calendar */}
  <motion.div className="select-none touch-pan-y">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          {viewMode === "daily" ? (
            // Days of the week for daily view
            <div className="flex items-center gap-2">
              {weekDays.map((day) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const isSelected = day.toDateString() === selectedDate.toDateString();
                
                return (
                  <ScaleButton
                    key={day.toDateString()}
                    onClick={() => setSelectedDate(day)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelected 
                        ? 'bg-[#00d563] text-white' 
                        : isToday 
                        ? 'bg-[#00d563]/20 text-[#00d563] hover:bg-[#00d563]/30'
                        : 'hover:bg-surface-1 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-xs">{wdShort(day)}</div>
                      <div className={`text-sm ${isSelected ? 'font-bold' : ''}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  </ScaleButton>
                );
              })}
            </div>
          ) : viewMode === "weekly" ? (
            // Week ranges for weekly view
            <div className="flex items-center gap-2">
              {weekRanges.map((week, index) => {
                const isCurrentWeek = week.start.getTime() <= selectedDate.getTime() && selectedDate.getTime() <= week.end.getTime();
                const isActualCurrentWeek = week.start.getTime() <= new Date().getTime() && new Date().getTime() <= week.end.getTime();
                const weekLabel = formatDateRange(week.start, week.end);
                
                return (
                  <ScaleButton
                    key={week.start.toISOString()}
                    onClick={() => setSelectedDate(week.start)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrentWeek 
                        ? 'bg-[#00d563] text-white shadow-lg shadow-[#00d563]/25' 
                        : isActualCurrentWeek
                        ? 'bg-[#00d563]/20 text-[#00d563] hover:bg-[#00d563]/30 ring-1 ring-[#00d563]/30'
                        : 'hover:bg-surface-1 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-xs">{fmt.m.format(selectedDate)}</div>
                      <div className={`text-sm ${isCurrentWeek ? 'font-bold' : ''}`}>
                        {week.start.getDate()}-{week.end.getDate()}
                      </div>
                    </div>
                  </ScaleButton>
                );
              })}
            </div>
          ) : viewMode === "monthly" ? (
            // Month ranges for monthly view
            <div className="flex items-center gap-2">
              {monthRanges.map((month) => {
                const isCurrentMonth = month.getMonth() === selectedDate.getMonth() && month.getFullYear() === selectedDate.getFullYear();
                const isActualCurrentMonth = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();
                
                return (
                  <ScaleButton
                    key={month.toISOString()}
                    onClick={() => setSelectedDate(month)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrentMonth 
                        ? 'bg-[#00d563] text-white shadow-lg shadow-[#00d563]/25' 
                        : isActualCurrentMonth
                        ? 'bg-[#00d563]/20 text-[#00d563] hover:bg-[#00d563]/30 ring-1 ring-[#00d563]/30'
                        : 'hover:bg-surface-1 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-xs">{month.getFullYear()}</div>
                      <div className={`text-sm ${isCurrentMonth ? 'font-bold' : ''}`}>
                        {fmt.m.format(month)}
                      </div>
                    </div>
                  </ScaleButton>
                );
              })}
            </div>
          ) : (
            // Year ranges for yearly view
            <div className="flex items-center gap-2">
              {yearRanges.map((year) => {
                const isCurrentYear = year === selectedDate.getFullYear();
                const isActualCurrentYear = year === new Date().getFullYear();
                
                return (
                  <ScaleButton
                    key={year}
                    onClick={() => setSelectedDate(new Date(year, 0, 1))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrentYear 
                        ? 'bg-[#00d563] text-white shadow-lg shadow-[#00d563]/25' 
                        : isActualCurrentYear
                        ? 'bg-[#00d563]/20 text-[#00d563] hover:bg-[#00d563]/30 ring-1 ring-[#00d563]/30'
                        : 'hover:bg-surface-1 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-xs">{t('planner.labels.year')}</div>
                      <div className={`text-sm ${isCurrentYear ? 'font-bold' : ''}`}>
                        {year}
                      </div>
                    </div>
                  </ScaleButton>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ScaleButton
            onClick={() => setShowCalendarPicker(true)}
            className="shrink-0 h-9 w-9 md:h-10 md:w-auto md:px-3 flex items-center justify-center gap-2 rounded-xl
                       hover:bg-surface-1/50 text-emerald-400"
          >
            <CalendarIcon className="w-4 h-4 md:w-5 md:h-5" />
            {/* hide date on phones */}
            <span className="hidden md:inline text-sm font-medium">
              {fmt.md.format(selectedDate)}
            </span>
          </ScaleButton>
        </div>
  </div>
  </motion.div>

      </div>

      {/* View Mode Tabs (kept outside the swipe zone) */}
      <div className="px-4 py-2 border-b border-border bg-surface-1/50">
        <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('planner.views.daily')}</span>
            </TabsTrigger>
            
            {isViewModeAllowed('weekly') ? (
              <TabsTrigger value="weekly" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">{t('planner.views.weekly')}</span>
              </TabsTrigger>
            ) : (
              renderLockedTab('weekly', <CalendarDays className="h-4 w-4" />, t('planner.views.weekly'))
            )}
            
            {isViewModeAllowed('monthly') ? (
              <TabsTrigger value="monthly" className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                <span className="hidden sm:inline">{t('planner.views.monthly')}</span>
              </TabsTrigger>
            ) : (
              renderLockedTab('monthly', <ListTodo className="h-4 w-4" />, t('planner.views.monthly'))
            )}
            
            {isViewModeAllowed('yearly') ? (
              <TabsTrigger value="yearly" className="flex items-center gap-2">
                <ChartGantt className="h-4 w-4" />
                <span className="hidden sm:inline">{t('planner.views.yearly')}</span>
              </TabsTrigger>
            ) : (
              renderLockedTab('yearly', <ChartGantt className="h-4 w-4" />, t('planner.views.yearly'))
            )}
          </TabsList>
        </Tabs>
      </div>

  {/* Enhanced Filters (Search removed) */}
      <div className="p-4 border-b border-border bg-surface-2/50">
        <div className="flex flex-col gap-3">
          {/* Primary filters row */}
          <div className="flex flex-col md:flex-row gap-3">
    <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                <SelectTrigger className="w-32 bg-surface-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('planner.filters.status.all')}</SelectItem>
                  <SelectItem value="todo">{t('planner.filters.status.todo')}</SelectItem>
                  <SelectItem value="doing">{t('planner.filters.status.doing')}</SelectItem>
                  <SelectItem value="done">{t('planner.filters.status.done')}</SelectItem>
                  <SelectItem value="skipped">{t('planner.filters.status.skipped')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as FilterPriority)}>
                <SelectTrigger className="w-32 bg-surface-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('planner.filters.priority.all')}</SelectItem>
                  <SelectItem value="high">{t('planner.priority.high')}</SelectItem>
                  <SelectItem value="medium">{t('planner.priority.medium')}</SelectItem>
                  <SelectItem value="low">{t('planner.priority.low')}</SelectItem>
                </SelectContent>
              </Select>
        <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={
          // Match SelectTrigger: height, radius, bg, border, padding, text, and width
          "h-9 w-32 px-3 py-2 rounded-md bg-surface-1 border border-input text-sm flex items-center justify-center"
                }
              >
                <Filter className="h-4 w-4 mr-1 opacity-80" />
                {t('planner.filters.button')}
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 bg-[#00d563] text-black text-xs px-1 min-w-[16px] h-4">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>
            {/* Project/List switcher at far right (web-only, monthly/yearly) */}
            <div className="hidden md:flex items-center gap-2 ml-auto">
              {(viewMode === 'monthly' || viewMode === 'yearly') && (
                <div className="inline-flex items-center gap-2">
                  {projectMode && (
                    <>
                      <input ref={headerFileInputRef} type="file" accept=".json,application/json" className="sr-only" onChange={headerImportFile} />
                      <ScaleButton variant="outline" className="h-8 px-3 rounded-md" onClick={triggerHeaderImport}>
                        {t('planner.actions.import', { defaultValue: 'Import' })}
                      </ScaleButton>
                      <ScaleButton variant="outline" className="h-8 px-3 rounded-md" onClick={headerExport} disabled={(viewMode==='monthly'||viewMode==='yearly') && !selectedGoal && (filteredItems as any[])?.length===0}>
                        {t('planner.actions.export', { defaultValue: 'Export' })}
                      </ScaleButton>
                    </>
                  )}
                  <div className="inline-flex rounded-md border border-input bg-surface-1 p-1">
                    <Button
                      variant={projectMode ? 'ghost' : 'default'}
                      className={`${projectMode ? 'text-muted-foreground' : 'bg-[#00d563] text-black hover:bg-[#00d563]/90'} h-8 px-3 py-1 rounded-md`}
                      onClick={() => setProjectMode(false)}
                    >
                      {t('planner.views.list', { defaultValue: 'List' })}
                    </Button>
                    <Button
                      variant={projectMode ? 'default' : 'ghost'}
                      className={`${projectMode ? 'bg-[#00d563] text-black hover:bg-[#00d563]/90' : 'text-muted-foreground'} h-8 px-3 py-1 rounded-md`}
                      onClick={() => setProjectMode(true)}
                    >
                      {t('planner.views.projects', { defaultValue: 'Projects' })}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced filters */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {/* Time range and completion filters */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex gap-2 flex-1">
                    <Select value={filterTimeRange} onValueChange={(value) => setFilterTimeRange(value as FilterTimeRange)}>
                        <SelectTrigger className="bg-surface-1">
                        <SelectValue placeholder={t('planner.filters.timeRange.placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('planner.filters.timeRange.all')}</SelectItem>
                        <SelectItem value="today">{t('planner.filters.timeRange.today')}</SelectItem>
                        <SelectItem value="yesterday">{t('planner.filters.timeRange.yesterday')}</SelectItem>
                        <SelectItem value="this_week">{t('planner.filters.timeRange.thisWeek')}</SelectItem>
                        <SelectItem value="last_week">{t('planner.filters.timeRange.lastWeek')}</SelectItem>
                        <SelectItem value="this_month">{t('planner.filters.timeRange.thisMonth')}</SelectItem>
                        <SelectItem value="last_month">{t('planner.filters.timeRange.lastMonth')}</SelectItem>
                        <SelectItem value="this_year">{t('planner.filters.timeRange.thisYear')}</SelectItem>
                        <SelectItem value="last_year">{t('planner.filters.timeRange.lastYear')}</SelectItem>
                        <SelectItem value="custom">{t('planner.filters.timeRange.custom')}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterCompletion} onValueChange={(value) => setFilterCompletion(value as FilterCompletion)}>
                      <SelectTrigger className="bg-surface-1">
                        <SelectValue placeholder={t('planner.filters.completion.placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('planner.filters.completion.all')}</SelectItem>
                        <SelectItem value="completed">{t('planner.filters.completion.completed')}</SelectItem>
                        <SelectItem value="incomplete">{t('planner.filters.completion.incomplete')}</SelectItem>
                        <SelectItem value="overdue">{t('planner.filters.completion.overdue')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show-completed"
                      checked={showCompletedTasks}
                      onCheckedChange={(checked) => setShowCompletedTasks(!!checked)}
                    />
                    <Label htmlFor="show-completed" className="text-sm">{t('planner.filters.showCompleted')}</Label>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t('planner.filters.resetAll')}
                  </Button>
                </div>

                {/* Custom date range inputs */}
                {filterTimeRange === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 items-center"
                  >
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">{t('planner.filters.labels.from')}</Label>
                    <Input
                      type="date"
                      value={customDateStart?.toISOString().split('T')[0] || ""}
                      onChange={(e) => setCustomDateStart(e.target.value ? new Date(e.target.value) : null)}
                      className="bg-surface-1"
                    />
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">{t('planner.filters.labels.to')}</Label>
                    <Input
                      type="date"
                      value={customDateEnd?.toISOString().split('T')[0] || ""}
                      onChange={(e) => setCustomDateEnd(e.target.value ? new Date(e.target.value) : null)}
                      className="bg-surface-1"
                    />
                  </motion.div>
                )}

                {/* Filter summary */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <History className="h-3 w-3" />
                  <span>
                    {t('planner.filters.labels.showing')} {filteredItems.length} {viewMode === "daily" ? t('planner.filters.labels.tasks') : t('planner.filters.labels.goals')}
                    {activeFilterCount > 0 && ` ${t(activeFilterCount === 1 ? 'planner.filters.labels.activeFilter_one' : 'planner.filters.labels.activeFilter_other', { count: activeFilterCount })}`}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Calendar Picker Modal */}
      {showCalendarPicker && (
        <SlideUpModal
          isOpen={showCalendarPicker}
          onClose={() => setShowCalendarPicker(false)}
          title={t('planner.calendar.selectDateTitle')}
          className="min-h-[60vh]"
        >
          <div className="space-y-4">
            <p className="text-muted-foreground text-center">
              {t('planner.calendar.selectDateDesc')}
            </p>
            <div className="flex justify-center">
              <div className="w-full max-w-[380px] sm:max-w-[420px]">
                <div className="glass-card rounded-2xl p-4">
                  <DateCalendar
                    mode="single"
                    showOutsideDays
                    defaultMonth={selectedDate}
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setSelectedDate(date);
                      setShowCalendarPicker(false);
                      toast.success(t('planner.calendar.selectedToast', { date: date.toLocaleDateString() }));
                    }}
                    className="w-full [--cell-size:2.5rem]"
                    classNames={{
                      root: "w-full",
                      months: "flex flex-col gap-2",
                      month: "flex flex-col w-full gap-2",
                      nav: "flex items-center justify-between relative",
                      month_caption: "flex items-center justify-center h-10 w-full px-2 text-foreground",
                      weekdays: "flex px-0.5",
                      week: "flex w-full mt-1",
                      day: "relative w-full h-full p-0 text-center group/day aspect-square select-none",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </SlideUpModal>
      )}

  {/* Main Content Area */}
  <motion.div className="flex-1 flex">
        {/* Task List */}
  <div className={`flex-1 md:flex-none ${projectMode && (viewMode==='monthly' || viewMode==='yearly') ? 'md:w-[30%]' : 'md:w-1/2'} overflow-y-auto overflow-x-hidden min-h-0`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {viewMode === "daily" ? t('planner.list.tasks') : viewMode === "weekly" ? t('planner.list.weeklyGoals') : viewMode === "monthly" ? t('planner.list.monthlyGoals') : t('planner.list.yearlyGoals')} ({filteredItems.length})
              </h2>
            </div>

            <AnimatePresence>
              {filteredItems.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">{t('planner.list.empty', { itemType: viewMode === 'daily' ? t('planner.filters.labels.tasks') : t('planner.filters.labels.goals'), date: formatDate(selectedDate) })}</p>
                  <ScaleButton onClick={viewMode === "daily" ? handleNewTask : handleNewGoal} variant="outline">
                    {t('planner.list.createFirst', { itemTypeSingle: viewMode === 'daily' ? t('planner.nouns.task') : t('planner.nouns.goal') })}
                  </ScaleButton>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      {(() => {
                        const isActive = (isEditorOpen && editingTask?.id === item.id) || (selectedTask?.id === (item as any)?.id) || (viewMode !== 'daily' && selectedGoal?.id === (item as any)?.id);
                        return (
                      <Card
                        role="button"
                        tabIndex={0}
                        className={`group cursor-pointer transition-colors hover:bg-surface-1 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${isActive ? "ring-2 ring-primary" : ""}`}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); }}
                        onClick={() => {
                          if (viewMode === "daily") {
                            const t = item as Task;
                            const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
                            if (isDesktop) {
                              // On desktop/web: show details in the right pane
                              setSelectedTask(t);
                              setIsEditorOpen(false);
                              setEditingTask(null);
                            } else {
                              // On mobile: open the editor modal
                              setEditingTask({
                                ...t,
                                startDate: t.startDate ? new Date(t.startDate) : undefined,
                                dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
                                checklist: t.checklist ? t.checklist.map(ci => ({ ...ci })) : [],
                              });
                              setIsEditorOpen(true);
                            }
                          } else {
                            const g = item as Goal;
                            const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
                            if (isDesktop) {
                              setSelectedGoal(g);
                              setIsGoalEditorOpen(false);
                              setEditingGoal(null);
                            } else {
                              setEditingGoal?.({
                                ...g,
                                targetDate: g.targetDate ? new Date(g.targetDate) : undefined,
                                milestones: g.milestones ? g.milestones.map(m => ({ ...m })) : [],
                              });
                              setIsGoalEditorOpen?.(true);
                            }
                          }
                        }}
                      >
                        <CardContent className="relative p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={item.status === "done" || item.status === "completed"}
                              onCheckedChange={() => handleToggleComplete(item.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            
                            <div className="flex-1 min-w-0 pr-16">
                              <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                                <h3 className={`font-medium clamp-2 break-anywhere ${
                                  item.status === "done" || item.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                                }`}>
                                  {item.title}
                                </h3>
                              </div>
                              {/* Priority badge pinned top-right */}
                              <Badge className={`absolute right-3 top-3 text-xs ${getPriorityColor(item.priority)}`}>
                                {t(`planner.priority.${item.priority}`)}
                              </Badge>
                              
                              {item.description && (
                                <p className="text-sm text-muted-foreground clamp-2 break-anywhere mb-2">
                                  {item.description}
                                </p>
                              )}
                              {(() => {
                                // Show progress line whenever there are subtasks/milestones (even at 0% or 100%).
                                const isTask = viewMode === 'daily';
                                const hasTaskChecklist = isTask && 'checklist' in (item as any) && Array.isArray((item as any).checklist) && (item as any).checklist.length > 0;
                                const hasGoalMilestones = !isTask && 'milestones' in (item as any) && Array.isArray((item as any).milestones) && (item as any).milestones.length > 0;
                                const hasGoalChecklist = !isTask && 'checklist' in (item as any) && Array.isArray((item as any).checklist) && (item as any).checklist.length > 0;
                                const showProgress = hasTaskChecklist || hasGoalMilestones || hasGoalChecklist;
                                return showProgress ? (
                                  <Progress value={item.progress} className="h-1.5 mb-2" />
                                ) : null;
                              })()}
                              
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {"dueDate" in item && (item as Task).dueDate && (
                                  <span>{t('planner.detail.dueDate')}: {(item as Task).dueDate!.toLocaleDateString()}</span>
                                )}
                                {"targetDate" in item && (item as Goal).targetDate && (
                                  <span>{t('planner.detail.targetDate')}: {(item as Goal).targetDate!.toLocaleDateString()}</span>
                                )}
                                {"estimateHours" in item && typeof (item as Task).estimateHours !== "undefined" && (
                                  <span>{(item as Task).estimateHours}h</span>
                                )}
                                {"tags" in item && (item as Task).tags && (item as Task).tags.length > 0 && (
                                  <div className="flex gap-1 flex-wrap max-w-full">
                                    {(item as Task).tags!.slice(0, 2).map(tag => (
                                      <Badge key={tag} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* removed grip icon */}
                          </div>
                        </CardContent>
                      </Card>
                        );
                      })()}
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

  {/* Detail Panel - Desktop */}
  <div className={`hidden md:block md:flex-none ${projectMode && (viewMode==='monthly' || viewMode==='yearly') ? 'md:w-[70%]' : 'md:w-1/2'} border-l border-border bg-surface-1/50`}>
          {viewMode === 'daily' ? (
            selectedTask ? (
              <TaskDetailPanel 
                task={selectedTask} 
                onEdit={(task) => { setEditingTask(task); setIsEditorOpen(true); }}
                onDelete={() => handleDeleteTask(selectedTask.id)}
                onToggleChecklist={handleToggleChecklistItem}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div>
                  <PanelsLeftBottom className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('planner.detail.selectPrompt', { itemTypeSingle: t('planner.nouns.task') })}</p>
                </div>
              </div>
            )
          ) : (
            selectedGoal ? (
              projectMode && (viewMode==='monthly' || viewMode==='yearly') ? (
                <ProjectPlanTable goal={selectedGoal} onChange={async (updated) => {
                  setSelectedGoal(updated);
                  const ms = updated.milestones || [];
                  const prog = ms.length ? Math.round((ms.filter((m: Milestone)=>m.completed).length / ms.length) * 100) : 0;
                  try { await supabase.from('planner_items').update({ milestones: ms, progress: prog, updated_at: new Date().toISOString() }).eq('id', updated.id); } catch {}
                }} />
              ) : (
                // Reuse TaskDetailPanel UI for goals to match daily task details
                <TaskDetailPanel
                  task={{
                    id: selectedGoal.id,
                    title: selectedGoal.title,
                    description: selectedGoal.description,
                    status: goalStatusToTask(selectedGoal.status),
                    priority: selectedGoal.priority,
                    startDate: undefined,
                    dueDate: selectedGoal.targetDate,
                    estimateHours: selectedGoal.estimateHours,
                    tags: selectedGoal.tags || [],
                    checklist: selectedGoal.checklist || [],
                    progress: selectedGoal.progress,
                    attachments: [],
                    createdAt: selectedGoal.createdAt,
                    updatedAt: selectedGoal.updatedAt,
                    completedAt: selectedGoal.status === 'completed' ? (selectedGoal.updatedAt || new Date()) : null,
                  }}
                  onEdit={(taskLike) => {
                    // Map edited Task back to Goal and open goal editor with prefilled data
                    setEditingGoal({
                      id: selectedGoal.id,
                      title: taskLike.title,
                      description: taskLike.description,
                      status: taskStatusToGoal(taskLike.status),
                      priority: taskLike.priority,
                      targetDate: taskLike.dueDate || selectedGoal.targetDate,
                      milestones: selectedGoal.milestones,
                      progress: taskLike.progress,
                      type: selectedGoal.type,
                      tags: taskLike.tags,
                      checklist: taskLike.checklist,
                      estimateHours: taskLike.estimateHours,
                      createdAt: selectedGoal.createdAt,
                      updatedAt: new Date(),
                    } as any);
                    setIsGoalEditorOpen(true);
                  }}
                  onDelete={() => handleDeleteGoal(selectedGoal.id)}
                  onToggleChecklist={async (taskId, checklistItemId) => {
                    // Toggle within goal.checklist and persist progress and checklist
                    let updated = selectedGoal;
                    const nextChecklist = (selectedGoal.checklist || []).map(ci => ci.id === checklistItemId ? { ...ci, completed: !ci.completed } : ci);
                    const nextProgress = nextChecklist.length ? Math.round((nextChecklist.filter(ci=>ci.completed).length / nextChecklist.length) * 100) : selectedGoal.progress;
                    updated = { ...selectedGoal, checklist: nextChecklist, progress: nextProgress, updatedAt: new Date() } as Goal;
                    setSelectedGoal(updated);
                    // Replace in list state
                    if (viewMode === 'weekly') setWeeklyGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
                    if (viewMode === 'monthly') setMonthlyGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
                    if (viewMode === 'yearly') setYearlyGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
                    try {
                      await supabase.from('planner_items').update({ checklist: nextChecklist, progress: nextProgress, updated_at: new Date().toISOString() }).eq('id', updated.id);
                    } catch {}
                  }}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div>
                  <PanelsLeftBottom className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('planner.detail.selectPrompt', { itemTypeSingle: t('planner.nouns.goal') })}</p>
                </div>
              </div>
            )
          )}
        </div>
      </motion.div>

  {/* Progress Charts at Bottom with Blur Effect */}
  <div className="p-4 border-t border-border bg-surface-1 pb-[calc(env(safe-area-inset-bottom)+84px)]">
        <div className="relative">
          <PlannerAnalytics data={metrics} subscriptionPlan={subscriptionPlan} onUpgrade={onUpgrade} />
        </div>
      </div>

      {/* Task Editor Dialog */}
      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => {
          setIsEditorOpen(open);
          if (!open) setEditingTask(null);
        }}
      >
  <DialogContent className="w-[92vw] sm:max-w-2xl p-4 sm:p-6 overflow-y-auto rounded-2xl" onOpenAutoFocus={(e)=>e.preventDefault()}>
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">
              {editingTask?.id ? t('planner.editor.task.editTitle') : t('planner.editor.task.newTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('planner.editor.descriptionPlaceholder')}
            </DialogDescription>
          </DialogHeader>

      {editingTask && (
            <TaskEditor
              task={editingTask}
              onSave={handleSaveTask}
              onCancel={() => setIsEditorOpen(false)}
              onDelete={editingTask?.id ? () => { handleDeleteTask(editingTask.id as string); setIsEditorOpen(false); } : undefined}
              isLoading={isLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Goal Editor Dialog */}
      <Dialog
        open={isGoalEditorOpen}
        onOpenChange={(open) => {
          setIsGoalEditorOpen(open);
          if (!open) setEditingGoal(null);
        }}
      >
  <DialogContent className="w-[92vw] sm:max-w-2xl p-4 sm:p-6 overflow-y-auto rounded-2xl" onOpenAutoFocus={(e)=>e.preventDefault()}>
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">
              {editingGoal?.id ? t('planner.editor.goal.editTitle') : t('planner.editor.goal.newTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('planner.editor.descriptionPlaceholder')}
            </DialogDescription>
          </DialogHeader>
          
          {editingGoal && (
            <GoalEditor 
              goal={editingGoal}
              onSave={handleSaveGoal}
              onCancel={() => setIsGoalEditorOpen(false)}
              onDelete={editingGoal?.id ? () => { handleDeleteGoal(editingGoal.id as string); setIsGoalEditorOpen(false); } : undefined}
              isLoading={isLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

PlannerSection.displayName = 'PlannerSection';

export default PlannerSection;

// Notion-like project plan table for monthly/yearly project mode
function ProjectPlanTable({ goal, onChange }: { goal: Goal; onChange: (g: Goal) => void }) {
  const { t } = useTranslation('app');
  const [rows, setRows] = useState<Milestone[]>(goal.milestones || []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRows(goal.milestones || []);
  }, [goal.id]);

  const updateRow = (id: string, patch: Partial<Milestone>) => {
    const next = rows.map(r => r.id === id ? { ...r, ...patch } : r);
    setRows(next);
    onChange({ ...goal, milestones: next });
  };
  const addRow = () => {
    const r: Milestone = { id: String(Date.now()), title: '', completed: false };
    const next = [...rows, r];
    setRows(next);
    onChange({ ...goal, milestones: next });
  };
  const removeRow = (id: string) => {
    const next = rows.filter(r => r.id !== id);
    setRows(next);
    onChange({ ...goal, milestones: next });
  };

  // Helpers for export/import
  const slug = (s: string) => (s || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const serializeGoal = (g: Goal) => {
    // Convert Dates to ISO strings for portability
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      title: g.title,
      description: g.description || null,
      status: g.status,
      priority: g.priority,
      type: g.type,
      target_date: g.targetDate ? new Date(g.targetDate).toISOString() : null,
      progress: typeof g.progress === 'number' ? g.progress : 0,
      checklist: Array.isArray(g.checklist) ? g.checklist : [],
      tags: Array.isArray(g.tags) ? g.tags : [],
      estimate_hours: typeof g.estimateHours === 'number' ? g.estimateHours : null,
      milestones: Array.isArray(g.milestones)
        ? g.milestones.map(m => ({
            id: m.id,
            title: m.title,
            completed: !!m.completed,
            status: m.status || 'todo',
            notes: m.notes || '',
            dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : null
          }))
        : []
    };
  };

  const handleExport = () => {
    try {
      const data = serializeGoal({ ...goal, milestones: rows });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `artilect-project-${slug(goal.title)}-${ts}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success(t('toasts.planner.exported', { defaultValue: 'Project exported' }) as string);
    } catch (e) {
      toast.error(t('toasts.planner.exportFailed', { defaultValue: 'Failed to export project' }) as string);
    }
  };

  const normalizeImportedProject = (obj: any) => {
    const title = typeof obj?.title === 'string' && obj.title.trim() ? obj.title.trim() : (t('planner.default.untitledGoal') as string);
    const description = typeof obj?.description === 'string' ? obj.description : null;
    const status = (obj?.status === 'planning' || obj?.status === 'in_progress' || obj?.status === 'completed' || obj?.status === 'paused')
      ? obj.status : 'planning';
    const priority = (obj?.priority === 'low' || obj?.priority === 'medium' || obj?.priority === 'high') ? obj.priority : 'medium';
    const type = (obj?.type === 'weekly' || obj?.type === 'monthly' || obj?.type === 'yearly') ? obj.type : goal.type;
    const target_date = obj?.target_date ? new Date(obj.target_date).toISOString() : (goal.targetDate ? new Date(goal.targetDate).toISOString() : new Date().toISOString());
    const tags = Array.isArray(obj?.tags) ? obj.tags.filter((x: any) => typeof x === 'string') : [];
    const checklist = Array.isArray(obj?.checklist) ? obj.checklist : [];
    const estimate_hours = typeof obj?.estimate_hours === 'number' ? obj.estimate_hours : null;
    const milestones = Array.isArray(obj?.milestones) ? obj.milestones.map((m: any) => ({
      id: typeof m?.id === 'string' && m.id ? m.id : String(Date.now() + Math.random()),
      title: typeof m?.title === 'string' ? m.title : '',
      completed: !!m?.completed,
      status: (m?.status === 'todo' || m?.status === 'doing' || m?.status === 'done') ? m.status : 'todo',
      notes: typeof m?.notes === 'string' ? m.notes : '',
      dueDate: m?.dueDate ? m.dueDate : null
    })) : [];
    const progress = typeof obj?.progress === 'number'
      ? obj.progress
      : (milestones.length ? Math.round((milestones.filter((m: any) => m.completed).length / milestones.length) * 100) : 0);

    return { title, description, status, priority, type, target_date, milestones, progress, checklist, tags, estimate_hours } as any;
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { return; }
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error('Not signed in');

      const records = Array.isArray(json) ? json.map(normalizeImportedProject) : [normalizeImportedProject(json)];
      const payload = records.map(r => ({
        user_id: userId,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority,
        type: r.type,
        target_date: r.target_date,
        milestones: r.milestones,
        progress: r.progress,
        checklist: r.checklist,
        tags: r.tags,
        estimate_hours: r.estimate_hours,
        // updated_at/created_at handled by DB defaults if present
      }));
      const { error } = await supabase.from('planner_items').insert(payload);
      if (error) throw error;
      toast.success(t('toasts.planner.imported', { defaultValue: 'Project imported' }) as string);
    } catch (err: any) {
      console.warn('Import failed:', err);
      const msg = err?.message || err?.error_description || String(err);
      toast.error(`${t('toasts.planner.importFailed', { defaultValue: 'Failed to import project' })}: ${msg}` as string);
    } finally {
      // Always clear so selecting the same file again triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerImport = () => {
    const el = fileInputRef.current;
    if (!el) return;
    // Prefer showPicker when available (better on iOS Safari)
    // @ts-ignore
    if (typeof el.showPicker === 'function') {
      // @ts-ignore
      el.showPicker();
    } else {
      el.click();
    }
  };

  const completed = rows.filter(r => r.completed).length;
  const pct = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-1/60 backdrop-blur rounded-t-2xl">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold truncate">{goal.title}</h3>
          {goal.description && <p className="text-sm text-muted-foreground clamp-2 ">{goal.description}</p>}
        </div>
  <div className="flex items-center gap-2">
          <ScaleButton className="h-9 px-4 rounded-lg bg-[#00d563] text-black hover:bg-[#00d563]/90" onClick={addRow}>
            {t('planner.editor.addItem', { defaultValue: 'Add Item' })}
          </ScaleButton>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="min-w-[860px] p-4">
          <div className="grid grid-cols-[36px_1fr_1fr_1fr_1fr_40px] items-center gap-2 px-3 py-2 text-xs text-muted-foreground sticky top-0 bg-surface-1/70 backdrop-blur rounded-xl border border-border">
            <span></span>
            <span className="uppercase tracking-wide">{t('planner.table.task', { defaultValue: 'Task' })}</span>
            <span className="uppercase tracking-wide">{t('planner.table.status', { defaultValue: 'Status' })}</span>
            <span className="uppercase tracking-wide">{t('planner.table.due', { defaultValue: 'Due date' })}</span>
            <span className="uppercase tracking-wide">{t('planner.table.notes', { defaultValue: 'Notes' })}</span>
            <span></span>
          </div>

          <div className="mt-2 space-y-2">
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-[36px_1fr_1fr_1fr_1fr_40px] items-center gap-2 px-3 py-2 rounded-xl bg-surface-1/60 hover:bg-surface-1 transition-colors border border-border"
                >
                  <div className="flex items-center justify-center">
                    <Checkbox checked={r.completed} onCheckedChange={(c) => updateRow(r.id, { completed: !!c })} />
                  </div>
                  <Input
                    value={r.title}
                    onChange={(e)=>updateRow(r.id, { title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addRow();
                    }}
                    placeholder={t('planner.table.taskPlaceholder', { defaultValue: 'Write a step' }) as string}
                    className="h-10 w-full rounded-lg bg-surface-2/60 border-input"
                  />
                  <Select value={r.status || 'todo'} onValueChange={(v)=>updateRow(r.id, { status: v as any })}>
                    <SelectTrigger className="h-10 w-full rounded-lg bg-surface-2/60 border-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">{t('planner.filters.status.todo')}</SelectItem>
                      <SelectItem value="doing">{t('planner.filters.status.doing')}</SelectItem>
                      <SelectItem value="done">{t('planner.filters.status.done')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={r.dueDate ? new Date(r.dueDate).toISOString().slice(0,10) : ''}
                    onChange={(e)=>updateRow(r.id, { dueDate: e.target.value ? new Date(e.target.value) : undefined })}
                    className="h-10 w-full rounded-lg bg-surface-2/60 border-input"
                  />
                  <Input
                    value={r.notes || ''}
                    onChange={(e)=>updateRow(r.id, { notes: e.target.value })}
                    placeholder={t('planner.table.notesPlaceholder', { defaultValue: 'Notes' }) as string}
                    className="h-10 w-full rounded-lg bg-surface-2/60 border-input"
                  />
                  <ScaleButton variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={()=>removeRow(r.id)}>×</ScaleButton>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {rows.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              {t('planner.table.empty', { defaultValue: 'Add steps to your project' })}
            </div>
          )}

          {/* Progress summary */}
          <div className="mt-6 p-4 rounded-xl border border-border bg-surface-1/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t('planner.detail.progress', { defaultValue: 'Progress' })}</span>
              <span className="text-sm font-medium">{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalDetailPanel({ goal, onEdit, onDelete, onToggleMilestone }: {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: () => void;
  onToggleMilestone?: (goalId: string, milestoneId: string) => void;
}) {
  const { t } = useTranslation('app');
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-2">{goal.title}</h1>
          <div className="flex items-center gap-2">
            <Badge className={`${getPriorityColor(goal.priority)}`}>
              {t(`planner.priority.${goal.priority}`)}
            </Badge>
            <Badge className={`${getStatusColor(goal.status)}`}>
              {t(`planner.status.${goal.status}`)}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <ScaleButton variant="outline" size="sm" onClick={() => onEdit(goal)}>
            {t('common.edit')}
          </ScaleButton>
          <ScaleButton variant="destructive" size="sm" onClick={onDelete}>
            {t('buttons.delete')}
          </ScaleButton>
        </div>
      </div>

      {goal.description && (
        <div className="mb-6">
          <h3 className="font-medium mb-2">{t('planner.detail.description')}</h3>
          <p className="text-muted-foreground">{goal.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h4 className="font-medium mb-1">{t('planner.detail.targetDate')}</h4>
          <p className="text-sm text-muted-foreground">
            {goal.targetDate?.toLocaleDateString() || t('planner.detail.notSet')}
          </p>
        </div>
        <div>
          <h4 className="font-medium mb-1">{t('planner.detail.progress')}</h4>
          <div className="flex items-center gap-2">
            <Progress value={goal.progress} className="flex-1" />
            <span className="text-sm text-muted-foreground">{goal.progress}%</span>
          </div>
        </div>
      </div>

      {goal.milestones && goal.milestones.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-2">{t('planner.editor.milestonesLabel')}</h3>
          <div className="space-y-2">
            {goal.milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <Checkbox checked={m.completed} onCheckedChange={() => onToggleMilestone?.(goal.id, m.id)} />
                <span className={m.completed ? 'line-through text-muted-foreground' : ''}>{m.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskDetailPanel({ task, onEdit, onDelete, onToggleChecklist }: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: () => void;
  onToggleChecklist?: (taskId: string, checklistItemId: string) => void;
}) {
  const { t } = useTranslation('app');
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-2">{task.title}</h1>
          <div className="flex items-center gap-2">
            <Badge className={`${getPriorityColor(task.priority)}`}>
              {t(`planner.priority.${task.priority}`)} {t('planner.detail.prioritySuffix')}
            </Badge>
            <Badge className={`${getStatusColor(task.status)}`}>
              {t(`planner.status.${task.status}`)}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <ScaleButton variant="outline" size="sm" onClick={() => onEdit(task)}>
            {t('common.edit')}
          </ScaleButton>
          <ScaleButton variant="destructive" size="sm" onClick={onDelete}>
            {t('buttons.delete')}
          </ScaleButton>
        </div>
      </div>

      {task.checklist.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-2">{t('planner.detail.checklist')}</h3>
          <div className="space-y-2">
            {task.checklist.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => onToggleChecklist?.(task.id, item.id)}
                />
                <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {task.description && (
        <div className="mb-6">
          <h3 className="font-medium mb-2">{t('planner.detail.description')}</h3>
          <p className="text-muted-foreground">{task.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h4 className="font-medium mb-1">{t('planner.detail.startDate')}</h4>
          <p className="text-sm text-muted-foreground">
            {task.startDate?.toLocaleDateString() || t('planner.detail.notSet')}
          </p>
        </div>
        <div>
          <h4 className="font-medium mb-1">{t('planner.detail.dueDate')}</h4>
          <p className="text-sm text-muted-foreground">
            {task.dueDate?.toLocaleDateString() || t('planner.detail.notSet')}
          </p>
        </div>
        <div>
          <h4 className="font-medium mb-1">{t('planner.detail.estimate')}</h4>
          <p className="text-sm text-muted-foreground">
            {task.estimateHours ? `${task.estimateHours} ${t('planner.detail.hours')}` : t('planner.detail.notSet')}
          </p>
        </div>
        <div>
          <h4 className="font-medium mb-1">{t('planner.detail.progress')}</h4>
          <div className="flex items-center gap-2">
            <Progress value={task.progress} className="flex-1" />
            <span className="text-sm text-muted-foreground">{task.progress}%</span>
          </div>
        </div>
      </div>

      {task.tags.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-2">{t('planner.detail.tags')}</h3>
          <div className="flex flex-wrap gap-2">
            {task.tags.map(tag => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      
    </div>
  );
}

function TaskEditor({ task, onSave, onCancel, onDelete, isLoading }: {
  task: Partial<Task>;
  onSave: (task: Partial<Task>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState(task);
  const { t } = useTranslation('app');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;
    
    // Calculate progress from checklist
    const progress = formData.checklist && formData.checklist.length > 0 
      ? Math.round((formData.checklist.filter(item => item.completed).length / formData.checklist.length) * 100)
      : formData.progress || 0;

    onSave({ ...formData, progress });
  };

  const addChecklistItem = () => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: "",
      completed: false
    };
    setFormData(prev => ({
      ...prev,
      checklist: [...(prev.checklist || []), newItem]
    }));
  };

  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist?.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  };

  const removeChecklistItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist?.filter(item => item.id !== id)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
      {/* header with optional delete icon */}
      <div className="flex items-center justify-between -mt-1">
        <div className="text-sm font-medium text-muted-foreground">
          {formData?.id ? t('planner.editor.task.editTitle', { defaultValue: 'Edit Task' }) : t('planner.editor.task.newTitle', { defaultValue: 'New Task' })}
        </div>
        {task?.id && onDelete && (
          <ScaleButton
            type="button"
            variant="ghost"
            className="p-2 rounded-full text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label={t('buttons.delete')}
            title={t('buttons.delete') as string}
          >
            <Trash2 className="w-5 h-5" />
          </ScaleButton>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-sm font-medium">{t('planner.editor.task.titleLabel')}</Label>
        <Input
          id="title"
          className="h-11 w-full min-w-0"
          value={formData.title || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder={t('planner.editor.task.titlePlaceholder')}
          required
        />
      </div>

      {/* Checklist immediately after title */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">{t('planner.editor.checklistLabel')}</Label>
          <ScaleButton type="button" variant="outline" size="sm" onClick={addChecklistItem}>
            {t('planner.editor.addItem')}
          </ScaleButton>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {formData.checklist?.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <Checkbox
                checked={item.completed}
                onCheckedChange={(c) => updateChecklistItem(item.id, { completed: !!c })}
              />
              <Input
                value={item.text}
                onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                placeholder={t('planner.editor.checklistItemPlaceholder')}
                className="h-10 flex-1 min-w-0"
              />
              <ScaleButton type="button" variant="ghost" size="sm" onClick={() => removeChecklistItem(item.id)}>
                ×
              </ScaleButton>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-sm font-medium">{t('planner.editor.descriptionLabel')}</Label>
        <Textarea
          id="description"
          className="min-h-[96px] w-full"
          value={formData.description || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder={t('planner.editor.descriptionPlaceholder')}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
      <Label className="text-sm font-medium">{t('planner.editor.priorityLabel')}</Label>
          <Select
            value={formData.priority || "medium"}
            onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v as Task["priority"] }))}
          >
            <SelectTrigger className="h-11 w-full min-w-0">
        <SelectValue placeholder={t('planner.editor.priorityPlaceholder')} className="truncate" />
            </SelectTrigger>
            <SelectContent>
        <SelectItem value="low">{t('planner.priority.low')}</SelectItem>
        <SelectItem value="medium">{t('planner.priority.medium')}</SelectItem>
        <SelectItem value="high">{t('planner.priority.high')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
      <Label className="text-sm font-medium">{t('planner.editor.statusLabel')}</Label>
          <Select
            value={formData.status || "todo"}
            onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as Task["status"] }))}
          >
            <SelectTrigger className="h-11 w-full min-w-0">
        <SelectValue placeholder={t('planner.editor.statusPlaceholder')} className="truncate" />
            </SelectTrigger>
            <SelectContent>
        <SelectItem value="todo">{t('planner.status.todo')}</SelectItem>
        <SelectItem value="doing">{t('planner.status.doing')}</SelectItem>
        <SelectItem value="done">{t('planner.status.done')}</SelectItem>
        <SelectItem value="skipped">{t('planner.status.skipped')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate" className="text-sm font-medium">{t('planner.editor.startDate')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-11"
                id="startDate"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.startDate ? formData.startDate.toLocaleDateString() : t('planner.editor.pickDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-auto z-[120]" onOpenAutoFocus={(e)=>e.preventDefault()}>
              <DateStepper
                value={formData.startDate}
                onChange={(d) => setFormData(prev => ({ ...prev, startDate: d }))}
                onDone={() => {
                  // close popover by shifting focus
                  (document.activeElement as HTMLElement | null)?.blur?.();
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dueDate" className="text-sm font-medium">{t('planner.editor.dueDate')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-11"
                id="dueDate"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.dueDate ? formData.dueDate.toLocaleDateString() : t('planner.editor.pickDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-auto z-[120]" onOpenAutoFocus={(e)=>e.preventDefault()}>
              <DateStepper
                value={formData.dueDate}
                onChange={(d) => setFormData(prev => ({ ...prev, dueDate: d }))}
                onDone={() => {
                  (document.activeElement as HTMLElement | null)?.blur?.();
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="estimateHours" className="text-sm font-medium">{t('planner.editor.estimateLabel')}</Label>
        <Input
          id="estimateHours"
          type="number"
          min="0"
          step="0.5"
          className="h-11 w-full min-w-0"
          value={formData.estimateHours || ""}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            estimateHours: e.target.value ? parseFloat(e.target.value) : undefined
          }))}
          placeholder={t('planner.editor.estimatePlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tags" className="text-sm font-medium">{t('planner.editor.tagsLabel')}</Label>
        <Input
          id="tags"
          className="h-11 w-full min-w-0"
          value={formData.tags?.join(", ") || ""}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
          }))}
          placeholder={t('planner.editor.tagsPlaceholder')}
        />
      </div>

      

      {/* footer */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 border-t bg-background/90 backdrop-blur px-4 py-3">
        {/* actions */}
        <div className="mx-auto w-full max-w-[420px] grid grid-cols-2 gap-3">
          <ScaleButton
            type="button"
            variant="outline"
            className="w-full"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </ScaleButton>

          <ScaleButton
            type="submit"
            className="w-full"
            disabled={!formData.title?.trim() || isLoading}
          >
            {isLoading ? t('planner.editor.saving') : t('planner.editor.task.save')}
          </ScaleButton>
        </div>
      </div>
    </form>
  );
}

function GoalEditor({ goal, onSave, onCancel, onDelete, isLoading }: {
  goal: Partial<Goal>;
  onSave: (goal: Partial<Goal>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState(goal);
  const { t } = useTranslation('app');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;
  // Compute progress from checklist and milestones for parity with Task editor
  const checklist = formData.checklist || [];
  const milestones = formData.milestones || [];
  const total = checklist.length + milestones.length;
  const completed = checklist.filter(i => i.completed).length + milestones.filter(m => m.completed).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : (formData.progress || 0);

  onSave({ ...formData, progress });
  };

  const addMilestone = () => {
    const newMilestone: Milestone = {
      id: Date.now().toString(),
      title: "",
      completed: false
    };
    setFormData(prev => ({
      ...prev,
      milestones: [...(prev.milestones || []), newMilestone]
    }));
  };

  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones?.map(milestone => 
        milestone.id === id ? { ...milestone, ...updates } : milestone
      )
    }));
  };

  const removeMilestone = (id: string) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones?.filter(milestone => milestone.id !== id)
    }));
  };

  // Checklist parity with Task editor
  const addChecklistItem = () => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: "",
      completed: false,
    };
    setFormData(prev => ({
      ...prev,
      checklist: [...(prev.checklist || []), newItem],
    }));
  };

  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist?.map(item => (item.id === id ? { ...item, ...updates } : item)),
    }));
  };

  const removeChecklistItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist?.filter(item => item.id !== id),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
      {/* header with optional delete icon for parity */}
      <div className="flex items-center justify-between -mt-1">
        <div className="text-sm font-medium text-muted-foreground">
          {formData?.id ? t('planner.editor.goal.editTitle', { defaultValue: 'Edit Goal' }) : t('planner.editor.goal.newTitle', { defaultValue: 'New Goal' })}
        </div>
        {goal?.id && onDelete && (
          <ScaleButton
            type="button"
            variant="ghost"
            className="p-2 rounded-full text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label={t('buttons.delete')}
            title={t('buttons.delete') as string}
          >
            <Trash2 className="w-5 h-5" />
          </ScaleButton>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-sm font-medium">{t('planner.editor.goal.titleLabel')}</Label>
        <Input
          id="title"
          className="h-11 w-full min-w-0"
          value={formData.title || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder={t('planner.editor.goal.titlePlaceholder')}
          required
        />
      </div>

      {/* Checklist (same UX as Task editor) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">{t('planner.editor.checklistLabel')}</Label>
          <ScaleButton type="button" variant="outline" size="sm" onClick={addChecklistItem}>
            {t('planner.editor.addItem')}
          </ScaleButton>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {formData.checklist?.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <Checkbox
                checked={item.completed}
                onCheckedChange={(c) => updateChecklistItem(item.id, { completed: !!c })}
              />
              <Input
                value={item.text}
                onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                placeholder={t('planner.editor.checklistItemPlaceholder')}
                className="h-10 flex-1 min-w-0"
              />
              <ScaleButton type="button" variant="ghost" size="sm" onClick={() => removeChecklistItem(item.id)}>
                ×
              </ScaleButton>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-sm font-medium">{t('planner.editor.descriptionLabel')}</Label>
        <Textarea
          id="description"
          className="min-h-[96px] w-full"
          value={formData.description || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder={t('planner.editor.descriptionPlaceholder')}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
      <Label className="text-sm font-medium">{t('planner.editor.priorityLabel')}</Label>
          <Select 
            value={formData.priority || "medium"} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as Goal["priority"] }))}
          >
            <SelectTrigger className="h-11 w-full min-w-0">
        <SelectValue placeholder={t('planner.editor.priorityPlaceholder')} className="truncate" />
            </SelectTrigger>
            <SelectContent>
        <SelectItem value="low">{t('planner.priority.low')}</SelectItem>
        <SelectItem value="medium">{t('planner.priority.medium')}</SelectItem>
        <SelectItem value="high">{t('planner.priority.high')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
      <Label className="text-sm font-medium">{t('planner.editor.statusLabel')}</Label>
          <Select 
            value={formData.status || "planning"} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as Goal["status"] }))}
          >
            <SelectTrigger className="h-11 w-full min-w-0">
        <SelectValue placeholder={t('planner.editor.statusPlaceholder')} className="truncate" />
            </SelectTrigger>
            <SelectContent>
        <SelectItem value="planning">{t('planner.status.planning')}</SelectItem>
        <SelectItem value="in_progress">{t('planner.status.in_progress')}</SelectItem>
        <SelectItem value="completed">{t('planner.status.completed')}</SelectItem>
        <SelectItem value="paused">{t('planner.status.paused')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="targetDate" className="text-sm font-medium">{t('planner.editor.targetDate')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-11"
                id="targetDate"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.targetDate ? formData.targetDate.toLocaleDateString() : t('planner.editor.pickDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-auto z-[60]" onOpenAutoFocus={(e)=>e.preventDefault()}>
              <DateStepper
                value={formData.targetDate}
                onChange={(d) => setFormData(prev => ({ ...prev, targetDate: d }))}
                onDone={() => {
                  (document.activeElement as HTMLElement | null)?.blur?.();
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
      <Label className="text-sm font-medium">{t('common.type', { defaultValue: 'Type' })}</Label>
          <Select 
            value={formData.type || "weekly"} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as "weekly" | "monthly" | "yearly" }))}
          >
            <SelectTrigger className="h-11 w-full min-w-0">
        <SelectValue placeholder={t('common.selectType', { defaultValue: 'Select type' })} className="truncate" />
            </SelectTrigger>
            <SelectContent>
        <SelectItem value="weekly">{t('planner.views.weekly')}</SelectItem>
        <SelectItem value="monthly">{t('planner.views.monthly')}</SelectItem>
        <SelectItem value="yearly">{t('planner.views.yearly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Estimate hours (parity) */}
      <div className="space-y-1.5">
        <Label htmlFor="goal-estimateHours" className="text-sm font-medium">{t('planner.editor.estimateLabel')}</Label>
        <Input
          id="goal-estimateHours"
          type="number"
          min="0"
          step="0.5"
          className="h-11 w-full min-w-0"
          value={formData.estimateHours || ""}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            estimateHours: e.target.value ? parseFloat(e.target.value) : undefined,
          }))}
          placeholder={t('planner.editor.estimatePlaceholder')}
        />
      </div>

      {/* Tags (parity) */}
      <div className="space-y-1.5">
        <Label htmlFor="goal-tags" className="text-sm font-medium">{t('planner.editor.tagsLabel')}</Label>
        <Input
          id="goal-tags"
          className="h-11 w-full min-w-0"
          value={(formData.tags || []).join(", ")}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean),
          }))}
          placeholder={t('planner.editor.tagsPlaceholder')}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">{t('planner.editor.milestonesLabel')}</Label>
          <ScaleButton type="button" variant="outline" size="sm" onClick={addMilestone}>
            {t('planner.editor.addMilestone')}
          </ScaleButton>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {formData.milestones?.map((milestone) => (
            <div key={milestone.id} className="flex items-center gap-2">
              <Checkbox
                checked={milestone.completed}
                onCheckedChange={(checked) => updateMilestone(milestone.id, { completed: !!checked })}
              />
              <Input
                value={milestone.title}
                onChange={(e) => updateMilestone(milestone.id, { title: e.target.value })}
                placeholder={t('planner.editor.milestoneTitlePlaceholder')}
                className="h-10 flex-1 min-w-0"
              />
              <ScaleButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeMilestone(milestone.id)}
              >
                ×
              </ScaleButton>
            </div>
          ))}
        </div>
      </div>

      {/* footer (match Task editor) */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 border-t bg-background/90 backdrop-blur px-4 py-3">
        <div className="mx-auto w-full max-w-[420px] grid grid-cols-2 gap-3">
          <ScaleButton
            type="button"
            variant="outline"
            className="w-full"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </ScaleButton>

          <ScaleButton
            type="submit"
            className="w-full"
            disabled={!formData.title?.trim() || isLoading}
          >
            {isLoading ? t('planner.editor.saving') : t('planner.editor.goal.save')}
          </ScaleButton>
        </div>
      </div>
    </form>
  );
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "low": return "bg-green-500/20 text-green-400 border-green-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "done": return "bg-success/20 text-success border-success/30";
    case "doing": return "bg-primary/20 text-primary border-primary/30";
    case "skipped": return "bg-muted text-muted-foreground border-muted";
    default: return "bg-surface-1 text-foreground border-border";
  }
}