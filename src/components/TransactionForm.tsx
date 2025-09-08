"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, DollarSign, Upload, X, Plus, Minus, ArrowRight, ArrowLeft, Tag, Hash, Search } from 'lucide-react';
import { ScaleButton } from '@/components/iOSAnimations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateStepper } from '@/components/ui/date-stepper';
import { useTranslation } from 'react-i18next';

// Type definitions
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash';
  balance: number;
  currency: string;
  color?: string;
  icon?: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category?: Category;
  description: string;
  date: Date;
  accountId: string;
  toAccountId?: string;
  tags: string[];
  attachments?: File[];
}

interface TransactionFormProps {
  accounts: Account[];
  onSave: (transaction: Partial<OutgoingTransaction>) => void;
  onCancel: () => void;
  defaultDate: Date;
  initialTransaction?: Partial<Transaction>;
  currency?: 'UZS' | 'USD' | 'EUR' | 'RUB';
}

// Outgoing payload shape expected by FinanceSection (category as string)
type OutgoingTransaction = {
  id?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  category?: string; // name string
  description?: string;
  date?: Date;
  accountId?: string;
  toAccountId?: string;
  tags?: string[];
  attachments?: File[];
};

// Default categories - simplified for mobile
const defaultCategories: Record<'income' | 'expense', Category[]> = {
  income: [
  { id: 'salary', name: 'Salary', type: 'income', icon: '💼', color: '#10B981' },
  { id: 'business', name: 'Business', type: 'income', icon: '🏢', color: '#059669' },
  { id: 'investment', name: 'Investment', type: 'income', icon: '📈', color: '#34D399' },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: '💻', color: '#6EE7B7' },
  { id: 'other-income', name: 'Other', type: 'income', icon: '💰', color: '#A7F3D0' },
  ],
  expense: [
  { id: 'food', name: 'Food', type: 'expense', icon: '🍽️', color: '#EF4444' },
  { id: 'transport', name: 'Transport', type: 'expense', icon: '🚗', color: '#F97316' },
  { id: 'shopping', name: 'Shopping', type: 'expense', icon: '🛍️', color: '#8B5CF6' },
  { id: 'bills', name: 'Bills', type: 'expense', icon: '⚡', color: '#3B82F6' },
  { id: 'entertainment', name: 'Fun', type: 'expense', icon: '🎬', color: '#EC4899' },
  { id: 'health', name: 'Health', type: 'expense', icon: '🏥', color: '#06B6D4' },
  { id: 'education', name: 'Education', type: 'expense', icon: '📚', color: '#84CC16' },
  { id: 'other-expense', name: 'Other', type: 'expense', icon: '💸', color: '#6B7280' },
  ]
};

// Quick amount presets for UZS - mobile optimized
const quickAmounts = [
  { label: '10K', value: 10000 },
  { label: '50K', value: 50000 },
  { label: '100K', value: 100000 },
  { label: '500K', value: 500000 },
];

// Currency formatting helpers will be created inside the component to use the selected currency

const formatAmount = (value: string): string => {
  const numericValue = value.replace(/[^\d]/g, '');
  if (!numericValue) return '';
  return Number(numericValue).toLocaleString('uz-UZ');
};

export const TransactionForm: React.FC<TransactionFormProps> = ({
  accounts,
  onSave,
  onCancel,
  defaultDate,
  initialTransaction,
  currency: propCurrency
}) => {
  const { i18n, t } = useTranslation('app');
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
  const intlLocale = lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-UZ' : 'en-US';
  const fmtDate = new Intl.DateTimeFormat(intlLocale);
  const currentCurrency: 'UZS' | 'USD' | 'EUR' | 'RUB' = propCurrency || 'UZS';

  const getCurrencySymbol = useCallback((curr: 'UZS' | 'USD' | 'EUR' | 'RUB') => {
    switch (curr) {
      case 'UZS':
        return 'UZS';
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      case 'RUB':
        return '₽';
      default:
        return '';
    }
  }, []);

  const formatCurrency = useCallback((amount: number, curr: 'UZS' | 'USD' | 'EUR' | 'RUB' = currentCurrency): string => {
    if (curr === 'UZS') return 'UZS ' + new Intl.NumberFormat('uz-UZ').format(amount);
    const symbol = getCurrencySymbol(curr);
    return symbol + new Intl.NumberFormat('en-US').format(amount);
  }, [currentCurrency, getCurrencySymbol]);

  const [formData, setFormData] = useState<Partial<Transaction>>({
    amount: 0,
    type: 'expense',
    description: '',
    date: defaultDate,
    accountId: accounts[0]?.id || '',
    tags: [],
    ...initialTransaction
  });

  const [amountInput, setAmountInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1); // Multi-step for mobile
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [isDateOpen, setIsDateOpen] = useState(false);

  // Initialize amount input
  useEffect(() => {
    if (formData.amount) {
      setAmountInput(formatAmount(formData.amount.toString()));
    }
  }, [formData.amount]);

  const availableCategories = defaultCategories[formData.type as 'income' | 'expense'] || [];

  const updateFormData = useCallback((field: keyof Transaction, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const handleAmountChange = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, '');
    setAmountInput(formatAmount(numericValue));
    updateFormData('amount', Number(numericValue));
  };

  const handleQuickAmount = (amount: number) => {
    setAmountInput(formatAmount(amount.toString()));
    updateFormData('amount', amount);
  };

  const handleTypeChange = (type: 'income' | 'expense' | 'transfer') => {
    updateFormData('type', type);
    updateFormData('category', undefined);
    updateFormData('toAccountId', undefined);
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.amount || formData.amount <= 0) {
  newErrors.amount = t('finance.transactions.form.errors.amountRequired');
      }
      if (!formData.type) {
  newErrors.type = t('finance.transactions.form.errors.typeRequired');
      }
    }

    if (currentStep === 2) {
      // Description is now optional - no validation needed
      if (formData.type !== 'transfer' && !formData.category) {
  newErrors.category = t('finance.transactions.form.errors.categoryRequired');
      }
    }

    if (currentStep === 3) {
      if (!formData.accountId) {
  newErrors.accountId = t('finance.transactions.form.errors.accountRequired');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSave = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setIsLoading(true);
    try {
      // Set category from selected category for non-transfer transactions
  const transactionData: Partial<OutgoingTransaction> & { category?: any } = {
        ...formData,
        // FinanceSection expects a string category; our Transaction type uses object. Cast for interop.
        category: formData.type !== 'transfer' ? (formData.category?.name as unknown as any) : undefined,
      };
      await onSave(transactionData);
    } catch (error) {
      console.error('Failed to save transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle custom category creation
  const handleCreateCustomCategory = () => {
    if (!customCategoryName.trim()) return;
    
    const newCategory: Category = {
      id: `custom-${Date.now()}`,
      name: customCategoryName.trim(),
      type: formData.type as 'income' | 'expense',
      icon: formData.type === 'income' ? '💰' : '💸',
      color: formData.type === 'income' ? '#10B981' : '#EF4444'
    };
    
    setCustomCategories(prev => [...prev, newCategory]);
    updateFormData('category', newCategory);
    setCustomCategoryName('');
    setShowCustomCategory(false);
  };

  const getAllCategories = () => {
    const defaultCats = defaultCategories[formData.type as 'income' | 'expense'] || [];
    const typedCustomCats = customCategories.filter(cat => cat.type === formData.type);
    // Map default category display names via i18n when rendering
    return [...defaultCats, ...typedCustomCats];
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Amount Section */}
            <div className="text-center">
              <label className="text-sm text-muted-foreground mb-4 block">{t('finance.transactions.form.amount.howMuch')}</label>
              <div className="relative mb-6">
                <Input
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className={cn(
                    "text-4xl text-center font-bold bg-transparent border-none text-money-green h-20",
                    "focus-visible:ring-2 focus-visible:ring-money-green/50",
                    errors.amount && "text-destructive"
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                  {currentCurrency}
                </span>
              </div>
              {errors.amount && (
                <p className="text-destructive text-sm mb-4">{errors.amount}</p>
              )}

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((preset) => (
                  <ScaleButton
                    key={preset.value}
                    onClick={() => handleQuickAmount(preset.value)}
                  >
                    <div className="p-3 bg-surface-1 rounded-xl text-center text-sm font-medium hover:bg-surface-2 transition-colors">
                      {preset.label}
                    </div>
                  </ScaleButton>
                ))}
              </div>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="text-sm text-muted-foreground mb-3 block">{t('finance.transactions.form.type.label')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: 'expense', label: t('finance.transactions.form.type.expense'), icon: Minus, color: 'text-red-400', bgColor: 'bg-red-500/10' },
                  { type: 'income', label: t('finance.transactions.form.type.income'), icon: Plus, color: 'text-money-green', bgColor: 'bg-money-green/10' }
                ].map(({ type, label, icon: Icon, color, bgColor }) => (
                  <ScaleButton
                    key={type}
                    onClick={() => handleTypeChange(type as any)}
                  >
                    <div className={cn(
                      "p-4 rounded-xl border-2 transition-all",
                      formData.type === type
                        ? `${bgColor} border-money-green`
                        : "bg-surface-1 border-border hover:bg-surface-2"
                    )}>
                      <Icon size={24} className={cn("mx-auto mb-2", color)} />
                      <div className="text-sm font-medium text-center">{label}</div>
                    </div>
                  </ScaleButton>
                ))}
              </div>
              {errors.type && (
                <p className="text-destructive text-sm mt-2">{errors.type}</p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Description */}
            <div>
              <label className="text-sm text-muted-foreground mb-3 block">{t('finance.transactions.form.description.label')} {t('finance.transactions.form.description.optional')}</label>
              <Input
                value={formData.description || ''}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder={t('finance.transactions.form.description.placeholder')}
                className={cn(
                  "h-12 bg-surface-1 border-border rounded-xl",
                  errors.description && "border-destructive"
                )}
              />
              {errors.description && (
                <p className="text-destructive text-sm mt-1">{errors.description}</p>
              )}
            </div>

            {/* Category Selection (for income/expense) */}
            {formData.type !== 'transfer' && (
              <div>
                <label className="text-sm text-muted-foreground mb-3 block">{t('finance.transactions.form.category.label')}</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {getAllCategories().map((category) => (
                    <ScaleButton
                      key={category.id}
                      onClick={() => {
                        updateFormData('category', category);
                        setShowCustomCategory(false);
                      }}
                    >
                      <div className={cn(
                        "p-3 rounded-xl border-2 transition-all text-left",
                        formData.category?.id === category.id
                          ? "border-money-green bg-money-green/10"
                          : "border-border bg-surface-1 hover:bg-surface-2"
                      )}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{category.icon}</span>
                          <span className="text-sm font-medium truncate">{t(`finance.categoryNames.${category.id.replace(/-/g, '_')}`, { defaultValue: category.name })}</span>
                        </div>
                      </div>
                    </ScaleButton>
                  ))}
                  
                  {/* Custom Category Button */}
                  <ScaleButton
                    onClick={() => {
                      setShowCustomCategory(true);
                      updateFormData('category', undefined);
                    }}
                  >
                    <div className={cn(
                      "p-3 rounded-xl border-2 transition-all text-left",
                      showCustomCategory
                        ? "border-money-green bg-money-green/10"
                        : "border-dashed border-border bg-surface-1 hover:bg-surface-2"
                    )}>
                      <div className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">{t('finance.transactions.form.category.custom')}</span>
                      </div>
                    </div>
                  </ScaleButton>
                </div>

                {/* Custom Category Input */}
                {showCustomCategory && (
                  <div className="space-y-3 p-4 bg-surface-1 rounded-xl border-2 border-money-green/30">
                    <label className="text-sm text-muted-foreground block">{t('finance.transactions.form.category.create')}</label>
                    <div className="flex gap-2">
                      <Input
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        placeholder={t('finance.transactions.form.category.namePlaceholder')}
                        className="flex-1 h-10 bg-surface-2 border-border rounded-lg"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateCustomCategory();
                          }
                        }}
                      />
                      <ScaleButton onClick={handleCreateCustomCategory} disabled={!customCategoryName.trim()}>
                        <Button asChild size="sm" className="h-10 px-3 bg-money-gradient text-black font-semibold" disabled={!customCategoryName.trim()}>
                          <span>{t('common.add')}</span>
                        </Button>
                      </ScaleButton>
                    </div>
                    <ScaleButton onClick={() => setShowCustomCategory(false)}>
                      <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground">
                        <span>{t('common.cancel')}</span>
                      </Button>
                    </ScaleButton>
                  </div>
                )}

                {errors.category && (
                  <p className="text-destructive text-sm mt-2">{errors.category}</p>
                )}
              </div>
            )}

            {/* Date */}
<div>
  <label className="text-sm text-muted-foreground mb-3 block">{t('finance.transactions.form.date.label')}</label>
  <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 bg-surface-1 border-border rounded-xl
                   justify-start text-left font-normal flex items-center gap-3"
      >
        <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="truncate">
          {formData.date ? fmtDate.format(formData.date) : t('planner.editor.pickDate')}
        </span>
      </Button>
    </PopoverTrigger>

    <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e)=>e.preventDefault()}>
      <DateStepper
        value={formData.date || new Date()}
        onChange={(date: Date) => updateFormData('date', date)}
        onDone={(date: Date) => {
          updateFormData('date', date);
          setIsDateOpen(false);
        }}
        minYear={new Date().getFullYear() - 6}
        maxYear={new Date().getFullYear() + 6}
      />
    </PopoverContent>
  </Popover>
</div>

          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Account Selection */}
            <div>
              <label className="text-sm text-muted-foreground mb-3 block">{t('finance.transactions.form.account.label')}</label>
              <Select
                value={formData.accountId}
                onValueChange={(value) => updateFormData('accountId', value)}
              >
                <SelectTrigger className={cn(
                  "h-14 bg-surface-1 border-border rounded-xl",
                  errors.accountId && "border-destructive"
                )}>
                  <SelectValue placeholder={t('finance.transactions.form.account.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{account.name}</span>
                        <span className="text-sm text-muted-foreground ml-4">
                          {formatCurrency(account.balance, (account.currency as any) || currentCurrency)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && (
                <p className="text-destructive text-sm mt-1">{errors.accountId}</p>
              )}
            </div>

            {/* Summary */}
            <div className="p-4 bg-surface-1 rounded-xl">
              <h3 className="font-medium mb-3">{t('finance.transactions.form.summary.title')}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.form.summary.amount')}</span>
                  <span className={cn(
                    "font-bold",
                    formData.type === 'income' ? 'text-money-green' : 'text-red-400'
                  )}>
                    {formData.type === 'income' ? '+' : '-'}{formatCurrency(formData.amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.form.summary.type')}</span>
                  <span className="capitalize">{formData.type === 'income' ? t('finance.transactions.form.type.income') : formData.type === 'expense' ? t('finance.transactions.form.type.expense') : 'transfer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.form.summary.description')}</span>
                  <span className="truncate max-w-32">{formData.description || '-'}</span>
                </div>
                {formData.category && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('finance.transactions.form.summary.category')}</span>
                    <span>{t(`finance.categoryNames.${formData.category.id.replace(/-/g, '_')}`, { defaultValue: formData.category.name })}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.form.summary.account')}</span>
                  <span>{accounts.find(a => a.id === formData.accountId)?.name || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Step Progress */}
      <div className="p-4 border-b border-border/20">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            {step === 1 ? t('finance.transactions.form.steps.amountAndType') : step === 2 ? t('finance.transactions.form.steps.details') : t('finance.transactions.form.steps.accountAndConfirm')}
          </h2>
          <span className="text-sm text-muted-foreground">
            {t('finance.transactions.form.stepCounter', { step, total: 3 })}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 flex-1 rounded-full transition-colors",
                s <= step ? "bg-money-green" : "bg-surface-2"
              )}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderStep()}
      </div>

      {/* Navigation */}
  <div className="p-4 border-t border-border/20 bg-surface-1">
        <div className="flex gap-3">
          {step > 1 && (
            <ScaleButton onClick={prevStep} className="flex-1">
        <Button asChild variant="outline" className="w-full h-12 rounded-xl">
                <span>
                  <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
                </span>
              </Button>
            </ScaleButton>
          )}
          
          {step < 3 ? (
            <ScaleButton onClick={nextStep} className="flex-1">
              <Button asChild className="w-full h-12 rounded-xl bg-money-gradient text-black font-semibold">
                <span>
          {t('common.next')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </span>
              </Button>
            </ScaleButton>
          ) : (
            <ScaleButton onClick={handleSave} className="flex-1" disabled={isLoading}>
              <Button asChild className="w-full h-12 rounded-xl bg-money-gradient text-black font-semibold" disabled={isLoading}>
                <span>
          {isLoading ? t('finance.transactions.form.actions.saving') : t('finance.transactions.form.actions.save')}
                </span>
              </Button>
            </ScaleButton>
          )}
        </div>
        
        {step === 1 && (
          <ScaleButton onClick={onCancel} className="w-full mt-2">
            <Button asChild variant="ghost" className="w-full h-10 rounded-xl">
        <span>{t('common.cancel')}</span>
            </Button>
          </ScaleButton>
        )}
      </div>
    </div>
  );
};