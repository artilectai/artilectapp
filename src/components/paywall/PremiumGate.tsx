"use client";

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumGateProps {
  children: React.ReactNode;
  requiredPlan: 'lite' | 'pro';
  currentPlan: 'free' | 'lite' | 'pro';
  onUpgrade: (contextTrigger?: string) => void;
  blurIntensity?: 'light' | 'medium' | 'heavy';
  lockMessage?: string;
  feature?: string;
  className?: string;
}

const PLAN_HIERARCHY = {
  free: 0,
  lite: 1,
  pro: 2
};

const BLUR_CLASSES = {
  light: 'backdrop-blur-sm',
  medium: 'backdrop-blur-md', 
  heavy: 'backdrop-blur-lg'
};

const LOCK_MESSAGES = {
  lite: 'Upgrade to Premium Lite to unlock this feature',
  pro: 'Upgrade to Premium Pro to unlock this feature'
};

const PLAN_ICONS = {
  lite: Crown,
  pro: Star
};

const PLAN_COLORS = {
  lite: 'text-gold',
  pro: 'text-money-green'
};

export const PremiumGate: React.FC<PremiumGateProps> = ({
  children,
  requiredPlan,
  currentPlan,
  onUpgrade,
  blurIntensity = 'medium',
  lockMessage,
  feature,
  className
}) => {
  const hasAccess = PLAN_HIERARCHY[currentPlan] >= PLAN_HIERARCHY[requiredPlan];
  
  const handleUpgradeClick = useCallback(() => {
    // Haptic feedback for iOS
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(10); } catch {}
      }
    }
    
    // Analytics context
    const contextTrigger = feature ? `premium_gate_${feature}` : 'premium_gate';
    onUpgrade(contextTrigger);
  }, [onUpgrade, feature]);

  if (hasAccess) {
    return <>{children}</>;
  }

  const LockIcon = PLAN_ICONS[requiredPlan];
  const lockColor = PLAN_COLORS[requiredPlan];
  const displayMessage = lockMessage || LOCK_MESSAGES[requiredPlan];
  const blurClass = BLUR_CLASSES[blurIntensity];

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Render content with blur */}
      <div className={cn("pointer-events-none select-none", blurClass)}>
        {children}
      </div>

      {/* Premium gate overlay */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 cursor-pointer active:scale-[0.98] transition-transform duration-100"
          onClick={handleUpgradeClick}
        >
          {/* Lock icon with pulsing animation */}
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.8, 1, 0.8]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={cn(
              "mb-3 p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10",
              lockColor
            )}
          >
            <LockIcon size={24} className="drop-shadow-sm" />
          </motion.div>

          {/* Lock message */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center px-4"
          >
            <p className="text-sm font-medium text-white drop-shadow-sm mb-1">
              {displayMessage}
            </p>
            <p className="text-xs text-white/70 drop-shadow-sm">
              Tap anywhere to upgrade
            </p>
          </motion.div>

          {/* Subtle gradient overlay for better readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30 pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Glass effect border */}
      <div className="absolute inset-0 rounded-lg border border-white/5 pointer-events-none" />
    </div>
  );
};