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
  slotIntervalMinutes: 15;
  meetingDurationMinutes: number;
  finalized: boolean;
  locked: boolean;
  finalSlot?: AvailabilitySlotDto;
  createdAt: string;
}

export type MeetingStatus = "upcoming" | "past" | "finalized";

export interface OrganizerMeetingDto extends MeetingDto {
  status: MeetingStatus;
  participantCount: number;
  responseCount: number;
}

export interface OrganizerMeetingPageDto {
  items: OrganizerMeetingDto[];
  nextCursor?: string;
}

export interface MeetingGridDateDto {
  date: string;
  label: string;
}

export interface MeetingGridSlotDto extends AvailabilitySlotDto {
  date: string;
  timeLabel: string;
}

export interface PublicMeetingDto extends MeetingDto {
  acceptingResponses: boolean;
  closedReason?: string;
  dates: MeetingGridDateDto[];
  slots: MeetingGridSlotDto[];
  participants: HeatmapParticipantDto[];
  heatmap: HeatmapCellDto[];
}

export interface HeatmapParticipantDto {
  id: string;
  displayName: string;
  isOrganizer?: boolean;
  responded?: boolean;
}

export interface ParticipantDto {
  id: string;
  displayName: string;
  joinedAt: string;
  isOrganizer?: boolean;
}

export interface ParticipantSessionDto {
  participant: ParticipantDto;
  availabilities: AvailabilitySlotDto[];
  comment?: string;
}

export interface AvailabilitySlotDto {
  datetimeStart: string;
  datetimeEnd: string;
}

export interface HeatmapCellDto {
  datetimeStart: string;
  datetimeEnd: string;
  date: string;
  timeLabel: string;
  availableCount: number;
  totalParticipants: number;
  percentage: number;
  participantIds: string[];
  participantNames: string[];
}

export interface BestMatchDto {
  datetimeStart: string;
  datetimeEnd: string;
  date: string;
  timeLabel: string;
  availableCount: number;
  totalParticipants: number;
  percentage: number;
  participantIds: string[];
  participantNames: string[];
}
