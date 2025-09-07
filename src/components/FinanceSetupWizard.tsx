"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScaleButton } from '@/components/iOSAnimations';
import { 
  Wallet, 
  CreditCard, 
  Building2, 
  Bitcoin, 
  Plus, 
  ArrowRight, 
  ArrowLeft, 
  Check,
  TrendingUp,
  TrendingDown,
  Coffee,
  Car,
  Home,
  ShoppingBag,
  Heart,
  Gamepad2,
  Briefcase,
  DollarSign,
  Gift
} from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: 'cash' | 'card' | 'bank' | 'crypto';
  balance: number;
  color: string;
  isDefault: boolean;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  isCustom: boolean;
}

interface FinanceSetupWizardProps {
  onComplete: (data: {
    currency: string;
    accounts: Account[];
    categories: Category[];
  }) => void;
  onAddAccount: (account: Account) => void;
  onAddCategory: (category: Category) => void;
}

const CURRENCIES = [
  { code: 'UZS', symbol: 'UZS', name: 'Uzbekistan Som' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' }
];

const ACCOUNT_TYPES = [
  { type: 'cash' as const, icon: Wallet, label: 'Cash', color: '#10B981' },
  { type: 'card' as const, icon: CreditCard, label: 'Card', color: '#3B82F6' },
  { type: 'bank' as const, icon: Building2, label: 'Bank', color: '#8B5CF6' },
  { type: 'crypto' as const, icon: Bitcoin, label: 'Crypto', color: '#F59E0B' }
];

const ACCOUNT_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', 
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16'
];

const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Salary', icon: 'Briefcase', color: '#10B981' },
    { name: 'Freelance', icon: 'DollarSign', color: '#3B82F6' },
    { name: 'Investment', icon: 'TrendingUp', color: '#8B5CF6' },
    { name: 'Gift', icon: 'Gift', color: '#EC4899' }
  ],
  expense: [
    { name: 'Food & Drinks', icon: 'Coffee', color: '#F59E0B' },
    { name: 'Transport', icon: 'Car', color: '#06B6D4' },
    { name: 'Shopping', icon: 'ShoppingBag', color: '#EF4444' },
    { name: 'Housing', icon: 'Home', color: '#84CC16' },
    { name: 'Healthcare', icon: 'Heart', color: '#EC4899' },
    { name: 'Entertainment', icon: 'Gamepad2', color: '#8B5CF6' }
  ]
};

const formatCurrency = (amount: number, currency: string): string => {
  if (currency === 'UZS') {
    // Show like: UZS 1,000,000 (no "so'm" word)
    return 'UZS ' + new Intl.NumberFormat('uz-UZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
  
  const currencyData = CURRENCIES.find(c => c.code === currency);
  return (currencyData?.symbol || '') + new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const FinanceSetupWizard: React.FC<FinanceSetupWizardProps> = ({
  onComplete,
  onAddAccount,
  onAddCategory
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [currency, setCurrency] = useState('UZS');
    const { t } = useTranslation('app');
    const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2: Account creation state
  const [newAccount, setNewAccount] = useState<{
    name: string;
    type: 'cash' | 'card' | 'bank' | 'crypto';
    balance: string;
    color: string;
    isDefault: boolean;
  }>({
    name: '',
    type: 'cash',
    balance: '',
    color: ACCOUNT_COLORS[0],
    isDefault: false
  });

  // Step 4: Custom category state
  const [newCategory, setNewCategory] = useState<{
    name: string;
    type: 'income' | 'expense';
    icon: string;
    color: string;
  }>({
    name: '',
    type: 'expense',
    icon: 'ShoppingBag',
    color: ACCOUNT_COLORS[0]
  });

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        if (!currency) {
          newErrors.currency = 'Please select a currency';
        }
        break;
      case 2:
        if (accounts.length === 0) {
          newErrors.accounts = 'Please add at least one account';
        }
        break;
      case 3:
        // Balances are optional, no validation needed
        break;
      case 4:
        // Categories have defaults, no validation needed
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currency, accounts]);

  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  }, [currentStep, validateStep]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  const addAccount = useCallback(() => {
    if (!newAccount.name.trim()) {
      setErrors({ accountName: 'Account name is required' });
      return;
    }

    const balance = parseFloat(newAccount.balance) || 0;
    if (balance < 0) {
      setErrors({ accountBalance: 'Balance must be positive' });
      return;
    }

    const account: Account = {
      id: `account_${Date.now()}`,
      name: newAccount.name.trim(),
      type: newAccount.type,
      balance,
      color: newAccount.color,
      isDefault: accounts.length === 0 || newAccount.isDefault
    };

    setAccounts(prev => {
      const updated = newAccount.isDefault 
        ? prev.map(acc => ({ ...acc, isDefault: false })).concat(account)
        : prev.concat(account);
      return updated;
    });

    onAddAccount(account);
    
    setNewAccount({
      name: '',
      type: 'cash',
      balance: '',
      color: ACCOUNT_COLORS[0],
      isDefault: false
    });
    setErrors({});
  }, [newAccount, accounts, onAddAccount]);

  const addCustomCategory = useCallback(() => {
    if (!newCategory.name.trim()) {
      setErrors({ categoryName: 'Category name is required' });
      return;
    }

    const category: Category = {
      id: `category_${Date.now()}`,
      name: newCategory.name.trim(),
      type: newCategory.type,
      icon: newCategory.icon,
      color: newCategory.color,
      isCustom: true
    };

    setCategories(prev => prev.concat(category));
    onAddCategory(category);
    
    setNewCategory({
      name: '',
      type: 'expense',
      icon: 'ShoppingBag',
      color: ACCOUNT_COLORS[0]
    });
    setErrors({});
  }, [newCategory, onAddCategory]);

  const initializeDefaultCategories = useCallback(() => {
    const defaultCats: Category[] = [];
    
    Object.entries(DEFAULT_CATEGORIES).forEach(([type, cats]) => {
      cats.forEach((cat, index) => {
        defaultCats.push({
          id: `${type}_${index}`,
          name: cat.name,
          type: type as 'income' | 'expense',
          icon: cat.icon,
          color: cat.color,
          isCustom: false
        });
      });
    });
    
    setCategories(defaultCats);
  }, []);

  const completeSetup = useCallback(() => {
    if (categories.length === 0) {
      initializeDefaultCategories();
    }
    
    onComplete({
      currency,
      accounts,
      categories: categories.length > 0 ? categories : []
    });
  }, [currency, accounts, categories, onComplete, initializeDefaultCategories]);

  const progress = (currentStep / 4) * 100;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                Choose Your Currency
              </h2>
              <p className="text-muted-foreground">
                Select your primary currency for financial tracking
              </p>
            </div>

            <div className="space-y-3">
              {CURRENCIES.map((curr) => (
                <ScaleButton
                  key={curr.code}
                  onClick={() => setCurrency(curr.code)}
                  className="w-full"
                >
                  <Card className={`glass-card p-4 cursor-pointer transition-all duration-200 ${
                    currency === curr.code 
                      ? 'border-money-green shadow-money' 
                      : 'border-border hover:border-money-green/50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          currency === curr.code ? 'bg-money-gradient text-black' : 'bg-surface-2 text-foreground'
                        }`}>
                          {curr.symbol}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">
                            {curr.code}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {curr.name}
                          </div>
                        </div>
                      </div>
                      {currency === curr.code && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 bg-money-green rounded-full flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 text-black" />
                        </motion.div>
                      )}
                    </div>
                  </Card>
                </ScaleButton>
              ))}
            </div>

            {errors.currency && (
              <p className="text-destructive text-sm text-center">{errors.currency}</p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                Add Your Accounts
              </h2>
              <p className="text-muted-foreground">
                Set up your financial accounts to track money
              </p>
            </div>

            <Card className="glass-card p-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    placeholder="e.g., Main Wallet, Credit Card"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1"
                  />
                  {errors.accountName && (
                    <p className="text-destructive text-sm mt-1">{errors.accountName}</p>
                  )}
                </div>

                <div>
                  <Label>Account Type</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {ACCOUNT_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <ScaleButton
                          key={type.type}
                          onClick={() => setNewAccount(prev => ({ ...prev, type: type.type }))}
                        >
                          <div className={`p-3 rounded-lg border-2 transition-all ${
                            newAccount.type === type.type
                              ? 'border-money-green bg-money-green/10'
                              : 'border-border bg-surface-2'
                          }`}>
                            <Icon className="w-5 h-5 mb-1" style={{ color: type.color }} />
                            <div className="text-sm font-medium">{type.label}</div>
                          </div>
                        </ScaleButton>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label htmlFor="accountBalance">Opening Balance</Label>
                  <Input
                    id="accountBalance"
                    type="number"
                    placeholder="0"
                    value={newAccount.balance}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, balance: e.target.value }))}
                    className="mt-1"
                  />
                  {errors.accountBalance && (
                    <p className="text-destructive text-sm mt-1">{errors.accountBalance}</p>
                  )}
                </div>

                <div>
                  <Label>Color</Label>
                  <div className="flex space-x-2 mt-2">
                    {ACCOUNT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewAccount(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-full border-2 ${
                          newAccount.color === color ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <ScaleButton onClick={addAccount} className="w-full">
                  <Button asChild className="w-full bg-money-gradient hover:bg-money-gradient/80 text-black">
                    <span>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Account
                    </span>
                  </Button>
                </ScaleButton>
              </div>
            </Card>

            {accounts.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Added Accounts</h3>
                {accounts.map((account) => {
                  const accountType = ACCOUNT_TYPES.find(t => t.type === account.type);
                  const Icon = accountType?.icon || Wallet;
                  
                  return (
                    <Card key={account.id} className="glass-card p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: account.color + '20' }}
                          >
                            <Icon className="w-5 h-5" style={{ color: account.color }} />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{account.name}</div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {account.type}
                              {account.isDefault && ' • Default'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-foreground">
                            {formatCurrency(account.balance, currency)}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {errors.accounts && (
              <p className="text-destructive text-sm text-center">{errors.accounts}</p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                Set Opening Balances
              </h2>
              <p className="text-muted-foreground">
                Update your account balances if needed
              </p>
            </div>

            <div className="space-y-3">
              {accounts.map((account) => {
                const accountType = ACCOUNT_TYPES.find(t => t.type === account.type);
                const Icon = accountType?.icon || Wallet;
                
                return (
                  <Card key={account.id} className="glass-card p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: account.color + '20' }}
                      >
                        <Icon className="w-5 h-5" style={{ color: account.color }} />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{account.name}</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {account.type}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor={`balance_${account.id}`}>Current Balance</Label>
                      <Input
                        id={`balance_${account.id}`}
                        type="number"
                        placeholder="0"
                        value={account.balance}
                        onChange={(e) => {
                          const newBalance = parseFloat(e.target.value) || 0;
                          setAccounts(prev => prev.map(acc => 
                            acc.id === account.id ? { ...acc, balance: newBalance } : acc
                          ));
                        }}
                        className="mt-1"
                      />
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="glass-card p-4 bg-money-green/5 border-money-green/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-money-gradient rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-black" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Total Balance</div>
                  <div className="text-2xl font-bold text-money-green">
                    {formatCurrency(accounts.reduce((sum, acc) => sum + acc.balance, 0), currency)}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case 4:
        const incomeCategories = categories.filter(c => c.type === 'income');
        const expenseCategories = categories.filter(c => c.type === 'expense');
        
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                Set Up Categories
              </h2>
              <p className="text-muted-foreground">
                We've added common categories. Add custom ones if needed.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-money-green" />
                  <h3 className="font-semibold text-foreground">Income Categories</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_CATEGORIES.income.map((cat, index) => (
                    <Card key={`income_${index}`} className="glass-card p-3">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: cat.color + '20' }}
                        >
                          <Briefcase className="w-4 h-4" style={{ color: cat.color }} />
                        </div>
                        <span className="text-sm font-medium text-foreground">{t(`finance.categoryNames.${cat.name.toLowerCase().replace(/\s+/g, '_')}`, { defaultValue: cat.name })}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                  <h3 className="font-semibold text-foreground">Expense Categories</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_CATEGORIES.expense.map((cat, index) => (
                    <Card key={`expense_${index}`} className="glass-card p-3">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: cat.color + '20' }}
                        >
                          <Coffee className="w-4 h-4" style={{ color: cat.color }} />
                        </div>
                        <span className="text-sm font-medium text-foreground">{t(`finance.categoryNames.${cat.name.toLowerCase().replace(/\s+/g, '_')}`, { defaultValue: cat.name })}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            <Card className="glass-card p-4">
              <h3 className="font-semibold text-foreground mb-3">Add Custom Category</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input
                    id="categoryName"
                    placeholder="e.g., Pet Care, Education"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1"
                  />
                  {errors.categoryName && (
                    <p className="text-destructive text-sm mt-1">{errors.categoryName}</p>
                  )}
                </div>

                <div>
                  <Label>Type</Label>
                  <Select value={newCategory.type} onValueChange={(value: 'income' | 'expense') => 
                    setNewCategory(prev => ({ ...prev, type: value }))
                  }>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Color</Label>
                  <div className="flex space-x-2 mt-2">
                    {ACCOUNT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewCategory(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-full border-2 ${
                          newCategory.color === color ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <ScaleButton onClick={addCustomCategory} className="w-full">
                  <Button variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Custom Category
                  </Button>
                </ScaleButton>
              </div>
            </Card>

            {categories.filter(c => c.isCustom).length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">Custom Categories</h3>
                <div className="space-y-2">
                  {categories.filter(c => c.isCustom).map((category) => (
                    <Card key={category.id} className="glass-card p-3">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: category.color + '20' }}
                        >
                          <ShoppingBag className="w-4 h-4" style={{ color: category.color }} />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{category.name}</span>
                          <span className="text-sm text-muted-foreground ml-2 capitalize">
                            ({category.type})
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md h-[100dvh] max-h-[100dvh] flex flex-col">
        <Card className="glass-card flex flex-col h-full max-h-[100dvh] overflow-hidden">
          {/* Progress Header - Fixed */}
          <div className="p-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-lg font-heading font-bold text-foreground">
                Finance Setup
              </h1>
              <span className="text-sm text-muted-foreground">
                {currentStep} of 4
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Content - Scrollable with proper constraints */}
          <div className="flex-1 overflow-hidden min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 pb-2">
                <AnimatePresence mode="wait" custom={currentStep}>
                  <motion.div
                    key={currentStep}
                    custom={currentStep}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 }
                    }}
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Navigation - Fixed with safe area */}
          <div className="p-4 pt-2 border-t border-border flex-shrink-0 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <ScaleButton onClick={prevStep} disabled={currentStep === 1}>
                <Button variant="outline" disabled={currentStep === 1} className="min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </ScaleButton>

              <ScaleButton 
                onClick={currentStep === 4 ? completeSetup : nextStep}
                className="ml-auto"
              >
                <Button className="bg-money-gradient hover:bg-money-gradient/80 text-black min-h-[44px]">
                  {currentStep === 4 ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Complete Setup
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </ScaleButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};