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
}

export interface ParticipantDto {
  id: string;
  displayName: string;
  joinedAt: string;
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
