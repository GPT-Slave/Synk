from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"anchor missing in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "apps/web/src/components/meetings/availability-grid.tsx",
    '  onInspectParticipants?: (participantIds: string[]) => void;\n}',
    '  onInspectParticipants?: (participantIds: string[]) => void;\n  showGuidanceOnMount?: boolean;\n}',
)
replace_once(
    "apps/web/src/components/meetings/availability-grid.tsx",
    '  onInspectParticipants,\n}: AvailabilityGridProps) {',
    '  onInspectParticipants,\n  showGuidanceOnMount = mode === "participant",\n}: AvailabilityGridProps) {',
)
replace_once(
    "apps/web/src/components/meetings/availability-grid.tsx",
    '  const [showGuidance, setShowGuidance] = useState(mode === "participant");',
    '  const [showGuidance, setShowGuidance] = useState(showGuidanceOnMount);',
)

replace_once(
    "apps/web/src/app/meets/[token]/page.tsx",
    '  const [confirmedSession, setConfirmedSession] = useState<{\n    meetingToken: string;\n    sessionToken: string;\n  }>();',
    '  const [confirmedSession, setConfirmedSession] = useState<{\n    meetingToken: string;\n    sessionToken: string;\n  }>();\n  const [guidanceSessionToken, setGuidanceSessionToken] = useState<string>();',
)
replace_once(
    "apps/web/src/app/meets/[token]/page.tsx",
    '    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    notifyParticipantStorage();\n  }\n\n  function chooseAnotherParticipant()',
    '    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    setGuidanceSessionToken(undefined);\n    notifyParticipantStorage();\n  }\n\n  function chooseAnotherParticipant()',
)
replace_once(
    "apps/web/src/app/meets/[token]/page.tsx",
    '    setEphemeralSession(undefined);\n    setConfirmedSession(undefined);\n    notifyParticipantStorage();',
    '    setEphemeralSession(undefined);\n    setConfirmedSession(undefined);\n    setGuidanceSessionToken(undefined);\n    notifyParticipantStorage();',
)
replace_once(
    "apps/web/src/app/meets/[token]/page.tsx",
    '    setEphemeralSession({ meetingToken: token, sessionToken: nextToken });\n    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    notifyParticipantStorage();\n  }\n\n  return (',
    '    setEphemeralSession({ meetingToken: token, sessionToken: nextToken });\n    setConfirmedSession({ meetingToken: token, sessionToken: nextToken });\n    setGuidanceSessionToken(nextToken);\n    notifyParticipantStorage();\n  }\n\n  return (',
)
replace_once(
    "apps/web/src/app/meets/[token]/page.tsx",
    '              sessionToken={sessionToken}\n              token={token}\n            />',
    '              sessionToken={sessionToken}\n              showGuidanceOnMount={guidanceSessionToken === sessionToken}\n              token={token}\n            />',
)

print("participant guidance now appears only after a fresh name entry/join")
