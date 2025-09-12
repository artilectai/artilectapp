"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Settings, Plus, Calendar, DollarSign, Dumbbell, User, Globe, Clock, CreditCard, Download, Trash2, Moon, Sun, Menu, X, TrendingUp, Crown, Star, Brain, ChevronRight, Shield, HelpCircle, LogOut, Palette, Volume2, Camera, Edit3, Check, Send } from 'lucide-react';
import { useSession, signOut } from '@/lib/supabase/useSession';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  HapticProvider, 
  SpringButton, 
  ScaleButton, 
  SlideUpModal, 
  FloatingActionButton, 
  ActionSheet,
  SegmentedControl,
  iosSpring 
} from '@/components/iOSAnimations';
import { useTranslation } from 'react-i18next';
import i18nInstance from '@/i18n/config';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTelegramBack } from '@/hooks/useTelegramBack';
import { openTelegramSupport } from '@/lib/telegram';

type AppMode = 'planner' | 'finance' | 'workout';

interface AppShellProps {
  children?: React.ReactNode;
  onModeChange?: (mode: AppMode) => void;
  initialMode?: AppMode;
  className?: string;
  subscriptionPlan?: 'free' | 'lite' | 'pro';
  onShowSubscription?: () => void;
  userData?: any; // User data (kept for compatibility)
  // Context-aware action callbacks
  onAddTask?: () => void;
  onAddTransaction?: () => void;
  onAddWorkout?: () => void;
}

interface NavItem {
  id: AppMode;
  label: string;
  icon: React.ReactNode;
}

const navItemsBase: Array<{ id: AppMode; icon: React.ReactNode }> = [
  { id: 'planner', icon: <Calendar className="w-6 h-6" /> },
  { id: 'finance', icon: <DollarSign className="w-6 h-6" /> },
  { id: 'workout', icon: <Dumbbell className="w-6 h-6" /> },
];

export default function AppShell({ 
  children, 
  onModeChange, 
  initialMode = 'planner',
  className = "",
  subscriptionPlan = 'free',
  onShowSubscription,
  userData,
  onAddTask,
  onAddTransaction,
  onAddWorkout
}: AppShellProps) {
  const { t, i18n } = useTranslation('app');
  // Resolve brand name parts (e.g., "Artilect" + "Assistant")
  const appName = t('app.name');
  const [brandTop, brandBottom] = useMemo(() => {
    const parts = (appName || '').split(' ');
    if (parts.length <= 1) return [appName, ''];
    return [parts[0], parts.slice(1).join(' ')];
  }, [appName]);
  const language = (i18n.resolvedLanguage as 'en' | 'ru' | 'uz') || 'en';
  const setLanguage = (lng: 'en' | 'ru' | 'uz') => {
    if (i18nInstance.isInitialized) {
      i18nInstance.changeLanguage(lng);
    } else {
      i18nInstance.on('initialized', () => i18nInstance.changeLanguage(lng));
    }
  };
  const router = useRouter();
  const { data: session, refetch } = useSession();
  const [currentMode, setCurrentMode] = useState<AppMode>(initialMode);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  // remove local language state; use global i18n
  const [timezone, setTimezone] = useState('UTC');
  // No default currency until user selects one during setup
  const [currency, setCurrency] = useState('');
  const [notifications, setNotifications] = useState(true);
  // Search removed from header
  const [notificationCount, setNotificationCount] = useState(2);

  // Enable Telegram Back/Close button to dismiss Settings when open
  useTelegramBack(!!showSettingsModal, () => setShowSettingsModal(false));

  // Profile editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: userData?.name || (userData as any)?.user_metadata?.name || '',
    email: userData?.email || '',
    bio: '',
    location: ''
  });
  // Telegram link code
  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);

  // Settings states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);

  const contentRef = useRef<HTMLDivElement>(null);
  const navTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Analytics events
  const emitAnalytics = useCallback((event: string, data?: any) => {
    console.log(`Analytics: ${event}`, data);
    // In a real app, this would send to analytics service
  }, []);

  // Save currency and trigger update in finance section; persist to user_profiles when signed in
  const handleCurrencyChange = useCallback(async (newCurrency: string) => {
    setCurrency(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem('finance_currency', newCurrency);
      window.dispatchEvent(new CustomEvent('currency-changed', { detail: { currency: newCurrency } }));
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (uid) {
        await supabase.from('user_profiles').upsert({
          user_id: uid,
          currency: newCurrency,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    } catch {}
    toast.success(t('toasts.currency.changed', { currency: newCurrency }));
  }, [t]);

  // Load settings from Supabase user_profiles when signed in; fallback to localStorage for guests
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (uid) {
          const { data } = await supabase
            .from('user_profiles')
            .select('app_theme, app_timezone, currency')
            .eq('user_id', uid)
            .single();
          if (!cancelled) {
            if (data) {
              if (data.app_theme) setTheme((data.app_theme as 'dark' | 'light') || 'dark');
              if (data.app_timezone) setTimezone(data.app_timezone || 'UTC');
              if (data.currency) setCurrency(data.currency || '');
            } else {
              // Create a default row using any locally saved preferences
              const savedCurrency = typeof window !== 'undefined' ? localStorage.getItem('finance_currency') : null;
              const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('app_theme') : null;
              const savedTimezone = typeof window !== 'undefined' ? localStorage.getItem('app_timezone') : null;
              const app_theme = (savedTheme as 'dark' | 'light') || 'dark';
              const app_timezone = savedTimezone || 'UTC';
              const currency = savedCurrency || '';
              if (!cancelled) {
                setTheme(app_theme);
                setTimezone(app_timezone);
                setCurrency(currency);
              }
              await supabase.from('user_profiles').upsert({
                user_id: uid,
                app_theme,
                app_timezone,
                currency,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });
            }
          }
          return;
        }
      } catch {}
      // Guest fallback
      if (typeof window !== 'undefined' && !cancelled) {
        const savedCurrency = localStorage.getItem('finance_currency');
        const savedTheme = localStorage.getItem('app_theme');
        const savedTimezone = localStorage.getItem('app_timezone');
        if (savedCurrency) setCurrency(savedCurrency);
        if (savedTheme) setTheme(savedTheme as 'dark' | 'light');
        if (savedTimezone) setTimezone(savedTimezone);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Reflect global currency changes (e.g., from finance onboarding)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { currency?: string } | undefined;
      if (detail?.currency) {
        setCurrency(detail.currency);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('currency-changed', handler as EventListener);
      return () => window.removeEventListener('currency-changed', handler as EventListener);
    }
  }, []);

  // Update profile data when userData changes
  useEffect(() => {
    if (userData) {
      setProfileData({
        name: userData.name || (userData as any)?.user_metadata?.name || '',
        email: userData.email || '',
        bio: '',
        location: ''
      });
    }
  }, [userData]);

  // Persist settings: keep localStorage for offline, and upsert to Supabase when signed in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_theme', theme);
      localStorage.setItem('app_timezone', timezone);
    }
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (uid) {
          await supabase.from('user_profiles').upsert({
            user_id: uid,
            app_theme: theme,
            app_timezone: timezone,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        }
      } catch {}
    })();
  }, [theme, timezone]);

  // Ensure inner content scrolls and page doesn’t overscroll
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // Make sure the content area has its own scroll context
    el.style.overscrollBehavior = 'contain';
  }, []);

  // Handle mode switching with animation and analytics
  const handleModeSwitch = useCallback((mode: AppMode, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (mode === currentMode) return;
    
    setCurrentMode(mode);
    onModeChange?.(mode);
    emitAnalytics('mode_switch', { from: currentMode, to: mode });
    
    // Haptic feedback on supported devices
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(50); } catch {}
      }
    }
    
  const labelKey = mode === 'planner' ? 'nav.planner' : mode === 'finance' ? 'nav.finance' : 'nav.workout';
  toast.success(`${t('common.success')}: ${t(labelKey)}`);
  }, [currentMode, onModeChange, emitAnalytics]);

  // Context-aware FAB action
  const handleContextualAdd = useCallback(() => {
    switch (currentMode) {
      case 'planner':
        onAddTask?.();
        break;
      case 'finance':
        onAddTransaction?.();
        break;
      case 'workout':
        onAddWorkout?.();
        break;
    }
  }, [currentMode, onAddTask, onAddTransaction, onAddWorkout]);

  // Get context-specific FAB props
  const getFABProps = useCallback(() => {
    switch (currentMode) {
      case 'planner':
        return {
          label: t('planner.task.newTask'),
          icon: <Plus className="w-5 h-5" />,
          color: '#10B981'
        };
      case 'finance':
        return {
          label: t('finance.transactions.newTransaction'),
          icon: <Plus className="w-5 h-5" />,
          color: '#F59E0B'
        };
      case 'workout':
        return {
          label: t('workout.activities.newWorkout'),
          icon: <Plus className="w-5 h-5" />,
          color: '#EF4444'
        };
      default:
        return {
          label: t('common.add'),
          icon: <Plus className="w-5 h-5" />,
          color: '#10B981'
        };
    }
  }, [currentMode]);

  // Handle swipe gestures only on navigation area
  const handleNavTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    navTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }, []);

  const handleNavTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!navTouchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - navTouchStartRef.current.x;
    const deltaY = touch.clientY - navTouchStartRef.current.y;
    const deltaTime = Date.now() - navTouchStartRef.current.time;

    // Only trigger if horizontal swipe is clear: large X, tiny Y jitter, quick gesture
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && Math.abs(deltaY) < 20 && deltaTime < 300) {
      const currentIndex = navItemsBase.findIndex(item => item.id === currentMode);
      
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - go to previous mode
        handleModeSwitch(navItemsBase[currentIndex - 1].id);
      } else if (deltaX < 0 && currentIndex < navItemsBase.length - 1) {
        // Swipe left - go to next mode
        handleModeSwitch(navItemsBase[currentIndex + 1].id);
      }
    }

    navTouchStartRef.current = null;
  }, [currentMode, handleModeSwitch]);

  // Logout handler using Supabase
  const handleLogout = useCallback(async (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    try {
      await signOut();
      refetch();
      setShowProfileModal(false);
      toast.success(t('toasts.profile.signedOut'));
      router.push('/login');
    } catch (error) {
      toast.error(t('toasts.profile.signOutFailed'));
    }
    
    emitAnalytics('logout');
  }, [emitAnalytics, refetch, router]);

  // Profile modal handlers
  const handleOpenProfile = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (session?.user) {
      setShowProfileModal(true);
      emitAnalytics('open_profile');
    } else {
      router.push('/login');
    }
  }, [session, emitAnalytics, router]);

  const handleUpgrade = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (onShowSubscription) {
      onShowSubscription();
    } else {
      setShowSubscriptionModal(true);
    }
    emitAnalytics('open_subscription');
  }, [emitAnalytics, onShowSubscription]);

  // Profile editing handlers
  const handleSaveProfile = useCallback(async () => {
    try {
      if (!session?.user) return;
      const name = (profileData.name || '').trim();

      // Persist to public.user_profiles (RLS allows current user)
      await supabase.from('user_profiles').upsert({
        user_id: session.user.id,
        email: session.user.email ?? null,
        name,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      // Mirror to auth metadata for consistency across app
      await supabase.auth.updateUser({ data: { name } });

      toast.success(t('toasts.profile.profileUpdated'));
      setIsEditingProfile(false);
      // Refresh local session snapshot
      refetch();
    } catch (e) {
      toast.error('Failed to update profile');
    }
  }, [profileData, session, refetch, t]);

  const handleCancelProfileEdit = useCallback(() => {
    setProfileData({
      name: userData?.name || '',
      email: userData?.email || '',
      bio: '',
      location: ''
    });
    setIsEditingProfile(false);
  }, [userData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key) {
        case '1':
          handleModeSwitch('planner');
          break;
        case '2':
          handleModeSwitch('finance');
          break;
        case '3':
          handleModeSwitch('workout');
          break;
        case '/':
          e.preventDefault();
          // Search was removed from header
          // document.querySelector<HTMLInputElement>('#search-input')?.focus();
          break;
        case 'n':
        case 'N':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleContextualAdd();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleModeSwitch, handleContextualAdd]);

  const actionSheetActions = [
    { label: t('nav.upgrade'), onClick: () => handleUpgrade() },
    { label: t('nav.settings'), onClick: () => setShowSettingsModal(true) },
    { label: t('profile.support'), onClick: () => toast.info('Opening support...') },
    { label: t('nav.signOut'), onClick: () => handleLogout(), destructive: true }
  ];

  const fabProps = getFABProps();

  // Keep bottom nav stable when the on-screen keyboard appears on mobile.
  // Primary: CSS translate by (100lvh - 100dvh). Fallback: VisualViewport -> --kb-offset.
  useEffect(() => {
    if (typeof window === 'undefined' || !('visualViewport' in window)) return;

    const vv = window.visualViewport as VisualViewport;
    const baselineRef = { current: Math.max(window.innerHeight, document.documentElement.clientHeight) };

    const computeShrink = () => {
      const vh = vv.height + vv.offsetTop; // visible region height relative to layout viewport
      let shrink = Math.max(0, baselineRef.current - vh);
      // Fallback: if reported shrink is 0 but visual viewport clearly shrank
      if (shrink === 0 && vv.height < baselineRef.current - 80) {
        shrink = baselineRef.current - (vv.height + vv.offsetTop);
      }
      return shrink;
    };

    const apply = () => {
      const shrink = computeShrink();
      document.documentElement.style.setProperty('--kb-offset', `${Math.max(0, Math.round(shrink))}px`);
    };

    const setBaselineSoon = () => {
      // Allow a short delay for UA UI bars to settle before capturing baseline
      setTimeout(() => {
        baselineRef.current = Math.max(window.innerHeight, document.documentElement.clientHeight);
        apply();
      }, 150);
    };

    // Listeners
    const onFocus = () => apply();
    const onBlur = () => apply();
    const onResize = () => apply();
    const onOrientation = () => setBaselineSoon();

    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    window.addEventListener('orientationchange', onOrientation);

    // Initial capture and settle
    setBaselineSoon();
    apply();

    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      window.removeEventListener('orientationchange', onOrientation);
      document.documentElement.style.removeProperty('--kb-offset');
    };
  }, []);

  return (
    <HapticProvider>
  <div className={`min-h-dvh bg-gradient-to-b from-[#0a0b0d] to-[#0f1114] text-foreground flex flex-col ${className}`} style={{ height: '100dvh' }}>
        {/* Top App Bar */}
  <header className="sticky top-0 z-50 glass-card border-t border-[#2a2d30]/30 pt-safe-top-loose" style={{ paddingTop: 'calc(var(--safe-top) + 36px)' }}>
          <div className="flex items-center justify-between h-14 px-3">
            {/* Left side with Brand and Brain Logo */}
            <div className="flex items-center gap-2.5">
              {/* Brain logo - non-clickable, just for branding */}
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#00d563]/10 backdrop-blur-sm border border-[#00d563]/20 shadow-md shadow-[#00d563]/20">
                <Brain className="w-5 h-5 text-[#00d563] drop-shadow-sm" />
              </div>
              
              {/* Brand: stacked on small screens, single-line on larger screens */}
              <motion.div 
                className="font-heading font-bold bg-gradient-to-r from-[#00d563] to-[#00b850] bg-clip-text text-transparent drop-shadow-sm"
                whileHover={{ scale: 1.05 }}
                transition={iosSpring.snappy}
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(0, 213, 99, 0.3))'
                }}
              >
                {/* Always single-line brand on all screens; prevent wrap on small devices */}
                <span className="block leading-none align-middle whitespace-nowrap truncate max-w-[52vw] text-sm sm:text-lg">
                  {appName}
                </span>
              </motion.div>
            </div>

            {/* Search removed for a cleaner top bar */}
            <div className="flex-1" />

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Quick language toggle */}
              <div className="hidden sm:block mr-2">
                <LanguageSwitcher />
              </div>
      {subscriptionPlan !== 'pro' && (
                <ScaleButton onClick={handleUpgrade}>
                  <Badge className="bg-money-gradient text-[#0a0b0d] hover:shadow-money">
                    <Crown className="w-3 h-3 mr-1" />
        {t('nav.upgrade')}
                  </Badge>
                </ScaleButton>
              )}

              {/* Settings Icon */}
              <ScaleButton
                onClick={(event: React.MouseEvent) => {
                  event.preventDefault();
                  setShowSettingsModal(true);
                }}
                className="relative p-2 rounded-xl hover:bg-surface-1/50"
              >
                <Settings className="w-5 h-5" />
              </ScaleButton>

              {/* Profile Avatar */}
              <ScaleButton
                onClick={handleOpenProfile}
                className="rounded-full"
              >
                <Avatar className="w-8 h-8 border-2 border-[#00d563]/30">
                  <AvatarImage src={userData?.image} alt={profileData.name || userData?.name} />
                  <AvatarFallback className="bg-money-gradient text-[#0a0b0d] text-sm font-bold">
                    {profileData.name?.[0] || userData?.name?.[0] || (userData as any)?.user_metadata?.name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
              </ScaleButton>
            </div>
          </div>
        </header>

    {/* Main Content Area - scrollable, body itself stays non-scrollable */}
        <main 
          ref={contentRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain relative"
          style={{ WebkitOverflowScrolling: 'touch' as any, touchAction: 'pan-y' as any }}
        >
      <motion.div 
    className="pb-24 pb-safe-bottom-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={iosSpring.gentle}
          >
            {children}
          </motion.div>
        </main>

    {/* Context-Aware Floating Action Button */}
  <motion.button
          onClick={handleContextualAdd}
          className="fixed right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center ring-1 ring-black/10"
          style={{ 
            // Sit just above the bottom mode switcher bar (~84px tall) with a small gap
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px - var(--kb-offset, 0px))',
            background: `linear-gradient(135deg, ${fabProps.color}, ${fabProps.color}dd)`,
            // Softer, tighter shadow so it doesn't bleed outside blocks
  boxShadow: `0 8px 24px ${fabProps.color}26`,
  transform: 'translateY(calc(100vh - 100dvh))'
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={iosSpring.snappy}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          title={fabProps.label}
        >
          <motion.div
            key={currentMode}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={iosSpring.bouncy}
            className="text-white"
          >
            {fabProps.icon}
          </motion.div>
        </motion.button>

        {/* Bottom Navigation with Swipe Gestures */}
        <nav 
          className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md bg-[#0b0e11]/70 border-t border-[#2a2d30]/30 overflow-hidden"
          style={{ bottom: 'calc(-1 * var(--kb-offset, 0px))', transform: 'translateY(calc(100vh - 100dvh))' }}
          onTouchStart={handleNavTouchStart}
          onTouchEnd={handleNavTouchEnd}
        >
          <div className="flex items-center justify-center h-[86px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)/2)] shadow-[0_-6px_20px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-around w-full max-w-md mx-auto gap-2">
              {navItemsBase.map((item) => {
                const isActive = currentMode === item.id;
                const label = item.id === 'planner' ? t('nav.planner') : item.id === 'finance' ? t('nav.finance') : t('nav.workout');
                return (
                  <motion.button
                    key={item.id}
                    onClick={(event: React.MouseEvent) => handleModeSwitch(item.id, event)}
                    className={`flex flex-col items-center gap-1 min-w-[60px] min-h-[52px] px-3 py-2 rounded-xl transition-all relative ${
                      isActive 
                        ? 'text-[#00d563]' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={iosSpring.snappy}
                    aria-label={t('appShell.nav.switchTo', { section: label })}
                  >
                    <motion.div
                      className={`p-2.5 rounded-lg ${isActive ? 'bg-[#00d563]/15 ring-1 ring-[#00d563]/25' : ''}`}
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {item.icon}
                    </motion.div>
                    <span className="text-xs font-medium">{label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 w-4 h-1 bg-[#00d563] rounded-full"
                        transition={iosSpring.snappy}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Enhanced Profile Modal */}
        <SlideUpModal
          isOpen={showProfileModal}
          onClose={() => {
            setShowProfileModal(false);
            setIsEditingProfile(false);
            handleCancelProfileEdit();
          }}
          title={isEditingProfile ? t('common.edit') + ' ' + t('nav.profile') : t('nav.profile')}
          bodyClassName="pb-0"
          hideEndSpacer
        >
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-20 h-20 border-4 border-[#00d563]/30">
                  <AvatarImage src={userData?.image} alt={userData?.name} />
                  <AvatarFallback className="bg-money-gradient text-[#0a0b0d] text-xl font-bold">
                    {userData?.name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                {isEditingProfile && (
                  <Button
                    size="sm"
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-money-green text-black p-0"
                    onClick={() => toast.info(t('profile.photoUploadSoon'))}
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="flex-1">
                {isEditingProfile ? (
                  <div className="space-y-2">
                    <Input
                      value={profileData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t('profile.namePlaceholder')}
                      className="font-semibold text-lg"
                    />
                    <Input
                      value={profileData.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder={t('profile.emailPlaceholder')}
                      className="text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-lg">{profileData.name || userData?.name || (userData as any)?.user_metadata?.name || t('profile.user')}</h3>
                    <p className="text-sm text-muted-foreground">{userData?.email}</p>
          {subscriptionPlan === 'pro' && (
                      <Badge className="bg-gold-gradient text-[#0a0b0d] mt-2">
                        <Crown className="w-3 h-3 mr-1" />
            {t('plans.pro')}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {!isEditingProfile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingProfile(true);
                    setProfileData({
                      name: userData?.name || '',
                      email: userData?.email || '',
                      bio: '',
                      location: ''
                    });
                  }}
                  className="p-2"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {isEditingProfile && (
              <>
                <div>
                  <Label htmlFor="bio">{t('profile.bio')}</Label>
                  <Input
                    id="bio"
                    value={profileData.bio}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder={t('profile.bioPlaceholder')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="location">{t('profile.location')}</Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder={t('profile.locationPlaceholder')}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <Separator />

            {/* Profile Actions */}
            <div className="space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-between h-12"
                onClick={() => setShowSettingsModal(true)}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5" />
                  <span>{t('nav.settings')}</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
              
  <Button
    variant="ghost"
    className="w-full justify-between h-12"
    onClick={() => openTelegramSupport('artilectsupport')}
        >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5" />
          <span>{t('profile.support')}</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>

              {subscriptionPlan !== 'pro' && (
                <Button
                  className="w-full bg-money-gradient text-black h-12 font-semibold"
                  onClick={handleUpgrade}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  {t('nav.upgrade')}
                </Button>
              )}
              {/* Telegram Link */}
              <div className="rounded-xl border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    <span className="font-medium">Link Telegram</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste 6-char code from /link"
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value)}
                  />
                  <Button
                    disabled={!linkCode || linking}
                    onClick={async () => {
                      setLinking(true);
                      setLinkStatus(null);
                      try {
                        const res = await fetch('/api/telegram/link', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ code: linkCode.trim() })
                        });
                        const j = await res.json();
                        if (j.ok) {
                          setLinkStatus('Linked successfully.');
                          setLinkCode('');
                          toast.success('Telegram linked');
                        } else {
                          setLinkStatus(j.error || 'Failed to link.');
                          toast.error(j.error || 'Failed to link');
                        }
                      } catch (e) {
                        setLinkStatus('Network error');
                        toast.error('Network error');
                      } finally {
                        setLinking(false);
                      }
                    }}
                  >Link</Button>
                </div>
                {linkStatus && <p className="text-xs text-muted-foreground mt-2">{linkStatus}</p>}
              </div>
            </div>

            <Separator />

            {/* Profile Edit Actions or Logout */}
            {isEditingProfile ? (
                <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancelProfileEdit}
                  className="h-11"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  className="bg-money-green text-black h-11 font-semibold"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {t('common.save')}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full text-destructive hover:text-destructive-foreground hover:bg-destructive h-11"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('nav.signOut')}
              </Button>
            )}
          </div>
        </SlideUpModal>

        {/* Enhanced Settings Modal - full-screen, dismiss on Telegram Back/Close, backdrop tap or swipe down */}
        <SlideUpModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          title={t('nav.settings')}
          height="half"
        >
          <div className="space-y-6">
            {/* Appearance Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">{t('appShell.appearance')}</h4>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  <div>
                    <Label className="font-medium">{t('appShell.darkThemeLabel')}</Label>
                    <p className="text-sm text-muted-foreground">{t('appShell.darkThemeDescription')}</p>
                  </div>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5" />
                  <div>
                    <Label className="font-medium">{t('appShell.accentColorLabel')}</Label>
                    <p className="text-sm text-muted-foreground">{t('appShell.accentColorDescription')}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info('Color customization coming soon')}>
                  {t('appShell.customize')}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Localization Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">{t('appShell.localization')}</h4>
              
              <div>
                  <Label className="font-medium flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4" />
                  {t('profile.language')}
                </Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇺🇸 {t('languages.en')}</SelectItem>
                    <SelectItem value="ru">🇷🇺 {t('languages.ru')}</SelectItem>
                    <SelectItem value="uz">🇺🇿 {t('languages.uz')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-medium flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" />
                  {t('appShell.timezoneLabel')}
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">{t('appShell.timezoneOptions.UTC')}</SelectItem>
                    <SelectItem value="EST">{t('appShell.timezoneOptions.EST')}</SelectItem>
                    <SelectItem value="PST">{t('appShell.timezoneOptions.PST')}</SelectItem>
                    <SelectItem value="CET">{t('appShell.timezoneOptions.CET')}</SelectItem>
                    <SelectItem value="JST">{t('appShell.timezoneOptions.JST')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-medium flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4" />
                  {t('finance.accounts.currency')}
                </Label>
        <Select value={(currency || undefined) as any} onValueChange={handleCurrencyChange}>
                  <SelectTrigger>
          <SelectValue placeholder={t('finance.onboarding.steps.errors.selectCurrency')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">🇺🇸 {t('appShell.currencyOptions.USD')}</SelectItem>
                    <SelectItem value="EUR">🇪🇺 {t('appShell.currencyOptions.EUR')}</SelectItem>
                    <SelectItem value="GBP">🇬🇧 {t('appShell.currencyOptions.GBP')}</SelectItem>
                    <SelectItem value="JPY">🇯🇵 {t('appShell.currencyOptions.JPY')}</SelectItem>
                    <SelectItem value="UZS">🇺🇿 {t('appShell.currencyOptions.UZS')}</SelectItem>
                    <SelectItem value="RUB">🇷🇺 {t('appShell.currencyOptions.RUB')}</SelectItem>
                    <SelectItem value="CNY">🇨🇳 {t('appShell.currencyOptions.CNY')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Experience Section */}
            <div className="space-y-4">
      <h4 className="font-semibold text-lg">{t('appShell.experience')}</h4>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5" />
                  <div>
        <Label className="font-medium">{t('appShell.soundEffectsLabel')}</Label>
        <p className="text-sm text-muted-foreground">{t('appShell.soundEffectsDescription')}</p>
                  </div>
                </div>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-money-green/20 rounded flex items-center justify-center">
                    <div className="w-2 h-2 bg-money-green rounded-full animate-pulse" />
                  </div>
                  <div>
        <Label className="font-medium">{t('appShell.hapticFeedbackLabel')}</Label>
        <p className="text-sm text-muted-foreground">{t('appShell.hapticFeedbackDescription')}</p>
                  </div>
                </div>
                <Switch
                  checked={hapticEnabled}
                  onCheckedChange={setHapticEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  <div>
        <Label className="font-medium">{t('appShell.pushNotificationsLabel')}</Label>
        <p className="text-sm text-muted-foreground">{t('appShell.pushNotificationsDescription')}</p>
                  </div>
                </div>
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
            </div>

            <Separator />

            {/* Privacy & Data Section */}
            <div className="space-y-4">
        <h4 className="font-semibold text-lg">{t('appShell.privacyData')}</h4>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5" />
                  <div>
          <Label className="font-medium">{t('appShell.analyticsLabel')}</Label>
          <p className="text-sm text-muted-foreground">{t('appShell.analyticsDescription')}</p>
                  </div>
                </div>
                <Switch
                  checked={analyticsEnabled}
                  onCheckedChange={setAnalyticsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5" />
                  <div>
          <Label className="font-medium">{t('appShell.autoBackupLabel')}</Label>
          <p className="text-sm text-muted-foreground">{t('appShell.autoBackupDescription')}</p>
                  </div>
                </div>
                <Switch
                  checked={autoBackup}
                  onCheckedChange={setAutoBackup}
                />
              </div>

              <Button
                variant="outline"
                className="w-full justify-start h-12"
        onClick={() => toast.success(t('common.success'))}
              >
                <Download className="w-5 h-5 mr-3" />
        {t('appShell.exportData')}
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-destructive hover:text-destructive-foreground hover:bg-destructive/10"
        onClick={() => toast.error(t('common.warning'))}
              >
                <Trash2 className="w-5 h-5 mr-3" />
        {t('appShell.deleteAllData')}
              </Button>
            </div>

            <Separator />

            {/* App Info */}
            <div className="space-y-2 text-center text-sm text-muted-foreground">
              <p>{t('appShell.version', { version: '2.1.0' })}</p>
              <p>{t('appShell.tagline')}</p>
            </div>
          </div>
        </SlideUpModal>

        {/* Action Sheet */}
        <ActionSheet
          isOpen={showActionSheet}
          onClose={() => setShowActionSheet(false)}
          title={t('common.more')}
          actions={actionSheetActions}
        />
      </div>
    </HapticProvider>
  );
}