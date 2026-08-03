import { CalendarDays } from "lucide-react";
import type { MeetingDto } from "@meet-planner/shared-types";
import { Button } from "@/components/ui/button";

// Placeholder until real meetings come from the API (proves shared-types wiring).
const exampleMeeting: Pick<MeetingDto, "title" | "timezone"> = {
  title: "INSAT Robotics Weekly Meeting",
  timezone: "Africa/Tunis",
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex items-center gap-3">
        <CalendarDays className="size-10 text-primary" />
        <h1 className="text-4xl font-semibold tracking-tight">Meet Planner</h1>
      </div>
      <p className="max-w-md text-lg text-muted-foreground">
        Create an availability poll, share one link, and find the time that
        works for everyone — no accounts needed for participants.
      </p>
      <Button size="lg">Create Meeting</Button>
      <p className="text-sm text-muted-foreground">
        e.g. {exampleMeeting.title} · {exampleMeeting.timezone}
      </p>
    </div>
  );
}
