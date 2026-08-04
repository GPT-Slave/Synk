"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { OrganizerShell } from "@/components/organizer-shell";
import { useI18n } from "@/lib/i18n";

export default function NewMeetingPage() {
  const { t } = useI18n();
  return (
    <OrganizerShell>
      <section className="mx-auto max-w-5xl py-10 sm:py-14">
        <Link
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          href="/dashboard"
        >
          <ArrowLeft className="size-4" /> {t("Back to meetings")}
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight">
          {t("Create meeting")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t(
            "Define the window, then share the secure link with your participants.",
          )}
        </p>
        <div className="mt-10">
          <MeetingForm />
        </div>
      </section>
    </OrganizerShell>
  );
}
