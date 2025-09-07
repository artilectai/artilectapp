"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CircleCheck, StepForward } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';
import i18nInstance from '@/i18n/config';

interface OnboardingData {
  language: string;
  name: string;
  timezone: string;
  weekStart: "monday" | "sunday";
}

interface OnboardingWizardProps {
  onComplete: (data: OnboardingData) => void;
}

const LANGUAGES = [
  { code: "en", abbr: "EN" },
  { code: "ru", abbr: "RU" },
  { code: "uz", abbr: "UZ" },
] as const;

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Tashkent",
  "Asia/Dubai",
  "Australia/Sydney",
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { t, i18n } = useTranslation('app');
  const language = (i18n.resolvedLanguage as 'en' | 'ru' | 'uz') || 'en';
  const setLanguage = (lng: 'en' | 'ru' | 'uz') => {
    if (i18nInstance.isInitialized) {
      i18nInstance.changeLanguage(lng);
    } else {
      i18nInstance.on('initialized', () => i18nInstance.changeLanguage(lng));
    }
  };
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
  language,
    name: "",
    timezone: "",
    weekStart: "monday",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-detect timezone
  useEffect(() => {
    if (typeof window !== "undefined") {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TIMEZONES.includes(detectedTimezone)) {
        setData(prev => ({ ...prev, timezone: detectedTimezone }));
      } else {
        setData(prev => ({ ...prev, timezone: "UTC" }));
      }
    }
  }, []);

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(50); } catch {}
      }
    }
  }, []);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!data.language) {
          newErrors.language = t('common.validation.required');
        }
        break;
      case 2:
        if (!data.name.trim()) {
          newErrors.name = t('common.validation.required');
        } else if (data.name.trim().length < 2) {
          newErrors.name = t('common.validation.minLength', { min: 2 });
        }
        break;
      case 3:
        if (!data.timezone) {
          newErrors.timezone = t('common.validation.required');
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsAnimating(true);
    triggerHaptic();
    
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsAnimating(false);
    }, 200);
  };

  const prevStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsAnimating(false);
    }, 200);
  };

  const handleComplete = () => {
    // Mark onboarding as completed
    if (typeof window !== "undefined") {
      // Persist preferences and completion flag (aligned with /onboarding page)
      localStorage.setItem("userPreferences", JSON.stringify({
        language: data.language,
        timezone: data.timezone,
        weekStart: data.weekStart
      }));
      localStorage.setItem("language", data.language);
      localStorage.setItem("timezone", data.timezone);
      localStorage.setItem("weekStart", data.weekStart);
      localStorage.setItem("onboardingCompleted", "true");
      
      // Analytics event
      if (typeof window !== "undefined" && "gtag" in window) {
        (window as any).gtag("event", "onboarding_complete", {
          language: data.language,
          timezone: data.timezone,
          week_start: data.weekStart,
        });
      }
    }

    triggerHaptic();
  toast.success(t('toasts.onboarding.preferencesSaved'));
    onComplete(data);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentStep < 5) nextStep();
      else handleComplete();
    } else if (e.key === "Escape" && currentStep > 1) {
      e.preventDefault();
      prevStep();
    }
  }, [currentStep]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-heading font-bold">{t('onboarding.step1.title')}</h2>
              <p className="text-muted-foreground">{t('onboarding.step1.description')}</p>
            </div>
            <div className="grid gap-3">
        {LANGUAGES.map((lang) => (
                <Button
                  key={lang.code}
                  variant={data.language === lang.code ? "default" : "outline"}
                  onClick={() => {
                    setData(prev => ({ ...prev, language: lang.code }));
                    setLanguage(lang.code as any);
                  }}
                  className={`h-14 justify-start text-left ${
                    data.language === lang.code ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  <span
                    className={`mr-3 inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold tracking-wide ${
                      data.language === lang.code
                        ? "border-primary/60 bg-primary/20 text-primary-foreground"
                        : "border-border bg-muted/20 text-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {lang.abbr}
                  </span>
                  <span className="text-lg">{t(`languages.${lang.code}`)}</span>
                </Button>
              ))}
            </div>
            {errors.language && (
              <p className="text-sm text-destructive" role="alert">{errors.language}</p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-heading font-bold">{t('profile.name')}</h2>
              <p className="text-muted-foreground">{t('profile.personalInfo')}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('profile.name')}</Label>
                <Input
                  id="name"
                  type="text"
                  value={data.name}
                  onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('profile.namePlaceholder')}
                  className="h-12 text-lg"
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>
              {data.name && (
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-bold">
                    {data.name.slice(0, 2).toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
        <h2 className="text-2xl font-heading font-bold">{t('onboarding.step2.title')}</h2>
        <p className="text-muted-foreground">{t('onboarding.step2.description')}</p>
            </div>
            <div className="space-y-2">
        <Label htmlFor="timezone">{t('onboarding.step2.timezone')}</Label>
              <Select
                value={data.timezone}
                onValueChange={(value) => setData(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger className="h-12 text-lg" aria-describedby={errors.timezone ? "timezone-error" : undefined}>
          <SelectValue placeholder={t('onboarding.step2.timezone')} />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.timezone && (
                <p id="timezone-error" className="text-sm text-destructive" role="alert">
                  {errors.timezone}
                </p>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-heading font-bold">{t('onboarding.step3.title')}</h2>
              <p className="text-muted-foreground">{t('onboarding.step3.description')}</p>
            </div>
            <div className="grid gap-3">
              <Button
                variant={data.weekStart === "monday" ? "default" : "outline"}
                onClick={() => setData(prev => ({ ...prev, weekStart: "monday" }))}
                className={`h-14 text-lg ${
                  data.weekStart === "monday" ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {t('weekdays.monday')}
              </Button>
              <Button
                variant={data.weekStart === "sunday" ? "default" : "outline"}
                onClick={() => setData(prev => ({ ...prev, weekStart: "sunday" }))}
                className={`h-14 text-lg ${
                  data.weekStart === "sunday" ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {t('weekdays.sunday')}
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto">
                <CircleCheck className="w-10 h-10 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-heading font-bold">{t('common.success')}</h2>
              <p className="text-muted-foreground">{t('profile.preferences')}</p>
            </div>
            <div className="space-y-4 bg-surface-1 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('profile.language')}</span>
                <span className="font-medium">
                  {t(`languages.${data.language}`)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('profile.name')}</span>
                <span className="font-medium">{data.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('onboarding.step2.timezone')}</span>
                <span className="font-medium">{data.timezone.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('onboarding.step3.weekStart')}</span>
                <span className="font-medium capitalize">{data.weekStart === 'monday' ? t('weekdays.monday') : t('weekdays.sunday')}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('onboarding.title')}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    step <= currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <CardTitle className="text-sm text-muted-foreground">
              {t('onboarding.stepCounter', { current: currentStep, total: 5 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`transition-all duration-200 ${
                isAnimating ? "opacity-0 transform translate-x-4" : "opacity-100 transform translate-x-0"
              }`}
            >
              {getStepContent()}
            </div>
            
            <div className="flex justify-between mt-8">
              {currentStep > 1 && currentStep < 6 && (
                <Button
                  variant="outline"
                  onClick={prevStep}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t('common.back')}</span>
                </Button>
              )}
              
              <div className="ml-auto">
        {currentStep < 4 ? (
                  <Button
                    onClick={nextStep}
                    className="flex items-center space-x-2"
                  >
          <span>{currentStep === 1 ? t('onboarding.step1.continue') : currentStep === 2 ? t('onboarding.step2.continue') : t('onboarding.step3.continue')}</span>
                    <StepForward className="w-4 h-4" />
                  </Button>
                ) : currentStep === 4 ? (
                  <Button
                    onClick={nextStep}
                    className="flex items-center space-x-2"
                  >
          <span>{t('onboarding.step3.continue')}</span>
                    <StepForward className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    className="flex items-center space-x-2"
                  >
                    <span>{t('onboarding.step4.finish')}</span>
                    <CircleCheck className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}