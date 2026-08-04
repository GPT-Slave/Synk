import type {
  AvailabilitySlotDto,
  BestMatchDto,
  HeatmapCellDto,
  MeetingDto,
  MeetingGridDateDto,
  MeetingGridSlotDto,
  OrganizerMeetingDto,
  ParticipantSessionDto,
  PublicMeetingDto,
} from "@meet-planner/shared-types";
import { authenticatedRequest, request } from "./auth-api";

export interface MeetingInput {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  workdayStart: string;
  workdayEnd: string;
  slotIntervalMinutes: 30 | 60;
  timezone: string;
  responseDeadline?: string | null;
}

export interface OrganizerMeetingDetail extends OrganizerMeetingDto {
  participants: Array<{
    id: string;
    displayName: string;
    joinedAt: string;
    responded: boolean;
    comment?: string;
  }>;
  dates: MeetingGridDateDto[];
  slots: MeetingGridSlotDto[];
  heatmap: HeatmapCellDto[];
  bestTimes: BestMatchDto[];
}

export interface JoinedParticipantSession extends ParticipantSessionDto {
  sessionToken: string;
}

export function listMeetings() {
  return authenticatedRequest<OrganizerMeetingDto[]>("/meetings");
}

export function getMeeting(id: string) {
  return authenticatedRequest<OrganizerMeetingDetail>(`/meetings/${id}`);
}

export function createMeeting(input: MeetingInput) {
  return authenticatedRequest<MeetingDto>("/meetings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMeeting(id: string, input: MeetingInput) {
  return authenticatedRequest<MeetingDto>(`/meetings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMeeting(id: string) {
  return authenticatedRequest<void>(`/meetings/${id}`, { method: "DELETE" });
}

export function getPublicMeeting(token: string) {
  return request<PublicMeetingDto>(`/public/meetings/${token}`);
}

export function joinMeeting(token: string, displayName: string) {
  return request<JoinedParticipantSession>(
    `/public/meetings/${token}/participants`,
    {
      method: "POST",
      body: JSON.stringify({ displayName }),
    },
  );
}

export function getParticipantSession(token: string, sessionToken: string) {
  return request<ParticipantSessionDto>(`/public/meetings/${token}/session`, {
    headers: { "x-participant-session": sessionToken },
  });
}

export function saveAvailability(
  token: string,
  sessionToken: string,
  response: { slots: AvailabilitySlotDto[]; comment?: string },
) {
  return request<{ availabilities: AvailabilitySlotDto[]; comment?: string }>(
    `/public/meetings/${token}/availability`,
    {
      method: "PUT",
      headers: { "x-participant-session": sessionToken },
      body: JSON.stringify(response),
    },
  );
}
