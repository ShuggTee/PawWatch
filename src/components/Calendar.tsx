import { useState, useEffect, useCallback } from "react";
import { getSitterAvailability } from "../data/api";

interface CalendarProps {
  sitterId: string;
  selectedDate: string | null; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function Calendar({
  sitterId,
  selectedDate,
  onSelectDate,
}: CalendarProps) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loadingAvail, setLoadingAvail] = useState(false);

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;

  // Fetch availability whenever month changes
  useEffect(() => {
    let cancelled = false;
    setLoadingAvail(true);
    getSitterAvailability(sitterId, monthKey)
      .then((dates) => {
        if (!cancelled) {
          setBookedDates(new Set(dates));
          setLoadingAvail(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookedDates(new Set());
          setLoadingAvail(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sitterId, monthKey]);

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  // Compute calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const isPastDate = (day: number): boolean => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr < todayStr;
  };

  const dateToStr = (day: number): string =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const isToday = (day: number): boolean =>
    dateToStr(day) === todayStr;

  const isSelected = (day: number): boolean =>
    dateToStr(day) === selectedDate;

  const isBooked = (day: number): boolean =>
    bookedDates.has(dateToStr(day));

  // Build grid cells
  const cells: (number | null)[] = [];
  // Empty cells for days before first of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
      {/* Month header with nav arrows */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-100 active:bg-amber-200"
          aria-label="Previous month"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-base font-bold text-gray-800">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        <button
          type="button"
          onClick={goToNextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-100 active:bg-amber-200"
          aria-label="Next month"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Loading indicator */}
      {loadingAvail && (
        <div className="mb-2 text-center">
          <span className="inline-block h-1 w-16 animate-pulse rounded-full bg-amber-200" />
        </div>
      )}

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAYS_OF_WEEK.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-amber-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const past = isPastDate(day);
          const today_ = isToday(day);
          const selected = isSelected(day);
          const booked = isBooked(day);

          return (
            <button
              key={day}
              type="button"
              disabled={past}
              onClick={() => onSelectDate(dateToStr(day))}
              className={`
                relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium
                transition-all active:scale-90
                ${past
                  ? "cursor-default text-gray-300"
                  : "cursor-pointer text-gray-700 hover:bg-amber-50 active:bg-amber-100"
                }
                ${selected
                  ? "bg-amber-500 text-white shadow-md hover:bg-amber-600 active:bg-amber-600"
                  : ""
                }
                ${today_ && !selected
                  ? "font-bold text-amber-600 ring-2 ring-amber-400 ring-inset"
                  : ""
                }
              `}
              aria-label={`${MONTH_NAMES[viewMonth]} ${day}, ${viewYear}${past ? " (past)" : ""}${booked ? " (booked)" : ""}`}
            >
              {day}
              {/* Busy dot */}
              {booked && !past && (
                <span
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                    selected ? "bg-white" : "bg-amber-400"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
