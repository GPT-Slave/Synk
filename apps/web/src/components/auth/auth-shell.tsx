"use client";

import {
  CalendarCheck2,
  Clock3,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MotionPanel } from "@/components/ui/motion-panel";
import { useI18n } from "@/lib/i18n";

const previewRows = [
  [true, false, true, true, false, true, false],
  [false, true, true, false, true, true, true],
  [true, true, true, true, true, false, true],
];

export function AuthShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  const { t } = useI18n();

  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -start-32 -top-32 size-[32rem] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -bottom-44 end-[-8rem] size-[36rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      <div className="relative mx-auto grid min-h-svh max-w-[96rem] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden min-h-svh overflow-hidden border-e border-border/70 p-10 lg:flex xl:p-14">
          <div className="flex w-full flex-col justify-between">
            <Link
              aria-label={t("Synk home")}
              className="inline-flex w-fit items-center gap-3"
              href="/"
            >
              <span className="grid size-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 shadow-glow">
                <Image
                  alt=""
                  className="brand-neon-blue size-9 rounded-xl"
                  height={72}
                  priority
                  src="/logo.png"
                  width={72}
                />
              </span>
              <span>
                <span className="block text-2xl font-semibold tracking-[-0.05em]">
                  Synk
                </span>
                <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-primary/70">
                  {t("Find time. Together.")}
                </span>
              </span>
            </Link>

            <div className="mx-auto w-full max-w-2xl py-14">
              <MotionPanel>
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  <Sparkles className="size-3.5" />
                  {t("Visual availability")}
                </div>
                <h2 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] xl:text-6xl">
                  {t("Find time. Together.")}
                </h2>
                <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
                  {t(
                    "Create polls, share one secure link, and find the overlap.",
                  )}
                </p>
              </MotionPanel>

              <MotionPanel delay={0.06}>
                <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-border/80 bg-card/75 p-5 shadow-2xl shadow-black/15 backdrop-blur-xl">
                  <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        {t("Quarter-hour slots")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("Visual availability")}
                      </p>
                    </div>
                    <div className="flex -space-x-2 rtl:space-x-reverse">
                      {["M", "D", "S"].map((initial) => (
                        <span
                          className="grid size-9 place-items-center rounded-full border-2 border-card bg-primary/15 text-xs font-semibold text-primary"
                          key={initial}
                        >
                          {initial}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
                    <div className="mb-3 grid grid-cols-7 gap-2 text-center text-[0.62rem] font-medium uppercase tracking-wider text-muted-foreground">
                      {["M", "T", "W", "T", "F", "S", "S"].map(
                        (day, index) => (
                          <span key={`${day}-${index}`}>{day}</span>
                        ),
                      )}
                    </div>
                    <div className="space-y-2">
                      {previewRows.map((row, rowIndex) => (
                        <div className="grid grid-cols-7 gap-2" key={rowIndex}>
                          {row.map((active, columnIndex) => (
                            <span
                              className={`h-10 rounded-xl border transition ${
                                active
                                  ? "border-primary/35 bg-primary/25 shadow-inner"
                                  : "border-border/50 bg-muted/45"
                              }`}
                              key={columnIndex}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </MotionPanel>

              <div className="mt-7 grid grid-cols-3 gap-3">
                <Feature icon={<Clock3 />} label={t("Quarter-hour slots")} />
                <Feature icon={<UsersRound />} label={t("No participant accounts")} />
                <Feature icon={<CalendarCheck2 />} label={t("Visual availability")} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              {t("Organizer access")}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-svh items-center justify-center px-4 py-8 sm:px-8 lg:px-10 xl:px-16">
          <MotionPanel className="w-full max-w-[31rem] rounded-[2rem] border border-border/80 bg-card/82 p-6 shadow-[0_32px_100px_-42px_rgb(0_0_0_/_0.72)] backdrop-blur-xl sm:p-9">
            <Link
              aria-label={t("Synk home")}
              className="mb-8 inline-flex items-center gap-3 lg:hidden"
              href="/"
            >
              <span className="grid size-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10">
                <Image
                  alt="Synk"
                  className="brand-neon-blue size-9 rounded-xl"
                  height={72}
                  priority
                  src="/logo.png"
                  width={72}
                />
              </span>
              <span className="text-xl font-semibold tracking-[-0.04em]">Synk</span>
            </Link>

            <div className="mb-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <ShieldCheck className="size-3.5" />
                {t("Organizer access")}
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                {t(title)}
              </h1>
              <p className="mt-3 max-w-md leading-6 text-muted-foreground">
                {t(description)}
              </p>
            </div>

            {children}
          </MotionPanel>
        </section>
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-border/65 bg-card/55 p-3.5">
      <span className="mb-2.5 grid size-8 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-4">
        {icon}
      </span>
      <p className="text-xs font-medium leading-5 text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
