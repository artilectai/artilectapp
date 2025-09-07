"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Check, X, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TopLanguageBar from '@/components/TopLanguageBar';
import { useTranslation } from 'react-i18next'; // ADDED

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation('app'); // ADDED
  // Hydration-safe gate
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const TT = (key: string, options?: any): string => (mounted ? String((t as any)(key, options)) : key);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    color: "bg-gray-600",
  });

  // Normalize phone for validation (allow spaces, dashes, parentheses while typing)
  const normalizePhone = (value: string) => value.replace(/[\s()-]/g, "");

  // Calculate password strength
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push("At least 8 characters");
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Lowercase letter");
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Uppercase letter");
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push("Number");
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Special character");
    }

    let color = "bg-red-500";
    if (score >= 4) color = "bg-green-500";
    else if (score >= 3) color = "bg-yellow-500";
    else if (score >= 2) color = "bg-orange-500";

    return { score, feedback, color };
  };

  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(calculatePasswordStrength(formData.password));
    } else {
      setPasswordStrength({ score: 0, feedback: [], color: "bg-gray-600" });
    }
  }, [formData.password]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = t('auth.register.validation.nameRequired');
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t('auth.register.validation.nameTooShort');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = t('auth.register.validation.emailRequired');
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = t('auth.register.validation.emailInvalid');
    }
    if (!formData.phone) {
      newErrors.phone = t('auth.register.validation.phoneRequired');
    } else {
      const cleaned = normalizePhone(formData.phone);
      const e164Regex = /^\+?[1-9]\d{7,14}$/;
      if (!e164Regex.test(cleaned)) {
        newErrors.phone = t('auth.register.validation.phoneInvalid');
      }
    }
    if (!formData.password) {
      newErrors.password = t('auth.register.validation.passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('auth.register.validation.passwordTooShort');
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.register.validation.confirmRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.register.validation.passwordsMismatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
  // Allow user to type common separators for phone numbers; don't auto-format

    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    try {
  const { error } = await authClient.signUp.email({
        email: formData.email,
        name: formData.name.trim(),
        password: formData.password,
      });
      if (error?.code) {
        const mapKey = `auth.register.errors.${error.code}`;
        const msg = t(mapKey, { defaultValue: t('auth.register.errors.GENERIC') });
        toast.error(msg);
        return;
      }
      // Try to mirror into Supabase with service role (non-blocking)
      try {
        await fetch('/api/supabase/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formData.phone })
        });
      } catch {}
      toast.success(t('toasts.auth.registerSuccess'));
      router.push("/login?registered=true");
    } catch (error) {
  toast.error(t('toasts.auth.registerGenericError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
  <div className="min-h-dvh bg-background flex items-center justify-center px-safe pt-safe-top pb-safe-bottom ios-slide-up">
        <div className="w-full max-w-md space-y-6 overflow-y-auto max-h-[100dvh]">
          {/* Back button */}
          <Link 
            href="/login" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors ios-spring"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span suppressHydrationWarning>{TT('auth.register.backToSignIn')}</span>
          </Link>

          <Card className="glass-card shadow-money ios-scale-in">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl font-heading" suppressHydrationWarning>
                {TT('auth.register.title')}
              </CardTitle>
              <CardDescription suppressHydrationWarning>
                {TT('auth.register.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" suppressHydrationWarning>{TT('auth.register.nameLabel')}</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={TT('auth.register.namePlaceholder')}
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={isLoading}
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" suppressHydrationWarning>{TT('auth.register.emailLabel')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={TT('auth.register.emailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={isLoading}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phone" suppressHydrationWarning>{TT('auth.register.phoneLabel')}</Label>
                  <PhoneInput
                    id="phone"
                    value={formData.phone}
                    onChange={(val) => handleInputChange("phone", val)}
                    disabled={isLoading}
                    className={errors.phone ? "border-destructive" : ""}
                    defaultCountry="us"
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
          <Label htmlFor="password" suppressHydrationWarning>{TT('auth.register.passwordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
            placeholder={TT('auth.register.passwordPlaceholder')}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      disabled={isLoading}
                      className={errors.password ? "border-destructive pr-10" : "pr-10"}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? TT('auth.register.hidePassword') : TT('auth.register.showPassword')}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          <span suppressHydrationWarning>
                            {passwordStrength.score < 3
                              ? TT('auth.register.strength.weak')
                              : passwordStrength.score < 4
                              ? TT('auth.register.strength.good')
                              : TT('auth.register.strength.strong')}
                          </span>
                        </span>
                      </div>
                      {passwordStrength.feedback.length > 0 && (
                        <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {TT('auth.register.strength.missingPrefix')} {passwordStrength.feedback.join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {errors.password && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
          <Label htmlFor="confirmPassword" suppressHydrationWarning>{TT('auth.register.confirmPasswordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
            placeholder={TT('auth.register.confirmPasswordPlaceholder')}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      disabled={isLoading}
                      className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? TT('auth.register.hidePassword') : TT('auth.register.showPassword')}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-sm text-success flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span suppressHydrationWarning>{TT('auth.register.passwordsMatch')}</span>
                    </p>
                  )}

                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-money-gradient hover:bg-money-dark font-medium ios-spring"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span suppressHydrationWarning>{TT('auth.register.creating')}</span>
                    </>
                  ) : (
                    <span suppressHydrationWarning>{TT('auth.register.submit')}</span>
                  )}
                </Button>

                {/* Sign In Link */}
                <div className="text-center text-sm">
                  <span className="text-muted-foreground" suppressHydrationWarning>{TT('auth.register.alreadyPrefix')} </span>
                  <Link href="/login" className="text-primary hover:text-primary/90 font-medium transition-colors">
                    <span suppressHydrationWarning>{TT('auth.register.signIn')}</span>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
  <TopLanguageBar />
    </>
  );
}