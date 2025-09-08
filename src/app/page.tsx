"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '@/lib/supabase/useSession';
import { supabase } from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import OnboardingWizard from '@/components/OnboardingWizard';
import PlannerSection from '@/components/PlannerSection';
import FinanceSection from '@/components/FinanceSection';
import WorkoutSection from '@/components/WorkoutSection';
import { PremiumSubscriptionPlans } from '@/components/SubscriptionPlans';
import { HapticProvider, SlideUpModal, iosSpring } from '@/components/iOSAnimations';
import { Button } from '@/components/ui/button';
import { Crown, TrendingUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type AppMode = 'planner' | 'finance' | 'workout';
type SubscriptionPlan = 'free' | 'lite' | 'pro';

interface OnboardingData {
  language: string;
  name: string;
  timezone: string;
  weekStart: "monday" | "sunday";
}

// Define interfaces for component refs
interface PlannerSectionRef {
  handleNewTask: () => void;
}

interface FinanceSectionRef {
  handleNewTransaction: () => void;
}

interface WorkoutSectionRef {
  handleNewWorkout: () => void;
}

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { t } = useTranslation('app');
  const [currentMode, setCurrentMode] = useState<AppMode>('planner');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSubscriptionPlans, setShowSubscriptionPlans] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>('free');
  const [usageCount, setUsageCount] = useState(0);

  // Use proper refs for section components
  const plannerRef = useRef<PlannerSectionRef>(null);
  const financeRef = useRef<FinanceSectionRef>(null);
  const workoutRef = useRef<WorkoutSectionRef>(null);

  // Authentication and onboarding check
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // If not authenticated, redirect to login
        if (!isPending && !session?.user) {
          router.push('/login');
          return;
        }

        // If authenticated, check onboarding status
        if (session?.user) {
          if (typeof window !== 'undefined') {
            // Treat presence of 'false' correctly: only "true" means completed
            const onboardingCompletedRaw = localStorage.getItem('onboardingCompleted');
            const onboardingCompleted = onboardingCompletedRaw === 'true';
            const savedPlan = localStorage.getItem('subscription_plan') as SubscriptionPlan;
            const savedUsageCount = localStorage.getItem('usage_count');

            // If onboarding not completed, display inline overlay wizard
            if (!onboardingCompleted) {
              setShowOnboarding(true);
            } else {
              setShowOnboarding(false);
            }
            setSubscriptionPlan(savedPlan || 'free');
            setUsageCount(parseInt(savedUsageCount || '0', 10));
            

            // Sync subscription plan with Supabase profile (is_pro / pro_expires_at)
            try {
              const userId = session.user.id as string;
              const now = new Date();
              // Try primary table name
              let { data: profile, error } = await supabase
                .from('profiles')
                .select('is_pro, pro_expires_at')
                .eq('id', userId)
                .single();
              // Fallback to user_profiles if profiles missing
              if (error) {
                const alt = await supabase
                  .from('user_profiles')
                  .select('*')
                  .eq('user_id', userId)
                  .single();
                profile = alt.data as any;
              }

              if (profile && typeof profile.is_pro === 'boolean') {
                const expiresAt = profile.pro_expires_at ? new Date(profile.pro_expires_at as string) : null;
                const proActive = profile.is_pro && (!expiresAt || expiresAt > now);
                const nextPlan: SubscriptionPlan = proActive ? 'pro' : (savedPlan || 'free');
                setSubscriptionPlan(nextPlan);
                localStorage.setItem('subscription_plan', nextPlan);
              }
            } catch (e) {
              // Non-fatal: keep local plan
              console.warn('Failed to sync subscription from profile:', e);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [session, isPending, router]);

  // Show upgrade prompt after certain usage
  const lastUpgradePromptCountRef = useRef<number>(-1);
  useEffect(() => {
    if (subscriptionPlan === 'free' && usageCount > 0 && usageCount % 10 === 0 && usageCount !== lastUpgradePromptCountRef.current) {
      lastUpgradePromptCountRef.current = usageCount;
      setShowUpgradePrompt(true);
    }
  }, [usageCount, subscriptionPlan]);

  const handleOnboardingComplete = async (data: OnboardingData) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_preferences', JSON.stringify(data));
        localStorage.setItem('onboardingCompleted', 'true');
      }
      
      setShowOnboarding(false);
      
      // Analytics event
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'onboarding_complete', {
          method: 'auth_onboarding',
          language: data.language,
          timezone: data.timezone
        });
      }

      // Show welcome message and subscription offer
      setTimeout(() => {
        toast.success(`Welcome ${session?.user?.name}! Your productivity journey starts now.`);
        if (subscriptionPlan === 'free') {
          setTimeout(() => {
            setShowUpgradePrompt(true);
          }, 3000);
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to save preferences');
    }
  };

  const handleModeChange = (mode: AppMode) => {
    if (mode === currentMode) return;
    
    setCurrentMode(mode);
    
    // Increment usage counter
    setUsageCount(prevCount => {
      const newCount = prevCount + 1;
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('usage_count', newCount.toString());
      }
      
      return newCount;
    });
    
    // Analytics events
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'mode_switch', {
        from: currentMode,
        to: mode,
        usage_count: usageCount + 1,
        user_id: session?.user?.id
      });
      
      if (mode === 'finance') {
        (window as any).gtag('event', 'open_finance');
      }
    }
  };

  const handleUpgrade = (event?: React.MouseEvent) => {
    event?.preventDefault();
    setShowSubscriptionPlans(true);
    setShowUpgradePrompt(false);
    
    // Analytics event
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'upgrade_intent', {
        source: 'upgrade_prompt',
        usage_count: usageCount,
        user_id: session?.user?.id
      });
    }
  };

  const handleSubscriptionSelect = async (planId: string) => {
    try {
      setSubscriptionPlan(planId as SubscriptionPlan);
      if (typeof window !== 'undefined') {
        localStorage.setItem('subscription_plan', planId);
      }
      
      setShowSubscriptionPlans(false);
      
      // Analytics event
      if (typeof window !== 'undefined' && 'gtag' in window) {
        const prices: Record<string, number> = {
          'pro': 9990,
          'lite': 4990,
          'free': 0
        };
        
        (window as any).gtag('event', 'purchase', {
          transaction_id: Date.now().toString(),
          value: prices[planId] || 0,
          currency: 'USD',
          user_id: session?.user?.id,
          items: [{
            item_id: planId,
            item_name: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
            category: 'subscription'
          }]
        });
      }

      toast.success(`🎉 Welcome to ${planId.charAt(0).toUpperCase() + planId.slice(1)}! New features unlocked.`);
    } catch (error) {
      console.error('Failed to update subscription:', error);
      toast.error('Failed to activate subscription');
    }
  };

  // Context-aware FAB handlers
  const handleAddTask = () => {
    try {
      plannerRef.current?.handleNewTask();
    } catch (error) {
      console.error('Failed to add task:', error);
      toast.error('Failed to create task');
    }
  };

  const handleAddTransaction = () => {
    try {
      financeRef.current?.handleNewTransaction();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error('Failed to create transaction');
    }
  };

  const handleAddWorkout = () => {
    try {
      workoutRef.current?.handleNewWorkout();
    } catch (error) {
      console.error('Failed to add workout:', error);
      toast.error('Failed to create workout');
    }
  };

  const renderCurrentSection = () => {
    const sectionProps = {
      subscriptionPlan,
      onUpgrade: () => setShowSubscriptionPlans(true),
      userData: session?.user || null
    };

    switch (currentMode) {
      case 'planner':
        return <PlannerSection 
          {...sectionProps} 
          ref={plannerRef}
        />;
      case 'finance':
        return <FinanceSection 
          {...sectionProps} 
          ref={financeRef}
        />;
      case 'workout':
        return <WorkoutSection 
          {...sectionProps} 
          ref={workoutRef}
        />;
      default:
        return <PlannerSection 
          {...sectionProps} 
          ref={plannerRef}
        />;
    }
  };

  // Show loading state while checking authentication
  if (isPending || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0b0d] to-[#0f1114] flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={iosSpring.gentle}
        >
          {/* Brand spinner (money green) */}
          <motion.div
            className="w-16 h-16 border-4 border-money-green/30 border-t-money-green rounded-full mx-auto mb-6"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          {/* Removed progress line per request */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2
              className="text-xl font-bold text-money-green mb-2"
              style={{ textShadow: "0 0 14px rgba(0,213,99,0.45)" }}
            >
              Artilect Assistant
            </h2>
            <p className="text-muted-foreground">Preparing your productivity dashboard...</p>
            {session?.user && (
              <p className="text-sm text-white/60 mt-2">Welcome back, {session.user.name}! 👋</p>
            )}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Don't render main app if not authenticated
  if (!session?.user) {
    return null;
  }

  return (
    <HapticProvider>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0b0d] to-[#0f1114]">
        <AnimatePresence mode="wait">
          {showOnboarding ? (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={iosSpring.gentle}
            >
              <OnboardingWizard onComplete={handleOnboardingComplete} />
            </motion.div>
          ) : (
            <motion.div
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={iosSpring.gentle}
            >
              <AppShell
                onModeChange={handleModeChange}
                initialMode={currentMode}
                className="min-h-screen"
                subscriptionPlan={subscriptionPlan}
                onShowSubscription={() => setShowSubscriptionPlans(true)}
                userData={session.user}
                onAddTask={handleAddTask}
                onAddTransaction={handleAddTransaction}
                onAddWorkout={handleAddWorkout}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMode}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={iosSpring.gentle}
                  >
                    {renderCurrentSection()}
                  </motion.div>
                </AnimatePresence>
              </AppShell>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subscription Plans Modal */}
        <SlideUpModal
          isOpen={showSubscriptionPlans}
          onClose={() => setShowSubscriptionPlans(false)}
          className="max-w-6xl mx-auto max-h-[95vh] overflow-y-auto"
        >
          <PremiumSubscriptionPlans 
            onSelectPlan={handleSubscriptionSelect}
            currentPlan={subscriptionPlan}
          />
        </SlideUpModal>

        {/* Upgrade Prompt Modal */}
        <SlideUpModal
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          title={t('pricing.upgradePrompt.title')}
        >
          <div className="space-y-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={iosSpring.bouncy}
              className="w-20 h-20 bg-money-gradient rounded-full flex items-center justify-center mx-auto"
            >
              <Crown className="w-10 h-10 text-[#0a0b0d]" />
            </motion.div>

            <div>
              <h3 className="text-xl font-bold mb-2">
                {t('pricing.upgradePrompt.usedFeatures', { count: usageCount })}
              </h3>
              <p className="text-muted-foreground">
                {t('pricing.upgradePrompt.subtitle')}
              </p>
            </div>

            <motion.div
              className="glass-card p-4 rounded-xl space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-money-green/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-money-green" />
                </div>
                <span className="text-sm">{t('pricing.upgradePrompt.features.analytics')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-money-green/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-money-green" />
                </div>
                <span className="text-sm">{t('pricing.upgradePrompt.features.planning')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-money-green/20 rounded-lg flex items-center justify-center">
                  <Crown className="w-4 h-4 text-money-green" />
                </div>
                <span className="text-sm">{t('pricing.upgradePrompt.features.unlimited')}</span>
              </div>
            </motion.div>

            <div className="space-y-3">
              <Button
                onClick={handleUpgrade}
                className="w-full bg-money-gradient hover:shadow-money text-[#0a0b0d] font-semibold h-12"
                size="lg"
              >
                <Crown className="w-5 h-5 mr-2" />
                {t('pricing.upgradePrompt.viewPlans')}
              </Button>
              
              <Button
                variant="ghost"
                onClick={(event: React.MouseEvent) => {
                  event?.preventDefault();
                  setShowUpgradePrompt(false);
                }}
                className="w-full text-muted-foreground"
              >
                {t('pricing.upgradePrompt.maybeLater')}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('pricing.upgradePrompt.footerLine')}
            </p>
          </div>
        </SlideUpModal>
      </div>
    </HapticProvider>
  );
}