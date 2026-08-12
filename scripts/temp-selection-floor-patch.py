from pathlib import Path

p = Path("apps/web/src/components/meetings/interactive-availability-heatmap.tsx")
s = p.read_text(encoding="utf-8")

old_participant = '''                <span
                  className={`rounded-full border px-3 py-1.5 text-xs transition duration-150 ${
                    highlighted
                      ? "border-emerald-300/80 bg-emerald-400/15 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.28)]"
                      : "border-white/10 bg-white/[0.025] text-muted-foreground"
                  }`}
                  data-highlighted={highlighted ? "true" : "false"}
                  data-participant-id={participant.id}
                  key={participant.id}
                >'''
new_participant = '''                <span
                  className={`relative overflow-hidden rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 ${
                    highlighted
                      ? "border-emerald-600 bg-emerald-950/35 text-emerald-100"
                      : "border-white/10 bg-white/[0.025] text-muted-foreground"
                  }`}
                  data-highlighted={highlighted ? "true" : "false"}
                  data-participant-id={participant.id}
                  key={participant.id}
                  style={{ borderRadius: "9999px" }}
                >'''
if old_participant not in s:
    raise SystemExit("participant pill anchor not found")
s = s.replace(old_participant, new_participant, 1)

run_block = '''              let selectedRunLength = 0;
              if (active && !selectedLeft) {
                for (let runIndex = quarterIndex; runIndex < 4; runIndex += 1) {
                  const runQuarter = runIndex * 15;
                  const runTime = `${hour.slice(0, 3)}${String(runQuarter).padStart(2, "0")}`;
                  const runCell = cellByGridPosition.get(`${date.date}:${runTime}`);
                  if (!runCell || !selected.has(runCell.datetimeStart)) break;
                  selectedRunLength += 1;
                }
              }
'''
if run_block not in s:
    raise SystemExit("selected run block not found")
s = s.replace(run_block, "", 1)

old_style = '''              const quarterFill = ((quarterIndex + 1) / 4) * 100;
              const heatStyle = heatmapColor(cell.percentage);
              const style = {
                ...heatStyle,
                "--synk-quarter-fill": `${quarterFill}%`,
                "--synk-heatmap-bg": heatStyle.backgroundColor,
              } as CSSProperties & {
                "--synk-quarter-fill": string;
                "--synk-heatmap-bg": CSSProperties["backgroundColor"];
              };'''
new_style = '''              const heatStyle = heatmapColor(cell.percentage);
              const style = {
                ...heatStyle,
                "--synk-heatmap-bg": heatStyle.backgroundColor,
              } as CSSProperties & {
                "--synk-heatmap-bg": CSSProperties["backgroundColor"];
              };'''
if old_style not in s:
    raise SystemExit("quarter style anchor not found")
s = s.replace(old_style, new_style, 1)

s = s.replace(
    '''                  data-boundary-left={active && !selectedLeft ? "true" : "false"}
                  data-boundary-right={active && !selectedRight ? "true" : "false"}
''',
    "",
    1,
)

old_circle = '''                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-1 top-1 size-2.5 rounded-full border border-current/55 opacity-70"
                    style={{
                      background: `conic-gradient(from -90deg, currentColor 0 ${quarterFill}%, transparent ${quarterFill}% 100%)`,
                    }}
                  />
'''
if old_circle not in s:
    raise SystemExit("quarter circle anchor not found")
s = s.replace(old_circle, "", 1)

old_boundary_render = '''                  {selectedRunLength > 0 && (
                    <FusedSelectionBoundary spanCount={selectedRunLength} />
                  )}'''
new_boundary_render = '''                  {active && (
                    <SelectedTileFloor
                      joinLeft={selectedLeft}
                      joinRight={selectedRight}
                    />
                  )}'''
if old_boundary_render not in s:
    raise SystemExit("selection boundary render anchor not found")
s = s.replace(old_boundary_render, new_boundary_render, 1)

start = s.index("function FusedSelectionBoundary(")
end = s.index("function DaySwipeNavigator(", start)
floor_component = '''function SelectedTileFloor({
  joinLeft,
  joinRight,
}: {
  joinLeft: boolean;
  joinRight: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      data-selection-floor="true"
      style={{
        position: "absolute",
        pointerEvents: "none",
        zIndex: 20,
        left: joinLeft ? 0 : 4,
        right: joinRight ? 0 : 4,
        bottom: 3,
        height: 5,
        backgroundColor: "rgb(21 128 61)",
        borderTopLeftRadius: joinLeft ? 0 : "999px",
        borderBottomLeftRadius: joinLeft ? 0 : "999px",
        borderTopRightRadius: joinRight ? 0 : "999px",
        borderBottomRightRadius: joinRight ? 0 : "999px",
        boxShadow: "none",
      }}
    />
  );
}

'''
s = s[:start] + floor_component + s[end:]

p.write_text(s, encoding="utf-8")
