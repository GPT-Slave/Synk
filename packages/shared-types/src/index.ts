export interface MeetingDto {
  id: string;
  title: string;
  description?: string;
  slug: string;
  timezone: string;
  startDate: string;
  endDate: string;
  workdayStart: string;
  workdayEnd: string;
  finalized: boolean;
  responseDeadline?: string;
  createdAt: string;
}

export type MeetingStatus = "upcoming" | "past" | "finalized";

export interface OrganizerMeetingDto extends MeetingDto {
  status: MeetingStatus;
  participantCount: number;
  responseCount: number;
}

export interface PublicMeetingDto extends MeetingDto {
  acceptingResponses: boolean;
  closedReason?: string;
  dates: Array<{ date: string; label: string }>;
  slots: Array<{
    datetimeStart: string;
    datetimeEnd: string;
    date: string;
    timeLabel: string;
  }>;
}

export interface ParticipantDto {
  id: string;
  displayName: string;
  joinedAt: string;
}

export interface ParticipantSessionDto {
  participant: ParticipantDto;
  availabilities: AvailabilitySlotDto[];
}

export interface AvailabilitySlotDto {
  datetimeStart: string;
  datetimeEnd: string;
}

export interface HeatmapCellDto {
  datetimeStart: string;
  datetimeEnd: string;
  availableCount: number;
  totalParticipants: number;
  participantNames: string[];
}

export interface BestMatchDto {
  datetimeStart: string;
  datetimeEnd: string;
  percentage: number;
}
