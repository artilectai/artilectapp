"use client";

import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScaleButton } from "@/components/iOSAnimations";
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Timer, 
  Dumbbell, 
  LayoutTemplate, 
  Logs, 
  Plus, 
  Play, 
  BarChart3, 
  Crown,
  Edit,
  Trash2,
  Settings,
  Save,
  X
} from 'lucide-react';
import { WorkoutAnalytics } from './WorkoutAnalytics';
import { WorkoutSportOnboardingWizard } from '@/components/WorkoutSportOnboardingWizard';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/supabase/useSession';
import { createProgram } from '@/app/actions/workout/programs';
import { logSession } from '@/app/actions/workout/sessions';

type SportType = 'strength' | 'cardio' | 'sports' | 'flexibility';

interface Exercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  restTime?: number;
  notes?: string;
}

interface Program {
  id: string;
  name: string;
  sportType: SportType;
  exercises: Exercise[];
  frequency: number;
}

interface WorkoutSectionProps {
  subscriptionPlan?: 'free' | 'lite' | 'pro';
  onUpgrade?: () => void;
  onAddWorkout?: () => void;
  telegramUser?: any;
  userData?: any;
}

interface WorkoutSectionRef {
  handleNewWorkout: () => void;
}

const SPORT_CONFIGS = {
  strength: { nameKey: 'workout.types.strength', color: 'text-red-400', icon: Dumbbell },
  cardio: { nameKey: 'workout.types.cardio', color: 'text-blue-400', icon: Timer },
  sports: { nameKey: 'workout.types.sports', color: 'text-green-400', icon: Play },
  flexibility: { nameKey: 'workout.types.flexibility', color: 'text-purple-400', icon: LayoutTemplate }
};

const WorkoutSection = forwardRef<WorkoutSectionRef, WorkoutSectionProps>(({
  subscriptionPlan = 'free',
  onUpgrade,
  onAddWorkout
}, ref) => {
  const { t } = useTranslation('app');
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'overview' | 'programs' | 'session' | 'history' | 'trackers'>('overview');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [showWorkoutOnboarding, setShowWorkoutOnboarding] = useState(false);
  const [currentSession, setCurrentSession] = useState<null | { programId: string; startedAt: string; completed: Record<string, boolean> }>(null);
  const [history, setHistory] = useState<Array<{ programId: string; startedAt: string; endedAt: string; durationMin: number }>>([]);
  type TrackerType = 'weight' | 'sleep' | 'water' | 'steps' | 'hr';
  type TrackerEntry = { date: string; value: number };
  const [trackers, setTrackers] = useState<Record<TrackerType, TrackerEntry[]>>({
    weight: [], sleep: [], water: [], steps: [], hr: []
  });
  const [trackerInputs, setTrackerInputs] = useState<Record<TrackerType, string>>({
    weight: '', sleep: '', water: '', steps: '', hr: ''
  });

  // Phone-first Today trackers (simple quick actions)
  type TodayField = 'steps' | 'water' | 'weightKg' | 'activeMinutes';
  type TodayTracker = { date: string; steps: number; water: number; weightKg: number; activeMinutes: number };
  const dateKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const [todayTracker, setTodayTracker] = useState<TodayTracker>({ date: dateKey(), steps: 0, water: 0, weightKg: 0, activeMinutes: 0 });
  const [todayInputs, setTodayInputs] = useState<{ steps: string; water: string; weightKg: string; activeMinutes: string }>({
    steps: '0', water: '0', weightKg: '0', activeMinutes: '0'
  });

  // Subscription limits per plan
  const limits = useMemo(() => {
    switch (subscriptionPlan) {
      case 'free':
        return {
          maxPrograms: 1,
          trackersAllowed: false,
          analyticsAllowed: false,
        } as const;
      case 'lite':
        return {
          maxPrograms: Infinity,
          trackersAllowed: true,
          analyticsAllowed: false, // analytics are Pro-only
        } as const;
      case 'pro':
      default:
        return {
          maxPrograms: Infinity,
          trackersAllowed: true,
          analyticsAllowed: true,
        } as const;
    }
  }, [subscriptionPlan]);
  
  // Dialog states
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [showProgramDetails, setShowProgramDetails] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showEditExercise, setShowEditExercise] = useState(false);
  
  // Selected/editing states
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  
  // Form states
  const [newProgram, setNewProgram] = useState({
    name: '',
    sportType: 'strength' as SportType,
    frequency: 3
  });
  const [frequencyInput, setFrequencyInput] = useState<string>('3');
  
  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    sets: 3,
    reps: 10,
    weight: 0,
    duration: 0,
    restTime: 60,
    notes: ''
  });
  // String inputs for free typing in numeric fields
  const [setsInput, setSetsInput] = useState<string>('3');
  const [repsInput, setRepsInput] = useState<string>('10');
  const [weightInput, setWeightInput] = useState<string>('0');
  const [durationInput, setDurationInput] = useState<string>('0');
  const [restTimeInput, setRestTimeInput] = useState<string>('60');

  const resetExerciseForm = () => {
    setExerciseForm({
      name: '',
      sets: 3,
      reps: 10,
      weight: 0,
      duration: 0,
      restTime: 60,
      notes: ''
    });
    setSetsInput('3');
    setRepsInput('10');
    setWeightInput('0');
    setDurationInput('0');
    setRestTimeInput('60');
  };

  // Sync input strings when exercise form changes programmatically (e.g., editing, reset)
  useEffect(() => {
    setSetsInput(String(exerciseForm.sets ?? 0));
    setRepsInput(String(exerciseForm.reps ?? 0));
    setWeightInput(String(exerciseForm.weight ?? 0));
    setDurationInput(String(exerciseForm.duration ?? 0));
    setRestTimeInput(String(exerciseForm.restTime ?? 0));
  }, [exerciseForm.sets, exerciseForm.reps, exerciseForm.weight, exerciseForm.duration, exerciseForm.restTime]);

  // Keep the frequency input string in sync with the numeric state
  useEffect(() => {
    setFrequencyInput(String(newProgram.frequency ?? 1));
  }, [newProgram.frequency]);

  // Load from Supabase + local persisted trackers/today
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        // Merge DB programs with locally stored exercises per program
        let exMap: Record<string, Exercise[]> = {};
        try {
          const exRaw = localStorage.getItem('workout_program_exercises');
          exMap = exRaw ? JSON.parse(exRaw) : {};
        } catch {}
  const { data: pData } = await supabase
          .from('workout_programs')
          .select('*')
          .order('created_at', { ascending: false });
  const mapped = (pData || []).map((p: any) => ({
          id: p.id as string,
          name: p.name as string,
          sportType: (p.sport_type as SportType) ?? 'strength',
          exercises: exMap[p.id] || [],
          frequency: (p.frequency as number) ?? 0,
        })) as Program[];
        setPrograms(mapped);
      } catch {}

      try {
        const { data: sData } = await supabase
          .from('workout_sessions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(100);
        const mappedH = (sData || []).map((s: any) => ({
          programId: (s.program_id as string) || '',
          startedAt: s.started_at as string,
          endedAt: (s.ended_at as string) || s.created_at || s.started_at,
          durationMin: (s.duration_min as number) || 0,
        }));
        setHistory(mappedH);
      } catch {}

      // Load today's quick trackers
      try {
        const savedToday = localStorage.getItem('today_tracker');
        if (savedToday) {
          const parsedRaw = JSON.parse(savedToday) as any;
          if (parsedRaw && parsedRaw.date === dateKey()) {
            const migrated: TodayTracker = {
              date: parsedRaw.date,
              steps: Number(parsedRaw.steps) || 0,
              water: Number(parsedRaw.water) || 0,
              weightKg: Number(parsedRaw.weightKg ?? parsedRaw.protein) || 0,
              activeMinutes: Number(parsedRaw.activeMinutes) || 0,
            };
            setTodayTracker(migrated);
          }
        }
      } catch {}

      try {
        const savedTrackers = localStorage.getItem('health_trackers');
        if (savedTrackers) {
          const parsedT = JSON.parse(savedTrackers) as Record<TrackerType, TrackerEntry[]>;
          if (parsedT && typeof parsedT === 'object') setTrackers(prev => ({ ...prev, ...parsedT }));
        }
      } catch {}

      // Prefer account-scoped server flag; fallback to localStorage
      let setupComplete = false;
      try {
        const userId = (session as any)?.user?.id as string | undefined;
        if (userId) {
          const { data: up } = await supabase
            .from('user_profiles')
            .select('workout_setup_completed')
            .eq('user_id', userId)
            .maybeSingle();
          setupComplete = Boolean(up?.workout_setup_completed);
        } else {
          setupComplete = localStorage.getItem('workout_setup_complete') === 'true';
        }
      } catch {
        setupComplete = localStorage.getItem('workout_setup_complete') === 'true';
      }
      try {
        // If user hasn't completed setup and has no programs, show onboarding
        if (!setupComplete) {
          const { count } = await supabase
            .from('workout_programs')
            .select('*', { count: 'exact', head: true });
          if ((count ?? 0) === 0) setShowWorkoutOnboarding(true);
        }
      } catch {
        // Fallback to local state length
        if (!setupComplete && programs.length === 0) setShowWorkoutOnboarding(true);
      }
    })();
  }, [session?.user?.id]);

  // Realtime subscriptions for programs and sessions
  useEffect(() => {
    const ch = supabase
      .channel('workout-programs-rt-main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_programs' }, async () => {
        try {
          const exRaw = localStorage.getItem('workout_program_exercises');
          const exMap = exRaw ? JSON.parse(exRaw) : {};
          const { data: pData } = await supabase.from('workout_programs').select('*').order('created_at', { ascending: false });
          const mapped = (pData || []).map((p: any) => ({
            id: p.id as string,
            name: p.name as string,
            sportType: (p.sport_type as SportType) ?? 'strength',
            exercises: exMap[p.id] || [],
            frequency: (p.frequency as number) ?? 0,
          })) as Program[];
          setPrograms(mapped);
        } catch {}
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('workout-sessions-rt-main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions' }, async () => {
        try {
          const { data: sData } = await supabase
            .from('workout_sessions')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(100);
          const mappedH = (sData || []).map((s: any) => ({
            programId: (s.program_id as string) || '',
            startedAt: s.started_at as string,
            endedAt: (s.ended_at as string) || s.created_at || s.started_at,
            durationMin: (s.duration_min as number) || 0,
          }));
          setHistory(mappedH);
        } catch {}
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Persist exercises only; history is from DB
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const exMap = programs.reduce((acc: Record<string, Exercise[]>, p) => {
        acc[p.id] = p.exercises || [];
        return acc;
      }, {});
      localStorage.setItem('workout_program_exercises', JSON.stringify(exMap));
      window.dispatchEvent(new Event('workout:data-updated'));
    } catch {}
  }, [programs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // history now syncs from DB; still emit event for analytics
      window.dispatchEvent(new Event('workout:data-updated'));
    } catch {}
  }, [history]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('health_trackers', JSON.stringify(trackers));
  window.dispatchEvent(new Event('workout:data-updated'));
    } catch {}
  }, [trackers]);

  // Persist today's quick trackers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (todayTracker.date !== dateKey()) {
        // reset if date changed
        setTodayTracker({ date: dateKey(), steps: 0, water: 0, weightKg: 0, activeMinutes: 0 });
        return;
      }
      localStorage.setItem('today_tracker', JSON.stringify(todayTracker));
  window.dispatchEvent(new Event('workout:data-updated'));
    } catch {}
  }, [todayTracker]);

  // Keep input strings in sync when tracker changes (e.g., +/- buttons)
  useEffect(() => {
    setTodayInputs({
      steps: String(todayTracker.steps ?? 0),
      water: String(todayTracker.water ?? 0),
      weightKg: String(todayTracker.weightKg ?? 0),
      activeMinutes: String(todayTracker.activeMinutes ?? 0),
    });
  }, [todayTracker.steps, todayTracker.water, todayTracker.weightKg, todayTracker.activeMinutes]);

  type WorkoutPreferences = {
    selectedSports: string[];
    experienceLevel: 'beginner' | 'intermediate' | 'advanced';
    weeklyFrequency: number;
    fitnessGoals: string[];
  };

  const handleWorkoutOnboardingComplete = useCallback((prefs: WorkoutPreferences) => {
    // Create a simple starter program from first selected sport
    const firstSport = prefs.selectedSports?.[0] || 'Gym Training';

    // Map sport name to our Program.sportType
    const SPORT_TO_TYPE: Record<string, SportType> = {
      // strength
      'Gym Training': 'strength',
      'Weightlifting': 'strength',
      'Bodybuilding': 'strength',
      'Powerlifting': 'strength',
      // cardio
      'Running': 'cardio',
      'Cycling': 'cardio',
      'Swimming': 'cardio',
      'HIIT': 'cardio',
      // sports
      'Basketball': 'sports',
      'Soccer': 'sports',
      'Tennis': 'sports',
      'Volleyball': 'sports',
      // flexibility
      'Yoga': 'flexibility',
      'Pilates': 'flexibility',
      'Stretching': 'flexibility',
      'Mobility': 'flexibility',
    };

    const programName = `${firstSport} Program`;
    const sportType = SPORT_TO_TYPE[firstSport] ?? 'strength';
    const freq = Math.max(1, Math.floor(prefs.weeklyFrequency || 3));
    (async () => {
      try {
        await createProgram(programName, sportType, freq);
        setShowWorkoutOnboarding(false);
        toast.success(t('toasts.workout.setupCompleted'), {
          description: t('toasts.workout.starterCreated', { name: programName })
        });
      } catch (e: any) {
        toast.error(e?.message || 'Failed to create starter');
      }
    })();
  }, []);

  const handleCreateProgram = useCallback(async () => {
    // Enforce plan limit before creating
    if (programs.length >= limits.maxPrograms) {
      toast.error(t('toasts.workout.programLimit'));
      onUpgrade?.();
      return;
    }
    if (!newProgram.name.trim()) {
      toast.error(t('toasts.workout.programNameRequired'));
      return;
    }

    const parsed = Math.floor(Number(frequencyInput));
    const validatedFrequency = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;

    try {
      await createProgram(newProgram.name, newProgram.sportType, validatedFrequency);
      // Fetch updated list
      try {
        const exRaw = localStorage.getItem('workout_program_exercises');
        const exMap = exRaw ? JSON.parse(exRaw) : {};
        const { data: pData } = await supabase.from('workout_programs').select('*').order('created_at', { ascending: false });
        const mapped = (pData || []).map((p: any) => ({ id: p.id as string, name: p.name as string, sportType: (p.sport_type as SportType) ?? 'strength', exercises: exMap[p.id] || [], frequency: (p.frequency as number) ?? 0 })) as Program[];
        setPrograms(mapped);
      } catch {}
      setNewProgram({ name: '', sportType: 'strength', frequency: 3 });
      setShowNewProgram(false);
      toast.success(t('toasts.workout.programCreated'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create program');
    }
  }, [newProgram, frequencyInput, limits.maxPrograms, programs.length, t, onUpgrade]);

  const handleDeleteProgram = useCallback(async (programId: string) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    if (window.confirm(t('dialogs.workout.confirmDeleteProgram', { name: program.name }))) {
      try {
        const { error } = await supabase.from('workout_programs').delete().eq('id', programId);
        if (error) throw error;
        // cleanup exercises for that program in local store
        try {
          const raw = localStorage.getItem('workout_program_exercises');
          const exMap = raw ? JSON.parse(raw) : {};
          if (exMap && exMap[programId]) {
            delete exMap[programId];
            localStorage.setItem('workout_program_exercises', JSON.stringify(exMap));
          }
        } catch {}
        toast.success(t('toasts.workout.programDeleted'));
      } catch (e: any) {
        toast.error(e?.message || 'Failed to delete program');
      }
    }
  }, [programs]);

  const startWorkoutForProgram = useCallback((programId: string) => {
    const program = programs.find(p => p.id === programId);
    if (!program) {
      toast.error(t('toasts.workout.programNotFound'));
      return;
    }
    setCurrentSession({ programId, startedAt: new Date().toISOString(), completed: {} });
    setActiveTab('session');
    toast.success(t('toasts.workout.started', { name: program.name }));
  }, [programs]);

  const stopCurrentWorkout = useCallback(async () => {
    if (!currentSession) return;
    const program = programs.find(p => p.id === currentSession.programId);
    const endedAt = new Date();
    const startedAtDate = new Date(currentSession.startedAt);
    const durationMin = Math.max(1, Math.round((endedAt.getTime() - startedAtDate.getTime()) / 60000));
    try {
      await logSession({ program_id: currentSession.programId, started_at: currentSession.startedAt, ended_at: endedAt.toISOString(), duration_min: durationMin });
      setCurrentSession(null);
      toast.success(t('toasts.workout.completed', { suffix: program ? `: ${program.name}` : '' }));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save session');
    }
  }, [currentSession, programs]);

  const handleViewProgramDetails = useCallback((program: Program) => {
    setSelectedProgram(program);
    setShowProgramDetails(true);
  }, []);

  const toggleExerciseComplete = useCallback((exerciseId: string) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      const nextCompleted = { ...(prev.completed || {}) } as Record<string, boolean>;
      nextCompleted[exerciseId] = !nextCompleted[exerciseId];
      return { ...prev, completed: nextCompleted };
    });
  }, []);

  const handleAddExercise = useCallback(() => {
    if (!selectedProgram || !exerciseForm.name.trim()) {
      toast.error(t('toasts.workout.exerciseNameRequired'));
      return;
    }

    // Finalize numeric values from input strings
  const sets = Math.max(0, Math.floor(Number(setsInput)) || 0);
    const reps = Math.max(0, Math.floor(Number(repsInput)) || 0);
    const weight = Math.max(0, parseFloat((weightInput || '0').replace(',', '.')) || 0);
    const duration = Math.max(0, Math.floor(Number(durationInput)) || 0);
    const restTime = Math.max(0, Math.floor(Number(restTimeInput)) || 0);

    const exercise: Exercise = {
      id: Date.now().toString(),
      name: exerciseForm.name,
      sets: sets || undefined,
      reps: reps || undefined,
      weight: weight || undefined,
      duration: duration || undefined,
      restTime: restTime || undefined,
      notes: exerciseForm.notes || undefined
    };

    setPrograms(prev => prev.map(p => 
      p.id === selectedProgram.id 
        ? { ...p, exercises: [...p.exercises, exercise] }
        : p
    ));

    setSelectedProgram(prev => prev ? 
      { ...prev, exercises: [...prev.exercises, exercise] } 
      : null
    );

    resetExerciseForm();
    setShowAddExercise(false);
  toast.success(t('toasts.workout.exerciseAdded'));
  }, [selectedProgram, exerciseForm, setsInput, repsInput, weightInput, durationInput, restTimeInput]);

  const handleEditExercise = useCallback((exercise: Exercise) => {
    setEditingExercise(exercise);
    setExerciseForm({
      name: exercise.name,
      sets: exercise.sets || 3,
      reps: exercise.reps || 10,
      weight: exercise.weight || 0,
      duration: exercise.duration || 0,
      restTime: exercise.restTime || 60,
      notes: exercise.notes || ''
    });
    setShowEditExercise(true);
  }, []);

  const handleUpdateExercise = useCallback(() => {
    if (!editingExercise || !selectedProgram || !exerciseForm.name.trim()) {
      toast.error(t('toasts.workout.exerciseNameRequired'));
      return;
    }

    const sets = Math.max(0, Math.floor(Number(setsInput)) || 0);
    const reps = Math.max(0, Math.floor(Number(repsInput)) || 0);
    const weight = Math.max(0, parseFloat((weightInput || '0').replace(',', '.')) || 0);
    const duration = Math.max(0, Math.floor(Number(durationInput)) || 0);
    const restTime = Math.max(0, Math.floor(Number(restTimeInput)) || 0);

    const updatedExercise: Exercise = {
      ...editingExercise,
      name: exerciseForm.name,
      sets: sets || undefined,
      reps: reps || undefined,
      weight: weight || undefined,
      duration: duration || undefined,
      restTime: restTime || undefined,
      notes: exerciseForm.notes || undefined
    };

    setPrograms(prev => prev.map(p => 
      p.id === selectedProgram.id 
        ? { 
            ...p, 
            exercises: p.exercises.map(ex => 
              ex.id === editingExercise.id ? updatedExercise : ex
            )
          }
        : p
    ));

    setSelectedProgram(prev => prev ? {
      ...prev,
      exercises: prev.exercises.map(ex => 
        ex.id === editingExercise.id ? updatedExercise : ex
      )
    } : null);

    resetExerciseForm();
    setEditingExercise(null);
    setShowEditExercise(false);
  toast.success(t('toasts.workout.exerciseUpdated'));
  }, [editingExercise, selectedProgram, exerciseForm, setsInput, repsInput, weightInput, durationInput, restTimeInput]);

  const handleDeleteExercise = useCallback((exerciseId: string) => {
    if (!selectedProgram) return;

    const exercise = selectedProgram.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

  if (window.confirm(t('dialogs.workout.confirmDeleteExercise', { name: exercise.name }))) {
      setPrograms(prev => prev.map(p => 
        p.id === selectedProgram.id 
          ? { ...p, exercises: p.exercises.filter(ex => ex.id !== exerciseId) }
          : p
      ));

      setSelectedProgram(prev => prev ? {
        ...prev,
        exercises: prev.exercises.filter(ex => ex.id !== exerciseId)
      } : null);

  toast.success(t('toasts.workout.exerciseDeleted'));
    }
  }, [selectedProgram]);

  const handleAddWorkout = useCallback(() => {
    // Open Create Program modal, enforcing plan limit
    if (programs.length >= limits.maxPrograms) {
      toast.error(t('toasts.workout.programLimit'));
      onUpgrade?.();
      return;
    }
    if (activeTab === 'programs') {
      setShowNewProgram(true);
    } else {
      setActiveTab('programs');
      setTimeout(() => setShowNewProgram(true), 100);
    }
    onAddWorkout?.();
  }, [activeTab, onAddWorkout, programs.length, limits.maxPrograms, t, onUpgrade]);

  // Open New Program dialog with plan gating
  const openNewProgramDialog = useCallback(() => {
    if (programs.length >= limits.maxPrograms) {
      toast.error(t('toasts.workout.programLimit'));
      onUpgrade?.();
      return;
    }
    setShowNewProgram(true);
  }, [programs.length, limits.maxPrograms, t, onUpgrade]);

  useImperativeHandle(ref, () => ({
    handleNewWorkout: handleAddWorkout
  }), [handleAddWorkout]);

  const todayKey = (() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString();
  })();

  const addTrackerValue = useCallback((type: TrackerType) => {
    const raw = trackerInputs[type];
    const v = parseFloat((raw || '').replace(',', '.'));
    if (!Number.isFinite(v)) {
      toast.error(t('toasts.workout.invalidNumber'));
      return;
    }
    setTrackers(prev => {
      const list = prev[type] || [];
      // Replace today entry if exists
      const has = list.findIndex(e => new Date(e.date).toDateString() === new Date(todayKey).toDateString());
      let next: TrackerEntry[];
      if (has >= 0) {
        next = list.slice();
        next[has] = { date: todayKey, value: v };
      } else {
        next = [{ date: todayKey, value: v }, ...list];
      }
      return { ...prev, [type]: next };
    });
    setTrackerInputs(prev => ({ ...prev, [type]: '' }));
  toast.success(t('toasts.workout.saved'));
  }, [todayKey, trackerInputs]);

  return (
    <div className="min-h-full flex flex-col bg-background overflow-x-hidden">
      {showWorkoutOnboarding && (
        <WorkoutSportOnboardingWizard
          onComplete={handleWorkoutOnboardingComplete}
          onSkip={() => setShowWorkoutOnboarding(false)}
        />
      )}
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold">{t('workout.section.header')}</h1>
          <Badge variant="outline" className="text-xs">
            {subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value as typeof activeTab);
        }} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-5 mx-4 mt-4">
            <TabsTrigger value="overview" className="text-xs">
              <BarChart3 className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="programs" className="text-xs">
              <LayoutTemplate className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="session" className="text-xs">
              <Play className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <Logs className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="trackers" className="text-xs">
              <Timer className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
      <TabsContent value="overview" className="h-full mt-0">
              <ScrollArea className="h-full">
        {/* Reduce bottom padding to avoid large gap before the analytics section below */}
        <div className="p-4 space-y-4 pb-4">
                  {programs.length === 0 ? (
                    <Card className="glass-card p-8 text-center">
                      <Dumbbell className="w-12 h-12 mx-auto mb-4 text-money-green" />
                      <h3 className="font-semibold mb-2">{t('workout.section.header')}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('workout.section.overview.stats', { programs: programs.length, exercises: programs.reduce((total, p) => total + p.exercises.length, 0) })}
                      </p>
                      <Button
                        onClick={handleAddWorkout}
                        className="bg-money-gradient"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('workout.section.cta.createProgram')}
                      </Button>
                    </Card>
                  ) : (
                    <Card className="glass-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{t('workout.section.programs.title')}</h3>
                        <Badge variant="outline">{t('workout.section.programs.totalSuffix', { count: programs.length })}</Badge>
                      </div>

                      <div className="space-y-2">
                        {programs.map((program) => {
                          const config = SPORT_CONFIGS[program.sportType];
                          const Icon = config.icon;
                          return (
                            <div key={program.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Icon className={`w-5 h-5 ${config.color}`} />
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{program.name}</div>
                                  <div className="text-xs text-muted-foreground">{t('workout.section.programs.meta', { freq: program.frequency, count: program.exercises.length })}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" className="bg-money-gradient" onClick={() => startWorkoutForProgram(program.id)}>{t('workout.section.cta.start')}</Button>
                                <Button size="sm" variant="outline" onClick={() => handleViewProgramDetails(program)}>
                                  <Settings className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3">
                        <Button onClick={openNewProgramDialog} variant="outline" className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          {t('workout.section.cta.addProgram')}
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* This Week summary: goal progress and quick stats */}
                  {(() => {
                    const now = new Date();
                    const startOfWeek = new Date(now);
                    const day = now.getDay(); // 0=Sun
                    const diffToMonday = (day + 6) % 7; // Mon-start week
                    startOfWeek.setDate(now.getDate() - diffToMonday);
                    startOfWeek.setHours(0, 0, 0, 0);

                    const sessionsThisWeek = history.filter(h => new Date(h.startedAt) >= startOfWeek);
                    const completed = sessionsThisWeek.length;
                    const goal = programs.reduce((sum, p) => sum + (p.frequency || 0), 0);
                    const progress = goal > 0 ? Math.min(100, Math.round((completed / goal) * 100)) : 0;
                    const activeMin = sessionsThisWeek.reduce((sum, h) => sum + (h.durationMin || 0), 0);
                    const hours = Math.floor(activeMin / 60);
                    const mins = activeMin % 60;
                    const activeLabel = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
                    const calories = Math.round(activeMin * 3); // simple estimate

                    return (
                      <Card className="glass-card p-4">
                        <h3 className="font-semibold mb-3">{t('workout.section.week.title')}</h3>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <div>{t('workout.section.week.workouts')}</div>
                          <div className="font-medium">{completed}/{goal}</div>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <div>{t('workout.section.week.caloriesEst', { cal: calories })}</div>
                          <div>{t('workout.section.week.activeLabel', { label: activeLabel })}</div>
                        </div>
                      </Card>
                    );
                  })()}

                  {/* Recent Workouts list */}
                  <Card className="glass-card p-4">
                    <h3 className="font-semibold mb-3">{t('workout.section.recent.title')}</h3>
                    {history.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('workout.section.recent.empty')}</p>
                    ) : (
                      <div className="space-y-2">
                        {[...history]
                          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                          .slice(0, 5)
                          .map((h, idx) => {
                            const p = programs.find(x => x.id === h.programId);
                            return (
                              <div key={idx} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 text-sm">
                                <div>
                                  <div className="font-medium">{p?.name || t('workout.common.workout')}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(h.startedAt).toLocaleString()} • {h.durationMin} {t('workout.analytics.units.min')}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </Card>

                  {/* Subscription Limits */}
                  <Card className="glass-card p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words">
                          {t('workout.section.limits.programs.label', {
                            current: programs.length,
                            max: limits.maxPrograms === Infinity ? '∞' : limits.maxPrograms,
                            defaultValue: 'Programs ({{current}}/{{max}})'
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {subscriptionPlan === 'free' && t('workout.section.limits.programs.freeHint', { defaultValue: 'Upgrade to Lite for 5 programs' })}
                          {subscriptionPlan === 'lite' && t('workout.section.limits.programs.liteHint', { defaultValue: 'Upgrade to Pro for unlimited' })}
                          {subscriptionPlan === 'pro' && t('workout.section.limits.programs.proHint', { defaultValue: 'Unlimited programs available' })}
                        </p>
                      </div>
                      {subscriptionPlan !== 'pro' && (
                        <Button size="sm" variant="outline" onClick={onUpgrade} className="self-start sm:self-auto">
                          <Crown className="w-4 h-4 mr-1" />
                          {t('workout.section.limits.programs.upgrade', { defaultValue: 'Upgrade' })}
                        </Button>
                      )}
                    </div>
                    {limits.maxPrograms !== Infinity && (
                      <Progress 
                        value={(programs.length / (typeof limits.maxPrograms === 'number' ? limits.maxPrograms : 1)) * 100} 
                        className="h-2 mt-2" 
                      />
                    )}
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="programs" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
                  {programs.length === 0 ? (
                    <Card className="glass-card p-8 text-center">
                      <LayoutTemplate className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">{t('workout.section.programs.emptyTitle')}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('workout.section.programs.emptySubtitle')}
                      </p>
                      <Button
                        onClick={() => setShowNewProgram(true)}
                        className="bg-money-gradient"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('workout.section.cta.createProgram')}
                      </Button>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {programs.map((program) => {
                        const config = SPORT_CONFIGS[program.sportType];
                        const Icon = config.icon;
                        return (
                          <Card key={program.id} className="glass-card p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Icon className={`w-5 h-5 ${config.color}`} />
                                <div className="flex-1">
                                  <h4 className="font-medium">{program.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {t('workout.section.programs.badges.freqPerWeek', { freq: program.frequency })} • {t('workout.section.programs.badges.exercisesCount', { count: program.exercises.length })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="bg-money-gradient"
                                  onClick={() => startWorkoutForProgram(program.id)}
                                >
                                  {t('workout.section.cta.start')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewProgramDetails(program)}
                                >
                                  <Settings className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteProgram(program.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                      
                      <Button
                        onClick={openNewProgramDialog}
                        variant="outline"
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('workout.section.cta.addNewProgram')}
                      </Button>

                      {/* Analytics at Bottom with Blur Effect (Planner/Finance style) */}
                      <div className="flex-shrink-0 p-4">
                        <div className="relative rounded-xl">
                          {/* Blurred underlying analytics card when locked */}
                          <Card className={`glass-card p-2 md:p-4 ${!limits.analyticsAllowed ? 'filter blur-sm pointer-events-none select-none' : ''}`}>
                            <WorkoutAnalytics />
                          </Card>

                          {/* Centered Overlay Upgrade (Finance style) */}
                          {!limits.analyticsAllowed && (
                            <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
                              <div className="text-center p-4">
                                <Crown className="h-8 w-8 mx-auto mb-2 text-money-green" />
                                <p className="text-sm font-medium text-white mb-1">{t('workout.analytics.header')}</p>
                                {(() => {
                                  const targetPlan = 'pro';
                                  const planLabel = t(`plans.${targetPlan}`);
                                  return (
                                    <p className="text-xs text-white/80 mb-3">
                                      {t('workout.analytics.overlay.subtitle', {
                                        plan: planLabel,
                                        defaultValue: 'Unlock detailed analytics with {{plan}} subscription'
                                      })}
                                    </p>
                                  );
                                })()}
                                <ScaleButton onClick={onUpgrade} className="rounded-lg">
                                  <div className="bg-money-gradient text-[#0a0b0d] px-4 py-2 rounded-lg text-sm font-medium">
                                    {(() => {
                                      const targetPlan = 'pro';
                                      const planLabel = t(`plans.${targetPlan}`);
                                      return t('workout.analytics.overlay.upgradeCta', {
                                        plan: planLabel,
                                        defaultValue: 'Upgrade to {{plan}}'
                                      });
                                    })()}
                                  </div>
                                </ScaleButton>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="session" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
                  {!currentSession ? (
                    <Card className="glass-card p-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Timer className="w-5 h-5 text-muted-foreground" />
                        <h3 className="font-semibold">{t('workout.section.session.startTitle')}</h3>
                      </div>
                      {programs.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          {t('workout.section.session.createPrompt')}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {programs.map((p) => (
                            <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-muted-foreground">{t('workout.section.programs.badges.exercisesCount', { count: p.exercises.length })}</div>
                              </div>
                              <Button size="sm" className="bg-money-gradient" onClick={() => startWorkoutForProgram(p.id)}>
                                {t('workout.section.cta.start')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ) : (
                    (() => {
                      const p = programs.find(x => x.id === currentSession.programId);
                      return (
                        <Card className="glass-card p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="font-semibold">{t('workout.section.session.activeTitle')}</h3>
                              <p className="text-sm text-muted-foreground">{p?.name || 'Program'}</p>
                            </div>
                            <Button variant="outline" onClick={stopCurrentWorkout}>{t('workout.section.cta.endSession')}</Button>
                          </div>
                          <div className="space-y-2">
                            {(p?.exercises || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t('workout.section.session.noExercises')}</p>
                            ) : (
                              <div className="space-y-2">
                                {p?.exercises.map((ex) => (
                                  <div key={ex.id} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={!!currentSession?.completed?.[ex.id]}
                                        onCheckedChange={() => toggleExerciseComplete(ex.id)}
                                        aria-label={t('workout.section.session.markComplete', { name: ex.name })}
                                      />
                                      <span className={`text-sm ${currentSession?.completed?.[ex.id] ? 'line-through text-muted-foreground' : ''}`}>{ex.name}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })()
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
                  <Card className="glass-card p-4">
                    <h3 className="font-semibold mb-3">{t('workout.section.history.title')}</h3>
                    {history.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('workout.section.history.empty')}</p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((h, idx) => {
                          const p = programs.find(x => x.id === h.programId);
                          return (
                            <div key={idx} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 text-sm">
                              <div>
                                <div className="font-medium">{p?.name || t('workout.common.workout')}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(h.startedAt).toLocaleString()}  {new Date(h.endedAt).toLocaleTimeString()}  {h.durationMin} {t('workout.analytics.units.min')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="trackers" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4 relative pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
                  {(() => {
                    return (
          !limits.trackersAllowed && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10 flex items-center justify-center">
                          <div className="text-center p-4">
                            <Crown className="h-8 w-8 mx-auto mb-2 text-money-green" />
                            <h3 className="font-medium text-white mb-1">{t('workout.section.trackers.overlay.title')}</h3>
                            <p className="text-xs text-white/80 mb-3">{t('workout.section.trackers.overlay.subtitle')}</p>
                            <Button onClick={onUpgrade} className="bg-money-gradient">
                              {t('workout.section.trackers.overlay.upgradeToLite')}
                            </Button>
                          </div>
                        </div>
                      )
                    );
                  })()}

                  <Card className="glass-card p-4">
        <h3 className="font-semibold mb-4">{t('workout.section.trackers.todayTitle')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Steps */}
                      <div className="p-3 rounded-lg bg-surface-1">
                        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">{t('workout.section.trackers.steps')}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, steps: Math.max(0, t.steps - 500) }))} className="w-6 h-6 p-0">-</Button>
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, steps: t.steps + 500 }))} className="w-6 h-6 p-0">+</Button>
                          </div>
                        </div>
                        <Input
                          className="h-9 bg-transparent border-0 px-0 text-lg font-bold text-money-green focus-visible:ring-0 focus-visible:outline-none"
                          value={todayInputs.steps}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(e) => setTodayInputs(p => ({ ...p, steps: e.target.value.replace(/[^0-9]/g, '') }))}
                          onBlur={() => setTodayTracker(t => ({ ...t, steps: Math.max(0, parseInt(todayInputs.steps || '0', 10) || 0) }))}
                        />
                      </div>

                      {/* Water (cups) */}
                      <div className="p-3 rounded-lg bg-surface-1">
                        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">{t('workout.section.trackers.water')}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, water: Math.max(0, t.water - 1) }))} className="w-6 h-6 p-0">-</Button>
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, water: t.water + 1 }))} className="w-6 h-6 p-0">+</Button>
                          </div>
                        </div>
                        <Input
                          className="h-9 bg-transparent border-0 px-0 text-lg font-bold text-blue-400 focus-visible:ring-0 focus-visible:outline-none"
                          value={todayInputs.water}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(e) => setTodayInputs(p => ({ ...p, water: e.target.value.replace(/[^0-9]/g, '') }))}
                          onBlur={() => setTodayTracker(t => ({ ...t, water: Math.max(0, parseInt(todayInputs.water || '0', 10) || 0) }))}
                        />
                      </div>

                      {/* Weight (kg) */}
                      <div className="p-3 rounded-lg bg-surface-1">
                        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">{t('workout.section.trackers.weight')}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, weightKg: Math.max(0, t.weightKg - 1) }))} className="w-6 h-6 p-0">-</Button>
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, weightKg: t.weightKg + 1 }))} className="w-6 h-6 p-0">+</Button>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <Input
                            className="h-9 bg-transparent border-0 px-0 text-lg font-bold text-violet-400 focus-visible:ring-0 focus-visible:outline-none"
                            value={todayInputs.weightKg}
                            inputMode="decimal"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.,-]/g, '');
                              setTodayInputs(p => ({ ...p, weightKg: raw }));
                            }}
                            onBlur={() => {
                              const n = parseFloat((todayInputs.weightKg || '0').replace(',', '.'));
                              setTodayTracker(t => ({ ...t, weightKg: Number.isFinite(n) && n >= 0 ? n : 0 }));
                            }}
                          />
          <span className="text-sm text-muted-foreground">{t('workout.analytics.units.kg')}</span>
                        </div>
                      </div>

                      {/* Active Minutes */}
                      <div className="p-3 rounded-lg bg-surface-1">
                        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">{t('workout.section.trackers.activeMinutes')}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, activeMinutes: Math.max(0, t.activeMinutes - 15) }))} className="w-6 h-6 p-0">-</Button>
                            <Button size="sm" variant="outline" onClick={() => setTodayTracker(t => ({ ...t, activeMinutes: t.activeMinutes + 15 }))} className="w-6 h-6 p-0">+</Button>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <Input
                            className="h-9 bg-transparent border-0 px-0 text-lg font-bold text-green-400 focus-visible:ring-0 focus-visible:outline-none"
                            value={todayInputs.activeMinutes}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => setTodayInputs(p => ({ ...p, activeMinutes: e.target.value.replace(/[^0-9]/g, '') }))}
                            onBlur={() => setTodayTracker(t => ({ ...t, activeMinutes: Math.max(0, parseInt(todayInputs.activeMinutes || '0', 10) || 0) }))}
                          />
          <span className="text-sm text-muted-foreground">{t('workout.analytics.units.min')}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>

  {/* Analytics Section (Planner/Finance style) */}
  {/* Add extra bottom padding so last cards aren't hidden behind bottom nav/FAB */}
  <div className="flex-shrink-0 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
        <div className="relative">
          {!limits.analyticsAllowed && (
            <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
              <div className="text-center p-4">
                <Crown className="h-8 w-8 mx-auto mb-2 text-money-green" />
                <h3 className="font-medium text-white mb-1">{t('workout.analytics.header')}</h3>
                {(() => {
                  const targetPlan = 'pro';
                  const planLabel = t(`plans.${targetPlan}`);
                  return (
                    <p className="text-xs text-white/80 mb-3">
                      {t('workout.analytics.overlay.subtitle', {
                        plan: planLabel,
                        defaultValue: 'Unlock detailed analytics with {{plan}} subscription'
                      })}
                    </p>
                  );
                })()}
                <ScaleButton onClick={onUpgrade} className="rounded-lg">
                  <div className="bg-money-gradient text-[#0a0b0d] px-4 py-2 rounded-lg text-sm font-medium">
                    {(() => {
                      const targetPlan = 'pro';
                      const planLabel = t(`plans.${targetPlan}`);
                      return t('workout.analytics.overlay.upgradeCta', {
                        plan: planLabel,
                        defaultValue: 'Upgrade to {{plan}}'
                      });
                    })()}
                  </div>
                </ScaleButton>
              </div>
            </div>
          )}
          <Card className={`glass-card p-2 md:p-4 ${!limits.analyticsAllowed ? 'filter blur-sm pointer-events-none select-none' : ''}`}>
            <WorkoutAnalytics />
          </Card>
        </div>
      </div>

  {/* Workout Onboarding Wizard is rendered early-return above when needed */}

      {/* New Program Dialog (mobile-first) */}
<Dialog open={showNewProgram} onOpenChange={setShowNewProgram}>
  <DialogContent className="w-[92vw] sm:max-w-md p-4 sm:p-6 rounded-2xl overflow-y-auto" onOpenAutoFocus={(e)=>e.preventDefault()}>
    <DialogHeader className="pb-2">
  <DialogTitle className="text-lg sm:text-xl">{t('workout.section.dialogs.newProgram.title')}</DialogTitle>
  <DialogDescription className="sr-only">Create and configure a new workout program</DialogDescription>
    </DialogHeader>

    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="program-name" className="text-sm">{t('workout.section.dialogs.newProgram.nameLabel')}</Label>
        <Input
          id="program-name"
          value={newProgram.name}
          onChange={(e) => setNewProgram(prev => ({ ...prev, name: e.target.value }))}
          placeholder={t('workout.section.dialogs.newProgram.namePlaceholder')}
          className="h-11 w-full min-w-0"
        />
      </div>

      <div className="space-y-1.5">
  <Label htmlFor="sport-type" className="text-sm">{t('workout.section.dialogs.newProgram.sportTypeLabel')}</Label>

        <Select
          value={newProgram.sportType}
          onValueChange={(v) =>
            setNewProgram(prev => ({ ...prev, sportType: v as SportType }))
          }
        >
          <SelectTrigger
            id="sport-type"
            className="h-11 w-full min-w-0 rounded-xl bg-surface-1 border-border text-foreground"
          >
            <SelectValue placeholder={t('workout.section.dialogs.newProgram.sportTypePlaceholder') || ''} />
          </SelectTrigger>

          {/* Portal’ed, themed dropdown */}
          <SelectContent className="z-[60] rounded-xl bg-surface-1 border border-border shadow-xl">
      {Object.entries(SPORT_CONFIGS).map(([key, config]) => (
              <SelectItem
                key={key}
                value={key}
                className="cursor-pointer rounded-lg data-[highlighted]:bg-surface-2 data-[state=checked]:bg-money-green/15 data-[state=checked]:text-money-green"
              >
        {t(config.nameKey as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="frequency" className="text-sm">{t('workout.section.dialogs.newProgram.freqLabel')}</Label>
        <Input
          id="frequency"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-11 w-full rounded-xl"
          value={frequencyInput}
          onChange={(e) => {
            // Allow empty while typing and only digits
            const v = e.target.value.replace(/[^0-9]/g, '');
            setFrequencyInput(v);
          }}
          onBlur={() => {
            const n = Math.floor(Number(frequencyInput));
            const valid = Number.isFinite(n) && n >= 1 ? n : 1;
            setNewProgram(prev => ({ ...prev, frequency: valid }));
            setFrequencyInput(String(valid));
          }}
          placeholder={t('workout.section.dialogs.newProgram.freqPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">{t('workout.section.dialogs.newProgram.freqHelper')}</p>
      </div>
    </div>

    {/* Sticky footer actions */}
    <div className="sticky bottom-0 -mx-4 sm:mx-0 mt-4 border-t bg-background/90 backdrop-blur px-4 py-3">
      <div className="mx-auto w-full max-w-[420px] flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleCreateProgram}
          className="h-11 w-full sm:flex-1 bg-money-gradient text-black font-semibold"
        >
          {t('workout.section.cta.createProgram')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowNewProgram(false)}
          className="h-11 w-full sm:flex-1"
        >
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>


      {/* Program Details Dialog */}
<Dialog open={showProgramDetails} onOpenChange={setShowProgramDetails}>
  <DialogContent className="w-[92vw] sm:max-w-3xl p-4 sm:p-6 overflow-hidden rounded-2xl">
    <DialogHeader className="pb-2">
  <DialogTitle className="text-lg sm:text-xl flex flex-wrap items-center gap-2 break-words whitespace-normal">
        {selectedProgram && (
          <>
            {React.createElement(
              SPORT_CONFIGS[selectedProgram.sportType].icon,
              { className: `w-5 h-5 ${SPORT_CONFIGS[selectedProgram.sportType].color}` }
            )}
            <span className="leading-snug">{selectedProgram.name} — {t('workout.section.dialogs.programDetails.exercises')}</span>
          </>
        )}
      </DialogTitle>
  <DialogDescription className="sr-only">View and manage exercises in this program</DialogDescription>
    </DialogHeader>

    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t('workout.section.programs.badges.exercisesCount', { count: selectedProgram?.exercises.length || 0 })}</Badge>
          <Badge variant="outline">{t('workout.section.programs.badges.freqPerWeek', { freq: selectedProgram?.frequency || 0 })}</Badge>
        </div>
        <Button onClick={() => setShowAddExercise(true)} size="sm" className="bg-money-gradient w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          {t('workout.section.cta.addExercise')}
        </Button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 max-h-[70vh]">
        {selectedProgram?.exercises.length === 0 ? (
          <div className="text-center py-10">
            <Dumbbell className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">{t('workout.section.dialogs.addExercise.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('workout.section.dialogs.addExercise.emptySubtitle')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedProgram?.exercises.map((exercise, index) => (
              <Card key={exercise.id} className="glass-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-medium bg-money-green/20 text-money-green px-2 py-0.5 rounded">#{index + 1}</span>
                      <h4 className="font-medium">{exercise.name}</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      {exercise.sets ? <div><span className="text-muted-foreground">{t('workout.section.labels.sets')}: </span><span className="font-medium">{exercise.sets}</span></div> : null}
                      {exercise.reps ? <div><span className="text-muted-foreground">{t('workout.section.labels.reps')}: </span><span className="font-medium">{exercise.reps}</span></div> : null}
                      {exercise.weight ? <div><span className="text-muted-foreground">{t('workout.section.labels.weight')}: </span><span className="font-medium">{exercise.weight}{t('workout.analytics.units.kg')}</span></div> : null}
                      {exercise.duration ? <div><span className="text-muted-foreground">{t('workout.section.labels.duration')}: </span><span className="font-medium">{exercise.duration}{t('workout.analytics.units.min')}</span></div> : null}
                      {exercise.restTime ? <div><span className="text-muted-foreground">{t('workout.section.labels.rest')}: </span><span className="font-medium">{exercise.restTime}{t('workout.analytics.units.s')}</span></div> : null}
                    </div>

                    {exercise.notes && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <span className="text-muted-foreground">{t('workout.section.labels.notes')}: </span>{exercise.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button size="sm" variant="outline" onClick={() => handleEditExercise(exercise)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteExercise(exercise.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  </DialogContent>
</Dialog>


      {/* Add Exercise Dialog */}
<Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
  <DialogContent className="w-[92vw] sm:max-w-md p-4 sm:p-6 overflow-y-auto rounded-2xl">
    <DialogHeader className="pb-2">
  <DialogTitle className="text-lg sm:text-xl">{t('workout.section.dialogs.addExercise.title')}</DialogTitle>
  <DialogDescription className="sr-only">Fill in exercise details like sets, reps and duration</DialogDescription>
    </DialogHeader>

    <div className="space-y-4 sm:space-y-5">
      {/* Exercise name */}
      <div className="space-y-1.5">
        <Label htmlFor="exercise-name" className="block text-sm font-medium leading-tight">
          {t('workout.section.dialogs.addExercise.nameLabel')}
        </Label>
        <Input
          id="exercise-name"
          className="h-11"
          value={exerciseForm.name}
          onChange={(e) => setExerciseForm(p => ({ ...p, name: e.target.value }))}
          placeholder={t('workout.section.dialogs.addExercise.namePlaceholder')}
        />
      </div>

      {/* Sets / Reps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sets" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.sets')}</Label>
          <Input
            id="sets"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-11"
            value={setsInput}
            onChange={(e) => setSetsInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = Math.max(0, Math.floor(Number(setsInput)) || 0);
              setExerciseForm(p => ({ ...p, sets: n }));
              setSetsInput(String(n));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reps" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.reps')}</Label>
          <Input
            id="reps"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-11"
            value={repsInput}
            onChange={(e) => setRepsInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = Math.max(0, Math.floor(Number(repsInput)) || 0);
              setExerciseForm(p => ({ ...p, reps: n }));
              setRepsInput(String(n));
            }}
          />
        </div>
      </div>

      {/* Weight / Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="weight" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.weight')}</Label>
          <Input
            id="weight"
            type="text"
            inputMode="decimal"
            className="h-11"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value.replace(/[^0-9.,]/g, ''))}
            onBlur={() => {
              const v = parseFloat((weightInput || '0').replace(',', '.'));
              const n = Number.isFinite(v) && v >= 0 ? v : 0;
              setExerciseForm(p => ({ ...p, weight: n }));
              setWeightInput(String(n));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.duration')}</Label>
          <Input
            id="duration"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-11"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = Math.max(0, Math.floor(Number(durationInput)) || 0);
              setExerciseForm(p => ({ ...p, duration: n }));
              setDurationInput(String(n));
            }}
          />
        </div>
      </div>

      {/* Rest time */}
      <div className="space-y-1.5">
  <Label htmlFor="rest-time" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.restTime')}</Label>
        <Input
          id="rest-time"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-11"
          value={restTimeInput}
          onChange={(e) => setRestTimeInput(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => {
            const n = Math.max(0, Math.floor(Number(restTimeInput)) || 0);
            setExerciseForm(p => ({ ...p, restTime: n }));
            setRestTimeInput(String(n));
          }}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.notes')}</Label>
        <Input
          id="notes"
          className="h-11"
          value={exerciseForm.notes}
          onChange={(e) => setExerciseForm(p => ({ ...p, notes: e.target.value }))}
          placeholder={t('workout.section.dialogs.addExercise.notesPlaceholder')}
        />
      </div>

      {/* Sticky footer stays the same */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 border-t bg-background/90 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-11 w-28"
            onClick={() => {
              setShowAddExercise(false);
              resetExerciseForm();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAddExercise} className="h-11 flex-1 bg-money-gradient">
            <Plus className="w-4 h-4 mr-2" />
            {t('workout.section.cta.addExercise')}
          </Button>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>


      {/* Edit Exercise Dialog */}
<Dialog open={showEditExercise} onOpenChange={setShowEditExercise}>
  <DialogContent className="w-[92vw] sm:max-w-md p-4 sm:p-6 overflow-y-auto rounded-2xl">
    <DialogHeader className="pb-2">
  <DialogTitle className="text-lg sm:text-xl">{t('workout.section.dialogs.editExercise.title')}</DialogTitle>
  <DialogDescription className="sr-only">Update exercise fields and save changes</DialogDescription>
    </DialogHeader>

    <div className="space-y-4 sm:space-y-5">
      {/* Exercise name */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-exercise-name" className="block text-sm font-medium leading-tight">
          {t('workout.section.dialogs.addExercise.nameLabel')}
        </Label>
        <Input
          id="edit-exercise-name"
          className="h-11"
          value={exerciseForm.name}
          onChange={(e) => setExerciseForm(p => ({ ...p, name: e.target.value }))}
          placeholder={t('workout.section.dialogs.addExercise.namePlaceholder')}
        />
      </div>

      {/* Sets / Reps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-sets" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.sets')}</Label>
          <Input
            id="edit-sets"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-11"
            value={setsInput}
            onChange={(e) => setSetsInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = Math.max(0, Math.floor(Number(setsInput)) || 0);
              setExerciseForm(p => ({ ...p, sets: n }));
              setSetsInput(String(n));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-reps" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.reps')}</Label>
          <Input
            id="edit-reps"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-11"
            value={repsInput}
            onChange={(e) => setRepsInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = Math.max(0, Math.floor(Number(repsInput)) || 0);
              setExerciseForm(p => ({ ...p, reps: n }));
              setRepsInput(String(n));
            }}
          />
        </div>
      </div>

      {/* Weight / Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-weight" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.weight')}</Label>
          <Input
            id="edit-weight"
            type="text"
            inputMode="decimal"
            className="h-11"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value.replace(/[^0-9.,]/g, ''))}
            onBlur={() => {
              const v = parseFloat((weightInput || '0').replace(',', '.'));
              const n = Number.isFinite(v) && v >= 0 ? v : 0;
              setExerciseForm(p => ({ ...p, weight: n }));
              setWeightInput(String(n));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-duration" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.duration')}</Label>
          <Input
            id="edit-duration"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-11"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = Math.max(0, Math.floor(Number(durationInput)) || 0);
              setExerciseForm(p => ({ ...p, duration: n }));
              setDurationInput(String(n));
            }}
          />
        </div>
      </div>

      {/* Rest time */}
      <div className="space-y-1.5">
  <Label htmlFor="edit-rest-time" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.restTime')}</Label>
        <Input
          id="edit-rest-time"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-11"
          value={restTimeInput}
          onChange={(e) => setRestTimeInput(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => {
            const n = Math.max(0, Math.floor(Number(restTimeInput)) || 0);
            setExerciseForm(p => ({ ...p, restTime: n }));
            setRestTimeInput(String(n));
          }}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
  <Label htmlFor="edit-notes" className="block text-sm font-medium leading-tight">{t('workout.section.dialogs.addExercise.notes')}</Label>
        <Input
          id="edit-notes"
          className="h-11"
          value={exerciseForm.notes}
          onChange={(e) => setExerciseForm(p => ({ ...p, notes: e.target.value }))}
          placeholder={t('workout.section.dialogs.addExercise.notesPlaceholder')}
        />
      </div>

      {/* Sticky footer stays the same */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 border-t bg-background/90 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-11 w-28"
            onClick={() => {
              setShowEditExercise(false);
              setEditingExercise(null);
              resetExerciseForm();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleUpdateExercise} className="h-11 flex-1 bg-money-gradient">
            <Save className="w-4 h-4 mr-2" />
            {t('workout.section.cta.updateExercise')}
          </Button>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
});

WorkoutSection.displayName = 'WorkoutSection';

export default WorkoutSection;