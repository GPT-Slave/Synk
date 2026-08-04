"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { OrganizerShell } from "@/components/organizer-shell";
import { getMeeting } from "@/lib/meeting-api";

export default function EditMeetingPage() {
  return (
    <OrganizerShell>
      <EditMeeting />
    </OrganizerShell>
  );
}

function EditMeeting() {
  const { id } = useParams<{ id: string }>();
  const meeting = useQuery({
    queryKey: ["meetings", id],
    queryFn: () => getMeeting(id),
  });

  return (
    <section className="mx-auto max-w-3xl py-10 sm:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        href={`/dashboard/meetings/${id}`}
      >
        <ArrowLeft className="size-4" /> Back to meeting
      </Link>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight">
        Edit meeting
      </h1>
      {meeting.isPending && (
        <div className="mt-10 h-96 animate-pulse rounded-2xl bg-white/5" />
      )}
      {meeting.isError && (
        <p className="mt-10 text-sm text-blue-200">
          This meeting could not be loaded or is no longer available.
        </p>
      )}
      {meeting.data?.finalized && (
        <p className="mt-10 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-blue-100">
          Finalized meetings cannot be edited.
        </p>
      )}
      {meeting.data && !meeting.data.finalized && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-8">
          <MeetingForm meeting={meeting.data} />
        </div>
      )}
    </section>
  );
}
