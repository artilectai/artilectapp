"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Calendar,
  Award,
  Zap,
  Flame,
  Star,
  ArrowUp,
  ArrowDown,
  MoreHorizontal
} from 'lucide-react';

// TypeScript Interfaces
interface ProgressChartsAnalyticsProps {
  data: {
    income: number;
    expense: number;
    savings: number;
    accounts: number;
    transactions: number;
    savingsRate: number;
  };
  title?: string;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

// Custom Components
const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, trend }) => {
  return (
    <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20 hover:bg-surface-1/70 transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {trend === 'up' && <ArrowUp className="h-3 w-3 text-success" />}
              {trend === 'down' && <ArrowDown className="h-3 w-3 text-danger" />}
              <span className={`text-xs font-medium ${
                trend === 'up' ? 'text-success' : 
                trend === 'down' ? 'text-danger' : 'text-muted-foreground'
              }`}>
                {change > 0 ? '+' : ''}{change}%
              </span>
            </div>
          </div>
          <div className="text-primary/70">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
};

const TimePeriodSelector: React.FC<{
  selected: string;
  onSelect: (period: string) => void;
}> = ({ selected, onSelect }) => {
  const { t } = useTranslation('app');
  const periods = [
    { value: '7d', label: t('finance.analytics.periods.7d') },
    { value: '30d', label: t('finance.analytics.periods.30d') },
    { value: '90d', label: t('finance.analytics.periods.90d') },
    { value: '1y', label: t('finance.analytics.periods.1y') },
  ];

  return (
    <div className="flex bg-surface-2/50 rounded-lg p-1 backdrop-blur-sm">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant={selected === period.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelect(period.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
            selected === period.value 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
};

export const ProgressChartsAnalytics: React.FC<ProgressChartsAnalyticsProps & { currency?: 'UZS' | 'USD' | 'EUR' | 'RUB' }> = ({ 
  data, 
  title = "Financial Analytics",
  className = "",
  currency
}) => {
  const { t } = useTranslation('app');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);

  const handlePeriodChange = (period: string) => {
    setIsLoading(true);
    setSelectedPeriod(period);
    // Simulate loading
    setTimeout(() => setIsLoading(false), 300);
  };

  const currentCurrency = currency || (typeof window !== 'undefined' ? (localStorage.getItem('finance_currency') as any) : 'UZS') || 'UZS';
  const formatCurrency = (value: number) => {
    if (currentCurrency === 'UZS') return 'UZS ' + new Intl.NumberFormat('uz-UZ').format(value);
    const symbol = currentCurrency === 'USD' ? '$' : currentCurrency === 'EUR' ? '€' : currentCurrency === 'RUB' ? '₽' : '';
    return symbol + new Intl.NumberFormat('en-US').format(value);
  };

  const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-1/95 backdrop-blur-sm border border-border/20 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate basic statistics from real user data
  const summaryStats = useMemo(() => {
    const netWorth = data.income - data.expense; // Simple calculation
    
    return {
      netWorth: {
        value: netWorth,
        change: 0 // Can't calculate change without historical data
      },
      income: {
        value: data.income,
        change: 0
      },
      expenses: {
        value: data.expense,
        change: 0
      },
      savings: {
        value: data.savings,
        change: 0
      }
    };
  }, [data]);

  // Only show analytics if user has meaningful data
  const hasData = data.transactions > 0 || data.accounts > 0;

  if (!hasData) {
    return (
      <div className={`w-full ${className}`}>
        <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
          <CardContent className="p-8 text-center">
            <div className="mb-4">
              <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">{t('finance.analytics.empty.title')}</h3>
            <p className="text-muted-foreground mb-4">{t('finance.analytics.empty.description')}</p>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-muted-foreground">{data.accounts}</div>
                <div className="text-sm text-muted-foreground">{t('finance.analytics.empty.accounts')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">{data.transactions}</div>
                <div className="text-sm text-muted-foreground">{t('finance.analytics.empty.transactions')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto p-4 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title || t('finance.analytics.title')}</h1>
          <p className="text-muted-foreground">{t('finance.analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <TimePeriodSelector selected={selectedPeriod} onSelect={handlePeriodChange} />
        </div>
      </div>

      {/* Quick Stats - Based on Real User Data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('finance.analytics.stats.totalBalance')}
          value={formatCurrency(summaryStats.netWorth.value)}
          change={summaryStats.netWorth.change}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={summaryStats.netWorth.value >= 0 ? "up" : "down"}
        />
        <StatCard
          title={t('finance.analytics.stats.income')}
          value={formatCurrency(summaryStats.income.value)}
          change={summaryStats.income.change}
          icon={<DollarSign className="h-5 w-5" />}
          trend="up"
        />
        <StatCard
          title={t('finance.analytics.stats.expenses')}
          value={formatCurrency(summaryStats.expenses.value)}
          change={summaryStats.expenses.change}
          icon={<TrendingDown className="h-5 w-5" />}
          trend="down"
        />
        <StatCard
          title={t('finance.analytics.stats.savings')}
          value={formatCurrency(summaryStats.savings.value)}
          change={data.savingsRate}
          icon={<Target className="h-5 w-5" />}
          trend={summaryStats.savings.value >= 0 ? "up" : "down"}
        />
      </div>

      {/* Main Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 bg-surface-2/50 backdrop-blur-sm">
          <TabsTrigger value="overview">{t('finance.analytics.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="insights">{t('finance.analytics.tabs.insights')}</TabsTrigger>
          <TabsTrigger value="summary" className="hidden lg:block">{t('finance.analytics.tabs.summary')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Simple Financial Overview */}
          <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t('finance.analytics.overview.title')}
              </CardTitle>
              <CardDescription>{t('finance.analytics.overview.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">
                    {formatCurrency(data.income)}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('finance.analytics.overview.totalIncome')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-400 mb-2">
                    {formatCurrency(data.expense)}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('finance.analytics.overview.totalExpenses')}</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${data.savings >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {formatCurrency(data.savings)}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('finance.analytics.overview.netSavings')}</div>
                </div>
              </div>
              
              {/* Savings Rate Progress */}
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span>{t('finance.analytics.overview.savingsRate')}</span>
                  <span>{data.savingsRate}%</span>
                </div>
                <Progress 
                  value={Math.max(0, Math.min(100, data.savingsRate))} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {data.savingsRate >= 20
                    ? t('finance.analytics.overview.savingsRateMessages.excellent')
                    : data.savingsRate >= 10
                    ? t('finance.analytics.overview.savingsRateMessages.good')
                    : t('finance.analytics.overview.savingsRateMessages.consider')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Summary */}
          <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
            <CardHeader>
        <CardTitle>{t('finance.analytics.accountSummary.title')}</CardTitle>
        <CardDescription>{t('finance.analytics.accountSummary.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-foreground">{data.accounts}</div>
          <div className="text-sm text-muted-foreground">{t('finance.analytics.accountSummary.activeAccounts')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{data.transactions}</div>
          <div className="text-sm text-muted-foreground">{t('finance.analytics.accountSummary.totalTransactions')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Dynamic Insights Based on Real Data */}
            {data.savingsRate > 20 && (
              <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-success" />
                    <CardTitle className="text-base">{t('finance.analytics.insights.excellentSaver.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('finance.analytics.insights.excellentSaver.message', { percent: data.savingsRate })}
                  </p>
                </CardContent>
              </Card>
            )}

            {data.savingsRate < 0 && (
              <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-warning" />
                    <CardTitle className="text-base">{t('finance.analytics.insights.budgetAlert.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('finance.analytics.insights.budgetAlert.message')}
                  </p>
                </CardContent>
              </Card>
            )}

            {data.transactions > 10 && (
              <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{t('finance.analytics.insights.activeTracker.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('finance.analytics.insights.activeTracker.message', { count: data.transactions })}
                  </p>
                </CardContent>
              </Card>
            )}

            {data.accounts > 1 && (
              <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{t('finance.analytics.insights.multiAccount.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('finance.analytics.insights.multiAccount.message', { count: data.accounts })}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Default insight if no specific conditions met */}
            {data.savingsRate >= 0 && data.savingsRate <= 20 && (
              <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{t('finance.analytics.insights.keepGrowing.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('finance.analytics.insights.keepGrowing.message')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          {/* Financial Health Score */}
          <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                {t('finance.analytics.summary.title')}
              </CardTitle>
              <CardDescription>{t('finance.analytics.summary.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">{t('finance.analytics.summary.overallScore')}</span>
                  <span className="text-lg font-bold">
                    {data.savingsRate >= 20 ? '85/100' : 
                     data.savingsRate >= 10 ? '70/100' : 
                     data.savingsRate >= 0 ? '55/100' : '35/100'}
                  </span>
                </div>
                <Progress 
                  value={data.savingsRate >= 20 ? 85 : 
                         data.savingsRate >= 10 ? 70 : 
                         data.savingsRate >= 0 ? 55 : 35} 
                  className="h-3"
                />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">{t('finance.analytics.summary.savingsRate')}</div>
                    <div className="text-muted-foreground">{data.savingsRate}%</div>
                  </div>
                  <div>
                    <div className="font-medium">{t('finance.analytics.summary.activityLevel')}</div>
                    <div className="text-muted-foreground">
                      {data.transactions > 20 ? t('finance.analytics.summary.activity.high') : 
                       data.transactions > 10 ? t('finance.analytics.summary.activity.medium') : t('finance.analytics.summary.activity.low')}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-surface-1/50 backdrop-blur-sm border-border/20">
            <CardHeader>
      <CardTitle>{t('finance.analytics.actions.title')}</CardTitle>
      <CardDescription>{t('finance.analytics.actions.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.savingsRate < 10 && (
                  <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <Target className="h-4 w-4 text-warning" />
        <span className="text-sm">{t('finance.analytics.actions.increaseSavingsRate')}</span>
                  </div>
                )}
                {data.transactions < 10 && (
                  <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <Star className="h-4 w-4 text-primary" />
        <span className="text-sm">{t('finance.analytics.actions.keepTracking')}</span>
                  </div>
                )}
                {data.accounts === 1 && (
                  <div className="flex items-center gap-3 p-3 bg-info/10 border border-info/20 rounded-lg">
                    <DollarSign className="h-4 w-4 text-info" />
        <span className="text-sm">{t('finance.analytics.actions.addSavingsAccount')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};