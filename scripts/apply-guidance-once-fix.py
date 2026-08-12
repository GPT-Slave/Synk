from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"anchor missing in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_after(path: str, marker: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"marker missing in {path}: {marker!r}")
    tail = text[start:]
    if old not in tail:
        raise RuntimeError(f"scoped anchor missing in {path} after {marker!r}: {old[:100]!r}")
    target.write_text(text[:start] + tail.replace(old, new, 1), encoding="utf-8")


availability = "apps/web/src/components/meetings/availability-grid.tsx"
replace_once(
    availability,
    '  onInspectParticipants?: (participantIds: string[]) => void;\n}',
    '  onInspectParticipants?: (participantIds: string[]) => void;\n  showGuidanceOnMount?: boolean;\n}',
)
replace_once(
    availability,
    '  onInspectParticipants,\n}: AvailabilityGridProps) {',
    '  onInspectParticipants,\n  showGuidanceOnMount = mode === "participant",\n}: AvailabilityGridProps) {',
)
replace_once(
    availability,
    '  const [showGuidance, setShowGuidance] = useState(mode === "participant");',
    '  const [showGuidance, setShowGuidance] = useState(showGuidanceOnMount);',
)

page = "apps/web/src/app/meets/[token]/page.tsx"
replace_once(
    page,
    '  const [confirmedSession, setConfirmedSession] = useState<{\n    meetingToken: string;\n    sessionToken: string;\n  }>();',
    '  const [confirmedSession, setConfirmedSession] = useState<{\n    meetingToken: string;\n    sessionToken: string;\n  }>();\n  const [guidanceSessionToken, setGuidanceSessionToken] = useState<string>();',
)
replace_after(
    page,
    "  function activateStoredSession()",
    '    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n',
    '    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    setGuidanceSessionToken(undefined);\n',
)
replace_after(
    page,
    "  function chooseAnotherParticipant()",
    '    setEphemeralSession(undefined);\n    setConfirmedSession(undefined);\n    notifyParticipantStorage();',
    '    setEphemeralSession(undefined);\n    setConfirmedSession(undefined);\n    setGuidanceSessionToken(undefined);\n    notifyParticipantStorage();',
)
replace_after(
    page,
    "  async function joined(data: ParticipantJoinResponseDto)",
    '    setEphemeralSession({ meetingToken: token, sessionToken: nextToken });\n    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    notifyParticipantStorage();',
    '    setEphemeralSession({ meetingToken: token, sessionToken: nextToken });\n    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    setGuidanceSessionToken(nextToken);\n    notifyParticipantStorage();\n    void queryClient.invalidateQueries({\n      queryKey: ["public-meeting", token],\n      exact: true,\n    });',
)
replace_once(
    page,
    '              sessionToken={sessionToken}\n              token={token}\n            />',
    '              sessionToken={sessionToken}\n              showGuidanceOnMount={guidanceSessionToken === sessionToken}\n              token={token}\n            />',
)

print("participant guidance now appears only after a fresh name entry/join")
