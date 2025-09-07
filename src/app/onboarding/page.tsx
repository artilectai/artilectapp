"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/supabase/useSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, User, Globe, Clock, Calendar, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18nInstance from "@/i18n/config";

// Use reliable two-letter abbreviations instead of emoji/flags to avoid "��" glyphs
const LANGUAGES = [
  { code: "en", abbr: "EN" },
  { code: "ru", abbr: "RU" },
  { code: "uz", abbr: "UZ" },
] as const;

const TIMEZONES = [
  { value: "UTC", label: "UTC (GMT+0)", offset: "+00:00" },
  { value: "America/New_York", label: "New York (EST/EDT)", offset: "-05:00/-04:00" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)", offset: "-08:00/-07:00" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)", offset: "-06:00/-05:00" },
  { value: "Europe/London", label: "London (GMT/BST)", offset: "+00:00/+01:00" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)", offset: "+01:00/+02:00" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)", offset: "+01:00/+02:00" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", offset: "+09:00" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)", offset: "+08:00" },
  { value: "Asia/Seoul", label: "Seoul (KST)", offset: "+09:00" },
  { value: "Asia/Tashkent", label: "Tashkent (UZT)", offset: "+05:00" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)", offset: "+10:00/+11:00" },
];

const WEEK_START_OPTIONS = [
  { value: "sunday", label: "Sunday", icon: "🟡" },
  { value: "monday", label: "Monday", icon: "🔵" },
];

interface UserPreferences {
  language: string;
  timezone: string;
  weekStart: string;
}

const steps = [
  {
    id: 1,
  title: "language",
  description: "chooseLanguage",
    icon: Globe,
  },
  {
    id: 2,
  title: "timezone", 
  description: "setTimezone",
    icon: Clock,
  },
  {
    id: 3,
  title: "weekStart",
  description: "chooseWeekStart",
    icon: Calendar,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { t, i18n } = useTranslation('app');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: (i18n.resolvedLanguage as 'en'|'ru'|'uz') || "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    weekStart: "monday",
  });
  const [errors, setErrors] = useState<Partial<UserPreferences>>({});

  // Redirect if not authenticated
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  // Show loading while checking session
  if (isPending) {
    return (
  <div className="min-h-dvh bg-background flex items-center justify-center px-safe pt-safe-top pb-safe-bottom overflow-hidden">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!session?.user) {
    return null;
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<UserPreferences> = {};

    switch (step) {
      case 1:
        if (!preferences.language) {
          newErrors.language = t('common.validation.required');
        }
        break;
      case 2:
        if (!preferences.timezone) {
          newErrors.timezone = t('common.validation.required');
        }
        break;
      case 3:
        if (!preferences.weekStart) {
          newErrors.weekStart = t('common.validation.required');
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      } else {
        handleComplete();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Store preferences in localStorage
      localStorage.setItem("userPreferences", JSON.stringify(preferences));
      
      // Also store individual preferences for easy access
      localStorage.setItem("language", preferences.language);
      localStorage.setItem("timezone", preferences.timezone);
      localStorage.setItem("weekStart", preferences.weekStart);
      localStorage.setItem("onboardingCompleted", "true");
  toast.success(t('toasts.onboarding.preferencesSaved'));
      
      // Small delay for better UX
      setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (error) {
  toast.error(t('toasts.onboarding.preferencesFailed'));
      setIsSubmitting(false);
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    // Clear error when user makes a selection
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const progress = (currentStep / steps.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 ios-scale-in">
                <Globe className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">{t('onboarding.step1.title')}</h2>
              <p className="text-muted-foreground">{t('onboarding.step1.description')}</p>
            </div>

            <div className="space-y-3">
              {LANGUAGES.map((language) => (
                <div
                  key={language.code}
                  onClick={() => {
                    updatePreference("language", language.code);
                    // Apply language instantly
                    if (i18nInstance.isInitialized) {
                      i18nInstance.changeLanguage(language.code);
                    } else {
                      i18nInstance.on('initialized', () => i18nInstance.changeLanguage(language.code));
                    }
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('language', language.code);
                    }
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ios-spring hover:shadow-money ${
                    preferences.language === language.code
                      ? "border-primary bg-primary/5 shadow-money"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Abbreviation chip styled to match app theme */}
                    <span
                      className="inline-flex items-center justify-center h-6 min-w-8 px-2 rounded-md text-xs font-bold border"
                      style={{
                        background: 'color-mix(in oklab, var(--primary) 10%, transparent)',
                        borderColor: 'color-mix(in oklab, var(--primary) 30%, var(--border))',
                        color: 'var(--primary)'
                      }}
                    >
                      {language.abbr}
                    </span>
                    <span className="font-medium">{t(`languages.${language.code}`)}</span>
                    {preferences.language === language.code && (
                      <Check className="w-5 h-5 text-primary ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {errors.language && (
              <p className="text-destructive text-sm mt-2">{errors.language}</p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 ios-scale-in">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">{t('onboarding.step2.title')}</h2>
              <p className="text-muted-foreground">{t('onboarding.step2.description')}</p>
            </div>

            <div className="space-y-4">
              <Label htmlFor="timezone">{t('onboarding.step2.timezone')}</Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => updatePreference("timezone", value)}
              >
                <SelectTrigger
                  className={(errors.timezone ? "border-destructive " : "") + "w-full h-10"}
                >
                  <SelectValue placeholder={t('onboarding.step2.timezone')} />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      <div className="flex w-full items-center justify-between">
                        <span>{tz.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{tz.offset}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.timezone && (
                <p className="text-destructive text-sm">{errors.timezone}</p>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 ios-scale-in">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">{t('onboarding.step3.title')}</h2>
              <p className="text-muted-foreground">{t('onboarding.step3.description')}</p>
            </div>

            <div className="space-y-4">
              <Label>{t('onboarding.step3.weekStart')}</Label>
              <RadioGroup
                value={preferences.weekStart}
                onValueChange={(value) => updatePreference("weekStart", value)}
                className="space-y-3"
              >
                {WEEK_START_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label
                      htmlFor={option.value}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <span>{option.icon}</span>
                      <span>{option.value === 'monday' ? t('weekdays.monday') : t('weekdays.sunday')}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.weekStart && (
                <p className="text-destructive text-sm">{errors.weekStart}</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center px-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)'
      }}
    >
      <div className="w-full max-w-md">
        <Card className="glass-card shadow-money ios-slide-up border-none">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <CardTitle className="text-lg">{t('onboarding.title')}</CardTitle>
                <CardDescription className="text-sm">{t('profile.preferences')}</CardDescription>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('onboarding.stepCounter', { current: currentStep, total: steps.length })}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Steps Indicator */}
            <div className="flex justify-center space-x-2 mt-4">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`w-3 h-3 rounded-full transition-all ios-spring ${
                    currentStep >= step.id
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="ios-slide-up">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between space-x-3 pt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex items-center space-x-2 ios-spring"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t('buttons.back')}</span>
              </Button>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="flex items-center space-x-2 bg-money-gradient hover:shadow-money ios-spring"
              >
                <span>
                  {currentStep === steps.length ? t('buttons.finish') : t('buttons.continue')}
                </span>
                {currentStep === steps.length ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}