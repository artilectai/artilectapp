"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { pushBackAction, popBackAction } from '@/lib/telegram-backstack';
import { X, Check, Star, Crown, Zap, Shield, TrendingUp, PiggyBank, FileText, Users, Calendar, BarChart3, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTelegramBack } from '@/hooks/useTelegramBack';

// Local fallback implementations for ios-like animations
const ScaleButton = ({ onPress, children }: { onPress: () => void; children: React.ReactNode }) => (
  <motion.div
    whileTap={{ scale: 0.96 }}
    onClick={onPress}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress();
      }
    }}
  >
    {children}
  </motion.div>
);

const SlideUpModal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  // Register a back action with Telegram so the top-right Close becomes Back while open
  useEffect(() => {
    if (!isOpen) return;
    const action = () => onClose();
    pushBackAction(action);
    return () => {
      popBackAction(action);
    };
  }, [isOpen, onClose]);

  // Support Escape key to close (desktop/Telegram web)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div
            className="absolute inset-x-0 bottom-0"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface PaywallSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planId: string, isAnnual: boolean) => void;
  currentPlan?: string;
  contextualTrigger?: 'finance-second-account' | 'export-attempt' | 'pdf-attempt' | 'streak-nudge';
}

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
  bestValue?: boolean;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Basic expense tracking',
      'Simple budget planning',
      '1 financial account',
      'Weekly reports',
      'Basic workout logging',
      'Community access'
    ],
    icon: <Shield className="h-5 w-5" />
  },
  {
    id: 'lite',
    name: 'Lite',
    monthlyPrice: 9990,
    annualPrice: 99900,
    badge: 'Most Popular',
    badgeVariant: 'default',
    popular: true,
    features: [
      'Advanced expense categories',
      'Multiple budget goals',
      '3 financial accounts',
      'Daily insights & trends',
      'PDF export capability',
      'Premium workout plans'
    ],
    icon: <TrendingUp className="h-5 w-5" />
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 19990,
    annualPrice: 199900,
    badge: 'Best Value',
    badgeVariant: 'secondary',
    bestValue: true,
    features: [
      'Unlimited accounts & goals',
      'Advanced analytics & forecasting',
      'Custom categories & tags',
      'Priority support',
      'Team collaboration',
      'AI-powered insights'
    ],
    icon: <Crown className="h-5 w-5" />
  }
];

const paymentMethods = [
  { name: 'Uzcard', logo: '💳' },
  { name: 'Humo', logo: '💳' },
  { name: 'Visa', logo: '💳' },
  { name: 'Mastercard', logo: '💳' }
];

const contextualMessages = {
  'finance-second-account': {
    title: 'Add Another Account',
    subtitle: 'Track multiple accounts with Lite or Pro',
    highlightPlan: 'lite'
  },
  'export-attempt': {
    title: 'Export Your Data',
    subtitle: 'Generate PDF reports with premium plans',
    highlightPlan: 'lite'
  },
  'pdf-attempt': {
    title: 'PDF Reports Available',
    subtitle: 'Create professional financial reports',
    highlightPlan: 'lite'
  },
  'streak-nudge': {
    title: 'Keep Your Streak Going',
    subtitle: 'Unlock advanced tracking to maintain momentum',
    highlightPlan: 'pro'
  }
};

export const PaywallSheet = ({
  isOpen,
  onClose,
  onSelectPlan,
  currentPlan = 'free',
  contextualTrigger
}: PaywallSheetProps) => {
  const { t } = useTranslation('app');
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Telegram Back button integration: show Back when paywall is open
  useTelegramBack(isOpen, onClose);

  const contextualMessage = contextualTrigger ? contextualMessages[contextualTrigger] : null;

  const formatPrice = (price: number, isAnnual: boolean) => {
    if (price === 0) return 'Free';
    const displayPrice = isAnnual ? Math.floor(price / 12) : price;
    return `${displayPrice.toLocaleString()} UZS`;
  };

  const calculateSavings = (monthlyPrice: number, annualPrice: number) => {
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - annualPrice;
    const monthsFree = Math.floor(savings / monthlyPrice * 10) / 10;
    return monthsFree;
  };

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlan) return;
    
    setSelectedPlan(planId);
    setIsLoading(true);
    
    // Haptic feedback
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(50); } catch {}
    }
    
    try {
      // Paid plans go to checkout to collect card details
      if (planId !== 'free') {
        const billing = isAnnual ? 'annual' : 'monthly';
        router.push(`/checkout?plan=${planId}&billing=${billing}`);
        onClose();
      } else {
        await new Promise(resolve => setTimeout(resolve, 400));
        onSelectPlan(planId, isAnnual);
        onClose();
      }
    } catch (error) {
      console.error('Plan selection failed:', error);
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  const getPlanButtonText = (plan: Plan) => {
    if (plan.id === currentPlan) return 'Current Plan';
    if (selectedPlan === plan.id && isLoading) return 'Processing...';
    if (plan.id === 'free') return 'Downgrade';
    return 'Upgrade Now';
  };

  const isPlanDisabled = (plan: Plan) => {
    return plan.id === currentPlan || isLoading;
  };

  return (
    <SlideUpModal isOpen={isOpen} onClose={onClose}>
  <div className="relative bg-card rounded-t-3xl min-h-[85lvh] max-h-[90lvh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex-1">
              {contextualMessage ? (
                <div>
                  <h2 className="text-xl font-bold text-foreground font-heading">
                    {contextualMessage.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {contextualMessage.subtitle}
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold text-foreground font-heading">
                    Choose Your Plan
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Unlock premium features and insights
                  </p>
                </div>
              )}
            </div>
            <ScaleButton onPress={onClose}>
              <div className="p-2 rounded-full bg-muted/50 hover:bg-muted/70 transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </div>
            </ScaleButton>
          </div>

          {/* Billing Toggle */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-center">
              <div className="bg-muted rounded-full p-1 flex items-center">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    !isAnnual 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all relative ${
                    isAnnual 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Annual
                  {isAnnual && (
                    <Badge className="absolute -top-2 -right-2 bg-money-green text-black text-xs px-2 py-0.5">
                      ~2 months free
                    </Badge>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Plans */}
          <div className="space-y-4 mb-8">
            {plans.map((plan, index) => {
              const isHighlighted = contextualMessage?.highlightPlan === plan.id;
              const monthsFree = plan.annualPrice > 0 ? calculateSavings(plan.monthlyPrice, plan.annualPrice) : 0;
              
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`relative p-4 transition-all duration-200 ${
                    isHighlighted 
                      ? 'border-money-green shadow-money bg-money-green/5' 
                      : plan.popular 
                        ? 'border-money-green/50 bg-money-green/5' 
                        : 'border-border hover:border-border/70'
                  }`}>
                    {/* Badges (localized) */}
          {(plan.popular || plan.bestValue) && (
                      <Badge 
                        className={`absolute -top-2 left-4 ${
                          plan.popular ? 'bg-money-green text-black' : 'bg-gold text-black'
                        }`}
                      >
            {plan.popular ? t('pricing.badges.mostPopular') : t('pricing.badges.bestValue')}
                      </Badge>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          plan.popular ? 'bg-money-green/20' : 'bg-muted/50'
                        }`}>
                          {plan.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-foreground font-heading">
                            {plan.name}
                          </h3>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold text-money-green">
                              {formatPrice(isAnnual ? plan.annualPrice : plan.monthlyPrice, isAnnual)}
                            </span>
                            {plan.id !== 'free' && (
                              <span className="text-sm text-muted-foreground">
                                /{isAnnual ? 'year' : 'month'}
                              </span>
                            )}
                          </div>
                          {isAnnual && monthsFree > 0 && (
                            <p className="text-xs text-money-green mt-1">
                              Save ~{monthsFree} months
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2 mb-4">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-money-green flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <ScaleButton onPress={() => handleSelectPlan(plan.id)}>
                      <Button
                        className={`w-full ${
                          plan.popular || isHighlighted
                            ? 'bg-money-green hover:bg-money-dark text-black'
                            : plan.bestValue
                              ? 'bg-gold hover:bg-gold/90 text-black'
                              : 'bg-muted hover:bg-muted/80 text-foreground'
                        } ${isPlanDisabled(plan) ? 'opacity-50 cursor-not-allowed' : ''} rounded-lg`}
                        disabled={isPlanDisabled(plan)}
                      >
                        {selectedPlan === plan.id && isLoading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            <span>Processing...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            {plan.id === currentPlan ? (
                              <Check className="h-4 w-4" />
                            ) : plan.id === 'free' ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                            <span>{getPlanButtonText(plan)}</span>
                          </div>
                        )}
                      </Button>
                    </ScaleButton>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Payment Methods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <p className="text-sm text-muted-foreground mb-3">
              Secure payment with
            </p>
            <div className="flex items-center justify-center space-x-3">
              {paymentMethods.map((method, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-1 px-3 py-2 bg-muted/30 rounded-lg"
                >
                  <span className="text-lg">{method.logo}</span>
                  <span className="text-xs text-muted-foreground">{method.name}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Cancel anytime • 30-day money-back guarantee
            </p>
          </motion.div>
        </div>

        {/* Bottom Safe Area */}
        <div className="h-safe-area-inset-bottom bg-card" />
      </div>
    </SlideUpModal>
  );
};