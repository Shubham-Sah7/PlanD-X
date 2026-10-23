import {
  STANDARD_5_DAY_CALENDAR,
  isWorkingDay,
  getNextWorkingDay,
  formatDateIso,
  parseIsoDate,
  type ProjectCalendar,
} from "../lib/programme-calendar";

export function shiftByWorkingDays(
  dateOrStr: Date | string,
  offsetDays: number,
  calendar: ProjectCalendar
): Date {
  let curr = typeof dateOrStr === "string" ? parseIsoDate(dateOrStr) : new Date(dateOrStr.getTime());

  if (offsetDays === 0) {
    return getNextWorkingDay(curr, calendar);
  }

  let daysRemaining = Math.abs(offsetDays);
  const step = offsetDays > 0 ? 1 : -1;
  let guard = 5000;

  while (daysRemaining > 0 && guard > 0) {
    curr.setDate(curr.getDate() + step);
    guard--;
    if (isWorkingDay(curr, calendar)) {
      daysRemaining--;
    }
  }

  return curr;
}

const cal = STANDARD_5_DAY_CALENDAR; // Mon-Fri
const fri = "2025-10-10"; // Friday

console.log("Friday 2025-10-10 base tests:");
console.log("+1 working day (should be Mon Oct 13):", formatDateIso(shiftByWorkingDays(fri, 1, cal)));
console.log("+2 working days (should be Tue Oct 14):", formatDateIso(shiftByWorkingDays(fri, 2, cal)));
console.log("+3 working days (should be Wed Oct 15):", formatDateIso(shiftByWorkingDays(fri, 3, cal)));
console.log("0 working days (should be Fri Oct 10):", formatDateIso(shiftByWorkingDays(fri, 0, cal)));
console.log("-1 working day (should be Thu Oct 09):", formatDateIso(shiftByWorkingDays(fri, -1, cal)));
console.log("-2 working days (should be Wed Oct 08):", formatDateIso(shiftByWorkingDays(fri, -2, cal)));
