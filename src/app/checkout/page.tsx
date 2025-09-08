"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import '@/i18n/config';
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Shield, Lock, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/supabase/useSession';
import { useTelegramBack } from '@/hooks/useTelegramBack';

type PlanId = "free" | "lite" | "pro";

export default function CheckoutPage() {
  const { t, i18n } = useTranslation("app");
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();
  const plan = (params.get("plan") as PlanId) || "pro";
  const billing = (params.get("billing") as "monthly" | "annual") || "monthly";
  // Ensure Telegram Back closes this page (navigates back) when opened via deep link
  useTelegramBack(true, () => router.back());

  // Minimal shared plan data (kept in sync with SubscriptionPlans)
  const planMeta = useMemo(() => {
    return {
      free: { name: "Free", monthly: 0, annual: 0, trialDays: 0 },
      lite: { name: "Lite", monthly: 9990, annual: 99900, trialDays: 0 },
      pro: { name: "Pro", monthly: 19990, annual: 199900, trialDays: 7 },
    } satisfies Record<PlanId, { name: string; monthly: number; annual: number; trialDays: number }>;
  }, []);

  const price = billing === "annual" ? planMeta[plan].annual : planMeta[plan].monthly;
  const trialDays = planMeta[plan].trialDays;

  // Wait until checkout keys are available to avoid flashing raw keys
  const [translationsReady, setTranslationsReady] = useState(false);
  useEffect(() => {
    // Poll a few times briefly to allow async resource load
    let active = true;
    const check = () => {
      const ok = i18n && typeof i18n.exists === 'function' && i18n.exists('checkout.form.paymentDetails');
      if (ok && active) setTranslationsReady(true);
    };
    check();
    const id = setInterval(check, 150);
    // stop after 2 seconds max
    const stop = setTimeout(() => clearInterval(id), 2000);
    return () => { active = false; clearInterval(id); clearTimeout(stop); };
  }, [i18n, i18n.language]);

  // Form state (simple validation)
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [country, setCountry] = useState("UZ");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Prefill email from session if present
  useEffect(() => {
    if (session?.user?.email && !email) {
      setEmail(session.user.email);
    }
  }, [session?.user?.email]);

  const formatPrice = (v: number) => (v === 0 ? t("plans.free") : `${new Intl.NumberFormat("uz-UZ").format(v)} UZS`);

  // Format card number to groups of 4 digits (e.g., 4242 4242 4242 4242)
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 19); // keep only digits, up to 19
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(" ");
  };

  // Format expiry as MM/YY while typing
  const formatExpiryInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits; // typing month
    return `${digits.slice(0, 2)}/${digits.slice(2)}`; // add slash before year
  };

  const canSubmit = useMemo(() => {
    const phoneDigits = phone.replace(/[^0-9]/g, "");
    const phoneOk = phone.trim().length > 0 && phoneDigits.length >= 8 && phoneDigits.length <= 15;
    return (
      name.trim().length > 2 &&
      email.includes("@") &&
      phoneOk &&
      /^(\d{4} \d{4} \d{4} \d{4}|\d{16})$/.test(number.replace(/\s+/g, "").replace(/(\d{4})(?=\d)/g, "$1 ")) &&
      /^(0[1-9]|1[0-2])\/(\d{2})$/.test(expiry) &&
      /^\d{3,4}$/.test(cvc) &&
      !!country &&
      agree &&
      plan !== "free"
    );
  }, [name, email, phone, number, expiry, cvc, country, agree, plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setProcessing(true);
    try {
      // Simulate payment confirmation
      await new Promise((r) => setTimeout(r, 1200));

      // Persist subscription to Supabase, keyed by auth user_id and purchaser email/phone
      const userId: string | undefined = session?.user?.id as string | undefined;
      if (!userId) {
        throw new Error('No authenticated user');
      }

    // Normalize phone (basic): keep digits and leading +, ensure + prefix
    const cleaned = phone.replace(/[^\d+]/g, "");
    const normalizedPhone = cleaned.startsWith('+') ? cleaned : (cleaned ? `+${cleaned}` : null);

    // Upsert to user_profiles to keep phone on file
      try {
        await supabase.from('user_profiles').upsert({
          user_id: userId,
          email: session?.user?.email ?? email,
          name: (session?.user?.user_metadata as any)?.name ?? null,
      phone: normalizedPhone,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      } catch {}

      // Create/update subscription row with email and optional phone
      const now = new Date();
      const expiresAt = plan === 'pro'
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: subErr } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        email,
  phone: normalizedPhone,
        plan,
        status: 'active',
        started_at: now.toISOString(),
        expires_at: expiresAt,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });
      if (subErr) throw subErr;

      // Cache locally for quick gating without extra roundtrip
      if (typeof window !== 'undefined') localStorage.setItem('subscription_plan', plan);

      // Redirect back to app root
      router.replace("/");
    } finally {
      setProcessing(false);
    }
  };

  if (!translationsReady) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-surface-2 rounded" />
          <div className="h-5 w-80 bg-surface-2 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
            <div className="md:col-span-3 h-96 bg-surface-2 rounded-xl border border-border" />
            <div className="md:col-span-2 h-64 bg-surface-2 rounded-xl border border-border" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-2 bg-money-gradient px-4 py-2 rounded-full text-[#0a0b0d] font-semibold mb-4">
          <Crown className="w-5 h-5" />
          <span>{t("pricing.banner")}</span>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          {trialDays > 0 ? t("pricing.cta.startTrial", { days: trialDays }) : t("checkout.title.upgrade")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {trialDays > 0
            ? t('checkout.subtitle.trial', { days: trialDays })
            : t('checkout.subtitle.upgrade')}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Payment form */}
        <Card className="md:col-span-3 bg-surface-1 border-border">
          <CardHeader>
            <CardTitle>{t('checkout.form.paymentDetails')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('checkout.form.email')}</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('auth.register.phoneLabel')}</Label>
                <Input id="phone" type="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t('checkout.form.cardholderName')}</Label>
                <Input id="name" placeholder={t('checkout.form.cardholderNamePlaceholder') as string} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number">{t('checkout.form.cardNumber')}</Label>
                <Input
                  id="number"
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={number}
                  maxLength={19 + 3 /* spaces */}
                  onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="expiry">{t('checkout.form.expiry')}</Label>
                  <Input id="expiry" placeholder="MM/YY" value={expiry} maxLength={5} onChange={(e) => setExpiry(formatExpiryInput(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">{t('checkout.form.cvc')}</Label>
                  <Input id="cvc" inputMode="numeric" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/g, ""))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('checkout.form.country')}</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('checkout.form.selectCountry') as string} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZ">{t('checkout.countries.UZ')}</SelectItem>
                    <SelectItem value="RU">{t('checkout.countries.RU')}</SelectItem>
                    <SelectItem value="US">{t('checkout.countries.US')}</SelectItem>
                    <SelectItem value="GB">{t('checkout.countries.GB')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
                <input type="checkbox" className="size-4 accent-emerald-500" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{t('checkout.form.agree')}</span>
              </label>

              <Button
                type="submit"
                disabled={!canSubmit || processing}
                className="w-full h-12 rounded-lg bg-money-gradient text-[#0a0b0d] hover:opacity-90"
              >
                {processing ? t("pricing.cta.processing") : trialDays > 0 ? t("pricing.cta.startTrial", { days: trialDays }) : t("pricing.cta.upgradeNow")}
              </Button>
              {trialDays > 0 ? (
                <p className="text-xs text-muted-foreground text-center">{t('checkout.summary.chargeAfterTrial', { amount: formatPrice(price), period: billing === 'annual' ? t('pricing.billing.periodSuffix.year') : t('pricing.billing.periodSuffix.month') })}</p>
              ) : (
                <p className="text-xs text-muted-foreground text-center">{t('checkout.summary.chargeToday', { amount: formatPrice(price) })}</p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Order summary */}
        <div className="md:col-span-2 space-y-4">
          <Card className="bg-surface-1 border-border overflow-hidden">
            <CardHeader>
              <CardTitle>{t('checkout.summary.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('checkout.summary.plan')}</span>
                <span className="font-medium">{planMeta[plan].name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('checkout.summary.billing')}</span>
                <span className="font-medium">{billing === "annual" ? t('pricing.billing.annual') : t('pricing.billing.monthly')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('checkout.summary.amount')}</span>
                <span className="font-semibold">{formatPrice(price)}</span>
              </div>
              {trialDays > 0 && (
                <div className="rounded-lg p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                  {t('pricing.cta.startTrial', { days: trialDays })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface-1 border-border">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-center gap-2"><Shield className="w-4 h-4 text-green-400" />{t('pricing.footer.moneyBackGuarantee')}</div>
                <div className="flex items-center justify-center gap-2"><Lock className="w-4 h-4 text-blue-400" />{t('pricing.footer.securePayments')}</div>
                <div className="flex items-center justify-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />{t('pricing.footer.instantActivation')}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </Suspense>
  );
}
