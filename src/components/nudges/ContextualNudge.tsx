"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, FileText, Target, Zap, Crown, PiggyBank, Award } from "lucide-react";
import { useSubscriptionNudges, type PlanType } from "@/hooks/useContextualNudges";
import { ScaleButton } from "@/components/iOSAnimations";

interface ContextualNudgeProps {
  currentPlan: PlanType;
  onUpgrade: (contextTrigger?: string) => void;
}

const nudgeIcons = {
  'finance-second-account': PiggyBank,
  'export-attempt': FileText,
  'pdf-attempt': FileText,
  'streak-nudge': Award,
  default: Crown
};

export const ContextualNudge: React.FC<ContextualNudgeProps> = ({ 
  currentPlan, 
  onUpgrade 
}) => {
  const { currentNudge, isVisible, dismissNudge, convertNudge } = useSubscriptionNudges(currentPlan);

  if (!currentNudge || !isVisible) return null;

  const IconComponent = nudgeIcons[currentNudge.type] || nudgeIcons.default;

  const handleDismiss = () => {
    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(50); } catch {}
      }
    }
    dismissNudge();
  };

  const handleConvert = () => {
    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([50, 50, 100]); } catch {}
      }
    }
    convertNudge();
    onUpgrade(currentNudge.type);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-safe"
        style={{ backdropFilter: "blur(8px)" }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40"
          onClick={handleDismiss}
        />

        {/* Nudge Card */}
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            scale: 1,
          }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            damping: 25, 
            stiffness: 300,
            duration: 0.4 
          }}
          className="relative w-full max-w-sm"
        >
          {/* Pulsing glow effect */}
          <motion.div
            animate={{ 
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.02, 1] 
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="absolute inset-0 rounded-2xl bg-money-green/20 blur-xl"
          />

          {/* Glass card */}
          <div className="glass-card relative rounded-2xl border border-money-green/20 p-6 shadow-2xl">
            {/* Header with icon and dismiss */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-money-green/20">
                  <IconComponent className="h-5 w-5 text-money-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-lg text-foreground truncate">
                    {currentNudge.title}
                  </h3>
                  {currentNudge.priority === 1 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="h-2 w-2 rounded-full bg-money-green animate-pulse" />
                      <span className="text-xs text-money-green font-medium">High Priority</span>
                    </div>
                  )}
                </div>
              </div>
              
              <ScaleButton
                onClick={handleDismiss}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </ScaleButton>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {currentNudge.description}
            </p>

            {/* CTA Button */}
            <ScaleButton
              onClick={handleConvert}
              className="w-full"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-xl bg-money-gradient py-4 px-6 shadow-money"
              >
                <span className="font-semibold text-black text-center block">
                  {currentNudge.ctaText}
                </span>
              </motion.div>
            </ScaleButton>

            {/* Contextual footer */}
            {currentNudge.type === "streak-nudge" && (
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Join 10,000+ users who upgraded this month
                </p>
              </div>
            )}

            {currentNudge.type === "finance-second-account" && (
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Track expenses • Set budgets • Reach goals
                </p>
              </div>
            )}

            {(currentNudge.type === "export-attempt" || currentNudge.type === "pdf-attempt") && (
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  PDF, CSV, Excel formats available
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};