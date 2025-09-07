"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, 
  PiggyBank, CreditCard, Wallet, ArrowUpRight, ArrowDownRight,
  DollarSign, Calendar, BarChart3, Zap, Shield,
  ChevronRight, Info, Lightbulb, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Types for financial data
interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  type: 'income' | 'expense';
  account: string;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  currency: string;
}

interface Budget {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  period: 'monthly' | 'weekly' | 'yearly';
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
}

interface FinancialData {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  currency: 'UZS' | 'USD' | 'EUR' | 'RUB';
}

interface AnalysisProps {
  data: FinancialData;
  onInsightClick?: (insight: any) => void;
}

// Currency formatting utility
const formatCurrency = (
  amount: number,
  currency: 'USD' | 'EUR' | 'RUB' | 'UZS'
) => {
  const formatters: Record<'USD' | 'EUR' | 'RUB' | 'UZS', Intl.NumberFormat> = {
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    EUR: new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }),
    RUB: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }),
    UZS: new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' })
  };
  return formatters[currency]?.format(amount) || `${amount} ${currency}`;
};

// Analysis calculations
const useFinancialAnalysis = (data: FinancialData) => {
  return useMemo(() => {
    const { transactions, accounts, budgets, goals } = data;
    
    // Calculate totals
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Cash flow
    const netCashFlow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100) : 0;
    
    // Spending by category
    const spendingByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
    
    // Budget analysis
    const budgetPerformance = budgets.map(budget => ({
      ...budget,
      usage: (budget.spent / budget.budgeted) * 100,
      remaining: budget.budgeted - budget.spent,
      status: budget.spent > budget.budgeted ? 'over' : 
              budget.spent > budget.budgeted * 0.8 ? 'warning' : 'good'
    }));
    
    // Goal progress
    const goalProgress = goals.map(goal => ({
      ...goal,
      progress: (goal.currentAmount / goal.targetAmount) * 100,
      remaining: goal.targetAmount - goal.currentAmount,
      daysLeft: Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    }));
    
    // Monthly trends (simplified)
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      const monthStr = month.toISOString().slice(0, 7);
      
      const monthTransactions = transactions.filter(t => t.date.startsWith(monthStr));
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      return {
        month: month.toLocaleDateString('en-US', { month: 'short' }),
        income,
        expenses,
        netFlow: income - expenses
      };
    }).reverse();
    
    // Financial health score
    const healthFactors = [
      { name: 'Savings Rate', score: Math.min(savingsRate / 20 * 100, 100), weight: 0.3 },
      { name: 'Budget Adherence', score: budgetPerformance.filter(b => b.status === 'good').length / budgetPerformance.length * 100, weight: 0.2 },
      { name: 'Emergency Fund', score: Math.min(totalBalance / (totalExpenses * 3) * 100, 100), weight: 0.3 },
      { name: 'Goal Progress', score: goalProgress.reduce((sum, g) => sum + g.progress, 0) / goalProgress.length || 0, weight: 0.2 }
    ];
    
    const healthScore = healthFactors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);
    
    // Generate insights
    const insights = [];
    
    if (savingsRate < 10) {
      insights.push({
        type: 'warning',
        title: 'Low Savings Rate',
        description: `Your savings rate is ${savingsRate.toFixed(1)}%. Try to save at least 20% of your income.`,
        action: 'Review expenses',
        priority: 'high'
      });
    }
    
    budgetPerformance.forEach(budget => {
      if (budget.status === 'over') {
        insights.push({
          type: 'alert',
          title: 'Budget Exceeded',
          description: `You've exceeded your ${budget.category} budget by ${formatCurrency(budget.spent - budget.budgeted, data.currency)}.`,
          action: 'Adjust spending',
          priority: 'high'
        });
      }
    });
    
    if (totalBalance < totalExpenses * 3) {
      insights.push({
        type: 'warning',
        title: 'Low Emergency Fund',
        description: 'Consider building an emergency fund covering 3-6 months of expenses.',
        action: 'Start saving',
        priority: 'medium'
      });
    }
    
    const topSpendingCategory = Object.entries(spendingByCategory)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topSpendingCategory) {
      insights.push({
        type: 'info',
        title: 'Top Spending Category',
        description: `Your highest spending is in ${topSpendingCategory[0]}: ${formatCurrency(topSpendingCategory[1], data.currency)}.`,
        action: 'Analyze category',
        priority: 'low'
      });
    }
    
    return {
      totalBalance,
      totalIncome,
      totalExpenses,
      netCashFlow,
      savingsRate,
      spendingByCategory,
      budgetPerformance,
      goalProgress,
      monthlyData,
      healthScore,
      healthFactors,
      insights
    };
  }, [data]);
};

export const FinancialAnalyst: React.FC<AnalysisProps> = ({ data, onInsightClick }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const analysis = useFinancialAnalysis(data);

  const {
    totalBalance,
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    spendingByCategory,
    budgetPerformance,
    goalProgress,
    monthlyData,
    healthScore,
    healthFactors,
    insights
  } = analysis;

  // Chart colors
  const chartColors = ['#10B981', '#FFD700', '#EF4444', '#8B5CF6', '#F59E0B', '#06B6D4'];
  
  // Spending chart data
  const spendingChartData = Object.entries(spendingByCategory)
    .map(([category, amount], index) => ({
      name: category,
      value: amount,
      fill: chartColors[index % chartColors.length]
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Analysis</h1>
          <p className="text-muted-foreground">AI-powered insights for your finances</p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1month">1 Month</SelectItem>
            <SelectItem value="3months">3 Months</SelectItem>
            <SelectItem value="6months">6 Months</SelectItem>
            <SelectItem value="1year">1 Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Financial Health Score */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-money-green" />
            <CardTitle className="text-lg">Financial Health Score</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="rgba(16, 185, 129, 0.2)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10B981"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - healthScore / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-money-green">
                  {Math.round(healthScore)}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">
                {healthScore >= 80 ? 'Excellent' : 
                 healthScore >= 60 ? 'Good' : 
                 healthScore >= 40 ? 'Fair' : 'Needs Improvement'}
              </h3>
              <div className="space-y-2">
                {healthFactors.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{factor.name}</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={factor.score} 
                        className="w-16 h-2" 
                      />
                      <span className="text-xs w-8 text-right">
                        {Math.round(factor.score)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-money-green/10">
                <Wallet className="h-5 w-5 text-money-green" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className="text-lg font-semibold text-money-green">
                  {formatCurrency(totalBalance, data.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <PiggyBank className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Savings Rate</p>
                <p className="text-lg font-semibold text-warning">
                  {savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${netCashFlow >= 0 ? 'bg-money-green/10' : 'bg-destructive/10'}`}>
                {netCashFlow >= 0 ? 
                  <TrendingUp className="h-5 w-5 text-money-green" /> :
                  <TrendingDown className="h-5 w-5 text-destructive" />
                }
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Cash Flow</p>
                <p className={`text-lg font-semibold ${netCashFlow >= 0 ? 'text-money-green' : 'text-destructive'}`}>
                  {formatCurrency(netCashFlow, data.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Target className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Goals</p>
                <p className="text-lg font-semibold text-chart-2">
                  {goalProgress.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights & Alerts */}
      {insights.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-chart-2" />
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.slice(0, 3).map((insight, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface-1/50 cursor-pointer hover:bg-surface-1 transition-colors"
                  onClick={() => onInsightClick?.(insight)}
                >
                  <div className={`p-1 rounded-full ${
                    insight.type === 'alert' ? 'bg-destructive/10' :
                    insight.type === 'warning' ? 'bg-warning/10' :
                    'bg-info/10'
                  }`}>
                    {insight.type === 'alert' ? 
                      <AlertTriangle className="h-4 w-4 text-destructive" /> :
                      insight.type === 'warning' ?
                      <AlertCircle className="h-4 w-4 text-warning" /> :
                      <Info className="h-4 w-4 text-info" />
                    }
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <Badge 
                      variant="outline" 
                      className={`mt-1 text-xs ${
                        insight.priority === 'high' ? 'border-destructive text-destructive' :
                        insight.priority === 'medium' ? 'border-warning text-warning' :
                        'border-info text-info'
                      }`}
                    >
                      {insight.action}
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-surface-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Cash Flow Chart */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-lg">Cash Flow Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stackId="1"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stackId="2"
                    stroke="#EF4444"
                    fill="#EF4444"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spending" className="space-y-4">
          {/* Spending by Category */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-lg">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={spendingChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={(entry) => entry.name}
                  >
                    {spendingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(value as number, data.currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="grid grid-cols-2 gap-2 mt-4">
                {spendingChartData.slice(0, 4).map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted-foreground ml-auto">
                      {formatCurrency(item.value, data.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budgets" className="space-y-4">
          {budgetPerformance.map((budget, index) => (
            <Card key={index} className="glass-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">{budget.category}</h3>
                  <Badge 
                    variant="outline"
                    className={
                      budget.status === 'over' ? 'border-destructive text-destructive' :
                      budget.status === 'warning' ? 'border-warning text-warning' :
                      'border-money-green text-money-green'
                    }
                  >
                    {budget.status === 'over' ? 'Over Budget' :
                     budget.status === 'warning' ? 'Near Limit' : 'On Track'}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatCurrency(budget.spent, data.currency)} of {formatCurrency(budget.budgeted, data.currency)}
                    </span>
                    <span className={`font-medium ${
                      budget.usage > 100 ? 'text-destructive' :
                      budget.usage > 80 ? 'text-warning' :
                      'text-money-green'
                    }`}>
                      {budget.usage.toFixed(1)}%
                    </span>
                  </div>
                  
                  <Progress 
                    value={Math.min(budget.usage, 100)} 
                    className="h-2"
                  />
                  
                  <p className="text-xs text-muted-foreground">
                    {budget.remaining > 0 ? 
                      `${formatCurrency(budget.remaining, data.currency)} remaining` :
                      `${formatCurrency(Math.abs(budget.remaining), data.currency)} over budget`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          {goalProgress.map((goal, index) => (
            <Card key={index} className="glass-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">{goal.name}</h3>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {goal.daysLeft > 0 ? `${goal.daysLeft} days left` : 'Overdue'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatCurrency(goal.currentAmount, data.currency)} of {formatCurrency(goal.targetAmount, data.currency)}
                    </span>
                    <span className="font-medium text-money-green">
                      {goal.progress.toFixed(1)}%
                    </span>
                  </div>
                  
                  <Progress 
                    value={Math.min(goal.progress, 100)} 
                    className="h-2"
                  />
                  
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(goal.remaining, data.currency)} remaining
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};