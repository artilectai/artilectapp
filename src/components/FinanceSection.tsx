"use client";

import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import { 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Eye,
  EyeOff,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Target,
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Filter,
  Search,
  X,
  History,
  Lock,
  Crown
} from "lucide-react";
import { Trash2 } from "lucide-react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// Planner-style date picker
import { DateStepper } from "@/components/ui/date-stepper";
import { FinancialAnalyst } from "@/components/FinancialAnalyst";
import { TransactionForm } from "@/components/TransactionForm";
import { ScaleButton, SlideUpModal } from "@/components/iOSAnimations";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  Legend
} from 'recharts';
// import { CustomCalendar } from "@/components/ui/calendar-custom"; // Replaced by DateStepper for finance flows
import { FinanceOnboardingWizard } from "@/components/FinancialOnboardingWizard";
import { FinanceDataManager as FinanceStore } from "@/lib/finance-data-manager";
import { supabase } from "@/lib/supabase/client";
import { createAccount as createAccountAction } from "@/app/actions/finance/accounts";
import { useSession } from "@/lib/supabase/useSession";

// Types
interface Account {
  id: string;
  name: string;
  // Allow custom account types in addition to the defaults
  type: "cash" | "card" | "bank" | "crypto" | string;
  balance: number;
  color: string;
  isDefault: boolean;
  createdAt: Date;
}

interface Transaction {
  id: string;
  accountId: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: Date;
  tags: string[];
}

interface Budget {
  id: string;
  category: string;
  limit: number;
  // 'spent' stored in DB but we will recompute dynamically from transactions for the active date range
  spent: number;
  currency: string;
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  startDate?: Date; // inclusive
  endDate?: Date;   // exclusive boundary (start + period)
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date;
  category: string;
}

type TimePeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
type TransactionType = "all" | "income" | "expense" | "transfer";
type AmountRange = "all" | "under_100" | "100_500" | "500_1000" | "over_1000";

// Data manager
class FinanceLocalManager {
  private static instance: FinanceLocalManager;
  
  static getInstance(): FinanceLocalManager {
    if (!FinanceLocalManager.instance) {
      FinanceLocalManager.instance = new FinanceLocalManager();
    }
    return FinanceLocalManager.instance;
  }

  saveData<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`finance_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
    }
  }

  loadData<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(`finance_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.error(`Failed to load ${key}:`, error);
      return defaultValue;
    }
  }

  isSetupComplete(): boolean {
    return FinanceStore.isSetupComplete();
  }

  markSetupComplete(): void {
    try {
      localStorage.setItem('finance_setup_completed', 'true');
      FinanceStore.markSetupComplete();
    } catch (error) {
      console.error('Failed to mark setup complete:', error);
    }
  }
}

interface FinanceSectionProps {
  subscriptionPlan?: 'free' | 'lite' | 'pro';
  onUpgrade?: () => void;
}

export interface FinanceSectionRef {
  handleNewTransaction: () => void;
}

const FinanceSection = forwardRef<FinanceSectionRef, FinanceSectionProps>(
  ({ subscriptionPlan = 'free', onUpgrade }, ref) => {
  const { t, i18n } = useTranslation('app');
  const { data: session } = useSession();
  const userId = (session as any)?.user?.id as string | undefined;
  const userKey = (session as any)?.user?.id || (session as any)?.user?.email || 'anon';
  const keyWithUser = (key: string) => `${key}_${userKey}`;
  // Avoid duplicate health-check toasts across re-renders
  const backendWarnedRef = useRef(false);
    // State
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("all");
    const [balanceVisible, setBalanceVisible] = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("weekly");
  const [currency, setCurrency] = useState<string>("");
    const [isInitialized, setIsInitialized] = useState(false);
    const [showFinanceOnboarding, setShowFinanceOnboarding] = useState(false);

    // Dialogs
    const [showTransactionDialog, setShowTransactionDialog] = useState(false);
    const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showEditAccountDialog, setShowEditAccountDialog] = useState(false);
    const [showBudgetDialog, setShowBudgetDialog] = useState(false);
    const [showGoalDialog, setShowGoalDialog] = useState(false);
  // (Former reset finance data dialog removed)
    // Mobile detection for chart sizing
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const update = () => setIsMobile(window.innerWidth <= 480);
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }, []);

    // Forms
    const [newTransaction, setNewTransaction] = useState({
      type: 'expense' as 'income' | 'expense',
      amount: '',
      category: '',
      description: '',
      accountId: ''
    });

    // Helpers: translate known category names; fallback to original
    const translateCategory = useCallback((name: string) => {
      if (!name) return '';
      const raw = name.trim();
      const norm = raw
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const alt: Record<string, string> = {
        'food_and_drinks': 'food_drinks',
        'food_and_dining': 'food_drinks'
      };
      const key = alt[norm] || norm;
      const i18nKey = `finance.categoryNames.${key}`;
      return i18n.exists(i18nKey) ? t(i18nKey) : raw;
    }, [i18n, t]);

    const [newAccount, setNewAccount] = useState({
      name: '',
      // allow arbitrary custom type strings
      type: 'cash' as 'cash' | 'card' | 'bank' | 'crypto' | string,
      balance: '0'
    });

    // Edit Account form
    const [editAccount, setEditAccount] = useState({
      id: '',
      name: '',
      type: 'cash' as 'cash' | 'card' | 'bank' | 'crypto' | string,
      balance: '0'
    });

    // Custom account type creation (similar to TransactionForm's "Custom" category)
    const [showCustomAccountType, setShowCustomAccountType] = useState(false);
    const [customAccountTypeName, setCustomAccountTypeName] = useState('');
    const [customAccountTypes, setCustomAccountTypes] = useState<string[]>([]);
  // For edit dialog custom type
  const [showEditCustomAccountType, setShowEditCustomAccountType] = useState(false);
  const [editCustomAccountTypeName, setEditCustomAccountTypeName] = useState('');

    // Load saved custom account types for this user
    useEffect(() => {
      try {
        const saved = dataManager.loadData(keyWithUser('customAccountTypes'), []) as string[];
        if (Array.isArray(saved)) setCustomAccountTypes(saved);
      } catch {}
    }, [userKey]);

    const [newBudget, setNewBudget] = useState({
      category: '',
      limit: '',
      period: 'monthly' as TimePeriod,
      startDate: new Date()
    });
    const [isBudgetStartOpen, setIsBudgetStartOpen] = useState(false);

    const [newGoal, setNewGoal] = useState({
      name: '',
      targetAmount: '',
      deadline: '',
      category: ''
    });

    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [showTransactionDetails, setShowTransactionDetails] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [showBudgetProgress, setShowBudgetProgress] = useState(false);
    const [budgetProgressAmount, setBudgetProgressAmount] = useState('');
    const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
    const [showGoalProgress, setShowGoalProgress] = useState(false);
    const [goalProgressAmount, setGoalProgressAmount] = useState('');
  // Date pickers open state (controlled) for Planner-style steppers
  const [isGoalDeadlineOpen, setIsGoalDeadlineOpen] = useState(false);
  const [isFilterFromOpen, setIsFilterFromOpen] = useState(false);
  const [isFilterToOpen, setIsFilterToOpen] = useState(false);

    // Transaction filters state
    const [transactionFilters, setTransactionFilters] = useState({
      search: '',
      type: 'all' as TransactionType,
      category: 'all',
      amountRange: 'all' as AmountRange,
      dateFrom: '',
      dateTo: '',
      showAdvancedFilters: false
    });

  const dataManager = FinanceLocalManager.getInstance();

    // Subscription-based limits
    const limits = useMemo(() => {
      switch (subscriptionPlan) {
        case 'free':
          return {
            maxAccounts: 1,
            maxTransactionsPerMonth: 50,
            budgetsAllowed: false,
            goalsAllowed: false,
            analyticsBlurred: true
          };
        case 'lite':
          return {
            maxAccounts: 5,
            maxTransactionsPerMonth: Infinity,
            budgetsAllowed: true,
            goalsAllowed: true,
            analyticsBlurred: true // Still blurred in Lite
          };
        case 'pro':
          return {
            maxAccounts: Infinity,
            maxTransactionsPerMonth: Infinity,
            budgetsAllowed: true,
            goalsAllowed: true,
            analyticsBlurred: false // Unblurred in Pro - Financial analytics available!
          };
        default:
          return {
            maxAccounts: 1,
            maxTransactionsPerMonth: 50,
            budgetsAllowed: false,
            goalsAllowed: false,
            analyticsBlurred: true
          };
      }
    }, [subscriptionPlan]);

    // Check if user has reached transaction limit for current month
    const getMonthlyTransactionCount = useCallback(() => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      return transactions.filter(t => 
        t.date >= startOfMonth && t.date <= endOfMonth
      ).length;
    }, [transactions]);

    const isTransactionLimitReached = useMemo(() => {
      if (subscriptionPlan !== 'free') return false;
      return getMonthlyTransactionCount() >= limits.maxTransactionsPerMonth;
    }, [subscriptionPlan, getMonthlyTransactionCount, limits.maxTransactionsPerMonth]);

    const isAccountLimitReached = useMemo(() => {
      return accounts.length >= limits.maxAccounts;
    }, [accounts, limits.maxAccounts]);

    // Calculations with time period filtering
    const getDateRange = useCallback((period: TimePeriod) => {
      const now = new Date();
      const start = new Date();
      
      switch (period) {
        case 'daily':
          start.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          start.setDate(now.getDate() - 7);
          break;
        case 'monthly':
          start.setMonth(now.getMonth() - 1);
          break;
        case 'quarterly':
          start.setMonth(now.getMonth() - 3);
          break;
        case 'yearly':
          start.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      return { start, end: now };
    }, []);

    // Initialize and check for onboarding
    useEffect(() => {
      if (typeof window === 'undefined') return;

      const initializeFinance = async () => {
        try {
          let serverCurrency: string | null = null;
          // Check if financial setup is complete (prefer server profile when signed in)
          let setupComplete = FinanceStore.isSetupComplete();
          try {
            if (userId) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('finance_setup_completed, currency')
                .eq('user_id', userId)
                .maybeSingle();
              if (profile) {
                setupComplete = !!profile.finance_setup_completed || setupComplete;
                if (profile.currency) {
                  serverCurrency = profile.currency;
                  setCurrency(profile.currency);
                  // Sync local cache with server preference
                  try { localStorage.setItem('finance_currency', profile.currency); } catch {}
                  try { dataManager.saveData('currency', profile.currency as any); } catch {}
                }
              }
            }
          } catch {}
          
          if (!setupComplete) {
            setShowFinanceOnboarding(true);
            setIsInitialized(true);
            return;
          }

          // Load existing data if setup is complete (legacy local only)
          const loadData = () => {
            try {
              const savedAccounts = dataManager.loadData('accounts', []) as any[];
              const savedTransactions = dataManager.loadData('transactions', []) as any[];
              const savedBudgets = dataManager.loadData('budgets', []) as any[];
              const savedGoals = dataManager.loadData('goals', []) as any[];
              const savedCurrency = dataManager.loadData('currency', '') || (typeof window !== 'undefined' ? localStorage.getItem('finance_currency') : '') || '';

              if (Array.isArray(savedAccounts)) {
                setAccounts(
                  (savedAccounts as any[]).map((acc: any) => ({
                    ...acc,
                    createdAt: new Date(acc?.createdAt || Date.now())
                  })) as Account[]
                );
              }

              if (Array.isArray(savedTransactions)) {
                setTransactions(
                  (savedTransactions as any[]).map((t: any) => ({
                    ...t,
                    date: new Date(t?.date)
                  })) as Transaction[]
                );
              }

              if (Array.isArray(savedBudgets)) {
                setBudgets((savedBudgets as any[]).map(b => ({
                  ...b,
                  startDate: b.startDate ? new Date(b.startDate) : undefined,
                  endDate: b.endDate ? new Date(b.endDate) : undefined,
                })) as Budget[]);
              }
              if (Array.isArray(savedGoals)) {
                setGoals(
                  (savedGoals as any[]).map((g: any) => ({
                    ...g,
                    deadline: new Date(g?.deadline)
                  })) as Goal[]
                );
              }

              // Only apply local saved currency if we didn't get a server value
              if (!serverCurrency && savedCurrency) setCurrency(savedCurrency as any);
              setIsInitialized(true);
            } catch (error) {
              console.error('Error loading finance data:', error);
              setIsInitialized(true);
            }
          };

          loadData();
        } catch (error) {
          console.error('Error initializing finance:', error);
          setIsInitialized(true);
        }
      };

      initializeFinance();
    }, []);

    // Auto-save data
    useEffect(() => {
      if (isInitialized) {
        dataManager.saveData('accounts', accounts);
        dataManager.saveData('transactions', transactions);
        dataManager.saveData('budgets', budgets);
        dataManager.saveData('goals', goals);
        dataManager.saveData('currency', currency);
      }
    }, [accounts, transactions, budgets, goals, currency, isInitialized]);

    // Remote load: accounts, transactions, budgets, goals + realtime
    const loadRemote = useCallback(async () => {
      if (!userId) return;
      try {
        const [accRes, txRes, budRes, goalRes] = await Promise.all([
          supabase.from('finance_accounts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          // Join category to get human-readable name for UI
          supabase
            .from('finance_transactions')
            .select('*, category:finance_categories(name,type,color)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
          ,
          supabase
            .from('finance_budgets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('finance_goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        ]);
        const accs = (accRes as any)?.data || [];
        const txs = (txRes as any)?.data || [];
        const buds = (budRes as any)?.data || [];
        const gos = (goalRes as any)?.data || [];
        if (Array.isArray(accs)) {
          setAccounts(accs.map((a: any) => ({
            id: String(a.id),
            name: a.name,
            type: a.type,
            balance: Number(a.balance ?? 0),
            color: a.color || '#10B981',
            isDefault: !!a.is_default,
            createdAt: a.created_at ? new Date(a.created_at) : new Date(),
          })) as Account[]);
        }
        if (Array.isArray(txs)) {
          setTransactions(
            txs.map((t: any) => ({
              id: String(t.id),
              accountId: String(t.account_id),
              type: t.type,
              amount: Number(t.amount),
              currency: t.currency,
              // Prefer joined category name; fallback to previous text; if nothing, mark as Uncategorized
              category: (t.category && (t.category.name || t.category)) || t.category_name || t.category_id || 'Uncategorized',
              description: t.description || '',
              date: t.occurred_at ? new Date(t.occurred_at) : new Date(),
              tags: Array.isArray(t.tags) ? t.tags : [],
            })) as Transaction[]
          );
        }
        if (Array.isArray(buds)) {
          setBudgets(buds.map((b: any) => {
            // Derive dates if missing (fallback similar to migration logic)
            let start: Date | undefined = b.start_date ? new Date(b.start_date) : (b.created_at ? new Date(b.created_at) : undefined);
            let end: Date | undefined = b.end_date ? new Date(b.end_date) : undefined;
            if (start && !end) {
              const s = new Date(start);
              switch (b.period) {
                case 'daily': end = new Date(s.getTime() + 24*60*60*1000); break;
                case 'weekly': end = new Date(s.getTime() + 7*24*60*60*1000); break;
                case 'monthly': end = new Date(s); end.setMonth(end.getMonth() + 1); break;
                case 'quarterly': end = new Date(s); end.setMonth(end.getMonth() + 3); break;
                case 'yearly': end = new Date(s); end.setFullYear(end.getFullYear() + 1); break;
                default: end = new Date(s); end.setMonth(end.getMonth() + 1);
              }
            }
            return {
              id: String(b.id),
              category: b.category,
              limit: Number(b.limit_amount),
              spent: Number(b.spent ?? 0),
              currency: b.currency,
              period: b.period,
              startDate: start,
              endDate: end,
            } as Budget;
          }));
        }
        if (Array.isArray(gos)) {
          setGoals(gos.map((g: any) => ({
            id: String(g.id),
            name: g.name,
            targetAmount: Number(g.target_amount),
            currentAmount: Number(g.current_amount ?? 0),
            deadline: g.deadline ? new Date(g.deadline) : new Date(),
            category: g.category || ''
          })) as Goal[]);
        }
      } catch (e) {
        console.error('Finance remote load failed', e);
      }
  }, [userId]);

    useEffect(() => {
      loadRemote();
      if (!userId) return;
      // One-time backend health check: ensure finance tables exist and are accessible
      (async () => {
        try {
          // Try lightweight head selects; capture structural/RLS errors
          const [b, g] = await Promise.all([
            supabase.from('finance_budgets').select('id', { head: true, count: 'exact' }).limit(1),
            supabase.from('finance_goals').select('id', { head: true, count: 'exact' }).limit(1)
          ] as any);
          const bErr = (b as any)?.error;
          const gErr = (g as any)?.error;
          if ((bErr || gErr) && !backendWarnedRef.current) {
            backendWarnedRef.current = true;
            const details = [bErr?.message, gErr?.message].filter(Boolean).join(' | ');
            toast.error('Finance backend not initialized', {
              description: details || 'Please apply the SQL in supabase/schema.sql for finance_budgets and finance_goals, and ensure RLS policies exist.'
            });
            // Extra hint in console with quick pointers
            console.warn('[Finance] Backend check failed:', { budgetsError: bErr, goalsError: gErr },
              '\nAction: Run the SQL from supabase/schema.sql in your Supabase project (Tables: finance_budgets, finance_goals + RLS policies).');
          }
        } catch (e) {
          // Non-fatal
        }
      })();
      const ch1 = supabase
        .channel('finance-accounts-rt-internal')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_accounts', filter: `user_id=eq.${userId}` }, () => loadRemote())
        .subscribe();
      const ch2 = supabase
        .channel('finance-transactions-rt-internal')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions', filter: `user_id=eq.${userId}` }, () => loadRemote())
        .subscribe();
      const ch3 = supabase
        .channel('finance-budgets-rt-internal')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_budgets', filter: `user_id=eq.${userId}` }, () => loadRemote())
        .subscribe();
      const ch4 = supabase
        .channel('finance-goals-rt-internal')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_goals', filter: `user_id=eq.${userId}` }, () => loadRemote())
        .subscribe();
      return () => {
        supabase.removeChannel(ch1);
        supabase.removeChannel(ch2);
        supabase.removeChannel(ch3);
        supabase.removeChannel(ch4);
      };
    }, [loadRemote, userId]);

    // Listen for global currency changes (e.g., AppShell settings)
    useEffect(() => {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail as { currency?: string } | undefined;
        if (detail?.currency) {
          setCurrency(detail.currency as any);
        }
      };
      window.addEventListener('currency-changed', handler as EventListener);
      return () => window.removeEventListener('currency-changed', handler as EventListener);
    }, []);

  // Broadcast when local currency changes so other widgets listening can update
    useEffect(() => {
      if (typeof window !== 'undefined') {
    try { localStorage.setItem('finance_currency', currency); } catch {}
    window.dispatchEvent(new CustomEvent('currency-changed', { detail: { currency } }));
      }
    }, [currency]);

    // Handle financial onboarding completion
    const handleFinanceOnboardingComplete = useCallback(async (accountData: any) => {
      // Add the account to state
  const newAccount: Account = {
        id: accountData.id,
        name: accountData.name,
        type: accountData.type,
        balance: accountData.balance,
        color: '#10B981',
        isDefault: true,
        createdAt: new Date()
      };

      setAccounts([newAccount]);
      setCurrency(accountData.currency);
      setShowFinanceOnboarding(false);
      
      toast.success('Finance setup completed!', {
        description: 'Your account has been created successfully.'
      });

      // Mark setup as complete in the local data manager too
      dataManager.markSetupComplete();
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (uid) {
          await supabase.from('user_profiles').upsert({
            user_id: uid,
            finance_setup_completed: true,
            currency: accountData.currency,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        }
      } catch {}
    }, [dataManager]);

    // Create default account if none exist
    useEffect(() => {
      if (isInitialized && !showFinanceOnboarding && accounts.length === 0) {
  const defaultAccount: Account = {
          id: `account_${Date.now()}`,
          name: 'Main Account',
          type: 'cash',
          balance: 0,
          color: '#10B981',
          isDefault: true,
          createdAt: new Date()
        };
        setAccounts([defaultAccount]);
        dataManager.markSetupComplete();
      }
    }, [isInitialized, showFinanceOnboarding, accounts.length, currency]);

    // Auto-update budget spending based on transactions
    useEffect(() => {
      if (isInitialized && budgets.length > 0 && transactions.length > 0) {
        setBudgets(prevBudgets => 
          prevBudgets.map(budget => {
            // Calculate spent amount from transactions for this category
            const { start, end } = getDateRange(budget.period);
            
            const categorySpending = transactions
              .filter(t => 
                t.type === 'expense' && 
                t.category.toLowerCase() === budget.category.toLowerCase() &&
                t.date >= start && 
                t.date <= end
              )
              .reduce((sum, t) => sum + t.amount, 0);

            return {
              ...budget,
              spent: categorySpending
            };
          })
        );
      }
    }, [transactions, isInitialized, budgets.length, getDateRange]);

    const filteredData = useMemo(() => {
      const { start, end } = getDateRange(timePeriod);
      
      const filteredAccounts = selectedAccount === "all" 
        ? accounts 
        : accounts.filter(account => account.id === selectedAccount);
      
      let filteredTransactions = transactions.filter(t => {
        const inDateRange = t.date >= start && t.date <= end;
        const inAccount = selectedAccount === "all" || t.accountId === selectedAccount;
        return inDateRange && inAccount;
      });

      // Apply transaction-specific filters
      if (transactionFilters.search) {
        const searchLower = transactionFilters.search.toLowerCase();
        filteredTransactions = filteredTransactions.filter(t =>
          t.description.toLowerCase().includes(searchLower) ||
          t.category.toLowerCase().includes(searchLower) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      if (transactionFilters.type !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.type === transactionFilters.type);
      }

      if (transactionFilters.category !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.category === transactionFilters.category);
      }

      if (transactionFilters.amountRange !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => {
          switch (transactionFilters.amountRange) {
            case 'under_100':
              return t.amount < 100000; // Under 100K UZS
            case '100_500':
              return t.amount >= 100000 && t.amount < 500000; // 100K-500K UZS
            case '500_1000':
              return t.amount >= 500000 && t.amount < 1000000; // 500K-1M UZS
            case 'over_1000':
              return t.amount >= 1000000; // Over 1M UZS
            default:
              return true;
          }
        });
      }

      if (transactionFilters.dateFrom) {
        const fromDate = new Date(transactionFilters.dateFrom);
        filteredTransactions = filteredTransactions.filter(t => t.date >= fromDate);
      }

      if (transactionFilters.dateTo) {
        const toDate = new Date(transactionFilters.dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        filteredTransactions = filteredTransactions.filter(t => t.date <= toDate);
      }

      return { filteredAccounts, filteredTransactions };
    }, [accounts, transactions, selectedAccount, timePeriod, getDateRange, transactionFilters]);

    // Get unique categories for filter dropdown
    const uniqueCategories = useMemo(() => {
  const categories = [...new Set(transactions.map(t => t.category))];
      return categories.sort();
    }, [transactions]);

    // Count active filters
    const activeFiltersCount = useMemo(() => {
      let count = 0;
      if (transactionFilters.search) count++;
      if (transactionFilters.type !== 'all') count++;
      if (transactionFilters.category !== 'all') count++;
      if (transactionFilters.amountRange !== 'all') count++;
      if (transactionFilters.dateFrom) count++;
      if (transactionFilters.dateTo) count++;
      return count;
    }, [transactionFilters]);

    // Reset filters function
    const resetTransactionFilters = () => {
      setTransactionFilters({
        search: '',
        type: 'all',
        category: 'all',
        amountRange: 'all',
        dateFrom: '',
        dateTo: '',
        showAdvancedFilters: false
      });
    };

    const totals = useMemo(() => {
      const { filteredAccounts, filteredTransactions } = filteredData;
      
      const totalBalance = filteredAccounts.reduce((sum, account) => sum + account.balance, 0);
      
      const income = filteredTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expense = filteredTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        balance: totalBalance,
        income,
        expense,
        savings: income - expense
      };
    }, [filteredData]);

    // Enhanced chart data with proper 0 values for missing periods
    const chartData = useMemo(() => {
      const { filteredTransactions } = filteredData;
      
      // Enhanced time series data with sensible ranges per period
      const getExtendedDateRange = (period: TimePeriod) => {
        const now = new Date();
        // Normalize "end" to end-of-day to avoid timezone off-by-ones
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Helpers
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        
        switch (period) {
          case 'daily': {
            const start = new Date(end);
            start.setDate(start.getDate() - 6); // last 7 days inclusive
            return { start, end };
          }
          case 'weekly': {
            const start = new Date(end);
            start.setDate(start.getDate() - 6); // keep phone-first daily points for a week
            return { start, end };
          }
          case 'monthly': {
            // Last 12 whole months including current
            const start = startOfMonth(new Date(end.getFullYear(), end.getMonth() - 11, 1));
            const monthEnd = endOfMonth(end);
            return { start, end: monthEnd };
          }
          case 'quarterly': {
            // Last 8 quarters including current
            const m = end.getMonth();
            const currentQ = Math.floor(m / 3); // 0..3
            // Move back 7 quarters (21 months) from start of current quarter
            const startOfCurrentQuarter = new Date(end.getFullYear(), currentQ * 3, 1);
            const start = new Date(startOfCurrentQuarter.getFullYear(), startOfCurrentQuarter.getMonth() - 21, 1);
            const quarterEnd = new Date(end.getFullYear(), currentQ * 3 + 3, 0, 23, 59, 59, 999);
            return { start, end: quarterEnd };
          }
          case 'yearly': {
            // Last 5 years including current
            const start = new Date(end.getFullYear() - 4, 0, 1);
            const yearEnd = new Date(end.getFullYear(), 11, 31, 23, 59, 59, 999);
            return { start, end: yearEnd };
          }
        }
        return { start: new Date(end), end };
      };

      const { start: extendedStart, end: extendedEnd } = getExtendedDateRange(timePeriod);
      
      // Get all transactions in the extended range
      const extendedTransactions = transactions.filter(t => {
        const inDateRange = t.date >= extendedStart && t.date <= extendedEnd;
        const inAccount = selectedAccount === "all" || t.accountId === selectedAccount;
        return inDateRange && inAccount;
      });
      
      // Generate all periods in range with 0 values as default
      const generateAllPeriods = () => {
        const periods: Array<{ date: string; income: number; expense: number; netFlow: number; formattedDate: string }> = [];
        const pad2 = (n: number) => n.toString().padStart(2, '0');
        const current = new Date(extendedStart);

        while (current <= extendedEnd) {
          let dateKey = '';
          let formattedDate = '';

          switch (timePeriod) {
            case 'daily': {
              dateKey = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`;
              formattedDate = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              current.setDate(current.getDate() + 1);
              break;
            }
            case 'weekly': {
              // Phone-first: keep daily points over the last 7 days
              dateKey = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`;
              formattedDate = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              current.setDate(current.getDate() + 1);
              break;
            }
            case 'monthly': {
              dateKey = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}`;
              formattedDate = current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              current.setMonth(current.getMonth() + 1);
              break;
            }
            case 'quarterly': {
              const q = Math.floor(current.getMonth() / 3) + 1; // 1..4
              dateKey = `${current.getFullYear()}-Q${q}`;
              formattedDate = `Q${q} ${current.getFullYear()}`;
              current.setMonth(current.getMonth() + 3);
              break;
            }
            case 'yearly': {
              dateKey = `${current.getFullYear()}`;
              formattedDate = `${current.getFullYear()}`;
              current.setFullYear(current.getFullYear() + 1);
              break;
            }
            default: {
              dateKey = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`;
              formattedDate = current.toLocaleDateString();
              current.setDate(current.getDate() + 1);
            }
          }

          periods.push({ date: dateKey, income: 0, expense: 0, netFlow: 0, formattedDate });
        }

        return periods;
      };

      // Start with all periods set to 0
      const allPeriods = generateAllPeriods();
      const timeSeriesMap = new Map(allPeriods.map(p => [p.date, { income: 0, expense: 0 }]));
      
      // Fill in actual transaction data
      extendedTransactions.forEach(t => {
        const pad2 = (n: number) => n.toString().padStart(2, '0');
        const dateKey = timePeriod === 'daily'
          ? `${t.date.getFullYear()}-${pad2(t.date.getMonth() + 1)}-${pad2(t.date.getDate())}`
          : timePeriod === 'weekly'
          ? `${t.date.getFullYear()}-${pad2(t.date.getMonth() + 1)}-${pad2(t.date.getDate())}` // daily points in weekly view
          : timePeriod === 'monthly'
          ? `${t.date.getFullYear()}-${pad2(t.date.getMonth() + 1)}`
          : timePeriod === 'quarterly'
          ? `${t.date.getFullYear()}-Q${Math.floor(t.date.getMonth() / 3) + 1}`
          : `${t.date.getFullYear()}`;
        
        if (timeSeriesMap.has(dateKey)) {
          const data = timeSeriesMap.get(dateKey)!;
          if (t.type === 'income') {
            data.income += t.amount;
          } else {
            data.expense += t.amount;
          }
        }
      });
      
      // Convert to final array format with all periods included
      const timeSeriesData = allPeriods.map(period => ({
        date: period.date,
        income: timeSeriesMap.get(period.date)?.income || 0,
        expense: timeSeriesMap.get(period.date)?.expense || 0,
        netFlow: (timeSeriesMap.get(period.date)?.income || 0) - (timeSeriesMap.get(period.date)?.expense || 0),
        formattedDate: period.formattedDate
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Category spending (keep original logic for current period)
      const categoryMap = new Map<string, number>();
      filteredTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
        });
      
      const categoryData = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      return { timeSeriesData, categoryData };
    }, [filteredData, timePeriod, transactions, selectedAccount]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      handleNewTransaction: () => {
        if (isTransactionLimitReached) {
          toast.error(t('toasts.finance.freePlanLimit', { max: limits.maxTransactionsPerMonth }));
          onUpgrade?.();
          return;
        }
        setShowTransactionDialog(true);
      }
    }), [isTransactionLimitReached, limits.maxTransactionsPerMonth, onUpgrade]);

    const formatCurrency = useCallback((amount: number, curr: string = currency) => {
      if (!curr) return new Intl.NumberFormat('en-US').format(amount);
      if (curr === 'UZS') return 'UZS ' + new Intl.NumberFormat('uz-UZ').format(amount);
      const symbol = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'RUB' ? '₽' : '';
      const formatted = new Intl.NumberFormat('en-US').format(amount);
      return symbol ? symbol + formatted : `${curr} ${formatted}`;
    }, [currency]);

    const getAccountTypeIcon = (type: 'cash' | 'card' | 'bank' | 'crypto' | 'all' | string) => {
      const icons: Record<'cash' | 'card' | 'bank' | 'crypto' | 'all', string> = {
        'cash': '💵',
        'card': '💳', 
        'bank': '🏦',
        'crypto': '₿',
        'all': '📊'
      };
      return (icons as any)[type] || '💰';
    };

    // Delete a transaction and reverse its effect on the account balance
    const handleDeleteTransaction = async (tx: Transaction) => {
      let accountsSnapshot: Account[] | null = null;
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user) {
          toast.error(t('toasts.auth.signInRequired', { defaultValue: 'Please sign in to continue.' }));
          return;
        }

        accountsSnapshot = accounts.map(a => ({ ...a }));

        // Optimistic local balance reversal
        const reversal = tx.type === 'expense' ? tx.amount : tx.type === 'income' ? -tx.amount : 0;
        if (reversal !== 0) {
          setAccounts(prev => prev.map(a => a.id === tx.accountId ? { ...a, balance: (a.balance ?? 0) + reversal } : a));
        }

        // Try client-side delete first
        const tryClientDelete = async () => {
          const { error } = await supabase
            .from('finance_transactions')
            .delete()
            .eq('id', tx.id)
            .eq('user_id', userRes.user.id);
          if (error) throw new Error(error.message);
        };

        // Fallback to API route
        const tryApiDelete = async () => {
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), 12000);
          try {
            const res = await fetch(`/api/transactions/list?id=${encodeURIComponent(tx.id)}` , {
              method: 'DELETE',
              signal: controller.signal,
            });
            clearTimeout(to);
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error(j?.error || `API error ${res.status}`);
            }
          } catch (e: any) {
            if (e?.name === 'AbortError') throw new Error('Network timeout while deleting transaction');
            throw e;
          }
        };

        try {
          await tryClientDelete();
        } catch (e1) {
          console.warn('Client delete failed, trying API fallback');
          await tryApiDelete();
        }

        // Persist the reversed balance remotely as well (best-effort)
        if (reversal !== 0) {
          const acc = accounts.find(a => a.id === tx.accountId);
          if (acc) {
            const next = (acc.balance ?? 0) + reversal;
            await supabase
              .from('finance_accounts')
              .update({ balance: next })
              .eq('id', tx.accountId)
              .eq('user_id', userRes.user.id);
          }
        }

        // Remove locally and refresh from remote
        setTransactions(prev => prev.filter(item => item.id !== tx.id));
        await loadRemote();

        setShowTransactionDetails(false);
        setSelectedTransaction(null);
        toast.success(t('finance.transactions.actions.deleted', { defaultValue: 'Transaction deleted' }));
      } catch (e: any) {
        console.error('Delete transaction failed', e);
  // rollback optimistic account change
  if (accountsSnapshot) setAccounts(accountsSnapshot);
        toast.error(t('toasts.errors.deleteFailed', { defaultValue: 'Failed to delete transaction' }), {
          description: e?.message || String(e)
        });
      }
    };

    // Form handlers
  const handleSaveTransaction = async (transactionData: Partial<Transaction>) => {
      if (isTransactionLimitReached) {
        toast.error(t('toasts.finance.freePlanLimit', { max: limits.maxTransactionsPerMonth }));
        onUpgrade?.();
        return;
      }

      if (!transactionData.amount || !transactionData.category) {
        toast.error(t('toasts.finance.requiredFields'));
        return;
      }

      // Ensure user is signed in for remote save
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        toast.error(t('toasts.auth.signInRequired', { defaultValue: 'Please sign in to save transactions.' }));
        return;
      }

      // Helper: detect UUID-like ids
      const isUUID = (id: string | undefined) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

      // Ensure we use EXACTLY the user-selected account; only create a remote account if that specific id is non-UUID (legacy/local) and has no remote counterpart yet.
      const ensureRemoteAccountId = async (): Promise<string> => {
  const desiredId = transactionData.accountId ? String(transactionData.accountId) : '';
  if (!desiredId) throw new Error('No account selected');

        // If already a remote (UUID) -> done
        if (isUUID(desiredId)) return desiredId;

        // Find the local/legacy account entry
        const localAccount = accounts.find(a => a.id === desiredId);
        if (localAccount) {
          // If same id (non-UUID) but there exists a REMOTE entry with same name & type, use that remote id to avoid duplicate creation
          const existingRemote = accounts.find(a => a.name === localAccount.name && a.type === localAccount.type && isUUID(a.id));
          if (existingRemote) return existingRemote.id;

          // Create remote twin only for this local account
          const { data: created, error: createErr } = await supabase
            .from('finance_accounts')
            .insert({
              user_id: userRes.user.id,
              name: localAccount.name,
              type: localAccount.type,
              color: localAccount.color || '#10B981',
              is_default: !!localAccount.isDefault,
              balance: localAccount.balance ?? 0,
            })
            .select('id')
            .single();
          if (createErr) throw new Error(`Failed to create account: ${createErr.message}`);
          return String(created.id);
        }

        // If account not found locally anymore, abort instead of silently switching to another
        throw new Error('Selected account not found');
      };

      // Ensure we have a finance_categories row and return its id (for non-transfer types)
      const ensureCategoryId = async (): Promise<string | null> => {
        const catNameRaw = (transactionData.category || '').trim();
        const txType = (transactionData.type as any) || 'expense';
        if (!catNameRaw || txType === 'transfer') return null;
        // Try exact first (pick most recent if duplicates)
        const { data: catExact } = await supabase
          .from('finance_categories')
          .select('id')
          .eq('user_id', userRes.user.id)
          .eq('name', catNameRaw)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (catExact?.id) return String(catExact.id);
        // Insert new category
        const { data: inserted, error } = await supabase
          .from('finance_categories')
          .insert({
            user_id: userRes.user.id,
            name: catNameRaw,
            type: txType === 'income' ? 'income' : 'expense',
            color: '#06B6D4',
          })
          .select('id')
          .single();
        if (error) throw new Error(`Failed to create category: ${error.message}`);
        return String(inserted.id);
      };

  // Resolve ids once
  const resolvedAccountId = await ensureRemoteAccountId();
  const resolvedCategoryId = await ensureCategoryId();

    // Try client-side Supabase insert first
    const tryClientInsert = async () => {
        const { error } = await supabase.from('finance_transactions').insert({
          user_id: userRes.user.id,
      account_id: resolvedAccountId,
          category_id: resolvedCategoryId ?? null,
          type: (transactionData.type as any) || 'expense',
          amount: Number(transactionData.amount || 0),
          currency,
          description: transactionData.description,
          occurred_at: (transactionData.date || new Date()).toISOString(),
          tags: Array.isArray(transactionData.tags) ? transactionData.tags : null,
        });
        if (error) throw new Error(error.message);
      };

      // Fallback: API route with timeout to avoid hangs
  const tryApiFallback = async () => {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 12000);
        try {
      const res = await fetch('/api/transactions/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
      account_id: resolvedAccountId,
        category_id: resolvedCategoryId ?? undefined,
              type: (transactionData.type as any) || 'expense',
              amount: Number(transactionData.amount || 0),
              currency,
              description: transactionData.description,
              occurred_at: (transactionData.date || new Date()).toISOString(),
              tags: Array.isArray(transactionData.tags) ? transactionData.tags : undefined,
            }),
            signal: controller.signal,
          });
          clearTimeout(to);
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || `API error ${res.status}`);
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') throw new Error('Network timeout while saving transaction');
          throw e;
        }
      };

      try {
        await tryClientInsert();
      } catch (e1: any) {
        console.warn('Client insert failed, falling back to API:', e1?.message || e1);
        try {
          await tryApiFallback();
        } catch (e2: any) {
          console.error('API fallback failed:', e2);
          toast.error(t('toasts.errors.saveFailed', { defaultValue: 'Failed to save transaction' }), {
            description: e2?.message || String(e2)
          });
          return;
        }
      }

  // Update the selected account balance so the Balance card reflects the change immediately
  try {
  const rawAmount = Math.abs(Number(transactionData.amount || 0));
  const delta = ((transactionData.type as any) === 'income' ? 1 : -1) * rawAmount;
    const current = accounts.find(a => a.id === resolvedAccountId)?.balance ?? 0;
    const next = current + delta;
    // Optimistic local update
    setAccounts(prev => prev.map(a => a.id === resolvedAccountId ? { ...a, balance: next } : a));
    // Persist to remote
    await supabase
      .from('finance_accounts')
      .update({ balance: next })
      .eq('id', resolvedAccountId)
      .eq('user_id', userRes.user.id);
  } catch (balErr) {
    console.warn('Failed to update account balance:', balErr);
  }

  await loadRemote();
  // Reflect the selected account in the header selector
  setSelectedAccount(resolvedAccountId);
      setShowTransactionDialog(false);
      toast.success(t('finance.transactions.form.actions.saved', { defaultValue: 'Transaction added successfully' }));
    };

    const handleAddCustomAccountType = () => {
      const name = customAccountTypeName.trim();
      if (!name) return;
      // Avoid duplicates (case-insensitive)
      const exists = [...['cash','card','bank','crypto'], ...customAccountTypes]
        .some(t => t.toLowerCase() === name.toLowerCase());
      const next = exists ? customAccountTypes : [...customAccountTypes, name];
      setCustomAccountTypes(next);
      // Persist per-user
      dataManager.saveData(keyWithUser('customAccountTypes'), next);
      // Select it
      setNewAccount(prev => ({ ...prev, type: name }));
      setShowCustomAccountType(false);
      setCustomAccountTypeName('');
    };

  const handleSaveAccount = async () => {
      if (isAccountLimitReached) {
        const planMsg = subscriptionPlan === 'free' ? t('toasts.finance.accountLimit.free') : t('toasts.finance.accountLimit.lite');
        toast.error(planMsg);
        onUpgrade?.();
        return;
      }

      if (!newAccount.name) {
        toast.error(t('toasts.finance.accountNameRequired'));
        return;
      }

      await createAccountAction({
        name: newAccount.name,
        type: newAccount.type as any,
        color: '#10B981',
        is_default: accounts.length === 0,
  balance: Number(newAccount.balance || '0'),
      });
      await loadRemote();
      setNewAccount({
        name: '',
        type: 'cash',
        balance: '0'
      });
      
      setShowAccountDialog(false);
      toast.success("Account added successfully");
    };

    const openEditAccountDialog = () => {
      if (selectedAccount === 'all') return;
      const acc = accounts.find(a => a.id === selectedAccount);
      if (!acc) return;
      setEditAccount({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: String(acc.balance ?? 0)
      });
      setShowEditCustomAccountType(false);
      setEditCustomAccountTypeName('');
      setShowEditAccountDialog(true);
    };

    const openEditAccountDialogById = (id: string) => {
      const acc = accounts.find(a => a.id === id);
      if (!acc) return;
      setSelectedAccount(id);
      setEditAccount({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: String(acc.balance ?? 0)
      });
      setShowEditCustomAccountType(false);
      setEditCustomAccountTypeName('');
      setShowEditAccountDialog(true);
    };

    const handleUpdateAccount = async () => {
      if (!editAccount.id) return;
      if (!editAccount.name) {
        toast.error(t('toasts.finance.accountNameRequired'));
        return;
      }
      const nextBalance = parseFloat(editAccount.balance) || 0;

      // Optimistic local update
      setAccounts(prev => prev.map(acc => acc.id === editAccount.id
        ? { ...acc, name: editAccount.name, type: editAccount.type, balance: nextBalance }
        : acc
      ));
      setShowEditAccountDialog(false);

      // Persist to Supabase (update if UUID id, else create remote and swap id locally)
      const isUUID = (id: string | undefined) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;
        if (!userId) throw new Error('Not signed in');

        if (isUUID(editAccount.id)) {
          const { error } = await supabase
            .from('finance_accounts')
            .update({
              name: editAccount.name,
              type: editAccount.type as any,
              balance: nextBalance,
            })
            .eq('id', editAccount.id)
            .eq('user_id', userId);
          if (error) throw error;
        } else {
          // No remote id yet — create one with the edited values
          const { data, error } = await supabase
            .from('finance_accounts')
            .insert({
              user_id: userId,
              name: editAccount.name,
              type: editAccount.type as any,
              balance: nextBalance,
              color: '#10B981',
              is_default: accounts.length === 0,
            })
            .select('id')
            .single();
          if (error) throw error;
          const newId = String((data as any).id);
          setAccounts(prev => prev.map(acc => acc.id === editAccount.id ? { ...acc, id: newId } : acc));
          if (selectedAccount === editAccount.id) setSelectedAccount(newId);
        }
        toast.success(t('toasts.finance.accountUpdated'));
      } catch (e: any) {
        console.error('Failed to persist account update:', e);
        toast.error(t('toasts.errors.saveFailed', { defaultValue: 'Failed to save changes' }), {
          description: e?.message || String(e)
        });
      } finally {
        // Re-sync from server to ensure consistency
        await loadRemote();
      }
    };

    const handleAddCustomAccountTypeForEdit = () => {
      const name = editCustomAccountTypeName.trim();
      if (!name) return;
      const exists = [...['cash','card','bank','crypto'], ...customAccountTypes]
        .some(t => t.toLowerCase() === name.toLowerCase());
      const next = exists ? customAccountTypes : [...customAccountTypes, name];
      setCustomAccountTypes(next);
      dataManager.saveData(keyWithUser('customAccountTypes'), next);
      setEditAccount(prev => ({ ...prev, type: name }));
      setShowEditCustomAccountType(false);
      setEditCustomAccountTypeName('');
    };

  const computeEndDate = (period: TimePeriod, start: Date): Date => {
    const end = new Date(start);
    switch (period) {
      case 'daily': end.setDate(end.getDate() + 1); break;
      case 'weekly': end.setDate(end.getDate() + 7); break;
      case 'monthly': end.setMonth(end.getMonth() + 1); break;
      case 'quarterly': end.setMonth(end.getMonth() + 3); break;
      case 'yearly': end.setFullYear(end.getFullYear() + 1); break;
      default: end.setMonth(end.getMonth() + 1); break;
    }
    return end;
  };

  const handleSaveBudget = async () => {
                    if (!limits.budgetsAllowed) {
                      toast.error(t('toasts.finance.budgetsRequirePro'));
        onUpgrade?.();
        return;
      }

      if (!newBudget.category || !newBudget.limit || !newBudget.startDate) {
  toast.error(t('toasts.finance.requiredFields'));
        return;
      }

      const limitValue = parseFloat(newBudget.limit);
      const start = newBudget.startDate;
      const end = computeEndDate(newBudget.period, start);
      const optimistic: Budget = {
        id: `temp_${Date.now()}`,
        category: newBudget.category,
        limit: limitValue,
        spent: 0,
        currency: currency,
        period: newBudget.period,
        startDate: start,
        endDate: end
      };

      setBudgets(prev => [optimistic, ...prev]);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) throw new Error('Not signed in');
        const { data, error } = await supabase
          .from('finance_budgets')
          .insert({
            user_id: uid,
            category: optimistic.category,
            limit_amount: optimistic.limit,
            spent: optimistic.spent,
            currency: optimistic.currency,
            period: optimistic.period,
            start_date: optimistic.startDate?.toISOString(),
            end_date: optimistic.endDate?.toISOString(),
          })
          .select('id')
          .single();
        if (error) throw error;
        const newId = String((data as any).id);
        setBudgets(prev => prev.map(b => b.id === optimistic.id ? { ...b, id: newId } : b));
        // Success UI only after DB insert succeeds
        setNewBudget({ category: '', limit: '', period: 'monthly', startDate: new Date() });
        setShowBudgetDialog(false);
        toast.success(t('toasts.finance.budgetCreated'));
      } catch (e: any) {
        // rollback
        setBudgets(prev => prev.filter(b => b.id !== optimistic.id));
        const msg = e?.message || e?.error_description || String(e);
        toast.error(t('toasts.errors.saveFailed', { defaultValue: 'Failed to save changes' }), {
          description: msg
        });
        console.error('Failed to save budget:', e);
      }
    };

    // Delete a budget (with confirmation)
    const handleDeleteBudget = async (budgetId: string) => {
      if (!budgetId) return;
      const target = budgets.find(b => b.id === budgetId);
      if (!target) return;
      const confirmed = typeof window === 'undefined' ? true : window.confirm(t('finance.section.budgets.confirmDelete', { defaultValue: 'Delete this budget?' }));
      if (!confirmed) return;
      const snapshot = budgets;
      // Optimistic removal
      setBudgets(prev => prev.filter(b => b.id !== budgetId));
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) throw new Error('Not signed in');
        // Only delete if budget id is a real UUID (optimistic temps have temp_ prefix)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(budgetId)) {
          const { error } = await supabase
            .from('finance_budgets')
            .delete()
            .eq('id', budgetId)
            .eq('user_id', uid);
          if (error) throw error;
        }
        toast.success(t('finance.section.budgets.deleted', { defaultValue: 'Budget deleted' }));
      } catch (e: any) {
        console.error('Failed to delete budget:', e);
        setBudgets(snapshot); // rollback
        toast.error(t('toasts.errors.deleteFailed', { defaultValue: 'Failed to delete' }), { description: e?.message || String(e) });
      }
    };

    const handleSaveGoal = async () => {
                    if (!limits.goalsAllowed) {
                      toast.error(t('toasts.finance.goalsRequirePro'));
        onUpgrade?.();
        return;
      }

      if (!newGoal.name || !newGoal.targetAmount || !newGoal.deadline) {
  toast.error(t('toasts.finance.requiredFields'));
        return;
      }

      const optimistic: Goal = {
        id: `temp_${Date.now()}`,
        name: newGoal.name,
        targetAmount: parseFloat(newGoal.targetAmount),
        currentAmount: 0,
        deadline: new Date(newGoal.deadline),
        category: newGoal.category
      };
      setGoals(prev => [optimistic, ...prev]);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) throw new Error('Not signed in');
        const { data, error } = await supabase
          .from('finance_goals')
          .insert({
            user_id: uid,
            name: optimistic.name,
            target_amount: optimistic.targetAmount,
            current_amount: optimistic.currentAmount,
            deadline: optimistic.deadline.toISOString(),
            category: optimistic.category || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        const newId = String((data as any).id);
        setGoals(prev => prev.map(g => g.id === optimistic.id ? { ...g, id: newId } : g));
        // Success UI only after DB insert succeeds
        setNewGoal({ name: '', targetAmount: '', deadline: '', category: '' });
        setShowGoalDialog(false);
        toast.success(t('toasts.finance.goalCreated'));
      } catch (e: any) {
        setGoals(prev => prev.filter(g => g.id !== optimistic.id));
        const msg = e?.message || e?.error_description || String(e);
        toast.error(t('toasts.errors.saveFailed', { defaultValue: 'Failed to save changes' }), {
          description: msg
        });
        console.error('Failed to save goal:', e);
      }
    };

    const handleDeleteGoal = async (goalId: string) => {
      if (!goalId) return;
      const target = goals.find(g => g.id === goalId);
      if (!target) return;
      const confirmed = typeof window === 'undefined' ? true : window.confirm(t('finance.section.goals.confirmDelete', { defaultValue: 'Delete this goal?' }));
      if (!confirmed) return;
      const snapshot = goals;
      setGoals(prev => prev.filter(g => g.id !== goalId));
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) throw new Error('Not signed in');
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(goalId)) {
          const { error } = await supabase
            .from('finance_goals')
            .delete()
            .eq('id', goalId)
            .eq('user_id', uid);
          if (error) throw error;
        }
        toast.success(t('finance.section.goals.deleted', { defaultValue: 'Goal deleted' }));
      } catch (e: any) {
        console.error('Failed to delete goal:', e);
        setGoals(snapshot);
        toast.error(t('toasts.errors.deleteFailed', { defaultValue: 'Failed to delete' }), { description: e?.message || String(e) });
      }
    };

  const handleUpdateBudgetProgress = async () => {
      if (!selectedBudget || !budgetProgressAmount) {
        toast.error("Please enter an amount");
        return;
      }

      const amount = parseFloat(budgetProgressAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      const prev = budgets.find(b => b.id === selectedBudget.id);
      setBudgets(prevList => prevList.map(budget => 
        budget.id === selectedBudget.id 
          ? { ...budget, spent: budget.spent + amount }
          : budget
      ));

      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (isUUID.test(selectedBudget.id)) {
          const b = budgets.find(b => b.id === selectedBudget.id);
          const newSpent = (b?.spent ?? 0) + amount;
          const { error } = await supabase
            .from('finance_budgets')
            .update({ spent: newSpent, updated_at: new Date().toISOString() })
            .eq('id', selectedBudget.id);
          if (error) throw error;
        }
      } catch (e) {
        // rollback
        setBudgets(prevList => prevList.map(budget => 
          budget.id === selectedBudget.id && prev ? { ...budget, spent: prev.spent } : budget
        ));
        toast.error(t('toasts.errors.saveFailed', { defaultValue: 'Failed to save changes' }));
      }

      setShowBudgetProgress(false);
      setBudgetProgressAmount('');
      setSelectedBudget(null);
      toast.success("Budget progress updated");
    };

  const handleUpdateGoalProgress = async () => {
      if (!selectedGoal || !goalProgressAmount) {
        toast.error("Please enter an amount");
        return;
      }

      const amount = parseFloat(goalProgressAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      const prev = goals.find(g => g.id === selectedGoal.id);
      const optimisticAmount = Math.min((prev?.currentAmount ?? 0) + amount, prev?.targetAmount ?? amount);
      setGoals(prevList => prevList.map(goal => 
        goal.id === selectedGoal.id 
          ? { ...goal, currentAmount: optimisticAmount }
          : goal
      ));

      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (isUUID.test(selectedGoal.id)) {
          const { error } = await supabase
            .from('finance_goals')
            .update({ current_amount: optimisticAmount, updated_at: new Date().toISOString() })
            .eq('id', selectedGoal.id);
          if (error) throw error;
        }
      } catch (e) {
        setGoals(prevList => prevList.map(goal => 
          goal.id === selectedGoal.id && prev ? { ...goal, currentAmount: prev.currentAmount } : goal
        ));
        toast.error(t('toasts.errors.saveFailed', { defaultValue: 'Failed to save changes' }));
      }

      setShowGoalProgress(false);
      setGoalProgressAmount('');
      setSelectedGoal(null);
      toast.success("Goal progress updated");
    };

    // Handle restricted tab access
    const handleRestrictedTabAccess = (tab: string) => {
      if (tab === 'budgets' && !limits.budgetsAllowed) {
        toast.error("Budgets require Pro subscription. Upgrade to unlock budget tracking.");
        onUpgrade?.();
        return;
      }
      if (tab === 'goals' && !limits.goalsAllowed) {
        toast.error("Goals require Pro subscription. Upgrade to unlock financial goals.");
        onUpgrade?.();
        return;
      }
      setActiveTab(tab);
    };

    // One-time migration: import legacy local budgets/goals to Supabase for signed-in users
    useEffect(() => {
      (async () => {
        try {
          if (!userId) return;
          // If we already have any budgets/goals in DB, skip
          const [{ count: bCount }, { count: gCount }] = await Promise.all([
            supabase.from('finance_budgets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('finance_goals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          ] as any);
          const hasRemote = (bCount ?? 0) > 0 || (gCount ?? 0) > 0;
          if (hasRemote) return;

          const legacyBudgets = dataManager.loadData('budgets', []) as any[];
          const legacyGoals = dataManager.loadData('goals', []) as any[];
          if ((legacyBudgets?.length ?? 0) === 0 && (legacyGoals?.length ?? 0) === 0) return;

          if (legacyBudgets?.length) {
            await supabase.from('finance_budgets').insert(
              legacyBudgets.map((b: any) => ({
                user_id: userId,
                category: b.category,
                limit_amount: b.limit,
                spent: b.spent ?? 0,
                currency: b.currency,
                period: b.period || 'monthly',
              }))
            );
          }
          if (legacyGoals?.length) {
            await supabase.from('finance_goals').insert(
              legacyGoals.map((g: any) => ({
                user_id: userId,
                name: g.name,
                target_amount: g.targetAmount,
                current_amount: g.currentAmount ?? 0,
                deadline: new Date(g.deadline).toISOString(),
                category: g.category || null,
              }))
            );
          }
          // Optional: clear legacy local copies after migration
          try {
            dataManager.saveData('budgets', []);
            dataManager.saveData('goals', []);
          } catch {}
          await loadRemote();
        } catch (e) {
          console.warn('Finance legacy migration skipped/failed', e);
        }
      })();
    }, [userId, loadRemote]);

    // Show onboarding if not initialized or if explicitly showing onboarding
    if (!isInitialized) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-money-green"></div>
        </div>
      );
    }

    if (showFinanceOnboarding) {
      return (
        <FinanceOnboardingWizard
          onComplete={handleFinanceOnboardingComplete}
          onSkip={() => {
            setShowFinanceOnboarding(false);
            // Create a default account if user skips
            const defaultAccount: Account = {
              id: `account_${Date.now()}`,
              name: 'Main Account',
              type: 'cash',
              balance: 0,
              color: '#10B981',
              isDefault: true,
              createdAt: new Date()
            };
            setAccounts([defaultAccount]);
            dataManager.markSetupComplete();
            FinanceStore.markSetupComplete();
            (async () => {
              try {
                const { data: auth } = await supabase.auth.getUser();
                const uid = auth?.user?.id;
                if (uid) {
                  await supabase.from('user_profiles').upsert({
                    user_id: uid,
                    finance_setup_completed: true,
                    updated_at: new Date().toISOString(),
                  }, { onConflict: 'user_id' });
                }
              } catch {}
            })();
          }}
        />
      );
    }

    const chartColors = ['#10B981', '#FFD700', '#EF4444', '#8B5CF6', '#F59E0B', '#06B6D4'];

  // Custom pie label to keep text fully visible within chart margins (no hook to avoid rule-of-hooks after early returns)
  const renderCategoryLabel = (props: any) => {
      const { name, percent, cx, cy, midAngle, outerRadius } = props;
      if (!name) return null;
      const RADIAN = Math.PI / 180;
      const radius = outerRadius + 18; // distance outside the pie
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const anchor = x > cx ? 'start' : 'end';
      const label = `${translateCategory(String(name))} ${Math.round((percent ?? 0) * 100)}%`;
      return (
        <text x={x} y={y} fill="#fff" textAnchor={anchor} dominantBaseline="central" style={{ fontSize: isMobile ? 12 : 13 }}>
          {label}
        </text>
      );
  };

  // Editing existing budget date range
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editBudgetStart, setEditBudgetStart] = useState<Date | null>(null);
  const [showEditBudgetDialog, setShowEditBudgetDialog] = useState(false);

  const openEditBudget = (b: Budget) => {
    setEditingBudget(b);
    setEditBudgetStart(b.startDate ? new Date(b.startDate) : new Date());
    setShowEditBudgetDialog(true);
  };

  const handleUpdateBudgetDates = async () => {
    if (!editingBudget || !editBudgetStart) return;
    const original = editingBudget;
    const newStart = editBudgetStart;
    const newEnd = computeEndDate(editingBudget.period, newStart);
    // Optimistic update
    setBudgets(prev => prev.map(b => b.id === original.id ? { ...b, startDate: newStart, endDate: newEnd } : b));
    setShowEditBudgetDialog(false);
    try {
      // Skip remote update for temp IDs (not yet persisted)
      if (!/^temp_/.test(original.id)) {
        const { error } = await supabase.from('finance_budgets')
          .update({
            start_date: newStart.toISOString(),
            end_date: newEnd.toISOString()
          })
          .eq('id', original.id);
        if (error) throw error;
      }
      toast.success(t('finance.section.budgets.dateUpdated', { defaultValue: 'Budget date updated' }));
    } catch (e: any) {
      // rollback
      setBudgets(prev => prev.map(b => b.id === original.id ? original : b));
      toast.error(t('toasts.errors.saveFailed', { defaultValue: 'Failed to save changes' }), {
        description: e?.message || String(e)
      });
    }
  };

    return (
      <div className="flex flex-col bg-background">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{t('finance.section.title')}</h1>
              <ScaleButton
                variant="ghost"
                size="sm"
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="h-10 w-10 rounded-full"
              >
                {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </ScaleButton>
            </div>

            <div className="flex items-center gap-2 flex-nowrap justify-end min-w-0">
              {/* Time Period Selector */}
              <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
                <SelectTrigger className="h-10 w-auto min-w-[100px] bg-surface-1/50 border-border/20 rounded-full shrink-0 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium capitalize">{t(`finance.section.periods.${timePeriod}`)}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('finance.section.periods.daily')}</SelectItem>
                  <SelectItem value="weekly">{t('finance.section.periods.weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('finance.section.periods.monthly')}</SelectItem>
                  <SelectItem value="quarterly">{t('finance.section.periods.quarterly')}</SelectItem>
                  <SelectItem value="yearly">{t('finance.section.periods.yearly')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Account Selector */}
              <Select value={selectedAccount} onValueChange={(value) => {
                if (value === "add_account") {
                  if (isAccountLimitReached) {
                    const planMsg = subscriptionPlan === 'free'
                      ? t('toasts.finance.accountLimit.free')
                      : t('toasts.finance.accountLimit.lite');
                    toast.error(planMsg);
                    onUpgrade?.();
                    return;
                  }
                  setShowAccountDialog(true);
                } else {
                  setSelectedAccount(value);
                }
              }}>
        <SelectTrigger className="h-10 w-auto min-w-0 sm:min-w-[140px] max-w-[52vw] sm:max-w-[320px] bg-surface-1/50 border-border/20 rounded-full overflow-hidden whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {selectedAccount === "all" ? '📊' : getAccountTypeIcon(accounts.find(a => a.id === selectedAccount)?.type || '')}
                    </span>
          <span className="text-sm font-medium truncate max-w-[38vw] sm:max-w-[200px]">
                      {selectedAccount === "all" ? t('finance.section.accounts.all') : accounts.find(a => a.id === selectedAccount)?.name || t('finance.section.accounts.all')}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="w-56">
                  <SelectItem value="all">
                    <div className="flex items-center gap-3 py-1">
                      <span className="text-lg">📊</span>
                      <div>
                        <div className="font-medium">{t('finance.section.accounts.allAccounts')}</div>
                        <div className="text-xs text-muted-foreground">{t('finance.section.accounts.viewAllBalances')}</div>
                      </div>
                    </div>
                  </SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-3 py-1">
                        <span className="text-lg">{getAccountTypeIcon(account.type)}</span>
                        <div className="flex-1">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(account.balance, currency)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ml-2 p-1 rounded hover:bg-surface-1 text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); openEditAccountDialogById(account.id); }}
                          title={t('finance.section.accounts.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </SelectItem>
                  ))}
                  <Separator className="my-2" />
                  <SelectItem value="add_account">
                    <div className="flex items-center gap-3 py-1 text-money-green">
                      <Plus className="h-5 w-5" />
                      <span className="font-medium">{t('finance.section.accounts.add')}</span>
                      {isAccountLimitReached && <Lock className="h-4 w-4 ml-auto" />}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {/* per-account edit is now inside the dropdown items */}
            </div>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-green-400/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">
                    {selectedAccount === "all" ? t('finance.section.cards.totalBalance') : t('finance.section.cards.balance')}
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {balanceVisible ? formatCurrency(totals.balance) : "••••••"}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    totals.savings >= 0 ? 'bg-blue-400/10' : 'bg-red-400/10'
                  }`}>
                    <TrendingUp className={`h-4 w-4 ${totals.savings >= 0 ? 'text-blue-400' : 'text-red-400'}`} />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">{t('finance.section.cards.savings')}</span>
                </div>
                <p className={`text-lg font-bold ${totals.savings >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {balanceVisible ? formatCurrency(totals.savings) : "••••••"}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-green-400/10 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">{t('finance.section.cards.income')}</span>
                </div>
                <p className="text-lg font-bold text-green-400">
                  {balanceVisible ? formatCurrency(totals.income) : "••••••"}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-red-400/10 flex items-center justify-center">
                    <ArrowDownRight className="h-4 w-4 text-red-400" />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">{t('finance.section.cards.expenses')}</span>
                </div>
                <p className="text-lg font-bold text-red-400">
                  {balanceVisible ? formatCurrency(totals.expense) : "••••••"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Limit Warning for Free Users */}
          {subscriptionPlan === 'free' && (
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-orange-400 text-sm">
                <Target className="h-4 w-4" />
                <span>
                  {t('finance.section.freePlan.usage', { used: getMonthlyTransactionCount(), limit: limits.maxTransactionsPerMonth })}
                </span>
                {isTransactionLimitReached && (
                  <ScaleButton onClick={onUpgrade} className="ml-auto">
                    <div className="bg-money-gradient text-[#0a0b0d] px-3 py-1 rounded-lg text-xs font-medium">
                      {t('buttons.upgrade')}
                    </div>
                  </ScaleButton>
                )}
              </div>
              <Progress 
                value={(getMonthlyTransactionCount() / limits.maxTransactionsPerMonth) * 100} 
                className="h-1 mt-2" 
              />
            </div>
          )}
        </div>

  {/* Content */}
  <div className="pb-28">{/* extra bottom padding so last chart (pie) is fully visible and not cut by bottom nav */}
          <div className="p-4">
            <Tabs value={activeTab} onValueChange={handleRestrictedTabAccess} className="w-full">
              {/* Centered segmented control: wrapper uses flex to center; inner grid has fixed max width */}
              <div className="w-full flex justify-center mb-6">
                {/* Remove fixed max-width so longer localized labels (RU/UZ) don't wrap and shift perceived center */}
                <TabsList className="grid grid-cols-4 w-full sm:w-auto bg-surface-1 h-12 rounded-full overflow-hidden px-1">
                <TabsTrigger value="dashboard" className="text-sm font-medium rounded-full">{t('finance.section.tabs.dashboard')}</TabsTrigger>
                <TabsTrigger value="transactions" className="text-sm font-medium rounded-full">{t('finance.section.tabs.transactions')}</TabsTrigger>
                <TabsTrigger 
                  value="budgets" 
                  className={`text-sm font-medium rounded-full flex items-center gap-1 ${!limits.budgetsAllowed ? 'opacity-50' : ''}`}
                >
                  {t('finance.section.tabs.budgets')}
                  {!limits.budgetsAllowed && <Lock className="h-3 w-3" />}
                </TabsTrigger>
                <TabsTrigger 
                  value="goals" 
                  className={`text-sm font-medium rounded-full flex items-center gap-1 ${!limits.goalsAllowed ? 'opacity-50' : ''}`}
                >
                  {t('finance.section.tabs.goals')}
                  {!limits.goalsAllowed && <Lock className="h-3 w-3" />}
                </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dashboard" className="space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-4 gap-3">
                  <ScaleButton onClick={() => {
                    if (isTransactionLimitReached) {
                      toast.error(t('toasts.finance.transactionLimit', { limit: limits.maxTransactionsPerMonth }));
                      onUpgrade?.();
                      return;
                    }
                    setShowTransactionDialog(true);
                  }}>
                    <Card className="glass-card hover:bg-surface-1/50 transition-colors">
                      <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-20">
                        <div className="w-8 h-8 bg-money-green/10 rounded-full flex items-center justify-center mx-auto mb-1">
                          <Plus className="h-3.5 w-3.5 text-money-green" />
                        </div>
                        <span className="font-medium text-sm">{t('finance.section.quickActions.add')}</span>
                        <div className="h-2.5 mt-1">
                          {isTransactionLimitReached ? <Lock className="h-3 w-3 mx-auto" /> : null}
                        </div>
                      </CardContent>
                    </Card>
                  </ScaleButton>

                  <ScaleButton onClick={() => {
                    if (isAccountLimitReached) {
                      const planMsg = subscriptionPlan === 'free'
                        ? t('toasts.finance.accountLimit.free')
                        : t('toasts.finance.accountLimit.lite');
                      toast.error(planMsg);
                      onUpgrade?.();
                      return;
                    }
                    setShowAccountDialog(true);
                  }}>
                    <Card className="glass-card hover:bg-surface-1/50 transition-colors">
                      <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-20">
                        <div className="w-8 h-8 bg-blue-400/10 rounded-full flex items-center justify-center mx-auto mb-1">
                          <Wallet className="h-3.5 w-3.5 text-blue-400" />
                        </div>
                        <span className="font-medium text-sm">{t('finance.section.quickActions.account')}</span>
                        <div className="h-2.5 mt-1">
                          {isAccountLimitReached ? <Lock className="h-3 w-3 mx-auto" /> : null}
                        </div>
                      </CardContent>
                    </Card>
                  </ScaleButton>

                  <ScaleButton onClick={() => {
                    if (!limits.budgetsAllowed) {
                      toast.error(t('toasts.finance.budgetsRequirePro'));
                      onUpgrade?.();
                      return;
                    }
                    setShowBudgetDialog(true);
                  }}>
                    <Card className="glass-card hover:bg-surface-1/50 transition-colors">
                      <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-20">
                        <div className="w-8 h-8 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-1">
                          <Target className="h-3.5 w-3.5 text-yellow-400" />
                        </div>
                        <span className="font-medium text-sm">{t('finance.section.quickActions.budget')}</span>
                        <div className="h-2.5 mt-1">
                          {!limits.budgetsAllowed ? <Lock className="h-3 w-3 mx-auto" /> : null}
                        </div>
                      </CardContent>
                    </Card>
                  </ScaleButton>

                  <ScaleButton onClick={() => {
                    if (!limits.goalsAllowed) {
                      toast.error(t('toasts.finance.goalsRequirePro'));
                      onUpgrade?.();
                      return;
                    }
                    setShowGoalDialog(true);
                  }}>
                    <Card className="glass-card hover:bg-surface-1/50 transition-colors">
                      <CardContent className="p-2.5 text-center flex flex-col items-center justify-center h-20">
                        <div className="w-8 h-8 bg-purple-400/10 rounded-full flex items-center justify-center mx-auto mb-1">
                          <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                        </div>
                        <span className="font-medium text-sm">{t('finance.section.quickActions.goal')}</span>
                        <div className="h-2.5 mt-1">
                          {!limits.goalsAllowed ? <Lock className="h-3 w-3 mx-auto" /> : null}
                        </div>
                      </CardContent>
                    </Card>
                  </ScaleButton>
                </div>

                {/* Financial Overview Charts with Blur Effect */}
                {chartData.timeSeriesData.length > 0 && (
                  <div className="relative">
                    <Card className="glass-card">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <LineChart className="h-5 w-5 text-money-green" />
                            <h3 className="text-lg font-semibold">{t('finance.section.charts.cashFlow.title')}</h3>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t(`finance.section.periods.${timePeriod}`)} {t('finance.section.charts.cashFlow.overviewSuffix')}
                          </div>
                        </div>
                        
                        {/* Legend */}
                        <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-6'} mb-4 text-sm`}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                            <span>{t('finance.section.charts.cashFlow.legend.income')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <span>{t('finance.section.charts.cashFlow.legend.expenses')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-money-green"></div>
                            <span>{t('finance.section.charts.cashFlow.legend.netFlow')}</span>
                          </div>
                        </div>

                        <div className={`${limits.analyticsBlurred ? 'filter blur-sm' : ''}`}>
                          <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
                            <RechartsLineChart data={chartData.timeSeriesData} margin={{ top: 5, right: isMobile ? 8 : 24, left: isMobile ? 0 : 16, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                              <XAxis 
                                dataKey="formattedDate" 
                                stroke="#9CA3AF" 
                                fontSize={isMobile ? 10 : 12}
                                tick={{ fill: '#9CA3AF' }}
                                interval={isMobile ? 'preserveStartEnd' : 0}
                                padding={{ left: 0, right: 0 }}
                                tickCount={isMobile ? 4 : undefined}
                              />
                              <YAxis 
                                stroke="#9CA3AF" 
                                fontSize={isMobile ? 10 : 12}
                                tick={{ fill: '#9CA3AF' }}
                                tickCount={isMobile ? 3 : undefined}
                                tickFormatter={(value) => {
                                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                                  return value.toString();
                                }}
                                axisLine={!isMobile}
                                tickLine={!isMobile}
                                width={isMobile ? 0 : 40}
                                hide={isMobile}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1F2937', 
                                  border: '1px solid #374151',
                                  borderRadius: '12px',
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                                }}
                                formatter={(value: number, name: string) => [
                                  formatCurrency(value),
                                  name === 'income' ? t('finance.section.charts.cashFlow.tooltip.income') :
                                  name === 'expense' ? t('finance.section.charts.cashFlow.tooltip.expenses') : t('finance.section.charts.cashFlow.tooltip.netFlow')
                                ]}
                                labelFormatter={(label) => t('finance.section.charts.cashFlow.tooltip.period', { label })}
                              />
                              <Line
                                type="monotone"
                                dataKey="income"
                                stroke="#10B981"
                                strokeWidth={3}
                                dot={{ fill: '#10B981', strokeWidth: 2, r: isMobile ? 3 : 4 }}
                                activeDot={{ r: isMobile ? 5 : 6, fill: '#10B981' }}
                                name="income"
                              />
                              <Line
                                type="monotone"
                                dataKey="expense"
                                stroke="#EF4444"
                                strokeWidth={3}
                                dot={{ fill: '#EF4444', strokeWidth: 2, r: isMobile ? 3 : 4 }}
                                activeDot={{ r: isMobile ? 5 : 5, fill: '#EF4444' }}
                                name="expense"
                              />
                              <Line
                                type="monotone"
                                dataKey="netFlow"
                                stroke="#34D399"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ fill: '#34D399', strokeWidth: 2, r: isMobile ? 2.5 : 3 }}
                                activeDot={{ r: isMobile ? 4.5 : 5, fill: '#34D399' }}
                                name="netFlow"
                              />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Cash Flow Summary */}
                        <div className={`mt-4 grid grid-cols-3 gap-4 text-center ${limits.analyticsBlurred ? 'filter blur-sm' : ''}`}>
                          <div className="p-3 bg-green-400/10 rounded-xl">
                            <div className="text-xs text-green-400 font-medium">{t('finance.section.charts.cashFlow.avg.income')}</div>
                            <div className="text-sm font-bold text-green-400 mt-1">
                              {formatCurrency(chartData.timeSeriesData.reduce((sum, d) => sum + d.income, 0) / chartData.timeSeriesData.length || 0)}
                            </div>
                          </div>
                          <div className="p-3 bg-red-400/10 rounded-xl">
                            <div className="text-xs text-red-400 font-medium">{t('finance.section.charts.cashFlow.avg.expenses')}</div>
                            <div className="text-sm font-bold text-red-400 mt-1">
                              {formatCurrency(chartData.timeSeriesData.reduce((sum, d) => sum + d.expense, 0) / chartData.timeSeriesData.length || 0)}
                            </div>
                          </div>
                          <div className="p-3 bg-money-green/10 rounded-xl">
                            <div className="text-xs text-money-green font-medium">{t('finance.section.charts.cashFlow.avg.netFlow')}</div>
                            <div className="text-sm font-bold text-money-green mt-1">
                              {formatCurrency(chartData.timeSeriesData.reduce((sum, d) => sum + d.netFlow, 0) / chartData.timeSeriesData.length || 0)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Blur Overlay for Analytics */}
                    {limits.analyticsBlurred && (
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
                        <div className="text-center p-4">
                          <Crown className="h-8 w-8 mx-auto mb-2 text-money-green" />
                          <p className="text-sm font-medium text-white mb-1">{t('finance.section.charts.overlay.financialAnalytics')}</p>
                          <p className="text-xs text-white/80 mb-3">
                            {t('finance.section.charts.overlay.unlockPro')}
                          </p>
                          <ScaleButton onClick={onUpgrade}>
                            <div className="bg-money-gradient text-[#0a0b0d] px-4 py-2 rounded-lg text-sm font-medium">
                              {t('finance.section.charts.overlay.upgradeTo', { plan: t('plans.pro') })}
                            </div>
                          </ScaleButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {chartData.categoryData.length > 0 && (
                  <div className="relative">
                    <Card className="glass-card">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <PieChart className="h-5 w-5 text-chart-2" />
                          <h3 className="text-lg font-semibold">{t('finance.section.charts.category.title')}</h3>
                        </div>
                        <div className={`${limits.analyticsBlurred ? 'filter blur-sm' : ''}`}>
                          <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
                            <RechartsPieChart margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
                              <Pie
                                data={chartData.categoryData}
                                cx="50%"
                                cy="50%"
                                outerRadius={isMobile ? 68 : 84}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                minAngle={8}
                                paddingAngle={2}
                                labelLine
                                label={renderCategoryLabel}
                              >
                                {chartData.categoryData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number, name: any) => [formatCurrency(value as number), translateCategory(String(name || ''))]} />
                              <Legend verticalAlign="bottom" height={isMobile ? 28 : 32} wrapperStyle={{ paddingTop: isMobile ? 6 : 8 }} formatter={(value: any) => translateCategory(String(value))} />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Blur Overlay for Analytics */}
                    {limits.analyticsBlurred && (
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
                        <div className="text-center p-4">
                          <Crown className="h-8 w-8 mx-auto mb-2 text-money-green" />
                          <p className="text-sm font-medium text-white mb-1">{t('finance.section.charts.overlay.categoryAnalytics')}</p>
                          <p className="text-xs text-white/80 mb-3">
                            {subscriptionPlan === 'free' ? t('finance.section.charts.overlay.unlockLite') : t('finance.section.charts.overlay.unlockPro')}
                          </p>
                          <ScaleButton onClick={onUpgrade}>
                            <div className="bg-money-gradient text-[#0a0b0d] px-4 py-2 rounded-lg text-sm font-medium">
                              {t('finance.section.charts.overlay.upgradeTo', { plan: t(`plans.${subscriptionPlan === 'free' ? 'lite' : 'pro'}`) })}
                            </div>
                          </ScaleButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4">
                {/* Transaction Filters */}
<div className="space-y-4">

  {/* Basic Filters Row */}
  <div className="flex flex-col sm:flex-row gap-2">
    {/* Search */}
    <div className="relative flex-1 min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
  placeholder={t('finance.section.filters.searchPlaceholder') as string}
        value={transactionFilters.search}
        onChange={(e) =>
          setTransactionFilters(prev => ({ ...prev, search: e.target.value }))
        }
        className="pl-10 pr-10 h-11 bg-surface-1/50 border-border/20 rounded-xl"
      />
      {transactionFilters.search && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTransactionFilters(prev => ({ ...prev, search: '' }))}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>

    {/* Advanced Filters Toggle */}
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        setTransactionFilters(prev => ({
          ...prev,
          showAdvancedFilters: !prev.showAdvancedFilters,
        }))
      }
      className="h-11 px-4 bg-surface-1/50 border-border/20 rounded-xl flex items-center justify-center"
    >
      <Filter className="h-4 w-4 mr-2" />
  {t('finance.section.filters.toggle')}
      {activeFiltersCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-money-green text-black text-xs font-bold px-1.5 min-w-[1.25rem] h-5">
          {activeFiltersCount}
        </span>
      )}
    </Button>
  </div>

  {/* Advanced Filters */}
  {transactionFilters.showAdvancedFilters && (
    <div className="glass-card rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-money-green" />
          <span className="font-medium">{t('finance.section.filters.advanced')}</span>
        </div>
        {activeFiltersCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetTransactionFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('finance.section.filters.resetAll')}
          </Button>
        )}
      </div>

      {/* Selects Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Type */}
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs font-medium">{t('finance.section.filters.type')}</Label>
          <Select
            value={transactionFilters.type}
            onValueChange={(value: TransactionType) =>
              setTransactionFilters(prev => ({ ...prev, type: value }))
            }
          >
            <SelectTrigger className="h-11 bg-surface-1/50 border-border/20 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('finance.section.filters.allTypes')}</SelectItem>
              <SelectItem value="income">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-400" />
                  {t('finance.section.filters.types.income')}
                </div>
              </SelectItem>
              <SelectItem value="expense">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-red-400" />
                  {t('finance.section.filters.types.expense')}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs font-medium">{t('finance.section.filters.category')}</Label>
          <Select
            value={transactionFilters.category}
            onValueChange={(value) =>
              setTransactionFilters(prev => ({ ...prev, category: value }))
            }
          >
            <SelectTrigger className="h-11 bg-surface-1/50 border-border/20 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('finance.section.filters.allCategories')}</SelectItem>
              {uniqueCategories.map((c) => (
                <SelectItem key={c} value={c}>{translateCategory(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount Range */}
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs font-medium">{t('finance.section.filters.amountRange')}</Label>
          <Select
            value={transactionFilters.amountRange}
            onValueChange={(value: AmountRange) =>
              setTransactionFilters(prev => ({ ...prev, amountRange: value }))
            }
          >
            <SelectTrigger className="h-11 bg-surface-1/50 border-border/20 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('finance.section.filters.amounts.all')}</SelectItem>
              <SelectItem value="under_100">{t('finance.section.filters.amounts.under100')}</SelectItem>
              <SelectItem value="100_500">{t('finance.section.filters.amounts.100_500')}</SelectItem>
              <SelectItem value="500_1000">{t('finance.section.filters.amounts.500_1000')}</SelectItem>
              <SelectItem value="over_1000">{t('finance.section.filters.amounts.over1000')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Account (only if multiple) */}
        {accounts.length > 1 && (
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs font-medium">{t('finance.section.filters.account')}</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="h-11 bg-surface-1/50 border-border/20 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('finance.section.accounts.allAccounts')}</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="inline-flex items-center gap-2">
                      {getAccountTypeIcon(a.type)} {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Date Range */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('finance.section.filters.date.from')}</Label>
      <Popover open={isFilterFromOpen} onOpenChange={setIsFilterFromOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl bg-surface-1/50 border-border/20 hover:bg-surface-2 justify-start text-left flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {transactionFilters.dateFrom
                  ? new Date(transactionFilters.dateFrom).toLocaleDateString()
                  : t('finance.section.filters.date.selectFrom')}
              </Button>
            </PopoverTrigger>
  <PopoverContent className="w-auto p-0 z-[120]" align="start" onOpenAutoFocus={(e)=>e.preventDefault()}>
              <DateStepper
                value={transactionFilters.dateFrom ? new Date(transactionFilters.dateFrom) : undefined}
                onChange={(date: Date) => {
                  setTransactionFilters(prev => ({ ...prev, dateFrom: date.toISOString().split("T")[0] }));
                }}
                onDone={() => {
                  setIsFilterFromOpen(false);
                }}
                minYear={new Date().getFullYear() - 6}
                maxYear={new Date().getFullYear() + 6}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('finance.section.filters.date.to')}</Label>
      <Popover open={isFilterToOpen} onOpenChange={setIsFilterToOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl bg-surface-1/50 border-border/20 hover:bg-surface-2 justify-start text-left flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {transactionFilters.dateTo
                  ? new Date(transactionFilters.dateTo).toLocaleDateString()
                  : t('finance.section.filters.date.selectTo')}
              </Button>
            </PopoverTrigger>
  <PopoverContent className="w-auto p-0 z-[120]" align="start" onOpenAutoFocus={(e)=>e.preventDefault()}>
              <DateStepper
                value={transactionFilters.dateTo ? new Date(transactionFilters.dateTo) : undefined}
                onChange={(date: Date) => {
                  setTransactionFilters(prev => ({ ...prev, dateTo: date.toISOString().split("T")[0] }));
                }}
                onDone={() => {
                  setIsFilterToOpen(false);
                }}
                minYear={new Date().getFullYear() - 6}
                maxYear={new Date().getFullYear() + 6}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Summary */}
          {activeFiltersCount > 0 && (
            <div className="pt-2 border-t border-border/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {t('finance.section.filters.summary.showing', { count: filteredData.filteredTransactions.length, total: transactions.length })}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {transactionFilters.search && (
                    <span className="px-2 py-1 bg-money-green/10 text-money-green text-xs rounded-full">
                      {t('finance.section.filters.summary.search')} "{transactionFilters.search}"
                    </span>
                  )}
                  {transactionFilters.type !== 'all' && (
                    <span className="px-2 py-1 bg-blue-400/10 text-blue-400 text-xs rounded-full capitalize">
                      {transactionFilters.type}
                    </span>
                  )}
                  {transactionFilters.category !== 'all' && (
                    <span className="px-2 py-1 bg-purple-400/10 text-purple-400 text-xs rounded-full">
                      {translateCategory(transactionFilters.category)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    
      </div>
    
                    {/* Transaction List */}
                {filteredData.filteredTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-surface-1 rounded-full flex items-center justify-center mx-auto mb-4">
                      <History className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-2">
                      {activeFiltersCount > 0 ? t('finance.section.transactions.emptyFilteredTitle') : t('finance.section.transactions.emptyTitle')}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {activeFiltersCount > 0 ? t('finance.section.transactions.emptyFilteredSubtitle') : t('finance.section.transactions.emptySubtitle')}
                    </p>
                    <div className="flex gap-2 justify-center">
                      {activeFiltersCount > 0 && (
                        <Button variant="outline" onClick={resetTransactionFilters}>
                          {t('finance.section.filters.clear')}
                        </Button>
                      )}
                      <Button onClick={() => setShowTransactionDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('finance.section.transactions.add')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-xl overflow-hidden">
                    <div className="divide-y divide-border/30">
                      {filteredData.filteredTransactions.slice(0, 20).map((transaction, index) => (
                        <ScaleButton 
                          key={transaction.id}
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowTransactionDetails(true);
                          }}
                          className="w-full"
                        >
                          <div className="flex items-center justify-between p-4 hover:bg-surface-1/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                transaction.type === 'income' 
                                  ? 'bg-green-400/10 text-green-400' 
                                  : 'bg-red-400/10 text-red-400'
                              }`}>
                                {transaction.type === 'income' ? 
                                  <ArrowUpRight className="h-4 w-4" /> :
                                  <ArrowDownRight className="h-4 w-4" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {translateCategory(transaction.category)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-sm text-muted-foreground">
                                    {transaction.date.toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric',
                                      year: transaction.date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                    })}
                                  </p>
                                  {transaction.description && (
                                    <>
                                      <span className="text-muted-foreground">•</span>
                                      <p className="text-sm text-muted-foreground truncate">
                                        {transaction.description}
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                              <p className={`font-semibold tabular-nums ${
                                transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {accounts.find(acc => acc.id === transaction.accountId)?.name || t('finance.section.transactions.unknownAccount')}
                              </p>
                            </div>
                          </div>
                        </ScaleButton>
                      ))}
                    </div>
                    
                    {filteredData.filteredTransactions.length > 20 && (
                          <div className="p-4 border-t border-border/30 bg-surface-1/30">
                        <p className="text-sm text-muted-foreground text-center">
                          {activeFiltersCount > 0 
                            ? t('finance.section.transactions.showingTotal', { count: filteredData.filteredTransactions.length, total: transactions.length })
                            : t('finance.section.transactions.showingLimited', { count: filteredData.filteredTransactions.length })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="budgets" className="space-y-4">
                {budgets.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">{t('finance.section.budgets.empty')}</p>
                    <Button onClick={() => setShowBudgetDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('finance.section.budgets.create')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={() => {
                          if (!limits.budgetsAllowed) {
                            toast.error(t('toasts.finance.budgetsRequirePro'));
                            onUpgrade?.();
                            return;
                          }
                          setShowBudgetDialog(true);
                        }}
                        className="h-9"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('finance.section.budgets.create')}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {/** Derive spent dynamically based on transactions within range */}
                      {budgets.map((budget) => (
                        <Card key={budget.id} className="glass-card">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div>
                                <h3 className="font-medium">{translateCategory(budget.category)}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {t(`finance.section.periods.${budget.period}` as const)}
                                  </span>
                                  <div className="px-2 py-0.5 bg-money-green/10 text-money-green text-[10px] rounded-full">
                                    {t('finance.section.budgets.autoTracked')}
                                  </div>
                                  {budget.startDate && budget.endDate && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {budget.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                      {' – '}
                                      {new Date(budget.endDate.getTime() - 24*60*60*1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => openEditBudget(budget)}
                                >
                                  {t('buttons.update')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteBudget(budget.id)}
                                  title={t('buttons.delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(() => {
                                // compute dynamic spent
                                const start = budget.startDate;
                                const end = budget.endDate;
                                const dynamicSpent = transactions.filter(tx => (
                                  tx.type === 'expense' &&
                                  tx.category && tx.category.toLowerCase() === budget.category.toLowerCase() &&
                                  start && end && tx.date >= start && tx.date < end
                                )).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
                                const pct = (dynamicSpent / budget.limit) * 100;
                                return (
                                  <>
                                    <div className="flex justify-between text-sm">
                                      <span>{t('finance.analyst.budgets.summary.of', { spent: formatCurrency(dynamicSpent), budgeted: formatCurrency(budget.limit) })}</span>
                                      <span className="font-medium">{pct.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={Math.min(pct, 100)} className="h-2" />
                                    <div className="text-xs text-muted-foreground">
                                      {dynamicSpent <= budget.limit
                                        ? t('finance.section.budgets.remaining', { amount: formatCurrency(budget.limit - dynamicSpent) })
                                        : t('finance.section.budgets.overBudget', { amount: formatCurrency(dynamicSpent - budget.limit) })}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="goals" className="space-y-4">
                {goals.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">{t('finance.section.goals.empty')}</p>
                    <Button onClick={() => setShowGoalDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('finance.section.goals.create')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={() => {
                          if (!limits.goalsAllowed) {
                            toast.error(t('toasts.finance.goalsRequirePro'));
                            onUpgrade?.();
                            return;
                          }
                          setShowGoalDialog(true);
                        }}
                        className="h-9"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('finance.section.goals.create')}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {goals.map((goal) => (
                        <Card key={goal.id} className="glass-card">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div>
                                <h3 className="font-medium">{goal.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">{goal.deadline.toLocaleDateString()}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedGoal(goal);
                                      setShowGoalProgress(true);
                                      setGoalProgressAmount('');
                                    }}
                                    className="h-6 px-2 text-[10px]"
                                  >
                                    {t('buttons.update')}
                                  </Button>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteGoal(goal.id)}
                                title={t('buttons.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>{t('finance.analyst.goals.summary.of', { current: formatCurrency(goal.currentAmount), target: formatCurrency(goal.targetAmount) })}</span>
                                <span className="font-medium">{((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}%</span>
                              </div>
                              <Progress value={(goal.currentAmount / goal.targetAmount) * 100} className="h-2" />
                              <div className="text-xs text-muted-foreground">
                                {goal.targetAmount - goal.currentAmount > 0
                                  ? t('finance.section.budgets.remaining', { amount: formatCurrency(goal.targetAmount - goal.currentAmount) })
                                  : t('finance.section.goals.achieved')}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Transaction Dialog */}
        <SlideUpModal
          isOpen={showTransactionDialog}
          onClose={() => setShowTransactionDialog(false)}
        >
          <TransactionForm
            accounts={accounts.map(account => ({
              id: account.id,
              name: account.name,
              type: account.type as 'checking' | 'savings' | 'credit' | 'cash',
              balance: account.balance,
              color: account.color,
              icon: getAccountTypeIcon(account.type)
            }))}
            currency={currency}
            onSave={handleSaveTransaction}
            onCancel={() => setShowTransactionDialog(false)}
            defaultDate={new Date()}
            defaultAccountId={selectedAccount !== 'all' ? selectedAccount : accounts[0]?.id}
          />
        </SlideUpModal>

        {/* Account Dialog */}
<SlideUpModal
  isOpen={showAccountDialog}
  onClose={() => setShowAccountDialog(false)}
  title={t('finance.section.accounts.add')}
>
  <div className="p-4 sm:p-5">
    <form className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.accounts.form.nameLabel')}</Label>
        <Input
          placeholder={t('finance.section.accounts.form.namePlaceholder') as string}
          value={newAccount.name}
          onChange={(e) => setNewAccount(p => ({ ...p, name: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

      <div className="space-y-2">
  <Label className="text-sm font-medium">{t('finance.section.accounts.form.typeLabel')}</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['cash', 'card', 'bank', 'crypto', ...customAccountTypes].map((type) => (
            <Button
              key={type}
              type="button"
              variant={newAccount.type === type ? 'default' : 'outline'}
              onClick={() => { setNewAccount(p => ({ ...p, type: type as any })); setShowCustomAccountType(false); }}
              className="h-11 rounded-xl justify-center gap-2 min-w-0"
            >
              <span className="shrink-0">{getAccountTypeIcon(type)}</span>
              <span className="truncate">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </Button>
          ))}

          <Button
            type="button"
            variant={
              (typeof newAccount.type === 'string' &&
                !['cash','card','bank','crypto'].includes(newAccount.type)) || showCustomAccountType
                ? 'default' : 'outline'
            }
            onClick={() => { setShowCustomAccountType(true); }}
            className="h-11 rounded-xl justify-center gap-2 min-w-0"
          >
            <Plus className="h-4 w-4" />
            <span className="truncate">{t('finance.section.accounts.form.custom')}</span>
          </Button>
        </div>

        {showCustomAccountType && (
          <div className="mt-2 p-3 rounded-xl border border-border bg-surface-1 space-y-2">
            <Label className="text-xs text-muted-foreground">{t('finance.section.accounts.form.customTypeNameLabel')}</Label>
            <div className="flex gap-2">
              <Input
                value={customAccountTypeName}
                onChange={(e) => setCustomAccountTypeName(e.target.value)}
                placeholder={t('finance.section.accounts.form.customTypeNamePlaceholder') as string}
                className="h-10 flex-1"
                onKeyDown={(e)=>{ if(e.key==='Enter') handleAddCustomAccountType(); }}
              />
              <Button
                type="button"
                onClick={handleAddCustomAccountType}
                disabled={!customAccountTypeName.trim()}
                className="h-10 bg-money-gradient text-black font-semibold"
              >
                {t('common.add')}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowCustomAccountType(false)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.accounts.form.initialBalance')}</Label>
        <Input
          type="number"
          placeholder="0"
          value={newAccount.balance}
          onChange={(e) => setNewAccount(p => ({ ...p, balance: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

  {/* Currency selection removed — use global currency for now */}

      <Button
        type="button"
        onClick={handleSaveAccount}
        className="w-full h-12 rounded-xl bg-money-gradient text-black font-semibold mt-2"
      >
        {t('finance.section.accounts.add')}
      </Button>
    </form>
  </div>
</SlideUpModal>

{/* Edit Budget Dialog */}
<SlideUpModal
  isOpen={showEditBudgetDialog}
  onClose={() => setShowEditBudgetDialog(false)}
  title={t('buttons.update') + ' ' + (editingBudget ? translateCategory(editingBudget.category) : '')}
>
  <div className="p-4 sm:p-5 space-y-5">
    {editingBudget && (
      <>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('finance.section.budgets.startDateLabel', { defaultValue: 'Start Date' })}</Label>
            <DateStepper
              value={editBudgetStart || undefined}
              onChange={(date: Date) => setEditBudgetStart(date)}
              onDone={() => {/* nothing extra */}}
              minYear={new Date().getFullYear() - 2}
              maxYear={new Date().getFullYear() + 2}
            />
          </div>
          {editBudgetStart && (
            <div className="text-xs text-muted-foreground">
              {(() => {
                const newEnd = computeEndDate(editingBudget.period, editBudgetStart);
                return `${editBudgetStart.toLocaleDateString()} – ${new Date(newEnd.getTime() - 24*60*60*1000).toLocaleDateString()}`;
              })()}
            </div>
          )}
        </div>
        <Button
          type="button"
          onClick={handleUpdateBudgetDates}
          disabled={!editBudgetStart}
          className="w-full h-11 rounded-xl bg-money-gradient text-black font-semibold"
        >
          {t('buttons.saveChanges')}
        </Button>
      </>
    )}
  </div>
</SlideUpModal>

        {/* Edit Account Dialog */}
<SlideUpModal
  isOpen={showEditAccountDialog}
  onClose={() => setShowEditAccountDialog(false)}
  title={t('finance.section.accounts.edit')}
>
  <div className="p-4 sm:p-5">
    <form className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.accounts.form.nameLabel')}</Label>
        <Input
          placeholder={t('finance.section.accounts.form.namePlaceholder') as string}
          value={editAccount.name}
          onChange={(e) => setEditAccount(p => ({ ...p, name: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

      <div className="space-y-2">
  <Label className="text-sm font-medium">{t('finance.section.accounts.form.typeLabel')}</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['cash', 'card', 'bank', 'crypto', ...customAccountTypes].map((type) => (
            <Button
              key={type}
              type="button"
              variant={editAccount.type === type ? 'default' : 'outline'}
              onClick={() => { setEditAccount(p => ({ ...p, type: type as any })); setShowEditCustomAccountType(false); }}
              className="h-11 rounded-xl justify-center gap-2 min-w-0"
            >
              <span className="shrink-0">{getAccountTypeIcon(type)}</span>
              <span className="truncate">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </Button>
          ))}

          <Button
            type="button"
            variant={
              (typeof editAccount.type === 'string' &&
                !['cash','card','bank','crypto'].includes(editAccount.type)) || showEditCustomAccountType
                ? 'default' : 'outline'
            }
            onClick={() => { setShowEditCustomAccountType(true); }}
            className="h-11 rounded-xl justify-center gap-2 min-w-0"
          >
            <Plus className="h-4 w-4" />
            <span className="truncate">{t('finance.section.accounts.form.custom')}</span>
          </Button>
        </div>

        {showEditCustomAccountType && (
          <div className="mt-2 p-3 rounded-xl border border-border bg-surface-1 space-y-2">
            <Label className="text-xs text-muted-foreground">{t('finance.section.accounts.form.customTypeNameLabel')}</Label>
            <div className="flex gap-2">
              <Input
                value={editCustomAccountTypeName}
                onChange={(e) => setEditCustomAccountTypeName(e.target.value)}
                placeholder={t('finance.section.accounts.form.customTypeNamePlaceholder') as string}
                className="h-10 flex-1"
                onKeyDown={(e)=>{ if(e.key==='Enter') handleAddCustomAccountTypeForEdit(); }}
              />
              <Button
                type="button"
                onClick={handleAddCustomAccountTypeForEdit}
                disabled={!editCustomAccountTypeName.trim()}
                className="h-10 bg-money-gradient text-black font-semibold"
              >
                {t('common.add')}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowEditCustomAccountType(false)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
  <Label className="text-sm font-medium">{t('finance.section.accounts.form.currentBalance')}</Label>
        <Input
          type="number"
          placeholder="0"
          value={editAccount.balance}
          onChange={(e) => setEditAccount(p => ({ ...p, balance: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

  {/* Currency selection removed — use global currency for now */}

      <Button
        type="button"
        onClick={handleUpdateAccount}
        className="w-full h-12 rounded-xl bg-money-gradient text-black font-semibold mt-2"
        disabled={!editAccount.id}
      >
        {t('buttons.saveChanges')}
      </Button>
    </form>
  </div>
</SlideUpModal>

        {/* Budget Dialog */}
<SlideUpModal
  isOpen={showBudgetDialog}
  onClose={() => setShowBudgetDialog(false)}
  title={t('finance.section.budgets.create')}
>
  <div className="p-4 sm:p-5">
    <div className="p-3 bg-money-green/10 rounded-xl text-sm text-money-green">
      💡 {t('finance.section.budgets.info')}
    </div>

    <form className="space-y-4 mt-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.budgets.categoryLabel')}</Label>
        <Input
          placeholder={t('finance.section.budgets.categoryPlaceholder') as string}
          value={newBudget.category}
          onChange={(e) => setNewBudget(p => ({ ...p, category: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.budgets.limitLabel')}</Label>
        <Input
          type="number"
          placeholder="0"
          value={newBudget.limit}
          onChange={(e) => setNewBudget(p => ({ ...p, limit: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.budgets.periodLabel')}</Label>
        <Select
          value={newBudget.period}
          onValueChange={(v: TimePeriod) => setNewBudget(p => ({ ...p, period: v }))}
        >
          <SelectTrigger className="h-11 w-full bg-surface-1 border-border rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t('finance.section.periods.daily')}</SelectItem>
            <SelectItem value="weekly">{t('finance.section.periods.weekly')}</SelectItem>
            <SelectItem value="monthly">{t('finance.section.periods.monthly')}</SelectItem>
            <SelectItem value="quarterly">{t('finance.section.periods.quarterly')}</SelectItem>
            <SelectItem value="yearly">{t('finance.section.periods.yearly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.budgets.startDateLabel', { defaultValue: 'Start Date' })}</Label>
        <Popover open={isBudgetStartOpen} onOpenChange={setIsBudgetStartOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl bg-surface-1 border-border hover:bg-surface-2 justify-start text-left flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              {newBudget.startDate ? newBudget.startDate.toLocaleDateString() : t('planner.editor.pickDate')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e)=>e.preventDefault()}>
            <DateStepper
              value={newBudget.startDate}
              onChange={(date: Date) => setNewBudget(p => ({ ...p, startDate: date }))}
              onDone={() => setIsBudgetStartOpen(false)}
              minYear={new Date().getFullYear() - 2}
              maxYear={new Date().getFullYear() + 2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        type="button"
        onClick={handleSaveBudget}
        className="w-full h-12 rounded-xl bg-money-gradient text-black font-semibold mt-2"
      >
        {t('finance.section.budgets.create')}
      </Button>
    </form>
  </div>
</SlideUpModal>

        {/* Goal Dialog */}
<SlideUpModal
  isOpen={showGoalDialog}
  onClose={() => setShowGoalDialog(false)}
  title={t('finance.section.goals.create')}
>
  <div className="p-4 sm:p-5">
    <form className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.goals.form.nameLabel')}</Label>
        <Input
          placeholder={t('finance.section.goals.form.namePlaceholder') as string}
          value={newGoal.name}
          onChange={(e) => setNewGoal(p => ({ ...p, name: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.goals.form.targetLabel')}</Label>
        <Input
          type="number"
          placeholder="0"
          value={newGoal.targetAmount}
          onChange={(e) => setNewGoal(p => ({ ...p, targetAmount: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
  <Label className="text-sm font-medium">Deadline</Label>
        <Popover open={isGoalDeadlineOpen} onOpenChange={setIsGoalDeadlineOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl bg-surface-1 border-border hover:bg-surface-2 justify-start text-left flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              {newGoal.deadline
                ? new Date(newGoal.deadline).toLocaleDateString()
                : t('planner.editor.pickDate')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e)=>e.preventDefault()}>
            <DateStepper
              value={newGoal.deadline ? new Date(newGoal.deadline) : undefined}
              onChange={(date: Date) =>
                setNewGoal(p => ({
                  ...p,
                  deadline: date ? date.toISOString().split("T")[0] : "",
                }))
              }
              onDone={() => {
                setIsGoalDeadlineOpen(false);
              }}
              minYear={new Date().getFullYear() - 6}
              maxYear={new Date().getFullYear() + 6}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('finance.section.goals.form.categoryLabel')}</Label>
        <Input
          placeholder={t('finance.section.goals.form.categoryPlaceholder') as string}
          value={newGoal.category}
          onChange={(e) => setNewGoal(p => ({ ...p, category: e.target.value }))}
          className="h-11 w-full bg-surface-1 border-border rounded-xl"
        />
      </div>

      <Button
        type="button"
        onClick={handleSaveGoal}
        className="w-full h-12 rounded-xl bg-money-gradient text-black font-semibold mt-2"
      >
        {t('finance.section.goals.create')}
      </Button>
    </form>
  </div>
</SlideUpModal>

        {/* Transaction Details Dialog */}
        <SlideUpModal
          isOpen={showTransactionDetails}
          onClose={() => {
            setShowTransactionDetails(false);
            setSelectedTransaction(null);
          }}
          title={t('finance.transactions.details.title')}
        >
          {selectedTransaction && (
            <div className="space-y-4 p-4">
              {/* Title row: icon + name on the left, delete on the right (vertically centered) */}
              <div className="grid grid-cols-[1fr_auto] items-center mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${
                    selectedTransaction.type === 'income' 
                      ? 'bg-green-400/10 text-green-400' 
                      : 'bg-red-400/10 text-red-400'
                  }`}>
                    {selectedTransaction.type === 'income' ? 
                      <ArrowUpRight className="h-5 w-5" /> :
                      <ArrowDownRight className="h-5 w-5" />
                    }
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {selectedTransaction.description || translateCategory(selectedTransaction.category)}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedTransaction.type} {t('finance.transactions.details.typeSuffix')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 px-3 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => handleDeleteTransaction(selectedTransaction)}
                    title={t('finance.transactions.actions.delete', { defaultValue: 'Delete' }) as string}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.details.amount')}</span>
                  <span className={`font-semibold ${
                    selectedTransaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {selectedTransaction.type === 'income' ? '+' : '-'}{formatCurrency(selectedTransaction.amount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.details.category')}</span>
                  <span className="font-medium">{translateCategory(selectedTransaction.category)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.details.date')}</span>
                  <span className="font-medium">
                    {selectedTransaction.date.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.details.account')}</span>
                  <span className="font-medium">
                    {accounts.find(acc => acc.id === selectedTransaction.accountId)?.name || t('finance.section.transactions.unknownAccount')}
                  </span>
                </div>

                {selectedTransaction.description && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('finance.transactions.details.description')}</span>
                    <span className="font-medium text-right max-w-48 truncate">
                      {selectedTransaction.description}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.transactions.details.currency')}</span>
                  <span className="font-medium">{selectedTransaction.currency}</span>
                </div>

                {selectedTransaction.tags.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">{t('finance.transactions.details.tags')}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTransaction.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-surface-2 rounded-full text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SlideUpModal>

        {/* Goal Progress Dialog */}
        <SlideUpModal
          isOpen={showGoalProgress}
          onClose={() => {
            setShowGoalProgress(false);
            setSelectedGoal(null);
            setGoalProgressAmount('');
          }}
          title={t('finance.section.goals.progress.title')}
        >
          {selectedGoal && (
            <div className="space-y-4 p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-lg mb-2">{selectedGoal.name}</h3>
                <div className="text-sm text-muted-foreground">
                  {t('finance.analyst.goals.summary.of', { current: formatCurrency(selectedGoal.currentAmount), target: formatCurrency(selectedGoal.targetAmount) })}
                </div>
                <Progress 
                  value={Math.min((selectedGoal.currentAmount / selectedGoal.targetAmount) * 100, 100)} 
                  className="h-2 mt-2"
                />
              </div>

              <div>
                <Label>{t('finance.section.goals.progress.addSavings')}</Label>
                <Input
                  type="number"
                  placeholder={t('finance.section.goals.progress.amountPlaceholder') as string}
                  value={goalProgressAmount}
                  onChange={(e) => setGoalProgressAmount(e.target.value)}
                  className="mt-1 h-11 bg-surface-1 border-border rounded-xl"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {t('finance.section.goals.progress.note', { amount: formatCurrency(selectedGoal.currentAmount) })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowGoalProgress(false);
                    setSelectedGoal(null);
                    setGoalProgressAmount('');
                  }}
                  className="h-11 rounded-xl"
                >
                  {t('common.cancel')}
                </Button>
                <Button 
                  onClick={handleUpdateGoalProgress}
                  className="bg-money-gradient text-black h-11 rounded-xl font-semibold hover:shadow-money transition-all"
                >
                  {t('finance.section.goals.progress.update')}
                </Button>
              </div>
            </div>
          )}
        </SlideUpModal>
      </div>
    );
  }
);

FinanceSection.displayName = 'FinanceSection';

export default FinanceSection;