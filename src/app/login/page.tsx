"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/supabase/useSession';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import TopLanguageBar from '@/components/TopLanguageBar';
import { useTranslation } from 'react-i18next'; // ADDED
import AuthBox from '@/components/AuthBox';

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('app'); // ADDED
  const { data } = useSession();
  // Hydration-safe gate: render placeholders on SSR/first paint, real strings after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const TT = (key: string, options?: any): string => (mounted ? String((t as any)(key, options)) : key);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Show success message if coming from registration
  useEffect(() => {
    const registered = searchParams.get('registered');
    if (registered === 'true') {
  toast.success(t('toasts.auth.loginPrefillSuccess'));
    }
  }, [searchParams, t]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = t('auth.login.validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.login.validation.emailInvalid');
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = t('auth.login.validation.passwordRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        // Handle common Supabase error: unconfirmed email
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('confirm') && msg.includes('email')) {
          try {
            // Resend the confirmation email so the user can complete sign up
            await supabase.auth.resend({ type: 'signup', email: formData.email });
            toast.message('Email not confirmed. We sent a new confirmation link to your inbox.');
          } catch {}
        } else {
          toast.error(t('toasts.auth.loginInvalid'));
        }
        return;
      }

      // Ensure Supabase profile row exists (non-blocking)
      try { await fetch('/api/supabase/profile', { method: 'POST' }); } catch {}
      toast.success(t('toasts.auth.loginWelcomeBack'));
      router.push("/");
    } catch {
      toast.error(t('toasts.auth.loginUnexpected'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!formData.email) {
      toast.error('Enter your email first.');
      return;
    }
    setResendLoading(true);
    try {
      await supabase.auth.resend({ type: 'signup', email: formData.email });
      toast.message('Confirmation link sent. Check your inbox.');
    } catch {
      toast.error('Could not resend confirmation right now.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      toast.error('Enter your email first.');
      return;
    }
    try {
      await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/update-password` : undefined,
      });
      toast.message('Password reset link sent. Check your inbox.');
    } catch {
      toast.error('Could not send reset email.');
    }
  };

  return (
    <>
  <div className="min-h-dvh bg-background flex items-center justify-center px-safe pt-safe-top pb-safe-bottom">
        <div className="w-full max-w-md ios-slide-up overflow-y-auto max-h-[100dvh]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-bold mb-2" suppressHydrationWarning>
              {TT('auth.login.title')}
            </h1>
            <p className="text-muted-foreground" suppressHydrationWarning>
              {TT('auth.login.subtitle')}
            </p>
          </div>

          {/* Login Form Card */}
          <div className="glass-card rounded-lg p-6 shadow-money">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium" suppressHydrationWarning>
                  {TT('auth.login.emailLabel')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder={TT('auth.login.emailPlaceholder')}
                    className={`pl-10 ios-spring ${errors.email ? 'border-destructive' : ''}`}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium" suppressHydrationWarning>
                  {TT('auth.login.passwordLabel')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder={TT('auth.login.passwordPlaceholder')}
                    className={`pl-10 pr-10 ios-spring ${errors.password ? 'border-destructive' : ''}`}
                    autoComplete="off"
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground ios-spring"
                    aria-label={showPassword ? TT('auth.login.hidePassword') : TT('auth.login.showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive" role="alert">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={formData.rememberMe}
                  onCheckedChange={(checked) => handleInputChange('rememberMe', !!checked)}
                  className="ios-spring"
                />
                <Label htmlFor="rememberMe" className="text-sm font-medium cursor-pointer select-none" suppressHydrationWarning>
                  {TT('auth.login.rememberMe')}
                </Label>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-money-gradient hover:opacity-90 text-black font-semibold ios-spring ios-scale-in"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                    <span suppressHydrationWarning>{TT('auth.login.signingIn')}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <LogIn className="h-4 w-4" />
                    <span suppressHydrationWarning>{TT('auth.login.submit')}</span>
                  </div>
                )}
              </Button>
            </form>
          </div>

          {/* Recovery helpers */}
          <div className="mt-3 text-xs text-center text-muted-foreground space-x-3">
            <button type="button" className="underline hover:text-foreground" onClick={handleResendConfirmation} disabled={resendLoading}>
              {resendLoading ? 'Sending…' : 'Resend confirmation'}
            </button>
            <span>•</span>
            <button type="button" className="underline hover:text-foreground" onClick={handleForgotPassword}>
              Forgot password?
            </button>
          </div>

          {/* Sign Up Link */}
          <div className="text-center mt-6">
            <p className="text-muted-foreground" suppressHydrationWarning>
              {TT('auth.login.noAccountPrefix')}{' '}
              <Link href="/register" className="text-money-green hover:text-money-dark ios-spring font-medium">
                {TT('auth.login.createNow')}
              </Link>
            </p>
          </div>

          {/* Email OTP sign-in */}
          <div className="mt-6">
            <AuthBox />
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-xs text-muted-foreground" suppressHydrationWarning>
              {TT('auth.login.disclaimer')}
            </p>
          </div>
        </div>
      </div>
  <TopLanguageBar />
    </>
  );
}