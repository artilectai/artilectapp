"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// Utility: keys we want to wipe to restart onboarding and premium flows
const TRIAL_KEYS = [
  "pro_trial_status",
  "pro_trial_start_date",
  "pro_trial_end_date",
  "trial_eligibility",
  "onboarding_completed",
  "first_weekly_review_completed",
  "previous_plan_before_trial",
  "has_used_trial_before",
];

const CORE_KEYS = [
  "onboardingCompleted",
  "subscription_plan",
  "usage_count",
  "user_preferences",
  "userPreferences",
  "language",
  "timezone",
  "weekStart",
  "app_theme",
  "app_timezone",
  "nudge_history",
  "last_nudge_check",
];

const WORKOUT_KEYS = [
  "workout_programs",
  "workout_history",
  "today_tracker",
  "health_trackers",
  "workout_setup_complete",
  "workout_sports_selected",
  "workout_experience_level",
  "workout_frequency",
  "workout_goals",
];

const FINANCE_PREFIXES = ["finance_"]; // remove any localStorage key starting with these

export default function ResetPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const allKnownKeys = useMemo(() => {
    return [...TRIAL_KEYS, ...CORE_KEYS, ...WORKOUT_KEYS];
  }, []);

  const clearLocal = useCallback(() => {
    try {
      // Remove specific known keys first
      allKnownKeys.forEach((k) => localStorage.removeItem(k));

      // Remove finance_* keys and other prefixed keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (FINANCE_PREFIXES.some((p) => key.startsWith(p))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // Best-effort: clear Telegram CloudStorage if present
      const tg = (typeof window !== "undefined" && (window as any).Telegram)?.WebApp;
      if (tg?.CloudStorage) {
        // Remove known keys
        allKnownKeys.forEach((k) => {
          try {
            tg.CloudStorage.removeItem(k, () => {});
          } catch {}
        });
        keysToRemove.forEach((k) => {
          try {
            tg.CloudStorage.removeItem(k, () => {});
          } catch {}
        });
      }

      return { ok: true };
    } catch (e) {
      console.error("Local reset failed", e);
      return { ok: false, error: e };
    }
  }, [allKnownKeys]);

  const resetProfile = useCallback(async () => {
    if (!session?.user?.id) return { ok: false, skipped: true };
    try {
      const res = await fetch(`/api/users/${session.user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingCompleted: false,
          subscriptionPlan: "free",
          subscriptionStatus: "inactive",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, status: res.status, data };
      }
      return { ok: true };
    } catch (e) {
      console.error("Profile reset failed", e);
      return { ok: false, error: e };
    }
  }, [session?.user?.id]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setResult(null);

    const local = clearLocal();
    const profile = await resetProfile();

    const ok = local.ok && (profile.ok || profile.skipped);
    setResult(
      ok
        ? "Reset complete. Redirecting to onboarding..."
        : "Some parts failed to reset. You can still continue; if something looks off, try clearing site data in your browser settings."
    );

    // Small delay for UX, then route to onboarding
    setTimeout(() => {
      router.push("/onboarding");
      router.refresh();
    }, 700);
  }, [clearLocal, resetProfile, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0d] to-[#0f1114] flex items-center justify-center p-6">
      <div className="max-w-lg w-full glass-card p-6 rounded-2xl border border-border">
        <h1 className="text-2xl font-bold mb-2">Restart App</h1>
        <p className="text-muted-foreground mb-6">
          This will clear local data and reset your profile to run onboarding and premium plan flows again.
        </p>

        <div className="space-y-3 mb-6 text-sm">
          <div className="text-white/80">What will happen:</div>
          <ul className="list-disc list-inside text-white/70">
            <li>Clear onboarding, plan, usage counters, and trial flags</li>
            <li>Reset workout and finance local data</li>
            <li>Set your profile to onboarding not completed and plan = free</li>
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleReset} disabled={isResetting} className="bg-money-gradient text-black font-semibold">
            {isResetting ? "Resetting…" : "Reset everything"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")}>Cancel</Button>
        </div>

        {result && <p className="text-sm text-muted-foreground mt-4">{result}</p>}

        <div className="mt-6 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
          Tip: You can also manually clear site data via your browser settings if needed.
        </div>
      </div>
    </div>
  );
}
