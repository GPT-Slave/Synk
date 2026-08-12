from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


# Keep the two floating controls on physical opposite sides even when <html dir="rtl">.
replace_once(
    "apps/web/src/components/language-switcher.tsx",
    'className="fixed bottom-4 end-4 z-[70] flex items-center gap-2 rounded-xl border border-white/12 bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl"',
    'className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl border border-white/12 bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl"',
)
replace_once(
    "apps/web/src/components/theme-toggle.tsx",
    'className="fixed bottom-4 start-4 z-[70] grid size-10 place-items-center rounded-xl border border-white/12 bg-card/95 text-foreground shadow-xl backdrop-blur-xl transition hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"',
    'className="fixed bottom-4 left-4 z-[70] grid size-10 place-items-center rounded-xl border border-white/12 bg-card/95 text-foreground shadow-xl backdrop-blur-xl transition hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"',
)

# Add the visual quarter-of-hour cue without changing the timetable hit targets.
globals_path = ROOT / "apps/web/src/app/globals.css"
globals_text = globals_path.read_text(encoding="utf-8")
quarter_css = r'''

/* Quarter-of-hour cue inside availability cells. */
button[data-slot-start][title$=":00"] { --synk-quarter-fill: 25%; }
button[data-slot-start][title$=":15"] { --synk-quarter-fill: 50%; }
button[data-slot-start][title$=":30"] { --synk-quarter-fill: 75%; }
button[data-slot-start][title$=":45"] { --synk-quarter-fill: 100%; }

button[data-slot-start]::after {
  --synk-quarter-icon: var(--primary);
  content: "";
  pointer-events: none;
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.72rem;
  height: 0.72rem;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--synk-quarter-icon) 72%, transparent);
  background: conic-gradient(
    from -90deg,
    var(--synk-quarter-icon) 0 var(--synk-quarter-fill),
    color-mix(in oklab, var(--synk-quarter-icon) 15%, transparent) var(--synk-quarter-fill) 100%
  );
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--background) 34%, transparent);
  opacity: 0.78;
}

button[data-slot-start][aria-pressed="true"]::after {
  --synk-quarter-icon: var(--primary-foreground);
  opacity: 0.94;
}
'''
if "Quarter-of-hour cue inside availability cells" not in globals_text:
    globals_path.write_text(globals_text.rstrip() + quarter_css + "\n", encoding="utf-8")

# Participant guidance dialog appears as soon as the availability timetable is entered.
availability_path = ROOT / "apps/web/src/components/meetings/availability-grid.tsx"
availability = availability_path.read_text(encoding="utf-8")
availability = availability.replace(
    'import { Button } from "@/components/ui/button";\nimport { StatePanel } from "@/components/ui/state-panel";',
    'import { Button } from "@/components/ui/button";\nimport {\n  Dialog,\n  DialogContent,\n  DialogDescription,\n  DialogFooter,\n  DialogHeader,\n  DialogTitle,\n} from "@/components/ui/dialog";\nimport { StatePanel } from "@/components/ui/state-panel";',
    1,
)
availability = availability.replace(
    '  const [saveState, setSaveState] = useState<SaveState>("idle");',
    '  const [saveState, setSaveState] = useState<SaveState>("idle");\n  const [showGuidance, setShowGuidance] = useState(mode === "participant");',
    1,
)
availability = availability.replace(
    '  return (\n    <section className={mode === "participant" ? "mt-8" : ""}>\n      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">',
    '  return (\n    <section className={mode === "participant" ? "mt-8" : ""}>\n      {mode === "participant" && (\n        <ParticipantGuidanceDialog\n          onOpenChange={setShowGuidance}\n          open={showGuidance}\n        />\n      )}\n      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">',
    1,
)
guidance_component = r'''
function ParticipantGuidanceDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("Your availability")}</DialogTitle>
          <DialogDescription>
            {t(
              "Tap one square or paint across several. The complete timetable is always shown below.",
            )}
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t("Each hour is split into four 15-minute quarters.")}
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t("Selected times are highlighted and saved automatically.")}
          </li>
          <li className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
            {t(
              "Use the same name on another device to reopen this availability.",
            )}
          </li>
        </ul>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button">
            {t("Continue to availability")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'''
marker = "function SaveIndicator({ state }: { state: SaveState }) {"
if marker not in availability:
    raise RuntimeError("AvailabilityGrid SaveIndicator marker not found")
availability = availability.replace(marker, guidance_component + marker, 1)
availability_path.write_text(availability, encoding="utf-8")

# Add three dialog strings to every supported non-English locale.
translations = {
    "fr": [
        "Chaque heure est divisée en quatre quarts de 15 minutes.",
        "Les horaires sélectionnés sont mis en évidence et enregistrés automatiquement.",
        "Utilisez le même nom sur un autre appareil pour rouvrir cette disponibilité.",
    ],
    "ar": [
        "تُقسَّم كل ساعة إلى أربع فترات مدة كل منها 15 دقيقة.",
        "تظهر الأوقات المحددة بوضوح ويتم حفظها تلقائيًا.",
        "استخدم الاسم نفسه على جهاز آخر لفتح هذا التوافر من جديد.",
    ],
    "ja": [
        "1時間は15分ずつの4つの区切りに分かれています。",
        "選択した時間は強調表示され、自動的に保存されます。",
        "別の端末でも同じ名前を使うと、この空き時間を再度開けます。",
    ],
    "zh": [
        "每小时分为四个 15 分钟时段。",
        "已选择的时间会高亮显示并自动保存。",
        "在另一台设备上使用相同姓名即可重新打开这份可用时间。",
    ],
    "es": [
        "Cada hora se divide en cuatro tramos de 15 minutos.",
        "Los horarios seleccionados se resaltan y se guardan automáticamente.",
        "Usa el mismo nombre en otro dispositivo para volver a abrir esta disponibilidad.",
    ],
    "pt": [
        "Cada hora é dividida em quatro períodos de 15 minutos.",
        "Os horários selecionados ficam destacados e são salvos automaticamente.",
        "Use o mesmo nome em outro dispositivo para reabrir esta disponibilidade.",
    ],
    "ru": [
        "Каждый час разделён на четыре 15-минутных интервала.",
        "Выбранное время подсвечивается и сохраняется автоматически.",
        "Используйте то же имя на другом устройстве, чтобы снова открыть эту доступность.",
    ],
    "de": [
        "Jede Stunde ist in vier 15-Minuten-Abschnitte unterteilt.",
        "Ausgewählte Zeiten werden hervorgehoben und automatisch gespeichert.",
        "Verwende auf einem anderen Gerät denselben Namen, um diese Verfügbarkeit wieder zu öffnen.",
    ],
    "nl": [
        "Elk uur is verdeeld in vier kwartieren van 15 minuten.",
        "Geselecteerde tijden worden gemarkeerd en automatisch opgeslagen.",
        "Gebruik op een ander apparaat dezelfde naam om deze beschikbaarheid opnieuw te openen.",
    ],
    "hi": [
        "हर घंटे को 15-15 मिनट के चार हिस्सों में बाँटा गया है।",
        "चुने गए समय हाइलाइट होते हैं और अपने-आप सहेजे जाते हैं।",
        "दूसरे डिवाइस पर यही नाम इस्तेमाल करके इस उपलब्धता को फिर से खोलें।",
    ],
    "it": [
        "Ogni ora è divisa in quattro intervalli da 15 minuti.",
        "Gli orari selezionati vengono evidenziati e salvati automaticamente.",
        "Usa lo stesso nome su un altro dispositivo per riaprire questa disponibilità.",
    ],
}
keys = [
    "Each hour is split into four 15-minute quarters.",
    "Selected times are highlighted and saved automatically.",
    "Use the same name on another device to reopen this availability.",
]
i18n_path = ROOT / "apps/web/src/lib/i18n-extra.ts"
i18n = i18n_path.read_text(encoding="utf-8")
for locale, values in translations.items():
    pattern = re.compile(rf'(  {locale}: \{{.*?)(\n  \}},)', re.S)
    match = pattern.search(i18n)
    if not match:
        raise RuntimeError(f"Locale block not found: {locale}")
    block = match.group(1)
    if keys[0] in block:
        continue
    added = "".join(
        f'\n    "{key}": {value!r},'.replace("'", '"', 1).rsplit("'", 1)[0] + '"'
        for key, value in zip(keys, values)
    )
    # Build valid TS strings with JSON-style escaping instead of Python repr.
    import json
    added = "".join(
        f"\n    {json.dumps(key, ensure_ascii=False)}: {json.dumps(value, ensure_ascii=False)},"
        for key, value in zip(keys, values)
    )
    i18n = i18n[: match.end(1)] + added + i18n[match.end(1) :]
i18n_path.write_text(i18n, encoding="utf-8")

# Multi-device participant sessions: keep the legacy token column for backwards compatibility,
# but issue each device a separate token row attached to the same participant.
schema_path = ROOT / "apps/api/prisma/schema.prisma"
schema = schema_path.read_text(encoding="utf-8")
if "model ParticipantSession" not in schema:
    schema = schema.replace(
        "  availabilities        Availability[]\n",
        "  availabilities        Availability[]\n  sessions              ParticipantSession[]\n",
        1,
    )
    schema = schema.replace(
        "model Availability {",
        '''model ParticipantSession {
  id            String      @id @default(cuid())
  participantId String      @map("participant_id")
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  tokenHash     String      @unique @map("token_hash")
  createdAt     DateTime    @default(now()) @map("created_at")

  @@index([participantId])
  @@map("participant_sessions")
}

model Availability {''',
        1,
    )
schema_path.write_text(schema, encoding="utf-8")

migration_dir = ROOT / "apps/api/prisma/migrations/20260812193000_multi_device_participant_sessions"
migration_dir.mkdir(parents=True, exist_ok=True)
(migration_dir / "migration.sql").write_text('''CREATE TABLE "participant_sessions" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "participant_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "participant_sessions_token_hash_key"
ON "participant_sessions"("token_hash");

CREATE INDEX "participant_sessions_participant_id_idx"
ON "participant_sessions"("participant_id");

ALTER TABLE "participant_sessions"
ADD CONSTRAINT "participant_sessions_participant_id_fkey"
FOREIGN KEY ("participant_id") REFERENCES "participants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing browser session while moving to one-session-per-device rows.
INSERT INTO "participant_sessions" ("id", "participant_id", "token_hash", "created_at")
SELECT 'legacy_' || "id", "id", "session_token_hash", "joined_at"
FROM "participants"
WHERE "session_token_hash" IS NOT NULL
ON CONFLICT ("token_hash") DO NOTHING;
''', encoding="utf-8")

service_path = ROOT / "apps/api/src/participants/participants.service.ts"
service = service_path.read_text(encoding="utf-8")
join_start = service.index("  async join(")
session_start = service.index("  async session(", join_start)
new_join = r'''  async join(slug: string, requestedName: string) {
    const displayName = requestedName.trim().replace(/\s+/g, ' ');
    if (displayName.length < 2 || displayName.length > 30) {
      throw new ConflictException('Display name must be 2–30 characters.');
    }
    const displayNameNormalized = this.normalizeName(displayName);
    const sessionToken = randomBytes(32).toString('base64url');
    const sessionTokenHash = this.hashToken(sessionToken);

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const meeting = await transaction.meeting.findUnique({
          where: { slug },
        });
        if (!meeting) throw new NotFoundException('Invitation link not found.');
        this.ensureOpen(meeting);

        let participant = await transaction.participant.findUnique({
          where: {
            meetingId_displayNameNormalized: {
              meetingId: meeting.id,
              displayNameNormalized,
            },
          },
          include: { availabilities: true },
        });
        const isNew = !participant;
        if (!participant) {
          participant = await transaction.participant.create({
            data: {
              meetingId: meeting.id,
              displayName,
              displayNameNormalized,
            },
            include: { availabilities: true },
          });
        }

        await transaction.participantSession.create({
          data: {
            participantId: participant.id,
            tokenHash: sessionTokenHash,
          },
        });
        return { meetingId: meeting.id, participant, isNew };
      });

      if (result.isNew) {
        this.realtime.participantJoined({
          meetingId: result.meetingId,
          participant: this.serialize(result.participant),
        });
      }

      return this.joinResponse(result.participant, sessionToken);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const meeting = await this.meetings.findBySlug(slug);
        this.ensureOpen(meeting);
        const participant = await this.prisma.participant.findUnique({
          where: {
            meetingId_displayNameNormalized: {
              meetingId: meeting.id,
              displayNameNormalized,
            },
          },
          include: { availabilities: true },
        });
        if (!participant) throw error;

        const retryToken = randomBytes(32).toString('base64url');
        await this.prisma.participantSession.create({
          data: {
            participantId: participant.id,
            tokenHash: this.hashToken(retryToken),
          },
        });
        return this.joinResponse(participant, retryToken);
      }
      throw error;
    }
  }

'''
service = service[:join_start] + new_join + service[session_start:]
require_start = service.index("  async requireSession(")
ensure_start = service.index("  ensureOpen(", require_start)
new_require = r'''  async requireSession(slug: string, sessionToken: string | undefined) {
    if (!sessionToken) {
      throw new UnauthorizedException('Participant session missing.');
    }
    const tokenHash = this.hashToken(sessionToken);
    const session = await this.prisma.participantSession.findUnique({
      where: { tokenHash },
      include: {
        participant: {
          include: { meeting: true, availabilities: true },
        },
      },
    });
    const legacyParticipant = session
      ? null
      : await this.prisma.participant.findUnique({
          where: { sessionTokenHash: tokenHash },
          include: { meeting: true, availabilities: true },
        });
    const participant = session?.participant ?? legacyParticipant;
    if (!participant || participant.meeting.slug !== slug) {
      throw new UnauthorizedException('Participant session is invalid.');
    }
    return participant;
  }

  private joinResponse(
    participant: {
      id: string;
      displayName: string;
      joinedAt: Date;
      comment: string | null;
      availabilities: Array<{ datetimeStart: Date; datetimeEnd: Date }>;
    },
    sessionToken: string,
  ) {
    return {
      participant: this.serialize(participant),
      sessionToken,
      availabilities: participant.availabilities.map((availability) => ({
        datetimeStart: availability.datetimeStart.toISOString(),
        datetimeEnd: availability.datetimeEnd.toISOString(),
      })),
      ...(participant.comment ? { comment: participant.comment } : {}),
    };
  }

'''
service = service[:require_start] + new_require + service[ensure_start:]
service_path.write_text(service, encoding="utf-8")

spec_path = ROOT / "apps/api/src/participants/participants.service.spec.ts"
spec_path.write_text(r'''/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import type { MeetingsService } from '../meetings/meetings.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MeetingsRealtimeGateway } from '../realtime/meetings-realtime.gateway';
import { ParticipantsService } from './participants.service';

const meeting = {
  id: 'meeting-1',
  organizerId: 'user-1',
  title: 'Planning',
  description: null,
  slug: 'a'.repeat(64),
  timezone: 'Africa/Tunis',
  startDate: new Date('2026-08-12T00:00:00.000Z'),
  endDate: new Date('2026-08-13T00:00:00.000Z'),
  workdayStart: '08:00',
  workdayEnd: '10:00',
  slotIntervalMinutes: 60,
  meetingDurationMinutes: 60,
  finalized: false,
  locked: false,
  finalSlotAt: null,
  finalSlotEnd: null,
  createdAt: new Date('2026-08-04T00:00:00.000Z'),
} satisfies Meeting;

const existingParticipant = {
  id: 'participant-1',
  meetingId: meeting.id,
  displayName: 'Alice',
  displayNameNormalized: 'alice',
  sessionTokenHash: null,
  organizerId: null,
  comment: 'Remote is fine',
  respondedAt: new Date('2026-08-04T01:00:00.000Z'),
  joinedAt: new Date('2026-08-04T00:00:00.000Z'),
  availabilities: [
    {
      id: 'availability-1',
      participantId: 'participant-1',
      datetimeStart: new Date('2026-08-12T07:00:00.000Z'),
      datetimeEnd: new Date('2026-08-12T08:00:00.000Z'),
    },
  ],
};

describe('ParticipantsService', () => {
  const transaction = {
    meeting: { findUnique: jest.fn() },
    participant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    participantSession: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
    participant: { findUnique: jest.fn() },
    participantSession: { findUnique: jest.fn(), create: jest.fn() },
  };
  const meetings = {
    closedReason: jest.fn(),
    findBySlug: jest.fn(),
  };
  const realtime = { participantJoined: jest.fn() };
  const service = new ParticipantsService(
    prisma as unknown as PrismaService,
    meetings as unknown as MeetingsService,
    realtime as unknown as MeetingsRealtimeGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.meeting.findUnique.mockResolvedValue(meeting);
    transaction.participant.findUnique.mockResolvedValue(null);
    transaction.participantSession.create.mockResolvedValue({});
    prisma.participantSession.findUnique.mockResolvedValue(null);
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.participantSession.create.mockResolvedValue({});
    meetings.closedReason.mockReturnValue(undefined);
    meetings.findBySlug.mockResolvedValue(meeting);
  });

  it('normalizes names and stores only a hash for a new device session', async () => {
    transaction.participant.create.mockImplementation(({ data }) =>
      Promise.resolve({
        ...existingParticipant,
        displayName: data.displayName,
        displayNameNormalized: data.displayNameNormalized,
        comment: null,
        availabilities: [],
      }),
    );

    const result = await service.join(meeting.slug, '  Alice   Dev  ');

    expect(result.participant.displayName).toBe('Alice Dev');
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.participant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        displayNameNormalized: 'alice dev',
      }),
      include: { availabilities: true },
    });
    expect(transaction.participantSession.create).toHaveBeenCalledWith({
      data: {
        participantId: 'participant-1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(
      transaction.participantSession.create.mock.calls[0][0].data.tokenHash,
    ).not.toBe(result.sessionToken);
    expect(realtime.participantJoined).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: 'meeting-1' }),
    );
  });

  it('reopens an existing participant case-insensitively with saved availability', async () => {
    transaction.participant.findUnique.mockResolvedValue(existingParticipant);

    const result = await service.join(meeting.slug, 'ALICE');

    expect(result.participant).toMatchObject({
      id: 'participant-1',
      displayName: 'Alice',
    });
    expect(result.availabilities).toEqual([
      {
        datetimeStart: '2026-08-12T07:00:00.000Z',
        datetimeEnd: '2026-08-12T08:00:00.000Z',
      },
    ]);
    expect(result.comment).toBe('Remote is fine');
    expect(transaction.participant.create).not.toHaveBeenCalled();
    expect(transaction.participantSession.create).toHaveBeenCalledWith({
      data: {
        participantId: 'participant-1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(realtime.participantJoined).not.toHaveBeenCalled();
  });

  it('issues independent session tokens so multiple devices stay signed in', async () => {
    transaction.participant.findUnique.mockResolvedValue(existingParticipant);

    const first = await service.join(meeting.slug, 'Alice');
    const second = await service.join(meeting.slug, 'alice');

    expect(first.sessionToken).not.toBe(second.sessionToken);
    expect(transaction.participantSession.create).toHaveBeenCalledTimes(2);
    expect(transaction.participant.create).not.toHaveBeenCalled();
  });

  it('uses Unicode compatibility normalization when reopening a name', async () => {
    transaction.participant.findUnique.mockResolvedValue(existingParticipant);

    const result = await service.join(meeting.slug, 'Ａlice');

    expect(result.participant.id).toBe('participant-1');
    expect(transaction.participant.findUnique).toHaveBeenCalledWith({
      where: {
        meetingId_displayNameNormalized: {
          meetingId: meeting.id,
          displayNameNormalized: 'alice',
        },
      },
      include: { availabilities: true },
    });
  });

  it('blocks joins when the meeting is locked or finalized', async () => {
    meetings.closedReason.mockReturnValue(
      'The organizer has paused responses.',
    );

    await expect(service.join(meeting.slug, 'Alice')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.participantSession.create).not.toHaveBeenCalled();
  });

  it('loads a participant through a device session token', async () => {
    prisma.participantSession.findUnique.mockResolvedValue({
      participant: { ...existingParticipant, meeting },
    });

    const result = await service.session(meeting.slug, 'device-token');

    expect(result.participant.id).toBe('participant-1');
    expect(result.availabilities).toHaveLength(1);
    expect(prisma.participant.findUnique).not.toHaveBeenCalled();
  });

  it('keeps legacy participant tokens valid during migration', async () => {
    prisma.participant.findUnique.mockResolvedValue({
      ...existingParticipant,
      meeting,
    });

    const result = await service.session(meeting.slug, 'legacy-token');

    expect(result.participant.id).toBe('participant-1');
  });

  it('rejects an invalid returning participant token', async () => {
    await expect(
      service.session(meeting.slug, 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
''', encoding="utf-8")

print("participant guidance feature patch applied")
