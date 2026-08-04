"use client";

import { ArrowRight, CalendarDays, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();
  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden px-5 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,oklch(0.82_0.18_245_/_0.14),transparent_38%)]" />
      <nav className="relative mx-auto flex w-full max-w-6xl items-center justify-between border-b border-white/10 py-5">
        <Link className="flex items-center gap-3" href="/">
          <Image
            alt=""
            className="brand-neon-blue size-11 rounded-lg"
            height={72}
            priority
            src="/logo.png"
            width={72}
          />
          <span className="text-xl font-semibold tracking-tight">Synk</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/login" />} variant="ghost">
            {t("Log in")}
          </Button>
          <Button render={<Link href="/signup" />}>{t("Sign up")}</Button>
        </div>
      </nav>

      <section className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
        <div>
          <p className="mb-5 flex items-center gap-2 text-sm font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
            {t("Scheduling without the back-and-forth")}
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            {t("Find the time that works for everyone.")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t(
              "Create an availability poll, share one secure link, and see the perfect overlap. Participants never need an account.",
            )}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-11 px-5 shadow-glow"
              render={<Link href="/signup" />}
            >
              {t("Create your first poll")} <ArrowRight />
            </Button>
            <Button
              className="h-11 px-5"
              render={<Link href="/login" />}
              variant="outline"
            >
              {t("Organizer login")}
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />{" "}
              {t("Visual availability")}
            </span>
            <span className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" />{" "}
              {t("No participant accounts")}
            </span>
          </div>
        </div>

        <div className="relative mx-auto grid aspect-square w-full max-w-md place-items-center rounded-lg border border-primary/20 bg-primary/[0.045] shadow-[0_0_100px_-38px_oklch(0.82_0.18_245)]">
          <div className="pointer-events-none absolute inset-8 rounded-[2rem] border border-white/[0.06]" />
          <div className="relative text-center">
            <Image
              alt=""
              className="brand-neon-blue mx-auto size-40 rounded-lg sm:size-52"
              height={360}
              priority
              src="/logo.png"
              width={360}
            />
            <p className="mt-7 text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
              Synk
            </p>
            <p className="mt-2 text-sm tracking-[0.18em] text-primary/60 uppercase">
              {t("Find time. Together.")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
