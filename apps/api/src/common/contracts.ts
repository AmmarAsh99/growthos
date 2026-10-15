export interface Settings {
  dailyGoalMinutes: number;
  timezone: string;
  weekStart: number;
}
export interface User {
  id: string;
  email: string;
  displayName: string;
  settings: Settings;
}
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isArchived: boolean;
}
export interface Activity {
  id: string;
  activityDate: string;
  title: string;
  description: string | null;
  categoryId: string;
  durationMinutes: number;
  category: Category;
}
export interface ActivityPage {
  items: Activity[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalMinutes: number;
}
export interface Bucket {
  date: string;
  minutes: number;
  count: number;
}
export interface Goal {
  actualMinutes: number;
  goalMinutes: number;
  goalProgressPct: number;
  pacePct: number;
  active: boolean;
}
export interface Overview {
  asOfDate: string;
  timezone: string;
  dailyGoalMinutes: number;
  today: Goal;
  week: Goal;
  month: Goal;
  year: Goal;
  currentActivityStreakDays: number;
  monthActiveDays: number;
  monthActivityCount: number;
  monthTotalMinutes: number;
  timeChangeVsPreviousComparableMonthPct: number | null;
  selectedPeriod: {
    period: string;
    totalMinutes: number;
    activeDays: number;
    activityCount: number;
    changePct: number | null;
    comparisonWindow: { from: string; to: string };
  };
}
export interface Breakdown {
  category: Category;
  minutes: number;
  percentage: number;
}
export interface Envelope<T> {
  success: boolean;
  data: T;
  meta: { requestId: string; timestamp: string };
}
