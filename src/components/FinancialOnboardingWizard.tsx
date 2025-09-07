"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ArrowRight, ArrowLeft, X, Wallet, CreditCard, Building, Coins, Sparkles, TrendingUp, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { FinanceDataManager } from '@/lib/finance-data-manager';

// Types
interface Account {
  id: string;
  name: string;
  type: 'cash' | 'card' | 'bank' | 'crypto';
  balance: number;
  currency: string;
  createdAt: Date;
}

interface OnboardingData {
  currency: string;
  accountName: string;
  accountType: 'cash' | 'card' | 'bank' | 'crypto';
  initialBalance: number;
}

interface FinanceOnboardingWizardProps {
  onComplete: (accountData: Account) => void;
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
}

interface AccountType {
  id: 'cash' | 'card' | 'bank' | 'crypto';
  name: string;
  icon: React.ReactNode;
  description: string;
  suggestions: string[];
}

// Constants
const CURRENCIES: Currency[] = [
  { code: 'UZS', symbol: 'UZS', name: 'Uzbekistan Som' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' }
];

const ACCOUNT_TYPES: AccountType[] = [
  {
    id: 'cash',
  name: 'Cash',
    icon: <Wallet className="w-6 h-6" />,
  description: 'Physical money and petty cash',
  suggestions: ['Cash Wallet', 'Petty Cash', 'Emergency Fund']
  },
  {
    id: 'card',
  name: 'Card',
    icon: <CreditCard className="w-6 h-6" />,
  description: 'Debit and credit cards',
  suggestions: ['Main Card', 'Debit Card', 'Credit Card']
  },
  {
    id: 'bank',
  name: 'Bank Account',
    icon: <Building className="w-6 h-6" />,
  description: 'Bank savings and checking accounts',
  suggestions: ['Main Account', 'Savings Account', 'Checking Account']
  },
  {
    id: 'crypto',
  name: 'Crypto',
    icon: <Coins className="w-6 h-6" />,
  description: 'Cryptocurrency wallets',
  suggestions: ['Crypto Wallet', 'Bitcoin Wallet', 'Trading Account']
  }
];

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'currency', title: 'Currency' },
  { id: 'account', title: 'Account Setup' },
  { id: 'categories', title: 'Categories' },
  { id: 'ready', title: 'Ready' }
];

export const FinanceOnboardingWizard: React.FC<FinanceOnboardingWizardProps> = ({
  onComplete
}) => {
  const { t } = useTranslation('app');
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    currency: 'USD',
    accountName: '',
    accountType: 'cash',
    initialBalance: 0
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(10); } catch {}
      }
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentStep, onboardingData]);

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 1: // Currency selection
        if (!onboardingData.currency) {
          newErrors.currency = t('finance.onboarding.steps.errors.selectCurrency');
        }
        break;
      case 2: // Account setup
        if (!onboardingData.accountName.trim()) {
          newErrors.accountName = t('finance.onboarding.steps.errors.accountNameRequired');
        }
        if (onboardingData.accountName.length > 50) {
          newErrors.accountName = t('finance.onboarding.steps.errors.accountNameMaxLen');
        }
        if (!onboardingData.accountType) {
          newErrors.accountType = t('finance.onboarding.steps.errors.selectAccountType');
        }
        if (onboardingData.initialBalance < 0) {
          newErrors.initialBalance = t('finance.onboarding.steps.errors.balanceNonNegative');
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      triggerHaptic();
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setIsAnimating(true);
      triggerHaptic();
      
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsAnimating(false);
      }, 200);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      triggerHaptic();
      
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleComplete = async () => {
    try {
      const newAccount: Account = {
        id: Date.now().toString(),
        name: onboardingData.accountName,
        type: onboardingData.accountType,
        balance: onboardingData.initialBalance,
        currency: onboardingData.currency,
        createdAt: new Date()
      };

      await FinanceDataManager.addAccount({ ...(newAccount as any), isConnected: false } as any);
      await FinanceDataManager.markSetupComplete();
      
      toast.success(t('toasts.finance.setupCompleted'));

      onComplete(newAccount);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error(t('common.warning'), {
        description: t('toasts.app.activateFailed')
      });
    }
  };

  const handleAccountTypeSelect = (type: 'cash' | 'card' | 'bank' | 'crypto') => {
    const accountType = ACCOUNT_TYPES.find(t => t.id === type);
    setOnboardingData(prev => ({
      ...prev,
      accountType: type,
      accountName: prev.accountName || accountType?.suggestions[0] || ''
    }));
    triggerHaptic();
  };

  const formatCurrency = (amount: number, currency: string) => {
    const currencyObj = CURRENCIES.find(c => c.code === currency);
    if (currency === 'UZS') return `UZS ${amount.toLocaleString()}`;
    return `${currencyObj?.symbol}${amount.toLocaleString()}`;
  };

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-20 h-20 bg-money-gradient rounded-full flex items-center justify-center ios-bounce">
        <Sparkles className="w-10 h-10 text-black" />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-heading font-bold text-foreground">
          {t('finance.onboarding.steps.welcome.title')}
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          {t('finance.onboarding.steps.welcome.subtitle')}
        </p>
      </div>
      
      <div className="grid gap-4 mt-8">
        <div className="flex items-center gap-3 p-4 glass-card rounded-lg">
          <TrendingUp className="w-6 h-6 text-money-green" />
          <div className="text-left">
            <p className="font-medium text-foreground">{t('finance.onboarding.steps.welcome.cards.trackEverything.title')}</p>
            <p className="text-sm text-muted-foreground">{t('finance.onboarding.steps.welcome.cards.trackEverything.desc')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 glass-card rounded-lg">
          <Shield className="w-6 h-6 text-money-green" />
          <div className="text-left">
            <p className="font-medium text-foreground">{t('finance.onboarding.steps.welcome.cards.staySecure.title')}</p>
            <p className="text-sm text-muted-foreground">{t('finance.onboarding.steps.welcome.cards.staySecure.desc')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 glass-card rounded-lg">
          <Zap className="w-6 h-6 text-money-green" />
          <div className="text-left">
            <p className="font-medium text-foreground">{t('finance.onboarding.steps.welcome.cards.getInsights.title')}</p>
            <p className="text-sm text-muted-foreground">{t('finance.onboarding.steps.welcome.cards.getInsights.desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrencyStep = () => (
    <div className="space-y-6 max-w-[420px] mx-auto">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-heading font-bold text-foreground">
          {t('finance.onboarding.steps.currency.title')}
        </h2>
        <p className="text-muted-foreground">
          {t('finance.onboarding.steps.currency.subtitle')}
        </p>
      </div>
      
      <div className="space-y-3">
        <Label htmlFor="currency">{t('finance.onboarding.steps.currency.label')}</Label>
        <Select
          value={onboardingData.currency}
          onValueChange={(value) => {
            setOnboardingData(prev => ({ ...prev, currency: value }));
            setErrors(prev => ({ ...prev, currency: '' }));
            triggerHaptic();
          }}
        >
          <SelectTrigger className="h-12 w-full">
            {/* Closed-state: avoid duplicate UZS UZS */}
            <div className="flex items-center gap-2">
              {onboardingData.currency === 'UZS' ? (
                <span className="font-medium">UZS</span>
              ) : (
                <>
                  <span className="font-mono text-base w-5 text-center">
                    {CURRENCIES.find(c => c.code === onboardingData.currency)?.symbol}
                  </span>
                  <span className="font-medium">
                    {CURRENCIES.find(c => c.code === onboardingData.currency)?.code}
                  </span>
                </>
              )}
            </div>
          </SelectTrigger>
          <SelectContent className="w-[--radix-select-trigger-width] min-w-[--radix-select-trigger-width] max-h-64 overflow-y-auto">
            {CURRENCIES.map((currency) => (
              <SelectItem key={currency.code} value={currency.code}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-lg w-8 shrink-0 text-center">{currency.symbol}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{currency.code}</p>
                    <p className="text-sm text-muted-foreground truncate">{t(`finance.setup.currencies.${currency.code}`)}</p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.currency && (
          <p className="text-sm text-destructive">{errors.currency}</p>
        )}
      </div>
      
      {onboardingData.currency && (
        <div className="p-4 glass-card rounded-lg ios-scale-in">
          <p className="text-sm text-muted-foreground mb-2">{t('finance.onboarding.steps.currency.preview')}</p>
          <div className="text-2xl font-bold text-money-green truncate">
            {formatCurrency(1000, onboardingData.currency)}
          </div>
        </div>
      )}
    </div>
  );

  const renderAccountStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-heading font-bold text-foreground">
          {t('finance.onboarding.steps.account.title')}
        </h2>
        <p className="text-muted-foreground">
          {t('finance.onboarding.steps.account.subtitle')}
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="accountType">{t('finance.onboarding.steps.account.typeLabel')}</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {ACCOUNT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleAccountTypeSelect(type.id)}
                className={`p-4 rounded-lg border-2 transition-all ios-spring ${
                  onboardingData.accountType === type.id
                    ? 'border-money-green bg-money-green/10 shadow-money'
                    : 'border-border hover:border-muted-foreground glass-card'
                }`}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className={`${onboardingData.accountType === type.id ? 'text-money-green' : 'text-muted-foreground'}`}>
                    {type.icon}
                  </div>
                  <div>
                    <p className={`font-medium ${onboardingData.accountType === type.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {t(`finance.setup.accounts.types.${type.id}`)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(`finance.onboarding.steps.account.types.${type.id}.desc`)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {errors.accountType && (
            <p className="text-sm text-destructive mt-2">{errors.accountType}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="accountName">{t('finance.onboarding.steps.account.nameLabel')}</Label>
          <Input
            id="accountName"
            placeholder={t('finance.onboarding.steps.account.namePlaceholder')}
            value={onboardingData.accountName}
            onChange={(e) => {
              setOnboardingData(prev => ({ ...prev, accountName: e.target.value }));
              setErrors(prev => ({ ...prev, accountName: '' }));
            }}
            className="h-12"
          />
          {errors.accountName && (
            <p className="text-sm text-destructive">{errors.accountName}</p>
          )}
          
          {onboardingData.accountType && (
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_TYPES.find(t => t.id === onboardingData.accountType)?.suggestions.map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="cursor-pointer hover:bg-money-green/10 hover:border-money-green transition-colors"
                  onClick={() => {
                    setOnboardingData(prev => ({ ...prev, accountName: suggestion }));
                    triggerHaptic();
                  }}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="initialBalance">{t('finance.onboarding.steps.account.initialBalanceOptional')}</Label>
          <div className="relative">
            <Input
              id="initialBalance"
              type="number"
              placeholder="0"
              value={onboardingData.initialBalance || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setOnboardingData(prev => ({ ...prev, initialBalance: value }));
                setErrors(prev => ({ ...prev, initialBalance: '' }));
              }}
              className="h-12 pr-16"
              min="0"
              step="0.01"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
              {onboardingData.currency}
            </span>
          </div>
          {errors.initialBalance && (
            <p className="text-sm text-destructive">{errors.initialBalance}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {t('finance.onboarding.steps.account.balanceHelp')}
          </p>
        </div>
      </div>
    </div>
  );

  const renderCategoriesStep = () => (
    <div className="text-center space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-heading font-bold text-foreground">
          {t('finance.onboarding.steps.categories.title')}
        </h2>
        <p className="text-muted-foreground">
          {t('finance.onboarding.steps.categories.subtitle')}
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: t('finance.onboarding.steps.categories.names.foodDining'), emoji: '🍽️', color: 'bg-orange-500/20 border-orange-500/30' },
          { name: t('finance.onboarding.steps.categories.names.transportation'), emoji: '🚗', color: 'bg-blue-500/20 border-blue-500/30' },
          { name: t('finance.onboarding.steps.categories.names.shopping'), emoji: '🛍️', color: 'bg-purple-500/20 border-purple-500/30' },
          { name: t('finance.onboarding.steps.categories.names.entertainment'), emoji: '🎬', color: 'bg-pink-500/20 border-pink-500/30' },
          { name: t('finance.onboarding.steps.categories.names.billsUtilities'), emoji: '⚡', color: 'bg-yellow-500/20 border-yellow-500/30' },
          { name: t('finance.onboarding.steps.categories.names.healthcare'), emoji: '🏥', color: 'bg-red-500/20 border-red-500/30' }
        ].map((category, index) => (
          <div
            key={category.name}
            className={`p-4 rounded-lg border glass-card ${category.color} ios-slide-up`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="text-2xl mb-2">{category.emoji}</div>
            <p className="text-sm font-medium text-foreground">{category.name}</p>
          </div>
        ))}
      </div>
      
      <div className="p-4 glass-card rounded-lg">
        <p className="text-sm text-muted-foreground">
          💡 <strong>{t('finance.onboarding.steps.categories.tipLabel')}</strong> {t('finance.onboarding.steps.categories.tip')}
        </p>
      </div>
    </div>
  );

  const renderReadyStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-20 h-20 bg-money-gradient rounded-full flex items-center justify-center ios-bounce">
        <CheckCircle className="w-10 h-10 text-black" />
      </div>
      
      <div className="space-y-3">
        <h2 className="text-2xl font-heading font-bold text-foreground">
          {t('finance.onboarding.steps.ready.title')}
        </h2>
        <p className="text-muted-foreground">
          {t('finance.onboarding.steps.ready.subtitle')}
        </p>
      </div>
      
      <div className="space-y-3">
        <div className="p-4 glass-card rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('finance.onboarding.steps.ready.summary.currency')}</span>
            <span className="font-medium text-foreground">{onboardingData.currency}</span>
          </div>
        </div>
        
        <div className="p-4 glass-card rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('finance.onboarding.steps.ready.summary.firstAccount')}</span>
            <span className="font-medium text-foreground">{onboardingData.accountName}</span>
          </div>
        </div>
        
        <div className="p-4 glass-card rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('finance.onboarding.steps.ready.summary.accountType')}</span>
            <span className="font-medium text-foreground">{t(`finance.setup.accounts.types.${onboardingData.accountType}`)}</span>
          </div>
        </div>
        
        <div className="p-4 glass-card rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('finance.onboarding.steps.ready.summary.startingBalance')}</span>
            <span className="font-medium text-money-green">
              {formatCurrency(onboardingData.initialBalance, onboardingData.currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderWelcomeStep();
      case 1: return renderCurrencyStep();
      case 2: return renderAccountStep();
      case 3: return renderCategoriesStep();
      case 4: return renderReadyStep();
      default: return renderWelcomeStep();
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center px-4"
      style={{
        // Keep content clear of top bar and bottom nav (approx 84px) with safe-area support
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)'
      }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index <= currentStep ? 'bg-money-green' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          
          {/* Skip removed to enforce gating */}
        </div>

        {/* Progress */}
        <Progress value={progress} className="mb-8" />

        {/* Content */}
        <Card className={`glass-card border-none transition-all duration-300 ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
          <CardContent className="p-6">
            {currentStep === 0 ? (
              renderStepContent()
            ) : (
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                {renderStepContent()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0 || isAnimating}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('buttons.back', { defaultValue: 'Back' })}
          </Button>

          <Button
            onClick={handleNext}
            disabled={isAnimating}
            className="bg-money-gradient hover:opacity-90 transition-opacity flex items-center gap-2 min-w-[100px]"
          >
            {currentStep === STEPS.length - 1 ? (
              t('buttons.getStarted', { defaultValue: 'Get Started' })
            ) : (
              <>
                {t('buttons.continue', { defaultValue: 'Continue' })}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};