"use client";

import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
  type PanInfo,
  type HTMLMotionProps,
} from "framer-motion";
import { Check, X, RotateCcw, Plus, TrendingUp, ArrowRight } from "lucide-react";
import { pushBackAction, popBackAction } from '@/lib/telegram-backstack';

/* -------------------------------- Springs -------------------------------- */

export const iosSpring = {
  default: { type: "spring", damping: 25, stiffness: 300 },
  gentle: { type: "spring", damping: 30, stiffness: 200 },
  snappy: { type: "spring", damping: 20, stiffness: 400 },
  bouncy: { type: "spring", damping: 15, stiffness: 300 },
} as const;

/* ------------------------------ Safe-area utils --------------------------- */

const SAFE_TOP = "env(safe-area-inset-top)";
const SAFE_BOTTOM = "env(safe-area-inset-bottom)";

/* Locks document scroll while a modal/sheet is open */
const useLockBodyScroll = (locked: boolean) => {
  useEffect(() => {
    if (!locked) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarComp = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarComp > 0) document.body.style.paddingRight = `${scrollbarComp}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [locked]);
};

/* ------------------------------ Haptics ctx ------------------------------ */

const HapticContext = createContext({
  triggerHaptic: (_type: "light" | "medium" | "heavy") => {},
});

export const HapticProvider = ({ children }: { children: React.ReactNode }) => {
  const triggerHaptic = (type: "light" | "medium" | "heavy") => {
    // Only attempt vibration on supported devices and within a user gesture
    const hasVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    // In most browsers, event handlers like onClick are considered user gestures.
    if (!hasVibrate) return;
    try {
      const patterns = { light: [10], medium: [20], heavy: [30, 10, 30] } as const;
      navigator.vibrate(patterns[type]);
    } catch {}
  };
  return <HapticContext.Provider value={{ triggerHaptic }}>{children}</HapticContext.Provider>;
};
const useHaptic = () => useContext(HapticContext);

/* ----------------------------- Buttons / taps ---------------------------- */

export const SpringButton = ({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) => {
  const { triggerHaptic } = useHaptic();
  const variants = {
    primary: "bg-[#00d563] text-[#0a0b0d] hover:bg-[#00b850]",
    secondary: "bg-surface-1 text-foreground border border-border hover:bg-surface-2",
    ghost: "text-foreground hover:bg-surface-1",
  };
  const sizes = {
    sm: "px-3 py-2 text-sm min-h-[44px]",
    md: "px-4 py-2.5 text-base min-h-[44px]",
    lg: "px-5 py-3 text-lg min-h-[48px]",
  };
  return (
    <motion.button
      type="button"
      className={`rounded-full font-medium transition-colors relative overflow-hidden ${variants[variant]} ${sizes[size]} ${className} ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={iosSpring.snappy}
      onClick={(e) => {
        if (disabled) return;
        triggerHaptic("light");
        onClick?.(e);
      }}
      disabled={disabled}
    >
      <motion.div
        className="absolute inset-0 bg-white/20 rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        whileTap={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.1 }}
      />
      {children}
    </motion.button>
  );
};

type ScaleButtonProps = HTMLMotionProps<"button"> & {
  scaleAmount?: number;
  variant?: "default" | "outline" | "destructive" | "ghost" | "secondary";
  size?: "sm" | "md" | "lg";
};
export const ScaleButton = ({
  children,
  className = "",
  scaleAmount = 0.95,
  onClick,
  ...rest
}: ScaleButtonProps) => {
  const { triggerHaptic } = useHaptic();
  return (
    <motion.button
      type="button"
      className={`min-h-[44px] ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: scaleAmount }}
      transition={iosSpring.snappy}
      onClick={(e) => {
        triggerHaptic("light");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
};

/* --------------------------------- Sheet --------------------------------- */

export const SlideUpModal = ({
  isOpen,
  onClose,
  children,
  title,
  className = "",
  height = 'auto',
  /** Optional className to control padding/spacing of the scrollable body; defaults to 'pb-20' */
  bodyClassName,
  /** Hide the tiny spacer div at the end of the body */
  hideEndSpacer,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  /** Controls the sheet height; 'half' opens ~60vh, 'large' ~80vh, 'full' ~95vh, 'auto' keeps previous max height behavior */
  height?: 'auto' | 'half' | 'large' | 'full';
  bodyClassName?: string;
  hideEndSpacer?: boolean;
}) => {
  const { triggerHaptic } = useHaptic();
  useEffect(() => {
    if (isOpen) triggerHaptic("medium");
  }, [isOpen, triggerHaptic]);
  useLockBodyScroll(isOpen);

  // Stable viewport height that ignores the on-screen keyboard on mobile browsers.
  // We compute it once when the sheet opens and keep it fixed, so the sheet doesn't jump.
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const root = document.documentElement;
    const setStable = () => {
      const h = Math.max(window.innerHeight || 0, window.outerHeight || 0);
      root.style.setProperty('--stable-vh', `${h}px`);
    };
    // Set immediately
    setStable();
    // Update on orientation changes (not on keyboard open/close)
    const onOrient = () => setTimeout(setStable, 300);
    window.addEventListener('orientationchange', onOrient);
    return () => window.removeEventListener('orientationchange', onOrient);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Register a back action while open so TelegramBridge can route Back button
  useEffect(() => {
    if (!isOpen) return;
    const action = () => onClose();
    pushBackAction(action);
    return () => {
      popBackAction(action);
    };
  }, [isOpen, onClose]);

  // Determine target heights for body/container using a stable viewport var that ignores the keyboard.
  // Fallbacks: 100lvh (large viewport unit) and then 100vh.
  const vhVar = 'var(--stable-vh, 100lvh)';
  const calcH = (ratio: number) => `calc(${vhVar} * ${ratio})`;
  const containerHeight = height === 'half' ? calcH(0.6) : height === 'large' ? calcH(0.8) : height === 'full' ? calcH(0.95) : undefined;
  const bodyMaxHeight = containerHeight ? `calc(${containerHeight} - 56px)` : `calc(${vhVar} * 0.95 - 56px)`;
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            aria-hidden
            className="fixed inset-0 bg-black/50 z-[59]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`fixed bottom-0 left-0 right-0 z-[100] md:max-w-md md:left-1/2 md:-translate-x-1/2 bg-card rounded-t-3xl overflow-hidden ${className}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={iosSpring.default}
            style={{
              paddingBottom: `calc(${SAFE_BOTTOM} + 20px)`,
              height: containerHeight,
              // When using the dynamic stable height, keep a max so it never resizes with the keyboard
              maxHeight: containerHeight ? undefined : `calc(${vhVar} * 0.95)`,
              // Create its own composition layer to prevent layout shifts on iOS
              transform: 'translateZ(0)'
            }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) {
                onClose();
              }
            }}
          >
            <div
              className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-3"
              onPointerDown={(e) => dragControls.start(e)}
            />
            {title && (
              <div className="px-5 pb-3 sticky top-0 bg-card z-10">
                <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
              </div>
            )}
            {/* Scroll the body ONLY */}
            <div className={`px-5 overflow-y-auto overscroll-contain scrollbar-none ${bodyClassName ?? 'pb-20'}`} style={{ maxHeight: bodyMaxHeight }}>
              {children}
              {!hideEndSpacer && <div className="h-2" />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------ SwipeableCard ----------------------------- */

export const SwipeableCard = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className = "",
}: {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: { icon: React.ReactNode; color: string; label: string };
  rightAction?: { icon: React.ReactNode; color: string; label: string };
  className?: string;
}) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0, 100], [0.5, 1, 0.5]);
  const { triggerHaptic } = useHaptic();

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold && onSwipeRight) {
      triggerHaptic("medium");
      onSwipeRight();
    } else if (info.offset.x < -threshold && onSwipeLeft) {
      triggerHaptic("medium");
      onSwipeLeft();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {leftAction && (
        <motion.div
          className={`absolute left-0 top-0 h-full w-24 ${leftAction.color} flex items-center justify-center`}
          initial={{ x: -96 }}
          animate={{ x: x.get() > 0 ? 0 : -96 }}
        >
          <div className="text-white text-center">
            {leftAction.icon}
            <div className="text-xs mt-1">{leftAction.label}</div>
          </div>
        </motion.div>
      )}
      {rightAction && (
        <motion.div
          className={`absolute right-0 top-0 h-full w-24 ${rightAction.color} flex items-center justify-center`}
          initial={{ x: 96 }}
          animate={{ x: x.get() < 0 ? 0 : 96 }}
        >
          <div className="text-white text-center">
            {rightAction.icon}
            <div className="text-xs mt-1">{rightAction.label}</div>
          </div>
        </motion.div>
      )}
      <motion.div
        className={`bg-card border border-border rounded-xl ${className}`}
        style={{ x, opacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.02 }}
        transition={iosSpring.gentle}
      >
        {children}
      </motion.div>
    </div>
  );
};

/* ------------------------------ Pull to refresh --------------------------- */

export const PullToRefresh = ({
  onRefresh,
  children,
  refreshing = false,
}: {
  onRefresh: () => void;
  children: React.ReactNode;
  refreshing?: boolean;
}) => {
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, 100], [0, 180]);
  const { triggerHaptic } = useHaptic();
  const [showRefreshIcon, setShowRefreshIcon] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 && !refreshing) {
      triggerHaptic("heavy");
      onRefresh();
    }
    setShowRefreshIcon(false);
  };

  return (
    <motion.div
      style={{ y, touchAction: "pan-y" as any }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDrag={(_e, info) => setShowRefreshIcon(info.offset.y > 50)}
      onDragEnd={handleDragEnd}
      className="relative"
    >
      <AnimatePresence>
        {showRefreshIcon && (
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-4 z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <motion.div style={{ rotate }} className="w-8 h-8 bg-[#00d563] rounded-full flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-[#0a0b0d]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
};

/* --------------------------- Long press / slider -------------------------- */

export const LongPressButton = ({
  children,
  onLongPress,
  duration = 800,
  className = "",
}: {
  children: React.ReactNode;
  onLongPress: () => void;
  duration?: number;
  className?: string;
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const { triggerHaptic } = useHaptic();

  const start = () => {
    setIsPressed(true);
    triggerHaptic("light");
    timeoutRef.current = window.setTimeout(() => {
      triggerHaptic("heavy");
      onLongPress();
      setIsPressed(false);
    }, duration);
  };
  const end = () => {
    setIsPressed(false);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  };

  return (
    <motion.button
      type="button"
      className={`relative overflow-hidden min-h-[44px] ${className}`}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchEnd={end}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {isPressed && (
        <motion.div
          className="absolute inset-0 bg-[#00d563]/20 rounded-xl"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: duration / 1000, ease: "linear" }}
          style={{ transformOrigin: "left" }}
        />
      )}
      {children}
    </motion.button>
  );
};

export const DragToAction = ({
  children,
  onAction,
  actionText,
  threshold = 200,
  className = "",
}: {
  children: React.ReactNode;
  onAction: () => void;
  actionText?: string;
  threshold?: number;
  className?: string;
}) => {
  const { t } = useTranslation('app');
  const x = useMotionValue(0);
  const { triggerHaptic } = useHaptic();
  const [isCompleted, setIsCompleted] = useState(false);

  return (
    <div className={`relative bg-surface-1 rounded-xl p-1 ${className}`}>
  <div className="text-center text-muted-foreground text-sm py-2">{actionText ?? t('ios.dragToAction.slideToConfirm')}</div>
      <motion.div
        className="bg-[#00d563] rounded-lg p-3 cursor-grab active:cursor-grabbing"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: threshold }}
        onDragEnd={(_e, info) => {
          if (info.offset.x > threshold) {
            setIsCompleted(true);
            triggerHaptic("heavy");
            setTimeout(() => {
              onAction();
              setIsCompleted(false);
            }, 300);
          }
        }}
        whileDrag={{ scale: 1.05 }}
        animate={isCompleted ? { x: threshold } : {}}
        transition={iosSpring.snappy}
      >
        <div className="flex items-center justify-center text-[#0a0b0d]">
          {isCompleted ? <Check className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
        </div>
      </motion.div>
    </div>
  );
};

/* ------------------------------ Floating button --------------------------- */

export const FloatingActionButton = ({
  icon,
  actions = [],
  className = "",
}: {
  icon: React.ReactNode;
  actions?: Array<{ icon: React.ReactNode; label: string; onClick: () => void }>;
  className?: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { triggerHaptic } = useHaptic();

  return (
    <div
      className={`fixed right-5 z-50 ${className}`}
      style={{ bottom: `calc(${SAFE_BOTTOM} + 88px)` }} // avoids tab bar
    >
      <AnimatePresence>
        {isExpanded && actions.length > 0 && (
          <motion.div
            className="absolute bottom-16 right-0 space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={iosSpring.gentle}
          >
            {actions.map((action, i) => (
              <motion.button
                key={i}
                type="button"
                className="flex items-center gap-3 bg-card border border-border rounded-full px-4 py-3 shadow-lg min-h-[44px]"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ ...iosSpring.gentle, delay: i * 0.05 }}
                onClick={(e) => {
                  e.preventDefault();
                  action.onClick();
                  setIsExpanded(false);
                  triggerHaptic("light");
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {action.icon}
                <span className="text-sm font-medium">{action.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className="w-14 h-14 bg-[#00d563] rounded-full flex items-center justify-center shadow-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.preventDefault();
          setIsExpanded((v) => !v);
          triggerHaptic("medium");
        }}
        animate={{ rotate: isExpanded ? 45 : 0 }}
        transition={iosSpring.snappy}
      >
        <div className="text-[#0a0b0d]">{icon}</div>
      </motion.button>
    </div>
  );
};

/* ------------------------------ Segmented ctl ----------------------------- */

export const SegmentedControl = ({
  options = [],
  value,
  onChange,
  className = "",
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const { triggerHaptic } = useHaptic();
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div className={`relative bg-surface-1 rounded-xl p-1 flex min-h-[44px] ${className}`}>
      <motion.div
        className="absolute bg-[#00d563] rounded-lg"
        layoutId="segmentedControlBackground"
        transition={iosSpring.snappy}
        style={{
          width: `${100 / Math.max(1, options.length)}%`,
          height: "calc(100% - 8px)",
          top: "4px",
          left: `${(index * 100) / Math.max(1, options.length)}%`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`relative z-10 flex-1 px-3 text-sm font-medium rounded-lg transition-colors min-h-[44px] ${
            value === option.value ? "text-[#0a0b0d]" : "text-muted-foreground"
          }`}
          onClick={(e) => {
            e.preventDefault();
            onChange(option.value);
            triggerHaptic("light");
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

/* -------------------------------- ActionSheet ----------------------------- */

export const ActionSheet = ({
  isOpen,
  onClose,
  actions = [],
  title,
  message,
}: {
  isOpen: boolean;
  onClose: () => void;
  actions: Array<{ label: string; onClick: () => void; destructive?: boolean }>;
  title?: string;
  message?: string;
}) => {
  const { t } = useTranslation('app');
  const { triggerHaptic } = useHaptic();
  useEffect(() => {
    if (isOpen) triggerHaptic("medium");
  }, [isOpen, triggerHaptic]);
  useLockBodyScroll(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            aria-hidden
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed bottom-0 left-0 right-0 z-50 p-4 space-y-3 md:max-w-md md:left-1/2 md:-translate-x-1/2"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={iosSpring.default}
            style={{ paddingBottom: `calc(${SAFE_BOTTOM} + 12px)` }}
          >
            <div className="bg-card rounded-2xl overflow-hidden max-h-[70vh]">
              {(title || message) && (
                <div className="px-6 py-4 text-center border-b border-border">
                  {title && <div className="font-medium text-lg">{title}</div>}
                  {message && <div className="text-muted-foreground text-sm mt-1">{message}</div>}
                </div>
              )}
              <div className="overflow-y-auto overscroll-contain">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`w-full px-6 py-4 text-left hover:bg-surface-1 transition-colors min-h-[44px] ${
                      index !== actions.length - 1 ? "border-b border-border" : ""
                    } ${action.destructive ? "text-destructive" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      action.onClick();
                      onClose();
                      triggerHaptic("light");
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-card rounded-2xl px-6 py-4 font-medium min-h-[44px]"
              onClick={(e) => {
                e.preventDefault();
                onClose();
              }}
            >
              {t('common.cancel')}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/* ---------------------------------- Toast -------------------------------- */

export const Toast = ({
  message,
  type = "info",
  isVisible,
  onClose,
  duration = 3000,
}: {
  message: string;
  type?: "success" | "error" | "info";
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}) => {
  const { triggerHaptic } = useHaptic();
  const icons = {
    success: <Check className="w-5 h-5" />,
    error: <X className="w-5 h-5" />,
    info: <TrendingUp className="w-5 h-5" />,
  };
  const colors = {
    success: "bg-[#00d563] text-[#0a0b0d]",
    error: "bg-destructive text-destructive-foreground",
    info: "bg-card border border-border",
  };

  useEffect(() => {
    if (!isVisible) return;
    triggerHaptic("light");
    const t = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(t);
  }, [isVisible, duration, onClose, triggerHaptic]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed left-4 right-4 z-50"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={iosSpring.bouncy}
          style={{ top: `calc(${SAFE_TOP} + 12px)` }}
        >
          <div className={`rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg ${colors[type]}`}>
            {icons[type]}
            <span className="flex-1 font-medium">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* -------------------------------- Skeletons ------------------------------- */

export const LoadingSkeleton = ({ lines = 3, className = "" }: { lines?: number; className?: string }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div key={i} className="h-4 bg-surface-1 rounded-lg overflow-hidden relative" style={{ width: `${100 - i * 10}%` }}>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-surface-1 via-surface-2 to-surface-1"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
        </motion.div>
      ))}
    </div>
  );
};

/* ----------------------------- Finance widgets ---------------------------- */

export const CountUp = ({ value, duration = 1000, prefix = "$", className = "" }: { value: number; duration?: number; prefix?: string; className?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (value - startValue) * easeOutQuart;
      setDisplayValue(currentValue);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  return <span className={className}>{prefix}{displayValue.toFixed(2)}</span>;
};

export const ProgressRing = ({ progress, size = 120, strokeWidth = 8, className = "" }: { progress: number; size?: number; strokeWidth?: number; className?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className={`relative ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-surface-1" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          className="text-[#00d563]"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export const ChartBar = ({ value, maxValue, label, delay = 0, className = "" }: { value: number; maxValue: number; label: string; delay?: number; className?: string }) => {
  const height = Math.max(0, Math.min(100, (value / Math.max(1, maxValue)) * 100));
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="w-8 bg-surface-1 rounded-full h-32 mb-2 relative overflow-hidden">
        <motion.div className="absolute bottom-0 w-full bg-[#00d563] rounded-full" initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ ...iosSpring.bouncy, delay }} />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
};

export const TransactionCard = ({
  transaction,
  onDelete,
  className = "",
}: {
  transaction: { id: string; title: string; amount: number; type: "income" | "expense"; date: string };
  onDelete?: (id: string) => void;
  className?: string;
}) => {
  const { t } = useTranslation('app');
  return (
    <SwipeableCard
      className={`p-4 ${className}`}
      onSwipeLeft={() => onDelete?.(transaction.id)}
      leftAction={{ icon: <X className="w-5 h-5" />, color: "bg-destructive", label: t('buttons.delete') }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{transaction.title}</h3>
          <p className="text-sm text-muted-foreground">{transaction.date}</p>
        </div>
        <div className={`font-bold ${transaction.type === "income" ? "text-[#00d563]" : "text-destructive"}`}>
          {transaction.type === "income" ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
        </div>
      </div>
    </SwipeableCard>
  );
};

/* --------------------- Reduced motion (accessibility) --------------------- */

export const ReducedMotionWrapper = ({ children }: { children: React.ReactNode }) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  if (prefersReducedMotion) return <div style={{ ["--motion-duration" as any]: "0.01s" }}>{children}</div>;
  return <>{children}</>;
};
