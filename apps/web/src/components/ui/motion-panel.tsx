"use client";

import { motion, useReducedMotion } from "framer-motion";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function MotionPanel({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      transition={{ duration: 0.2, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
