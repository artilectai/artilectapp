"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { 
  Crown, 
  Zap, 
  Star, 
  Shield, 
  Clock, 
  TrendingUp,
  Lock,
  Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScaleButton, iosSpring } from "@/components/iOSAnimations";
import { openTelegramSupport } from "@/lib/telegram";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice?: number;
  currency: string;
  badge?: string;
  badgeColor?: string;
  popular?: boolean;
  bestValue?: boolean;
  features: string[];
  limitations?: string[];
  trialDays?: number;
  description: string;
  entitlements: {
    planner: string;
    finance: string;
    workout: string;
    extras?: string[];
  };
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    currency: "UZS",
    description: "Perfect for getting started",
    features: [
      "Unlimited tasks",
      "1 finance account", 
      "50 transactions/month",
      "1 workout program",
      "Daily plans only",
      "Basic features"
    ],
    limitations: [
      "No charts or analytics",
      "No AI assistance",
      "No exports or PDFs",
      "No advanced features"
    ],
    entitlements: {
      planner: "Unlimited tasks; no charts, no AI",
      finance: "1 account, 50 tx/mo, only daily plans",
      workout: "1 program, no advanced charts"
    }
  },
  {
    id: "lite",
    name: "Lite",
    monthlyPrice: 9990,
    annualPrice: 99900,
    currency: "UZS",
    badge: "Most Popular",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    popular: true,
    description: "Essential productivity features",
    features: [
      "Weekly & monthly views",
      "Basic charts & analytics",
      "Up to 5 finance accounts",
      "Budget tracking",
      "CSV export",
      "Category pie charts",
      "Unlimited workout programs",
      "Workout timers",
      "Basic workout charts"
    ],
    limitations: [
      "No PDFs",
      "No advanced analytics",
      "Limited AI features"
    ],
    entitlements: {
      planner: "Weekly/monthly views + basic charts",
      finance: "Up to 5 accounts, budgets, CSV export, category pie",
      workout: "Unlimited programs, timers, basic charts",
      extras: ["No PDFs", "No advanced analytics", "Limited AI"]
    }
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 19990,
    annualPrice: 199900,
    currency: "UZS",
    badge: "Best Value",
    badgeColor: "bg-money-gradient text-[#0a0b0d]",
    bestValue: true,
    trialDays: 7,
    description: "Ultimate productivity powerhouse",
    features: [
      "AI weekly plan & review summaries",
      "Advanced charts & analytics",
      "Unlimited finance accounts",
      "PDF monthly reports",
      "Advanced charts (cashflow/balances)",
      "Google Sheets auto-sync",
      "Macros pie charts",
      "Volume trends tracking",
      "PDF workout plans",
      "Premium templates library",
      "Priority support"
    ],
    entitlements: {
      planner: "AI weekly plan & review summaries, advanced charts",
      finance: "Unlimited accounts, PDF monthly report, advanced charts (cashflow/balances), Sheets auto-sync",
      workout: "Macros pie, volume trends, PDF plans",
      extras: ["Templates library", "Priority support"]
    }
  }
];

interface SubscriptionPlansProps {
  onSelectPlan: (planId: string, billing?: 'monthly' | 'annual') => void;
  currentPlan?: string;
  showUpgradePrompt?: boolean;
  contextualTrigger?: 'finance-second-account' | 'export-attempt' | 'pdf-attempt' | 'streak-nudge';
}

export function PremiumSubscriptionPlans({ 
  onSelectPlan, 
  currentPlan = "free", 
  showUpgradePrompt = false,
  contextualTrigger 
}: SubscriptionPlansProps) {
  const { t } = useTranslation('app');
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [trialCountdown, setTrialCountdown] = useState<number>(0);

  // Redirect helper: open Telegram support chat
  const redirectToTelegramSupport = () => openTelegramSupport('artilectsupport');

  // Simulate trial countdown for Pro plan
  useEffect(() => {
    if (currentPlan === 'pro-trial') {
      const interval = setInterval(() => {
        setTrialCountdown(prev => {
          // Simulate countdown from 7 days
          const hoursLeft = 24 * 7 - (Date.now() % (24 * 7 * 60 * 60 * 1000)) / (60 * 60 * 1000);
          return Math.floor(hoursLeft);
        });
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [currentPlan]);

  const handlePlanSelect = async (planId: string) => {
    if (planId === currentPlan) return;

    // For paid plans, redirect to Telegram support chat instead of checkout.
    const selected = plans.find(p => p.id === planId);
    if (selected && selected.monthlyPrice > 0) {
      setIsLoading(true);
      redirectToTelegramSupport();
      // Stop further processing; upgrade handled via support
      setTimeout(() => setIsLoading(false), 800);
      return;
    }

    // Free plan: apply immediately
    setIsLoading(true);
    try {
      onSelectPlan(planId, billingPeriod);
      toast.success(t('toasts.app.subscriptionActivated', { plan: t(`plans.${planId}`) }));
    } catch (error) {
      toast.error(t('toasts.app.activateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return t('plans.free');
    return new Intl.NumberFormat('uz-UZ').format(price) + " " + currency;
  };

  const getAnnualSavings = (monthly: number, annual: number) => {
    if (!annual || monthly === 0) return 0;
    const monthlyTotal = monthly * 12;
    const savings = monthlyTotal - annual;
    const monthsEquivalent = savings / monthly;
    return Math.round(monthsEquivalent * 10) / 10; // Round to 1 decimal
  };

  const getContextualMessage = () => {
    switch (contextualTrigger) {
      case 'finance-second-account':
        return {
          title: t('pricing.context.financeSecondAccount.title'),
          subtitle: t('pricing.context.financeSecondAccount.subtitle'),
          highlightPlan: 'lite'
        };
      case 'export-attempt':
        return {
          title: t('pricing.context.exportAttempt.title'),
          subtitle: t('pricing.context.exportAttempt.subtitle'),
          highlightPlan: 'lite'
        };
      case 'pdf-attempt':
        return {
          title: t('pricing.context.pdfAttempt.title'),
          subtitle: t('pricing.context.pdfAttempt.subtitle'),
          highlightPlan: 'pro'
        };
      case 'streak-nudge':
        return {
          title: t('pricing.context.streakNudge.title'),
          subtitle: t('pricing.context.streakNudge.subtitle'),
          highlightPlan: 'pro'
        };
      default:
        return {
          title: t('pricing.context.default.title'),
          subtitle: t('pricing.context.default.subtitle')
        };
    }
  };

  const contextualMsg = getContextualMessage();

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <motion.div 
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={iosSpring.gentle}
      >
        <motion.div
          className="inline-flex items-center gap-2 bg-money-gradient px-4 py-2 rounded-full text-[#0a0b0d] font-semibold mb-6"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Crown className="w-5 h-5" />
          <span>{t('pricing.banner')}</span>
        </motion.div>
        
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          {contextualMsg.title}
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {contextualMsg.subtitle}
        </p>

        {/* Billing Toggle */}
        <motion.div 
          className="flex items-center justify-center gap-4 mt-8 p-1 bg-surface-1 rounded-xl border border-border w-fit mx-auto"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-money-gradient text-[#0a0b0d] shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('pricing.billing.monthly')}
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all relative ${
              billingPeriod === 'annual'
                ? 'bg-money-gradient text-[#0a0b0d] shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('pricing.billing.annual')}
            <Badge className="absolute -top-2 -right-2 bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
              {t('pricing.billing.fixedMonthsFree')}
            </Badge>
          </button>
        </motion.div>

  {/* Social Proof removed per request */}
      </motion.div>

      {/* Trial Countdown for Pro Trial Users */}
      {currentPlan === 'pro-trial' && trialCountdown > 0 && (
        <motion.div
          className="mb-8 p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: [1, 1.02, 1] }}
          transition={{ opacity: { duration: 0.3 }, scale: { repeat: Infinity, repeatType: "loop", duration: 2 } }}
        >
          <div className="flex items-center justify-center gap-2 text-orange-400 mb-2">
            <Clock className="w-5 h-5" />
            <span className="font-bold text-lg">{t('pricing.trial.endsInHours', { hours: trialCountdown })}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('pricing.trial.upgradePrompt')}
          </p>
        </motion.div>
      )}
      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {plans.map((plan, index) => {
          const isCurrentPlan = plan.id === currentPlan;
          const isHighlighted = contextualMsg.highlightPlan === plan.id;
          const currentPrice = billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const savings = plan.annualPrice ? getAnnualSavings(plan.monthlyPrice, plan.annualPrice) : 0;
          
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring.gentle, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className={`relative ${plan.bestValue ? 'md:scale-105' : ''} ${isHighlighted ? 'ring-2 ring-money-green' : ''}`}
            >
              {/* Badge (localized) */}
              {(() => {
                const badgeLabel = plan.popular
                  ? t('pricing.badges.mostPopular')
                  : plan.bestValue
                    ? t('pricing.badges.bestValue')
                    : null;
                return badgeLabel ? (
                  <motion.div
                    className={`absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-semibold ${plan.badgeColor} backdrop-blur-sm z-10`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
                  >
                    {badgeLabel}
                  </motion.div>
                ) : null;
              })()}

              <Card className={`
                relative overflow-hidden h-full transition-all duration-300
                ${plan.bestValue || isHighlighted
                  ? 'bg-gradient-to-br from-surface-1 to-surface-2 border-money-gradient-border shadow-money' 
                  : 'bg-surface-1 border-border hover:border-primary/30'
                }
              `}>
                {/* Background Pattern */}
                {(plan.bestValue || isHighlighted) && (
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5" />
                )}

                <CardHeader className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-2xl font-bold">{t(`plans.${plan.id}`)}</CardTitle>
                    {isCurrentPlan && (
                      <Badge variant="outline" className="text-green-400 border-green-400">
                        {t('pricing.badges.current')}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">
                        {formatPrice(currentPrice || 0, plan.currency)}
                      </span>
            {plan.monthlyPrice > 0 && (
                        <span className="text-muted-foreground">
              /{billingPeriod === 'annual' ? t('pricing.billing.periodSuffix.year') : t('pricing.billing.periodSuffix.month')}
                        </span>
                      )}
                    </div>
                    
                    {billingPeriod === 'annual' && savings > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              {t('pricing.billing.monthsFree', { count: savings })}
                        </Badge>
                      </div>
                    )}
                  </div>

          <p className="text-muted-foreground mt-4">{t(`pricing.plans.${plan.id}.description`)}</p>
                </CardHeader>

                <CardContent className="relative space-y-6">
                  {/* Entitlements */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-green-400 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        {t('pricing.entitlements.planner')}
                      </h4>
                      <p className="text-sm text-muted-foreground">{t(`pricing.plans.${plan.id}.entitlements.planner`)}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-blue-400 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        {t('pricing.entitlements.finance')}
                      </h4>
                      <p className="text-sm text-muted-foreground">{t(`pricing.plans.${plan.id}.entitlements.finance`)}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-purple-400 flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        {t('pricing.entitlements.workout')}
                      </h4>
                      <p className="text-sm text-muted-foreground">{t(`pricing.plans.${plan.id}.entitlements.workout`)}</p>
                    </div>

                    {plan.entitlements.extras && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-orange-400 flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          {t('pricing.entitlements.extras')}
                        </h4>
                        <p className="text-sm text-muted-foreground">{t(`pricing.plans.${plan.id}.entitlements.extras.0`)}, {t(`pricing.plans.${plan.id}.entitlements.extras.1`)}</p>
                      </div>
                    )}
                  </div>

                  {/* Limitations for Free Plan */}
          {plan.limitations && (
                    <>
                      <Separator />
                      <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold">{t('pricing.limitations.title')}</p>
            {plan.limitations.map((_, limIndex) => (
                          <div key={limIndex} className="flex items-center gap-3">
                            <Lock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t(`pricing.plans.${plan.id}.limitations.${limIndex}`)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* CTA Button */}
                  <ScaleButton
                    onClick={() => handlePlanSelect(plan.id)}
                    disabled={isCurrentPlan || isLoading}
                    className={`
                      w-full h-12 font-semibold transition-all duration-300 rounded-lg
                      ${plan.bestValue || isHighlighted
                        ? 'bg-money-gradient hover:shadow-money text-[#0a0b0d]'
                        : plan.popular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-surface-2 hover:bg-surface-3 text-foreground border'
                      }
                      ${isCurrentPlan ? 'opacity-50' : ''}
                      ${isLoading ? 'opacity-75' : ''}
                    `}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <motion.div
                          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        {t('pricing.cta.processing')}
                      </div>
                    ) : isCurrentPlan ? (
                      t('pricing.cta.current')
                    ) : plan.monthlyPrice === 0 ? (
                      t('pricing.cta.getStartedFree')
                    ) : plan.trialDays ? (
                      t('pricing.cta.startTrial', { days: plan.trialDays })
                    ) : (
                      t('pricing.cta.upgradeNow')
                    )}
                  </ScaleButton>

                  {/* Trust Indicators */}
                  {plan.monthlyPrice > 0 && (
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>{t('pricing.trust.secure')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{t('pricing.trust.instant')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>{t('pricing.trust.guaranteed')}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Payment / Trust Section (tidy, symmetric) */}
      <motion.div
        className="text-center space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {/* Trust badges row as symmetric 3-col grid */}
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span>{t('pricing.footer.moneyBackGuarantee')}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-blue-400" />
            <span>{t('pricing.footer.securePayments')}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>{t('pricing.footer.instantActivation')}</span>
          </div>
        </div>

        {/* Payment brands, centered */}
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('pricing.footer.securePaymentsLabel')}</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="px-3 py-1 bg-surface-2/80 border border-border/40 rounded-md text-xs">{t('pricing.footer.brands.uzcard')}</div>
            <div className="px-3 py-1 bg-surface-2/80 border border-border/40 rounded-md text-xs">{t('pricing.footer.brands.humo')}</div>
            <div className="px-3 py-1 bg-surface-2/80 border border-border/40 rounded-md text-xs">{t('pricing.footer.brands.visa')}</div>
            <div className="px-3 py-1 bg-surface-2/80 border border-border/40 rounded-md text-xs">{t('pricing.footer.brands.mastercard')}</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground max-w-3xl mx-auto">
          {t('pricing.footer.disclaimer')}
        </p>
      </motion.div>
    </div>
  );
}