import { useState, useCallback, useRef, useEffect } from 'react';

export type PlanType = 'free' | 'lite' | 'pro';

export type NudgeType = 
  | 'finance-second-account'
  | 'export-attempt' 
  | 'pdf-attempt'
  | 'streak-nudge';

export interface NudgeContext {
  accountCount?: number;
  exportType?: 'csv' | 'sheets' | 'pdf';
  streakDays?: number;
  featureName?: string;
}

export interface NudgeConfig {
  type: NudgeType;
  title: string;
  description: string;
  targetPlan: PlanType;
  ctaText: string;
  priority: number;
  cooldownHours: number;
  maxDailyShows: number;
}

export interface ActiveNudge extends NudgeConfig {
  context?: NudgeContext;
  timestamp: number;
  id: string;
}

export interface NudgeHistory {
  type: NudgeType;
  timestamp: number;
  dismissed: boolean;
  converted?: boolean;
}

const NUDGE_CONFIGS: Record<NudgeType, NudgeConfig> = {
  'finance-second-account': {
    type: 'finance-second-account',
    title: 'Ready for Multiple Accounts?',
    description: 'Track all your accounts in one place with Lite. Perfect for managing checking, savings, and credit cards together.',
    targetPlan: 'lite',
    ctaText: 'Upgrade to Lite',
    priority: 2,
    cooldownHours: 24,
    maxDailyShows: 1
  },
  'export-attempt': {
    type: 'export-attempt',
    title: 'Export Your Data',
    description: 'Get your financial data in CSV or Google Sheets format. Keep your records organized and accessible.',
    targetPlan: 'lite',
    ctaText: 'Upgrade to Lite',
    priority: 2,
    cooldownHours: 12,
    maxDailyShows: 2
  },
  'pdf-attempt': {
    type: 'pdf-attempt',
    title: 'Professional Reports',
    description: 'Generate beautiful PDF reports with charts and insights. Perfect for sharing with advisors or personal records.',
    targetPlan: 'pro',
    ctaText: 'Upgrade to Pro',
    priority: 3,
    cooldownHours: 8,
    maxDailyShows: 1
  },
  'streak-nudge': {
    type: 'streak-nudge',
    title: '🔥 Amazing 7-Day Streak!',
    description: 'You\'re building great habits! Pro users get advanced analytics and goal tracking to level up even more.',
    targetPlan: 'pro',
    ctaText: 'See Pro Features',
    priority: 1,
    cooldownHours: 72,
    maxDailyShows: 1
  }
};

const STORAGE_KEYS = {
  NUDGE_HISTORY: 'nudge_history',
  LAST_NUDGE_CHECK: 'last_nudge_check'
} as const;

export function useSubscriptionNudges(currentPlan: PlanType) {
  const [currentNudge, setCurrentNudge] = useState<ActiveNudge | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<NudgeHistory[]>([]);

  // Load nudge history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NUDGE_HISTORY);
      if (stored) {
        historyRef.current = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load nudge history:', error);
      historyRef.current = [];
    }
  }, []);

  // Save nudge history to localStorage
  const saveHistory = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NUDGE_HISTORY, JSON.stringify(historyRef.current));
    } catch (error) {
      console.warn('Failed to save nudge history:', error);
    }
  }, []);

  // Check if nudge should be shown based on history and cooldowns
  const shouldShowNudge = useCallback((type: NudgeType): boolean => {
    const config = NUDGE_CONFIGS[type];
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    // Check if user already has target plan or higher
    const planHierarchy = { free: 0, lite: 1, pro: 2 };
    if (planHierarchy[currentPlan] >= planHierarchy[config.targetPlan]) {
      return false;
    }

    // Check cooldown period
    const lastShown = historyRef.current
      .filter(h => h.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (lastShown) {
      const cooldownMs = config.cooldownHours * 60 * 60 * 1000;
      if (now - lastShown.timestamp < cooldownMs) {
        return false;
      }
    }

    // Check daily limit
    const todayShows = historyRef.current.filter(h => 
      h.type === type && h.timestamp >= todayStart
    ).length;
    
    if (todayShows >= config.maxDailyShows) {
      return false;
    }

    // Check if there's already a higher priority nudge active
    if (currentNudge && NUDGE_CONFIGS[currentNudge.type].priority > config.priority) {
      return false;
    }

    return true;
  }, [currentPlan, currentNudge]);

  // Generate nudge message based on context
  const generateContextualMessage = useCallback((type: NudgeType, context?: NudgeContext): Partial<NudgeConfig> => {
    const config = NUDGE_CONFIGS[type];
    
    switch (type) {
      case 'finance-second-account':
        if (context?.accountCount) {
          return {
            description: `You currently have ${context.accountCount} account${context.accountCount === 1 ? '' : 's'}. Add unlimited accounts with Lite to get the full picture of your finances.`
          };
        }
        break;
        
      case 'export-attempt':
        if (context?.exportType) {
          const formatName = context.exportType === 'csv' ? 'CSV' : 'Google Sheets';
          return {
            title: `Export to ${formatName}`,
            description: `Download your data in ${formatName} format. Lite users get unlimited exports plus advanced filtering options.`
          };
        }
        break;
        
      case 'pdf-attempt':
        if (context?.featureName) {
          return {
            description: `Generate professional PDF reports with ${context.featureName} and other Pro features. Perfect for sharing or keeping records.`
          };
        }
        break;
        
      case 'streak-nudge':
        if (context?.streakDays && context.streakDays >= 7) {
          return {
            title: `🔥 Incredible ${context.streakDays}-Day Streak!`,
            description: `You're on fire! Pro users get streak insights, habit analytics, and advanced goal tracking to maintain momentum.`
          };
        }
        break;
    }
    
    return {};
  }, []);

  // Track nudge event for analytics
  const trackNudgeEvent = useCallback((event: string, nudgeType: NudgeType, context?: NudgeContext) => {
    try {
      // Analytics integration would go here
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'nudge_interaction', {
          event_category: 'subscription',
          event_label: nudgeType,
          nudge_event: event,
          current_plan: currentPlan,
          ...context
        });
      }
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }, [currentPlan]);

  // Add nudge to history
  const addToHistory = useCallback((type: NudgeType, dismissed: boolean = false, converted: boolean = false) => {
    const entry: NudgeHistory = {
      type,
      timestamp: Date.now(),
      dismissed,
      converted
    };
    
    historyRef.current.push(entry);
    
    // Keep only last 100 entries to prevent unlimited growth
    if (historyRef.current.length > 100) {
      historyRef.current = historyRef.current.slice(-100);
    }
    
    saveHistory();
  }, [saveHistory]);

  // Trigger a nudge
  const triggerNudge = useCallback((type: NudgeType, context?: NudgeContext) => {
    // Clear any existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce multiple triggers
    debounceRef.current = setTimeout(() => {
      if (!shouldShowNudge(type)) {
        return;
      }

      const config = NUDGE_CONFIGS[type];
      const contextualUpdates = generateContextualMessage(type, context);
      
      const nudge: ActiveNudge = {
        ...config,
        ...contextualUpdates,
        context,
        timestamp: Date.now(),
        id: `${type}-${Date.now()}`
      };

      // If there's already a nudge, check priority
      if (currentNudge) {
        const currentPriority = NUDGE_CONFIGS[currentNudge.type].priority;
        if (config.priority <= currentPriority) {
          return; // Don't override higher priority nudge
        }
      }

      setCurrentNudge(nudge);
      setIsVisible(true);
      addToHistory(type);
      trackNudgeEvent('shown', type, context);
    }, 300); // 300ms debounce
  }, [shouldShowNudge, generateContextualMessage, currentNudge, addToHistory, trackNudgeEvent]);

  // Dismiss current nudge
  const dismissNudge = useCallback(() => {
    if (currentNudge) {
      setIsVisible(false);
      trackNudgeEvent('dismissed', currentNudge.type, currentNudge.context);
      addToHistory(currentNudge.type, true);
      
      // Delay clearing the nudge to allow exit animation
      setTimeout(() => {
        setCurrentNudge(null);
      }, 300);
    }
  }, [currentNudge, trackNudgeEvent, addToHistory]);

  // Handle nudge conversion (user clicked CTA)
  const convertNudge = useCallback(() => {
    if (currentNudge) {
      trackNudgeEvent('converted', currentNudge.type, currentNudge.context);
      addToHistory(currentNudge.type, false, true);
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentNudge(null);
      }, 300);
    }
  }, [currentNudge, trackNudgeEvent, addToHistory]);

  // Get nudge statistics for debugging/analytics
  const getNudgeStats = useCallback(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    
    const stats = {
      totalNudges: historyRef.current.length,
      last7Days: historyRef.current.filter(h => now - h.timestamp < weekMs).length,
      last24Hours: historyRef.current.filter(h => now - h.timestamp < dayMs).length,
      dismissalRate: 0,
      conversionRate: 0,
      byType: {} as Record<NudgeType, { shown: number; dismissed: number; converted: number }>
    };

    // Calculate rates
    if (stats.totalNudges > 0) {
      const dismissed = historyRef.current.filter(h => h.dismissed).length;
      const converted = historyRef.current.filter(h => h.converted).length;
      
      stats.dismissalRate = dismissed / stats.totalNudges;
      stats.conversionRate = converted / stats.totalNudges;
    }

    // Group by type
    Object.keys(NUDGE_CONFIGS).forEach(type => {
      const typeNudges = historyRef.current.filter(h => h.type === type);
      stats.byType[type as NudgeType] = {
        shown: typeNudges.length,
        dismissed: typeNudges.filter(h => h.dismissed).length,
        converted: typeNudges.filter(h => h.converted).length
      };
    });

    return stats;
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    // State
    currentNudge,
    isVisible,
    
    // Actions
    triggerNudge,
    dismissNudge,
    convertNudge,
    
    // Utilities
    shouldShowNudge,
    getNudgeStats,
    
    // Config access
    configs: NUDGE_CONFIGS
  };
}