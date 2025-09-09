"use client";

import { useEffect } from "react";
import { initTelegramUI } from "@/lib/telegram";

export default function TelegramBootstrap() {
  useEffect(() => {
    initTelegramUI();
  }, []);
  return null;
}
