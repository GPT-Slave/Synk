from pathlib import Path

path = Path(__file__).resolve().parents[1] / "apps/web/src/components/meetings/interactive-availability-heatmap.tsx"
text = path.read_text(encoding="utf-8")
text = text.replace("const DAY_SWIPE_THRESHOLD = 42;\n", "")
start = text.find("function DaySwipeNavigator({")
end = text.find("function optimisticHeatmap(", start)
if start < 0 or end < 0:
    raise RuntimeError("DaySwipeNavigator block not found")

replacement = r'''function DaySwipeNavigator({
  activeIndex,
  dates,
  formatDate,
  onChange,
  t,
}: {
  activeIndex: number;
  dates: PublicMeetingDto["dates"];
  formatDate: (
    value: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  onChange: (index: number) => void;
  t: (message: string, variables?: Record<string, string | number>) => string;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const reportedIndex = useRef(activeIndex);

  function goTo(index: number) {
    const nextIndex = Math.max(0, Math.min(dates.length - 1, index));
    reportedIndex.current = nextIndex;
    onChange(nextIndex);
    const node = scroller.current;
    if (node) {
      node.scrollTo({
        left: nextIndex * node.clientWidth,
        behavior: "smooth",
      });
    }
  }

  function reportScroll() {
    const node = scroller.current;
    if (!node || node.clientWidth === 0) return;
    const nextIndex = Math.max(
      0,
      Math.min(dates.length - 1, Math.round(node.scrollLeft / node.clientWidth)),
    );
    if (nextIndex === reportedIndex.current) return;
    reportedIndex.current = nextIndex;
    onChange(nextIndex);
  }

  return (
    <div
      aria-label={t("Swipe between days")}
      className="mt-3 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.055] p-2 sm:hidden"
      data-day-swipe="true"
    >
      <button
        aria-label={t("Previous day")}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-primary transition disabled:opacity-25"
        disabled={activeIndex === 0}
        onClick={() => goTo(activeIndex - 1)}
        type="button"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory touch-pan-x rounded-xl border border-white/10 bg-black/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-day-swipe-track="true"
        onScroll={reportScroll}
        ref={scroller}
      >
        <div className="flex min-h-12 w-full">
          {dates.map((date, index) => (
            <div
              className="flex w-full shrink-0 snap-center snap-always select-none items-center justify-center gap-3 px-3 text-center"
              data-day-swipe-page={index}
              key={date.date}
            >
              <MoveHorizontal className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {formatDate(date.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <div className="mt-1 flex justify-center gap-1">
                  {dates.map((indicatorDate, indicatorIndex) => (
                    <span
                      aria-hidden="true"
                      className={`h-1 rounded-full transition-all ${
                        indicatorIndex === activeIndex
                          ? "w-4 bg-primary"
                          : "w-1 bg-white/20"
                      }`}
                      key={indicatorDate.date}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        aria-label={t("Next day")}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-primary transition disabled:opacity-25"
        disabled={activeIndex === dates.length - 1}
        onClick={() => goTo(activeIndex + 1)}
        type="button"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}

'''

path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")
print("dedicated mobile day navigator now uses native horizontal scroll snap")
