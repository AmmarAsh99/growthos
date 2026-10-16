export type LedgerKind = 'expense' | 'transfer' | 'income';
export type AllocationKind = 'expense' | 'savings' | 'emergency';
export interface FinanceCategory {
  id: string;
  name: string;
}
export interface Allocation {
  key: string;
  name: string;
  kind: AllocationKind;
  discretionary: boolean;
  amountHalalas: number;
  id?: string;
}
export interface CategoryRule {
  categoryId: string;
  envelopeKey: string;
  limitHalalas: number;
}
export interface BudgetPlan {
  month: string;
  salaryHalalas: number;
  warningPercent: number;
  envelopes: Allocation[];
  categoryRules: CategoryRule[];
}
export interface LedgerEntry {
  id: string;
  date: string;
  time: string | null;
  kind: LedgerKind;
  amountHalalas: number;
  description: string;
  notes: string | null;
  merchant: string | null;
  frequency: string | null;
  categoryId: string | null;
  envelopeId: string | null;
  category?: FinanceCategory | null;
  envelope?: Allocation | null;
}
export interface TransactionPage {
  items: LedgerEntry[];
  total: number;
  page: number;
  totalPages: number;
  totalSpentHalalas: number;
  totalIncomeHalalas: number;
  totalTransferredHalalas: number;
}
export interface EnvelopeResult extends Allocation {
  actualHalalas: number;
  remainingHalalas: number;
  usagePercent: number;
  projectedHalalas: number | null;
  projectedRemainingHalalas: number | null;
  exhaustionDate: string | null;
  status: 'On Track' | 'Warning' | 'Critical';
  message: string;
}
export interface FinanceSummary {
  month: string;
  today: string;
  elapsedDays: number;
  daysInMonth: number;
  loggedDays: number;
  confidence: string;
  closed: boolean;
  salaryHalalas: number;
  spentHalalas: number;
  incomeHalalas: number;
  todaySpentHalalas: number;
  discretionaryRemainingHalalas: number;
  expenseBudgetHalalas: number;
  usagePercent: number;
  plannedSavingsHalalas: number;
  actualSavingsHalalas: number;
  emergencyHalalas: number;
  plannedEmergencyHalalas: number;
  netCashFlowHalalas: number;
  availableCashHalalas: number;
  projectedBalanceHalalas: number | null;
  status: 'On Track' | 'Warning' | 'Over Budget';
  envelopes: EnvelopeResult[];
  daily: {
    date: string;
    spentHalalas: number;
    cumulativeHalalas: number;
    projectedCumulativeHalalas: number | null;
  }[];
  filteredDaily?: { date: string; spentHalalas: number }[];
  categories: {
    id: string;
    name: string;
    amountHalalas: number;
    limitHalalas: number;
    status: string;
  }[];
  yearly: { month: string; expenses: number; income: number; savings: number }[];
  yearlyTotals: { expenses: number; income: number; savings: number };
  period: {
    from: string;
    to: string;
    spentHalalas: number;
    incomeHalalas: number;
    transferredHalalas: number;
  };
  report: {
    assessment: string;
    observations: string[];
    previousSpentHalalas: number;
    changeHalalas: number;
    largestExpense: { description: string; amountHalalas: number } | null;
    highestCategory: string | null;
  };
}
