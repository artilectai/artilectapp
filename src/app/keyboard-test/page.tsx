"use client";

import React from "react";
import MobileKeyboardEvents from "@/components/MobileKeyboardEvents";

export default function KeyboardTestPage() {
  const [vv, setVv] = React.useState<{ height: number; width: number; offsetTop: number; offsetLeft: number } | null>(null);
  const [tgVh, setTgVh] = React.useState<{ vh?: number; stable?: number; version?: string } | null>(null);
  const [cssVars, setCssVars] = React.useState<{ kb?: string; tgvh?: string; stableVh?: string } | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const bottomRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const updateVV = () => {
      const v = (window as any).visualViewport as VisualViewport | undefined;
      if (!v) { setVv(null); return; }
      setVv({ height: Math.round(v.height), width: Math.round(v.width), offsetTop: Math.round(v.offsetTop), offsetLeft: Math.round(v.offsetLeft) });
    };
    updateVV();
    const v = (window as any).visualViewport as VisualViewport | undefined;
    v?.addEventListener("resize", updateVV);
    v?.addEventListener("scroll", updateVV);
    return () => {
      v?.removeEventListener("resize", updateVV);
      v?.removeEventListener("scroll", updateVV);
    };
  }, []);

  React.useEffect(() => {
    const updateTg = () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        setTgVh({ vh: tg?.viewportHeight, stable: tg?.viewportStableHeight, version: tg?.version });
      } catch { setTgVh(null); }
    };
    updateTg();
    try { (window as any).Telegram?.WebApp?.onEvent?.("viewportChanged", updateTg); } catch {}
    return () => { try { (window as any).Telegram?.WebApp?.offEvent?.("viewportChanged", updateTg); } catch {} };
  }, []);

  React.useEffect(() => {
    const updateVars = () => {
      const cs = getComputedStyle(document.documentElement);
      setCssVars({
        kb: cs.getPropertyValue("--kb-offset").trim() || undefined,
        tgvh: cs.getPropertyValue("--tgvh").trim() || undefined,
        stableVh: cs.getPropertyValue("--stable-vh").trim() || undefined,
      });
    };
    updateVars();
    const id = setInterval(updateVars, 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-stretch justify-start bg-[#0b0f10] text-foreground" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + var(--kb-offset, 0px))" }}>
      <MobileKeyboardEvents />

      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold">Keyboard Test</h1>
        <p className="text-sm text-muted-foreground">A minimal page to isolate keyboard and viewport behavior.</p>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <div className="rounded-xl border border-border p-3 bg-surface-1/60">
          <div className="text-sm mb-2 font-medium">Live Metrics</div>
          <div className="text-xs grid grid-cols-2 gap-2">
            <div>VV height: {vv?.height ?? 'n/a'}</div>
            <div>VV offsetTop: {vv?.offsetTop ?? 'n/a'}</div>
            <div>TG vh: {tgVh?.vh ?? 'n/a'}</div>
            <div>TG stable: {tgVh?.stable ?? 'n/a'}</div>
            <div>SDK version: {tgVh?.version ?? 'n/a'}</div>
            <div>--kb-offset: {cssVars?.kb ?? 'n/a'}</div>
            <div>--tgvh: {cssVars?.tgvh ?? 'n/a'}</div>
            <div>--stable-vh: {cssVars?.stableVh ?? 'n/a'}</div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm">Top input</label>
          <input ref={inputRef} className="w-full rounded-md border border-input bg-surface-1 px-3 py-2" placeholder="Type here" />
        </div>

        <div className="h-[40vh]" />

        <div className="space-y-3">
          <label className="block text-sm">Middle input</label>
          <input className="w-full rounded-md border border-input bg-surface-1 px-3 py-2" placeholder="Another input" />
        </div>

        <div className="h-[30vh]" />
      </div>

      {/* Fixed bottom input to test pinned elements above keyboard */}
      <div className="fixed left-0 right-0" style={{ bottom: "calc(env(safe-area-inset-bottom) + var(--kb-offset, 0px))", zIndex: 1000 }}>
        <div className="bg-card border-t border-border p-3">
          <div className="max-w-md mx-auto grid grid-cols-[1fr_auto] gap-2">
            <input ref={bottomRef} className="rounded-md border border-input bg-surface-1 px-3 py-2" placeholder="Fixed bottom input" />
            <button onClick={() => bottomRef.current?.focus()} className="px-3 py-2 rounded-md bg-[#00d563] text-[#0a0b0d] font-medium">Focus</button>
          </div>
        </div>
      </div>
    </div>
  );
}
