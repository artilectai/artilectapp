"use client";

import { useState, useEffect, useCallback } from 'react';

// Types and Interfaces
export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
}

export type TrialStatus = 'inactive' | 'active' | 'expired' | 'used';
export type PlanType = 'free' | 'pro' | 'premium';

export interface ProTrialState {
  trialStatus: TrialStatus;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  timeRemaining: TimeRemaining | null;
  isEligible: boolean;
  previousPlan: PlanType;
  onboardingCompleted: boolean;
  firstWeeklyReviewCompleted: boolean;
  hasUsedTrial: boolean;
}

export interface ProTrialActions {
  startTrial: () => Promise<boolean>;
  checkTrialExpiry: () => boolean;
  calculateTimeRemaining: () => TimeRemaining | null;
  markOnboardingComplete: () => void;
  markFirstWeeklyReviewComplete: () => void;
  getTrialEligibility: () => boolean;
  autoRevertTrial: () => void;
  resetTrial: () => void; // For testing/admin purposes
}

export interface UseProTrialReturn extends ProTrialState, ProTrialActions {}

// Storage Keys
const STORAGE_KEYS = {
  TRIAL_STATUS: 'pro_trial_status',
  TRIAL_START_DATE: 'pro_trial_start_date',
  TRIAL_END_DATE: 'pro_trial_end_date',
  TRIAL_ELIGIBILITY: 'trial_eligibility',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  FIRST_WEEKLY_REVIEW_COMPLETED: 'first_weekly_review_completed',
  PREVIOUS_PLAN: 'previous_plan_before_trial',
  HAS_USED_TRIAL: 'has_used_trial_before'
} as const;

// Constants
const TRIAL_DURATION_HOURS = 168; // 7 days
const GRACE_PERIOD_HOURS = 1;
const UPDATE_INTERVAL_MS = 1000; // Update every second

// Storage Utility Functions
const isClient = typeof window !== 'undefined';
const isTelegram = isClient && !!(window as any).Telegram?.WebApp;

const getStorageValue = <T>(key: string, defaultValue: T): T => {
  if (!isClient) return defaultValue;
  
  try {
    // Try Telegram storage first
    if (isTelegram && (window as any).Telegram?.WebApp?.CloudStorage) {
      // Note: Telegram storage is async, we'll handle it separately
      const localValue = localStorage.getItem(key);
      return localValue ? JSON.parse(localValue) : defaultValue;
    }
    
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading storage key ${key}:`, error);
    return defaultValue;
  }
};

const setStorageValue = <T>(key: string, value: T): void => {
  if (!isClient) return;
  
  try {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
    
    // Also sync to Telegram storage if available
    if (isTelegram && (window as any).Telegram?.WebApp?.CloudStorage) {
      (window as any).Telegram.WebApp.CloudStorage.setItem(key, serializedValue, (error: any) => {
        if (error) {
          console.error(`Error saving to Telegram storage key ${key}:`, error);
        }
      });
    }
  } catch (error) {
    console.error(`Error setting storage key ${key}:`, error);
  }
};

// Utility Functions
const parseStoredDate = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  try {
    return new Date(dateString);
  } catch {
    return null;
  }
};

const calculateTimeRemaining = (endDate: Date): TimeRemaining => {
  const now = new Date();
  const timeDiff = endDate.getTime() - now.getTime();
  
  if (timeDiff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalHours: 0,
      totalMinutes: 0,
      totalSeconds: 0
    };
  }
  
  const totalSeconds = Math.floor(timeDiff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  
  return {
    days,
    hours,
    minutes,
    seconds,
    totalHours,
    totalMinutes,
    totalSeconds
  };
};

const isTrialExpired = (endDate: Date, graceHours: number = GRACE_PERIOD_HOURS): boolean => {
  const now = new Date();
  const graceEndTime = new Date(endDate.getTime() + (graceHours * 60 * 60 * 1000));
  return now > graceEndTime;
};

// Analytics tracking (placeholder - implement based on your analytics provider)
const trackTrialEvent = (event: string, data?: Record<string, any>) => {
  console.log(`Trial Event: ${event}`, data);
  // Implement your analytics tracking here
  // Example: analytics.track(event, data);
};

// Main Hook
export const useProTrial = (): UseProTrialReturn => {
  // Initialize state from storage
  const [state, setState] = useState<ProTrialState>(() => ({
    trialStatus: getStorageValue<TrialStatus>(STORAGE_KEYS.TRIAL_STATUS, 'inactive'),
    trialStartDate: parseStoredDate(getStorageValue<string>(STORAGE_KEYS.TRIAL_START_DATE, '')),
    trialEndDate: parseStoredDate(getStorageValue<string>(STORAGE_KEYS.TRIAL_END_DATE, '')),
    timeRemaining: null,
    isEligible: getStorageValue<boolean>(STORAGE_KEYS.TRIAL_ELIGIBILITY, false),
    previousPlan: getStorageValue<PlanType>(STORAGE_KEYS.PREVIOUS_PLAN, 'free'),
    onboardingCompleted: getStorageValue<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETED, false),
    firstWeeklyReviewCompleted: getStorageValue<boolean>(STORAGE_KEYS.FIRST_WEEKLY_REVIEW_COMPLETED, false),
    hasUsedTrial: getStorageValue<boolean>(STORAGE_KEYS.HAS_USED_TRIAL, false)
  }));

  // Calculate initial time remaining
  useEffect(() => {
    if (state.trialEndDate && state.trialStatus === 'active') {
      const timeLeft = calculateTimeRemaining(state.trialEndDate);
      setState(prev => ({ ...prev, timeRemaining: timeLeft }));
    }
  }, [state.trialEndDate, state.trialStatus]);

  // Real-time countdown update
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (state.trialStatus === 'active' && state.trialEndDate) {
      intervalId = setInterval(() => {
        const timeLeft = calculateTimeRemaining(state.trialEndDate!);
        
        setState(prev => ({ ...prev, timeRemaining: timeLeft }));
        
        // Check if trial has expired
        if (timeLeft.totalSeconds <= 0) {
          setState(prev => ({ 
            ...prev, 
            trialStatus: 'expired',
            timeRemaining: null
          }));
          setStorageValue(STORAGE_KEYS.TRIAL_STATUS, 'expired');
          trackTrialEvent('trial_expired');
        }
      }, UPDATE_INTERVAL_MS);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [state.trialStatus, state.trialEndDate]);

  // Auto-revert expired trials
  useEffect(() => {
    if (state.trialStatus === 'expired' && state.trialEndDate) {
      if (isTrialExpired(state.trialEndDate, GRACE_PERIOD_HOURS)) {
        autoRevertTrial();
      }
    }
  }, [state.trialStatus, state.trialEndDate]);

  // Update eligibility when prerequisites are met
  useEffect(() => {
    const newEligibility = getTrialEligibility();
    if (newEligibility !== state.isEligible) {
      setState(prev => ({ ...prev, isEligible: newEligibility }));
      setStorageValue(STORAGE_KEYS.TRIAL_ELIGIBILITY, newEligibility);
    }
  }, [state.onboardingCompleted, state.firstWeeklyReviewCompleted, state.hasUsedTrial]);

  // Actions
    const startTrial = useCallback(async (): Promise<boolean> => {
      try {
        const eligible = state.onboardingCompleted && state.firstWeeklyReviewCompleted && !state.hasUsedTrial;
        if (!eligible) {
          console.warn('User is not eligible for trial');
          return false;
        }
  
        if (state.hasUsedTrial) {
          console.warn('User has already used their trial');
          return false;
        }
  
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + (TRIAL_DURATION_HOURS * 60 * 60 * 1000));
  
        const newState: Partial<ProTrialState> = {
          trialStatus: 'active',
          trialStartDate: startDate,
          trialEndDate: endDate,
          hasUsedTrial: true,
          isEligible: false
        };
  
        setState(prev => ({ ...prev, ...newState }));
  
        // Persist to storage
        setStorageValue(STORAGE_KEYS.TRIAL_STATUS, 'active');
        setStorageValue(STORAGE_KEYS.TRIAL_START_DATE, startDate.toISOString());
        setStorageValue(STORAGE_KEYS.TRIAL_END_DATE, endDate.toISOString());
        setStorageValue(STORAGE_KEYS.HAS_USED_TRIAL, true);
        setStorageValue(STORAGE_KEYS.TRIAL_ELIGIBILITY, false);
  
        trackTrialEvent('trial_started', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          previousPlan: state.previousPlan
        });
  
        return true;
      } catch (error) {
        console.error('Error starting trial:', error);
        trackTrialEvent('trial_start_error', { error: (error instanceof Error ? error.message : String(error)) });
        return false;
      }
    }, [state.onboardingCompleted, state.firstWeeklyReviewCompleted, state.hasUsedTrial, state.previousPlan]);
  
    const checkTrialExpiry = useCallback((): boolean => {
    if (state.trialStatus !== 'active' || !state.trialEndDate) {
      return false;
    }

    const expired = isTrialExpired(state.trialEndDate, 0); // No grace period for this check
    
    if (expired && state.trialStatus === 'active') {
      setState(prev => ({ ...prev, trialStatus: 'expired' }));
      setStorageValue(STORAGE_KEYS.TRIAL_STATUS, 'expired');
      trackTrialEvent('trial_expired_check');
    }

    return expired;
  }, [state.trialStatus, state.trialEndDate]);

  const calculateTimeRemainingCallback = useCallback((): TimeRemaining | null => {
    if (!state.trialEndDate || state.trialStatus !== 'active') {
      return null;
    }
    return calculateTimeRemaining(state.trialEndDate);
  }, [state.trialEndDate, state.trialStatus]);

  const markOnboardingComplete = useCallback((): void => {
    setState(prev => ({ ...prev, onboardingCompleted: true }));
    setStorageValue(STORAGE_KEYS.ONBOARDING_COMPLETED, true);
    trackTrialEvent('onboarding_completed');
  }, []);

  const markFirstWeeklyReviewComplete = useCallback((): void => {
    setState(prev => ({ ...prev, firstWeeklyReviewCompleted: true }));
    setStorageValue(STORAGE_KEYS.FIRST_WEEKLY_REVIEW_COMPLETED, true);
    trackTrialEvent('first_weekly_review_completed');
  }, []);

  const getTrialEligibility = useCallback((): boolean => {
    return state.onboardingCompleted && 
           state.firstWeeklyReviewCompleted && 
           !state.hasUsedTrial;
  }, [state.onboardingCompleted, state.firstWeeklyReviewCompleted, state.hasUsedTrial]);

  const autoRevertTrial = useCallback((): void => {
    if (state.trialStatus !== 'expired') return;

    setState(prev => ({
      ...prev,
      trialStatus: 'used',
      timeRemaining: null
    }));

    setStorageValue(STORAGE_KEYS.TRIAL_STATUS, 'used');
    
    trackTrialEvent('trial_auto_reverted', {
      previousPlan: state.previousPlan,
      revertedAt: new Date().toISOString()
    });

    // Here you would typically call your subscription management system
    // to revert the user back to their previous plan
    console.log(`Reverting user to ${state.previousPlan} plan`);
  }, [state.trialStatus, state.previousPlan]);

  const resetTrial = useCallback((): void => {
    // For testing/admin purposes only
    const resetState: Partial<ProTrialState> = {
      trialStatus: 'inactive',
      trialStartDate: null,
      trialEndDate: null,
      timeRemaining: null,
      hasUsedTrial: false,
      isEligible: false
    };

    setState(prev => ({ ...prev, ...resetState }));

    // Clear storage
    Object.values(STORAGE_KEYS).forEach(key => {
      if (isClient) {
        localStorage.removeItem(key);
      }
    });

    trackTrialEvent('trial_reset');
  }, []);

  return {
    // State
    ...state,
    // Actions
    startTrial,
    checkTrialExpiry,
    calculateTimeRemaining: calculateTimeRemainingCallback,
    markOnboardingComplete,
    markFirstWeeklyReviewComplete,
    getTrialEligibility,
    autoRevertTrial,
    resetTrial
  };
};

// Export utility functions for external use
export {
  calculateTimeRemaining as calculateTimeRemainingUtil,
  isTrialExpired as isTrialExpiredUtil,
  STORAGE_KEYS,
  TRIAL_DURATION_HOURS,
  GRACE_PERIOD_HOURS
};
