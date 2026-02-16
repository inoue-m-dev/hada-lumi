// src/components/calendar/CalendarGrid.tsx
import CalendarCell from "./CalendarCell";
import { formatYmdLocal } from "@/lib/date";

type SortCategory = "none" | "sleep" | "stress" | "skincare";
type SortDirection = "good" | "bad";
type SortState =
  | { category: "none"; direction: null }
  | { category: Exclude<SortCategory, "none">; direction: SortDirection };

type DailySummary = {
  sleepQuality: number;
  stressLevel: number;
  skinCondition: number;
  skincareEffort: number;
  memo?: string;
  prefecture?: string;
};

interface Props {
  days: { date: Date; inCurrentMonth: boolean }[];
  selectedDate: Date | null;
  recordsByDate: Record<string, DailySummary>;
  menstruationByDate: Record<string, boolean>;
  sortState: SortState;
  onSelectDate: (date: Date) => void;
}

function isSameDay(a: Date, b: Date | null) {
  if (!b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarGrid({
  days,
  selectedDate,
  recordsByDate,
  menstruationByDate,
  sortState,
  onSelectDate,
}: Props) {
  const today = new Date();

  return (
    <div className="grid grid-cols-7 grid-rows-6 gap-1 text-xs h-full">
      {days.map(({ date, inCurrentMonth }, idx) => {
        const key = formatYmdLocal(date);
        return (
          <CalendarCell
            key={`${key}-${idx}`}
            date={date}
            inCurrentMonth={inCurrentMonth}
            isToday={isSameDay(date, today)}
            isSelected={isSameDay(date, selectedDate)}
            summary={recordsByDate[key]}
            hasMenstruation={!!menstruationByDate[key]}
            sortState={sortState}
            onSelectDate={onSelectDate}
          />
        );
      })}
    </div>
  );
}
