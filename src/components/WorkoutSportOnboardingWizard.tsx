"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dumbbell, 
  Heart, 
  Trophy, 
  Activity, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Star,
  Target,
  Calendar,
  Clock,
  Zap,
  User,
  Award,
  TrendingUp,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';

interface WorkoutSportOnboardingWizardProps {
  onComplete: (preferences: WorkoutPreferences) => void;
}

interface WorkoutPreferences {
  selectedSports: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  weeklyFrequency: number;
  fitnessGoals: string[];
}

const SPORT_CONFIGS = {
  strength: {
    icon: Dumbbell,
    color: 'rgb(239, 68, 68)',
    gradient: 'from-red-500/20 to-red-600/20',
    sports: ['Gym Training', 'Weightlifting', 'Bodybuilding', 'Powerlifting']
  },
  cardio: {
    icon: Heart,
    color: 'rgb(59, 130, 246)',
    gradient: 'from-blue-500/20 to-blue-600/20',
    sports: ['Running', 'Cycling', 'Swimming', 'HIIT']
  },
  sports: {
    icon: Trophy,
    color: 'rgb(34, 197, 94)',
    gradient: 'from-green-500/20 to-green-600/20',
    sports: ['Basketball', 'Soccer', 'Tennis', 'Volleyball']
  },
  flexibility: {
    icon: Activity,
    color: 'rgb(168, 85, 247)',
    gradient: 'from-purple-500/20 to-purple-600/20',
    sports: ['Yoga', 'Pilates', 'Stretching', 'Mobility']
  }
};

const FITNESS_GOALS = [
  { id: 'lose_weight', label: 'Lose Weight', icon: TrendingUp },
  { id: 'build_muscle', label: 'Build Muscle', icon: Dumbbell },
  { id: 'improve_endurance', label: 'Improve Endurance', icon: Heart },
  { id: 'flexibility', label: 'Increase Flexibility', icon: Activity },
  { id: 'general_health', label: 'General Health', icon: Star },
  { id: 'performance', label: 'Athletic Performance', icon: Award }
];

const EXPERIENCE_LEVELS = [
  { 
    id: 'beginner', 
    label: 'Beginner', 
    description: 'Just starting out',
    icon: User 
  },
  { 
    id: 'intermediate', 
    label: 'Intermediate', 
    description: '6+ months experience',
    icon: Target 
  },
  { 
    id: 'advanced', 
    label: 'Advanced', 
    description: '2+ years experience',
    icon: Zap 
  }
];

export const WorkoutSportOnboardingWizard: React.FC<WorkoutSportOnboardingWizardProps> = ({
  onComplete
}) => {
  const { t } = useTranslation('app');
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [weeklyFrequency, setWeeklyFrequency] = useState(3);
  const [fitnessGoals, setFitnessGoals] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const steps = [
    { title: t('workout.onboarding.steps.welcome.title'), subtitle: t('workout.onboarding.steps.welcome.subtitle') },
    { title: t('workout.onboarding.steps.sports.title'), subtitle: t('workout.onboarding.steps.sports.subtitle') },
    { title: t('workout.onboarding.steps.goals.title'), subtitle: t('workout.onboarding.steps.goals.subtitle') },
    { title: t('workout.onboarding.steps.confirm.title'), subtitle: t('workout.onboarding.steps.confirm.subtitle') }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleSportToggle = (sport: string) => {
    setSelectedSports(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const handleGoalToggle = (goalId: string) => {
    setFitnessGoals(prev => 
      prev.includes(goalId) 
        ? prev.filter(g => g !== goalId)
        : [...prev, goalId]
    );
  };

  const handleComplete = () => {
    const preferences: WorkoutPreferences = {
      selectedSports,
      experienceLevel,
      weeklyFrequency,
      fitnessGoals
    };

    // Save to localStorage
    localStorage.setItem('workout_sports_selected', JSON.stringify(selectedSports));
    localStorage.setItem('workout_experience_level', experienceLevel);
    localStorage.setItem('workout_frequency', weeklyFrequency.toString());
    localStorage.setItem('workout_goals', JSON.stringify(fitnessGoals));
    localStorage.setItem('workout_setup_complete', 'true');

    onComplete(preferences);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedSports.length > 0;
      case 2: return fitnessGoals.length > 0;
      default: return true;
    }
  };

  // Welcome Step
  const WelcomeStep = () => (
    <div className="text-center space-y-6 ios-slide-up">
      <div className="w-20 h-20 mx-auto bg-money-gradient rounded-full flex items-center justify-center shadow-money">
        <Dumbbell className="w-10 h-10 text-black" />
      </div>
      <div className="space-y-3">
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
          {t('workout.onboarding.steps.welcome.heroTitle')}
        </h1>
        <p className="text-muted-foreground leading-relaxed text-sm">
          {t('workout.onboarding.steps.welcome.heroSubtitle')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="glass-card p-3 rounded-xl text-center">
          <Target className="w-5 h-5 text-money-green mx-auto mb-2" />
          <p className="text-xs font-medium">{t('workout.onboarding.steps.welcome.cards.setGoals')}</p>
        </div>
        <div className="glass-card p-3 rounded-xl text-center">
          <Calendar className="w-5 h-5 text-money-green mx-auto mb-2" />
          <p className="text-xs font-medium">{t('workout.onboarding.steps.welcome.cards.trackProgress')}</p>
        </div>
      </div>
    </div>
  );

  // Sports Selection Step
  const SportsStep = () => (
    <div className="space-y-4 ios-slide-up">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-heading font-bold text-foreground">
          {t('workout.onboarding.steps.sports.chooseTitle')}
        </h2>
        <p className="text-muted-foreground">
          {t('workout.onboarding.steps.sports.chooseSubtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(SPORT_CONFIGS).map(([category, config]) => {
          const IconComponent = config.icon;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${config.color}20` }}
                >
                  <IconComponent 
                    className="w-4 h-4" 
                    style={{ color: config.color }} 
                  />
                </div>
                <h3 className="font-medium capitalize text-foreground text-sm">
                  {category}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {config.sports.map((sport) => (
                  <Card
                    key={sport}
                    className={`cursor-pointer transition-all ios-spring min-h-[44px] ${
                      selectedSports.includes(sport)
                        ? 'border-money-green bg-money-green/10 shadow-money'
                        : 'border-border hover:border-money-green/50'
                    }`}
                    onClick={() => handleSportToggle(sport)}
                  >
                    <CardContent className="p-2 flex items-center justify-center h-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-medium text-foreground text-center flex-1">
                          {sport}
                        </span>
                        {selectedSports.includes(sport) && (
                          <Check className="w-3 h-3 text-money-green ml-1 flex-shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedSports.length > 0 && (
        <div className="text-center pt-2">
          <Badge variant="secondary" className="bg-money-green/20 text-money-green text-xs">
            {t('workout.onboarding.steps.sports.selectedCount', { count: selectedSports.length })}
          </Badge>
        </div>
      )}
    </div>
  );

  // Goals Step
  const GoalsStep = () => (
    <div className="space-y-4 ios-slide-up">
      <div className="text-center space-y-2">
  <h2 className="text-2xl font-heading font-bold text-foreground">
          {t('workout.onboarding.steps.goals.title')}
        </h2>
  <p className="text-muted-foreground">
          {t('workout.onboarding.steps.goals.whatAchieve')}
        </p>
      </div>

      {/* Fitness Goals */}
      <div className="space-y-3">
  <h3 className="font-medium text-foreground text-sm">{t('workout.onboarding.steps.goals.fitnessGoals')}</h3>
  <div className="grid grid-cols-2 gap-3">
          {FITNESS_GOALS.map((goal) => {
            const IconComponent = goal.icon;
            return (
              <Card
                key={goal.id}
                className={`cursor-pointer transition-all ios-spring min-h-[60px] ${
                  fitnessGoals.includes(goal.id)
                    ? 'border-money-green bg-money-green/10 shadow-money'
                    : 'border-border hover:border-money-green/50'
                }`}
                onClick={() => handleGoalToggle(goal.id)}
              >
                <CardContent className="p-2 text-center h-full flex flex-col justify-center">
                  <IconComponent className="w-5 h-5 mx-auto mb-1 text-money-green" />
                  <span className="text-xs font-medium text-foreground">
                    {t(`workout.onboarding.goalsList.${goal.id}`)}
                  </span>
                  {fitnessGoals.includes(goal.id) && (
                    <Check className="w-3 h-3 text-money-green mx-auto mt-1" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Experience Level */}
      <div className="space-y-3">
  <h3 className="font-medium text-foreground text-sm">{t('workout.onboarding.steps.goals.experience.title')}</h3>
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map((level) => {
            const IconComponent = level.icon;
            return (
              <Card
                key={level.id}
                className={`cursor-pointer transition-all ios-spring min-h-[44px] ${
                  experienceLevel === level.id
                    ? 'border-money-green bg-money-green/10 shadow-money'
                    : 'border-border hover:border-money-green/50'
                }`}
                onClick={() => setExperienceLevel(level.id as any)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-4 h-4 text-money-green flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">{t(`workout.onboarding.steps.goals.experience.levels.${level.id}.label`)}</div>
                      <div className="text-xs text-muted-foreground">{t(`workout.onboarding.steps.goals.experience.levels.${level.id}.desc`)}</div>
                    </div>
                    {experienceLevel === level.id && (
                      <Check className="w-4 h-4 text-money-green flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Weekly Frequency */}
      <div className="space-y-3">
        <h3 className="font-medium text-foreground text-sm">{t('workout.onboarding.steps.goals.weekly.title')}</h3>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-money-green" />
          <span className="text-xs text-muted-foreground">{t('workout.onboarding.steps.goals.weekly.timesPerWeek')}</span>
          <span className="font-medium text-money-green text-sm">{weeklyFrequency}</span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {[2, 3, 4, 5, 6, 7].map((freq) => (
            <Button
              key={freq}
              variant={weeklyFrequency === freq ? "default" : "outline"}
              size="sm"
              className={`text-xs min-h-[40px] ${
                weeklyFrequency === freq 
                  ? 'bg-money-gradient text-black' 
                  : 'border-border hover:border-money-green/50'
              }`}
              onClick={() => setWeeklyFrequency(freq)}
            >
              {freq}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  // Confirmation Step
  const ConfirmStep = () => (
    <div className="space-y-4 ios-slide-up">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto bg-money-gradient rounded-full flex items-center justify-center shadow-money">
          <Check className="w-6 h-6 text-black" />
        </div>
        <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground">
          {t('workout.onboarding.steps.confirm.allSet')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('workout.onboarding.steps.confirm.review')}
        </p>
      </div>

      <div className="space-y-3">
        <Card className="glass-card">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-money-green" />
              <span className="font-medium text-foreground text-sm">{t('workout.onboarding.steps.confirm.selectedSports')}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedSports.map((sport) => (
                <Badge key={sport} variant="secondary" className="bg-money-green/20 text-money-green text-xs">
                  {sport}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-money-green" />
              <span className="font-medium text-foreground text-sm">{t('workout.onboarding.steps.confirm.fitnessGoals')}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {fitnessGoals.map((goalId) => {
                const goal = FITNESS_GOALS.find(g => g.id === goalId);
                return goal ? (
                  <Badge key={goalId} variant="secondary" className="bg-money-green/20 text-money-green text-xs">
                    {goal.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="glass-card">
            <CardContent className="p-3 text-center">
              <User className="w-4 h-4 text-money-green mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">{t('workout.onboarding.steps.confirm.experience')}</div>
              <div className="font-medium text-foreground capitalize text-sm">
                {t(`workout.onboarding.steps.goals.experience.levels.${experienceLevel}.label`)}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-3 text-center">
              <Calendar className="w-4 h-4 text-money-green mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">{t('workout.onboarding.steps.confirm.frequency')}</div>
              <div className="font-medium text-foreground text-sm">
                {weeklyFrequency}{t('workout.onboarding.steps.goals.weekly.freqSuffix')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <WelcomeStep />;
      case 1: return <SportsStep />;
      case 2: return <GoalsStep />;
      case 3: return <ConfirmStep />;
      default: return <WelcomeStep />;
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center px-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)'
      }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index <= currentStep ? 'bg-money-green' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          {/* Skip removed to enforce gating */}
        </div>

        {/* Progress */}
        <Progress value={progress} className="mb-8" />

        {/* Content */}
        <Card className={`glass-card border-none transition-all duration-300 ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
          <CardContent className="p-6">
            {currentStep === 0 ? (
              renderStep()
            ) : (
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                {renderStep()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0 || isAnimating}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('workout.onboarding.cta.back')}
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={nextStep}
              disabled={isAnimating || !canProceed()}
              className="bg-money-gradient hover:opacity-90 transition-opacity flex items-center gap-2 min-w-[100px]"
            >
              {t('workout.onboarding.cta.continue')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isAnimating}
              className="bg-money-gradient hover:opacity-90 transition-opacity flex items-center gap-2 min-w-[140px]"
            >
              {t('workout.onboarding.cta.completeSetup')}
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};