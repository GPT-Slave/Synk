from pathlib import Path

path = Path("apps/web/src/components/meetings/interactive-availability-heatmap.tsx")
text = path.read_text(encoding="utf-8")

old_legend = '''        <div
          aria-label={t("Heatmap legend")}
          className="flex items-center gap-2"
        >
          <span className="text-[0.65rem] text-muted-foreground">0%</span>
          <span className="heatmap-gradient h-2.5 w-24 rounded-full border border-white/10 sm:w-28" />
          <span className="text-[0.65rem] text-muted-foreground">100%</span>
        </div>'''
new_legend = '''        <div
          aria-label={t("Heatmap legend")}
          className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] text-muted-foreground">0%</span>
            <span className="heatmap-gradient h-2.5 w-24 rounded-full border border-white/10 sm:w-28" />
            <span className="text-[0.65rem] text-muted-foreground">100%</span>
          </div>
          {!manualMeetingMode && (
            <div className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
              <span
                aria-hidden="true"
                className="relative h-3.5 w-6 overflow-hidden rounded-md border border-white/10 bg-sky-500/45"
              >
                <span className="absolute inset-x-0 bottom-0 h-1 bg-[#39ff14]" />
              </span>
              <span>{t("Your availability")}</span>
            </div>
          )}
        </div>'''
if text.count(old_legend) != 1:
    raise SystemExit(f"legend target count: {text.count(old_legend)}")
text = text.replace(old_legend, new_legend)

old_class = '''                  className={`relative grid min-h-12 place-items-center text-[0.58rem] font-semibold tabular-nums outline-none transition-transform duration-150 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-primary ${'''
new_class = '''                  className={`relative grid min-h-12 place-items-center overflow-hidden text-[0.58rem] font-semibold tabular-nums outline-none transition-transform duration-150 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-primary ${'''
if text.count(old_class) != 1:
    raise SystemExit(f"button class target count: {text.count(old_class)}")
text = text.replace(old_class, new_class)

old_attrs = '''                  data-heatmap-cell="true"
                  data-selected={active ? "true" : "false"}
                  data-slot-start={cell.datetimeStart}'''
new_attrs = '''                  data-available-count={cell.availableCount}
                  data-heatmap-cell="true"
                  data-selected={active ? "true" : "false"}
                  data-slot-start={cell.datetimeStart}
                  data-total-participants={cell.totalParticipants}'''
if text.count(old_attrs) != 1:
    raise SystemExit(f"data attribute target count: {text.count(old_attrs)}")
text = text.replace(old_attrs, new_attrs)

old_count = '''                  <span className="relative z-10">
                    {cell.availableCount}/{cell.totalParticipants}
                  </span>'''
new_count = '''                  <span className="relative z-10">{cell.availableCount}</span>'''
if text.count(old_count) != 1:
    raise SystemExit(f"visible count target count: {text.count(old_count)}")
text = text.replace(old_count, new_count)

path.write_text(text, encoding="utf-8")
print("heatmap UI patch applied")
