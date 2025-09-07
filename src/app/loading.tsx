"use client";

import { motion } from "framer-motion";
import { iosSpring } from "@/components/iOSAnimations";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0d] to-[#0f1114] flex items-center justify-center">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={iosSpring.gentle}
      >
        {/* Brand spinner (money green) */}
        <motion.div
          className="w-16 h-16 border-4 border-money-green/30 border-t-money-green rounded-full mx-auto mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        {/* Removed progress line per request */}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2
            className="text-xl font-bold text-money-green mb-2"
            style={{ textShadow: "0 0 14px rgba(0,213,99,0.45)" }}
          >
            Artilect Assistant
          </h2>
          <p className="text-muted-foreground">Preparing your productivity dashboard...</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
