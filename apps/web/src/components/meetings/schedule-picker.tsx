"use client";

import { CalendarRange, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface SchedulePickerProps {
  endDate: string;
  minDate?: string;
  onEndDateChange: (value: string) => void;
  onIntervalChange: (value: 30 | 60) => void;
  onStartDateChange: (value: string) => void;
  onWorkdayEndChange: (value: string) => void;
  onWorkdayStartChange: (value: string) => void;
  slotIntervalMinutes: 30 | 60;
  startDate: string;
  workdayEnd: string;
  workdayStart: string;
}

export function SchedulePicker({
  endDate,
  minDate,
  onEndDateChange,
  onIntervalChange,
  onStartDateChange,
  onWorkdayEndChange,
  onWorkdayStartChange,
  slotIntervalMinutes,
  startDate,
  workdayEnd,
  workdayStart,
}: SchedulePickerProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] shadow-lg">
      <div className="border-b border-white/10 px-5 py-5 sm:px-7">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Schedule window
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          Pick the days and hours visually
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose a start square, then an end square—just like booking a stay.
        </p>
      </div>

      <DateRangeCalendar
        endDate={endDate}
        minDate={minDate}
        onEndDateChange={onEndDateChange}
        onStartDateChange={onStartDateChange}
        startDate={startDate}
      />

      <TimeRangeGrid
        interval={slotIntervalMinutes}
        onEndChange={onWorkdayEndChange}
        onIntervalChange={(nextInterval) => {
          const start = floorToInterval(
            minutesFromLabel(workdayStart),
            nextInterval,
          );
          let end = ceilToInterval(minutesFromLabel(workdayEnd), nextInterval);
          if (end <= start) end = Math.min(1_440, start + nextInterval);
          onWorkdayStartChange(labelFromMinutes(start));
          onWorkdayEndChange(labelFromMinutes(end));
          onIntervalChange(nextInterval);
        }}
        onStartChange={onWorkdayStartChange}
        rangeEnd={workdayEnd}
        rangeStart={workdayStart}
      />
    </section>
  );
}

function DateRangeCalendar({
  endDate,
  minDate,
  onEndDateChange,
  onStartDateChange,
  startDate,
}: Pick<
  SchedulePickerProps,
  "endDate" | "minDate" | "onEndDateChange" | "onStartDateChange" | "startDate"
>) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    firstOfMonth(parseDate(startDate) ?? new Date()),
  );
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string>();
  const preview = useMemo(() => {
    if (!selectingEnd || !hoveredDate) {
      return { start: startDate, end: endDate };
    }
    return orderRange(startDate, hoveredDate);
  }, [endDate, hoveredDate, selectingEnd, startDate]);

  function selectDate(date: string) {
    if (minDate && date < minDate) return;
    if (!selectingEnd) {
      onStartDateChange(date);
      onEndDateChange("");
      setSelectingEnd(true);
      return;
    }

    const next = orderRange(startDate, date);
    onStartDateChange(next.start);
    onEndDateChange(next.end);
    setSelectingEnd(false);
    setHoveredDate(undefined);
  }

  const canGoBack = !minDate || dateKey(visibleMonth) > monthKey(minDate);

  return (
    <div className="border-b border-white/10 p-5 sm:p-7">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <CalendarRange className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Date range</p>
            <p className="text-xs text-muted-foreground">
              {selectingEnd
                ? "Now choose the last day"
                : "Choose the first day"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
          <RangeSummary
            label="Start"
            value={startDate}
            active={!selectingEnd}
          />
          <RangeSummary label="End" value={endDate} active={selectingEnd} />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Button
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronLeft />
        </Button>
        <p className="text-xs text-muted-foreground sm:hidden">
          Select two dates
        </p>
        <Button
          aria-label="Next month"
          onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {[visibleMonth, addMonths(visibleMonth, 1)].map((month) => (
          <Month
            key={dateKey(month)}
            minDate={minDate}
            month={month}
            onHover={setHoveredDate}
            onSelect={selectDate}
            rangeEnd={preview.end}
            rangeStart={preview.start}
          />
        ))}
      </div>
    </div>
  );
}

function Month({
  minDate,
  month,
  onHover,
  onSelect,
  rangeEnd,
  rangeStart,
}: {
  minDate?: string;
  month: Date;
  onHover: (date?: string) => void;
  onSelect: (date: string) => void;
  rangeEnd: string;
  rangeStart: string;
}) {
  const days = useMemo(() => monthDays(month), [month]);
  const reduceMotion = useReducedMotion();
  return (
    <div>
      <h3 className="mb-4 text-center text-sm font-semibold">
        {new Intl.DateTimeFormat("en", {
          month: "long",
          year: "numeric",
        }).format(month)}
      </h3>
      <div className="grid grid-cols-7 text-center text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((weekday) => (
          <span className="py-2" key={weekday}>
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map(({ date, outside }) => {
          const disabled = outside || Boolean(minDate && date < minDate);
          const endpoint = date === rangeStart || date === rangeEnd;
          const inside = Boolean(
            rangeStart && rangeEnd && date > rangeStart && date < rangeEnd,
          );
          return (
            <motion.button
              aria-label={new Intl.DateTimeFormat("en", {
                dateStyle: "full",
              }).format(parseDate(date)!)}
              aria-pressed={endpoint || inside}
              className={`relative h-11 text-sm outline-none transition duration-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary ${
                inside ? "bg-primary/14 text-foreground" : ""
              } ${date === rangeStart ? "rounded-l-xl" : ""} ${
                date === rangeEnd ? "rounded-r-xl" : ""
              } ${disabled ? "cursor-default text-white/20" : "hover:bg-white/[0.07]"}`}
              disabled={disabled}
              key={date}
              onClick={() => onSelect(date)}
              onMouseEnter={() => onHover(date)}
              onMouseLeave={() => onHover(undefined)}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.92 }}
            >
              <span
                className={`relative z-10 grid size-9 place-items-center rounded-xl transition duration-200 ${
                  endpoint
                    ? "bg-primary font-semibold text-primary-foreground shadow-glow"
                    : ""
                }`}
              >
                {Number(date.slice(-2))}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function TimeRangeGrid({
  interval,
  onEndChange,
  onIntervalChange,
  onStartChange,
  rangeEnd,
  rangeStart,
}: {
  interval: 30 | 60;
  onEndChange: (value: string) => void;
  onIntervalChange: (value: 30 | 60) => void;
  onStartChange: (value: string) => void;
  rangeEnd: string;
  rangeStart: string;
}) {
  const reduceMotion = useReducedMotion();
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoveredMinute, setHoveredMinute] = useState<number>();
  const slots = useMemo(
    () =>
      Array.from({ length: 1_440 / interval }, (_, index) => index * interval),
    [interval],
  );
  const savedStart = minutesFromLabel(rangeStart);
  const savedEnd = minutesFromLabel(rangeEnd);
  const preview =
    selectingEnd && hoveredMinute !== undefined
      ? orderMinuteRange(savedStart, hoveredMinute, interval)
      : { start: savedStart, end: savedEnd };

  function selectTime(minute: number) {
    if (!selectingEnd) {
      onStartChange(labelFromMinutes(minute));
      onEndChange(labelFromMinutes(minute + interval));
      setSelectingEnd(true);
      return;
    }

    const next = orderMinuteRange(savedStart, minute, interval);
    onStartChange(labelFromMinutes(next.start));
    onEndChange(labelFromMinutes(next.end));
    setSelectingEnd(false);
    setHoveredMinute(undefined);
  }

  return (
    <div className="p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Clock3 className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Daily working hours</p>
            <p className="text-xs text-muted-foreground">
              {selectingEnd
                ? "Choose the last time square"
                : "Choose the first time square"}
            </p>
          </div>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/10 p-1">
          {([30, 60] as const).map((value) => (
            <motion.button
              aria-pressed={interval === value}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition duration-200 ${
                interval === value
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              key={value}
              onClick={() => onIntervalChange(value)}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            >
              {value} min
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-foreground">
          {rangeStart}
        </span>
        <span className="text-muted-foreground">to</span>
        <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-foreground">
          {rangeEnd}
        </span>
        <span className="text-xs text-muted-foreground">
          · {formatDuration(savedEnd - savedStart)} each selected day
        </span>
      </div>

      <div
        className="mt-5 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8"
        onMouseLeave={() => setHoveredMinute(undefined)}
      >
        {slots.map((minute) => {
          const active = minute >= preview.start && minute < preview.end;
          const endpoint =
            minute === preview.start || minute + interval === preview.end;
          return (
            <motion.button
              aria-label={`Select ${labelFromMinutes(minute)}`}
              aria-pressed={active}
              className={`min-h-11 rounded-xl border px-1 py-2 text-xs tabular-nums outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-primary ${
                endpoint
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : active
                    ? "border-primary/30 bg-primary/15 text-foreground"
                    : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
              }`}
              key={minute}
              onClick={() => selectTime(minute)}
              onMouseEnter={() => setHoveredMinute(minute)}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            >
              {labelFromMinutes(minute)}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function RangeSummary({
  active,
  label,
  value,
}: {
  active: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`min-w-32 px-4 py-2.5 first:border-r first:border-white/10 ${active ? "bg-primary/10" : ""}`}
    >
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-medium">
        {value ? formatShortDate(value) : "Select date"}
      </p>
    </div>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthDays(month: Date) {
  const first = firstOfMonth(month);
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 42 }, () => {
    const result = {
      date: dateKey(cursor),
      outside: cursor.getMonth() !== month.getMonth(),
    };
    cursor.setDate(cursor.getDate() + 1);
    return result;
  });
}

function firstOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1, 12);
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function monthKey(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function orderRange(first: string, second: string) {
  return first <= second
    ? { start: first, end: second }
    : { start: second, end: first };
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDate(value));
}

function minutesFromLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function labelFromMinutes(value: number) {
  if (value === 1_440) return "24:00";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function orderMinuteRange(first: number, second: number, interval: number) {
  return first <= second
    ? { start: first, end: Math.min(1_440, second + interval) }
    : { start: second, end: Math.min(1_440, first + interval) };
}

function floorToInterval(value: number, interval: number) {
  return Math.floor(value / interval) * interval;
}

function ceilToInterval(value: number, interval: number) {
  return Math.min(1_440, Math.ceil(value / interval) * interval);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
