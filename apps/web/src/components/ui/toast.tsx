"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastRecord extends ToastInput {
  id: number;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(0);
  const reduceMotion = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-2), { ...input, id }]);
      window.setTimeout(() => dismiss(id), 3_600);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-atomic="false"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              animate={{ opacity: 1, x: 0, y: 0 }}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-white/12 bg-popover/96 p-4 shadow-lg backdrop-blur-xl",
                toast.variant === "error" && "border-destructive/35",
              )}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18 }}
              initial={
                reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20, y: 6 }
              }
              key={toast.id}
              layout
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <ToastIcon variant={toast.variant ?? "info"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                aria-label={t("Dismiss notification")}
                className="grid size-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                onClick={() => dismiss(toast.id)}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const contents = useMemo(
    () => ({
      success: <CheckCircle2 className="text-primary" />,
      error: <AlertTriangle className="text-destructive" />,
      info: <Info className="text-primary" />,
    }),
    [],
  );
  return <span className="mt-0.5 [&_svg]:size-4">{contents[variant]}</span>;
}
