"use client";

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Crown,
} from "lucide-react";
import { Doughnut, Line } from "react-chartjs-2";
import { ScaleButton } from "@/components/iOSAnimations";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler
);

interface PlannerAnalyticsData {
  completed: number;
  inProgress: number;
  todo: number;
  total: number;
  completionRate: number;
  streak: number;
  weeklyTasks: number[];   // ← counts of tasks COMPLETED per day (last 7 days)
  weeklyLabels: string[];  // e.g., ["Mon","Tue",...]
  priorityDistribution: { high: number; medium: number; low: number };
  totalCompleted: number;
}

interface PlannerAnalyticsProps {
  data: PlannerAnalyticsData;
  subscriptionPlan?: "free" | "lite" | "pro";
  onUpgrade?: () => void;
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  delay = 0,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  delay?: number;
}) => {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendCls =
    trend === "up"
      ? "bg-[#10B981]/10 text-[#10B981]"
      : trend === "down"
      ? "bg-red-500/10 text-red-500"
      : "bg-gray-500/10 text-gray-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
  className="glass-card p-4 rounded-xl border border-money-green/20"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[#10B981]/10">
            <Icon className="h-4 w-4 text-[#10B981]" />
          </div>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        {trend && (
          <div className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${trendCls}`}>
            <TrendIcon className="w-3 h-3" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </motion.div>
  );
};

export const PlannerAnalytics = ({
  data,
  subscriptionPlan = "free",
  onUpgrade,
}: PlannerAnalyticsProps) => {
  const { t } = useTranslation('app');
  const isBlurred = subscriptionPlan === "free";

  const completionChartData = useMemo(
    () => ({
      labels: [
        t('planner.status.completed'),
        t('planner.status.in_progress'),
        t('planner.status.todo')
      ],
      datasets: [
        {
          data: [data.completed, data.inProgress, data.todo],
          backgroundColor: ["#10B981", "#FFD700", "#6B7280"],
          borderColor: ["#10B981", "#FFD700", "#6B7280"],
          borderWidth: 2,
          hoverBorderWidth: 3,
        },
      ],
    }),
    [data.completed, data.inProgress, data.todo, t]
  );

  const priorityChartData = useMemo(
    () => ({
      labels: [
        `${t('planner.priority.high')} ${t('planner.detail.prioritySuffix')}`,
        `${t('planner.priority.medium')} ${t('planner.detail.prioritySuffix')}`,
        `${t('planner.priority.low')} ${t('planner.detail.prioritySuffix')}`
      ],
      datasets: [
        {
          data: [
            data.priorityDistribution.high,
            data.priorityDistribution.medium,
            data.priorityDistribution.low,
          ],
          backgroundColor: ["#EF4444", "#F59E0B", "#10B981"],
          borderColor: ["#EF4444", "#F59E0B", "#10B981"],
          borderWidth: 2,
        },
      ],
    }),
    [data.priorityDistribution, t]
  );

  const weeklyTrendsData = useMemo(
    () => ({
      labels: data.weeklyLabels,
      datasets: [
        {
          label: t('planner.status.completed'),
          data: data.weeklyTasks, // ← expects counts of completed tasks per day
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#10B981",
          pointBorderColor: "#10B981",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    }),
    [data.weeklyLabels, data.weeklyTasks, t]
  );

  const baseChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: "#E6E8EA",
            usePointStyle: true,
            padding: 15,
            font: { size: 12 },
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 17, 20, 0.9)",
          titleColor: "#E6E8EA",
          bodyColor: "#E6E8EA",
          borderColor: "#10B981",
          borderWidth: 1,
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.parsed?.y ?? ctx.parsed;
              return ` ${t('planner.status.completed')}: ${v}`;
            },
          },
        },
      },
    }),
    [t]
  );

  const lineChartOptions = useMemo(
    () => ({
      ...baseChartOptions,
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#9CA3AF" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#9CA3AF",
            stepSize: 1,
            precision: 0,
          },
        },
      },
    }),
    [baseChartOptions]
  );

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto relative">
      {/* Content (blur for free plan) */}
      <div className={isBlurred ? "filter blur-sm" : ""}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl font-bold text-foreground mb-2">{t('planner.analytics.header')}</h2>
          <p className="text-muted-foreground">{t('planner.analytics.subheader')}</p>
        </motion.div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title={t('planner.analytics.cards.completionRate.title')}
            value={`${data.completionRate}%`}
            subtitle={
              data.total > 0
                ? t('planner.analytics.cards.completionRate.subtitle', { completed: data.completed, total: data.total })
                : t('planner.analytics.cards.completionRate.noTasks')
            }
            icon={Target}
            trend={data.completionRate >= 80 ? "up" : data.completionRate >= 50 ? "neutral" : "down"}
            delay={0.1}
          />
          <StatCard
            title={t('planner.analytics.cards.streak.title')}
            value={data.streak}
            subtitle={
              data.streak === 0
                ? t('planner.analytics.cards.streak.start')
                : `${data.streak} ${data.streak === 1 ? t('planner.analytics.time.day') : t('planner.analytics.time.days')} ${t('planner.analytics.cards.streak.inARow')}`
            }
            icon={Zap}
            trend={data.streak > 0 ? "up" : "neutral"}
            delay={0.2}
          />
          <StatCard
            title={t('planner.analytics.cards.totalCompleted.title')}
            value={data.totalCompleted}
            subtitle={t('planner.analytics.cards.totalCompleted.subtitle')}
            icon={CheckCircle}
            trend={data.totalCompleted > 0 ? "up" : "neutral"}
            delay={0.3}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Task Status */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card p-6 rounded-xl border border-money-green/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-[#10B981]" />
              <h3 className="text-lg font-semibold text-foreground">{t('planner.analytics.sections.taskStatus.title')}</h3>
            </div>

            {data.total > 0 ? (
              <>
                <div className="h-64 flex items-center justify-center">
                  <Doughnut data={completionChartData} options={baseChartOptions as any} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">{t('planner.status.completed')}</div>
                    <div className="text-lg font-bold text-[#10B981]">{data.completed}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('planner.status.in_progress')}</div>
                    <div className="text-lg font-bold text-[#FFD700]">{data.inProgress}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('planner.status.todo')}</div>
                    <div className="text-lg font-bold text-gray-400">{data.todo}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('planner.analytics.sections.taskStatus.emptyTitle')}</p>
                  <p className="text-sm">{t('planner.analytics.sections.taskStatus.emptySubtitle')}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Priority Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
              className="glass-card p-6 rounded-xl border border-money-green/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-[#10B981]" />
              <h3 className="text-lg font-semibold text-foreground">{t('planner.analytics.sections.priorityDistribution.title')}</h3>
            </div>

            {data.total > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <Doughnut data={priorityChartData} options={baseChartOptions as any} />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('planner.analytics.sections.priorityDistribution.emptyTitle')}</p>
                  <p className="text-sm">{t('planner.analytics.sections.priorityDistribution.emptySubtitle')}</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Weekly Completions Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="glass-card p-6 rounded-xl border border-money-green/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-[#10B981]" />
            <h3 className="text-lg font-semibold text-foreground">{t('planner.analytics.sections.trends.title')}</h3>
            <span className="text-sm text-muted-foreground ml-auto">{t('planner.analytics.time.last7days')}</span>
          </div>

          {data.weeklyTasks.some((n) => n > 0) ? (
            <div className="h-64">
              <Line data={weeklyTrendsData} options={lineChartOptions as any} />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('planner.analytics.sections.trends.emptyTitle')}</p>
                <p className="text-sm">{t('planner.analytics.sections.trends.emptySubtitle')}</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Blur overlay for free users */}
      {isBlurred && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
          <div className="text-center p-4">
            <Crown className="h-8 w-8 mx-auto mb-2 text-money-green" />
            <p className="text-sm font-medium text-white mb-1">{t('planner.analytics.overlay.title')}</p>
            <p className="text-xs text-white/80 mb-3">{t('planner.analytics.overlay.subtitle', { plan: t('plans.lite') })}</p>
            <ScaleButton onClick={onUpgrade}>
              <div className="bg-money-gradient text-[#0a0b0d] px-4 py-2 rounded-lg text-sm font-medium">
                {t('planner.analytics.overlay.upgradeCta', { plan: t('plans.lite') })}
              </div>
            </ScaleButton>
          </div>
        </div>
      )}
    </div>
  );
};
