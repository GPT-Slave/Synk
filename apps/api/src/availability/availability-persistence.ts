export interface StoredAvailabilitySlot {
  id: string;
  datetimeStart: Date;
  datetimeEnd: Date;
}

export interface DesiredAvailabilitySlot {
  datetimeStart: Date;
  datetimeEnd: Date;
}

export function availabilitySlotChanges(
  stored: StoredAvailabilitySlot[],
  desired: DesiredAvailabilitySlot[],
) {
  const storedByKey = new Map(
    stored.map((slot) => [availabilitySlotKey(slot), slot]),
  );
  const desiredByKey = new Map(
    desired.map((slot) => [availabilitySlotKey(slot), slot]),
  );

  return {
    deleteIds: stored
      .filter((slot) => !desiredByKey.has(availabilitySlotKey(slot)))
      .map((slot) => slot.id),
    create: desired.filter(
      (slot) => !storedByKey.has(availabilitySlotKey(slot)),
    ),
  };
}

export function availabilitySlotsEqual(
  stored: StoredAvailabilitySlot[],
  desired: DesiredAvailabilitySlot[],
): boolean {
  if (stored.length !== desired.length) return false;
  const storedKeys = new Set(stored.map(availabilitySlotKey));
  return desired.every((slot) => storedKeys.has(availabilitySlotKey(slot)));
}

function availabilitySlotKey(slot: DesiredAvailabilitySlot): string {
  return `${slot.datetimeStart.toISOString()}|${slot.datetimeEnd.toISOString()}`;
}
