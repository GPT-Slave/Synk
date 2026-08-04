"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { OrganizerShell } from "@/components/organizer-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { getMeeting } from "@/lib/meeting-api";
import { useI18n } from "@/lib/i18n";

export default function EditMeetingPage() {
  return (
    <OrganizerShell>
      <EditMeeting />
    </OrganizerShell>
  );
}

function EditMeeting() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const meeting = useQuery({
    queryKey: ["meetings", id],
    queryFn: () => getMeeting(id),
  });

  return (
    <section className="mx-auto max-w-5xl py-10 sm:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        href={`/dashboard/meetings/${id}`}
      >
        <ArrowLeft className="size-4" /> {t("Back to meeting")}
      </Link>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight">
        {t("Edit meeting")}
      </h1>
      {meeting.isPending && (
        <div className="mt-10 space-y-4" role="status">
          <Skeleton className="h-14" />
          <Skeleton className="h-44" />
          <Skeleton className="h-52" />
          <span className="sr-only">{t("Loading meeting form…")}</span>
        </div>
      )}
      {meeting.isError && (
        <StatePanel
          className="mt-10"
          description={t("It may have been deleted, or it belongs to another organizer.")}
          kind="error"
          onRetry={() => void meeting.refetch()}
          title={t("Meeting could not be loaded")}
        />
      )}
      {meeting.data?.finalized && (
        <StatePanel
          action={
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href={`/dashboard/meetings/${id}`}
            >
              {t("Return to meeting")}
            </Link>
          }
          className="mt-10"
          description={t("Re-open the meeting from its dashboard before changing the schedule.")}
          icon={<LockKeyhole />}
          title={t("This meeting is finalized")}
        />
      )}
      {meeting.data && !meeting.data.finalized && (
        <div className="mt-10">
          <MeetingForm meeting={meeting.data} />
        </div>
      )}
    </section>
  );
}
