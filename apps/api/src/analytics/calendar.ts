export type Period = 'day' | 'week' | 'month' | 'year';
export const iso = (date: Date) => date.toISOString().slice(0, 10);
export const today = (timezone: string, now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
export const addDays = (day: string, n: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return iso(date);
};
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
export function startOf(day: string, period: Period) {
  const date = new Date(`${day}T00:00:00Z`);
  if (period === 'week') return addDays(day, -((date.getUTCDay() + 6) % 7));
  if (period === 'month') return `${day.slice(0, 7)}-01`;
  if (period === 'year') return `${day.slice(0, 4)}-01-01`;
  return day;
}
export function shiftStart(day: string, period: Period, n: number) {
  const date = new Date(`${startOf(day, period)}T00:00:00Z`);
  if (period === 'day' || period === 'week')
    return addDays(iso(date), n * (period === 'week' ? 7 : 1));
  if (period === 'month') date.setUTCMonth(date.getUTCMonth() + n);
  else date.setUTCFullYear(date.getUTCFullYear() + n);
  return iso(date);
}
export const endOf = (day: string, period: Period) => addDays(shiftStart(day, period, 1), -1);
export function progress(
  actualMinutes: number,
  dailyGoal: number,
  from: string,
  to: string,
  asOf: string,
  elapsedMinutes = actualMinutes,
) {
  const goalMinutes = dailyGoal * daysBetween(from, to);
  const elapsedDays = Math.max(1, daysBetween(from, asOf < to ? asOf : to));
  return {
    actualMinutes,
    goalMinutes,
    goalProgressPct: 100 * Math.min(actualMinutes / goalMinutes, 1),
    pacePct: 100 * Math.min(elapsedMinutes / (dailyGoal * elapsedDays), 1),
    active: actualMinutes > 0,
  };
}
export const changePct = (current: number, previous: number) =>
  previous === 0 ? null : ((current - previous) / previous) * 100;
export function streak(days: Iterable<string>, asOf: string) {
  const set = new Set(days);
  let cursor = set.has(asOf) ? asOf : addDays(asOf, -1);
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}
export function comparisonWindow(asOf: string, period: Period) {
  const from = shiftStart(asOf, period, -1);
  const previousEnd = endOf(from, period);
  const elapsedEnd = addDays(from, daysBetween(startOf(asOf, period), asOf) - 1);
  return { from, to: elapsedEnd < previousEnd ? elapsedEnd : previousEnd };
}
