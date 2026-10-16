import { TranslatePipe } from '../core/language';
import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ChartData } from 'chart.js';
import { Api, errorMessage } from '../core/api';
import { GrowthChart } from '../shared/chart';
import { SarPipe, money, parseMoney } from '../shared/money';
import { localDate } from '../shared/format';
import type { FinanceCategory, FinanceSummary } from '../../../../api/src/common/finance-contracts';
@Component({
  imports: [TranslatePipe, FormsModule, RouterLink, DecimalPipe, SarPipe, GrowthChart],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">{{ 'YOUR MONEY, WITH INTENTION' | t }}</div>
        <h1>{{ (reportMode ? 'Monthly reports' : 'Financial overview') | t }}</h1>
        <p>{{ 'A clear view of your spending, savings and what comes next.' | t }}</p>
      </div>
      <a routerLink="/finance/new" class="button primary">{{ '＋ Add transaction' | t }}</a>
    </div>
    <div class="filterbar">
      <label
        >{{ 'Month' | t
        }}<input
          type="month"
          min="2000-01"
          max="2099-12"
          [(ngModel)]="month"
          (change)="date = month + '-01'; load()" /></label
      ><span class="muted">{{ 'SAR · Asia/Riyadh · Actual records only' | t }}</span
      ><a routerLink="/finance/budgets" class="button secondary">{{ 'Manage budgets ↗' | t }}</a>
    </div>
    @if (error()) {
      <p role="alert" class="error">
        {{ error() }} <button (click)="load()">{{ 'Retry' | t }}</button>
      </p>
    }
    @if (loading()) {
      <div class="metrics">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="card skeleton" role="status">{{ 'Loading finances…' | t }}</div>
        }
      </div>
    } @else if (data(); as d) {
      @if (!reportMode) {
        <div class="finance-hero card">
          <div>
            <span class="eyebrow">{{ 'ROOM TO SPEND' | t }}</span>
            <h2>{{ d.discretionaryRemainingHalalas | sar }}</h2>
            <p>{{ 'Remaining across discretionary envelopes' | t }}</p>
          </div>
          <div>
            <span class="status" [class.warning]="d.status !== 'On Track'">{{ d.status | t }}</span>
            <p>{{ d.elapsedDays }} / {{ d.daysInMonth }} calendar days elapsed</p>
          </div>
        </div>
        <div class="metrics finance-metrics">
          @for (card of cards(); track card.label) {
            <article class="card metric">
              <span class="metric-label">{{ card.label | t }}</span>
              <div class="finance-value">{{ card.value }}</div>
              <small>{{ card.note | t }}</small>
            </article>
          }
        </div>
        <p class="info-note">
          {{ d.confidence }} {{ d.loggedDays }} dates with entries; zero-entry days are included in
          the pace calculation.
        </p>
        <div class="finance-grid">
          <section class="card">
            <div class="section-heading">
              <div>
                <h2>{{ 'Daily spending' | t }}</h2>
                <p>{{ 'Consumption expenses · selected month' | t }}</p>
              </div>
              <select aria-label="Daily chart category" [(ngModel)]="categoryId" (change)="load()">
                <option value="">{{ 'All categories' | t }}</option>
                @for (c of categories(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <growth-chart
              [data]="dailyChart()"
              unit="SAR"
              [summary]="'Daily spending for ' + month"
            />
          </section>
          <section class="card">
            <h2>{{ 'Where your money goes' | t }}</h2>
            @if (d.spentHalalas) {
              <growth-chart
                [data]="categoryChart()"
                type="doughnut"
                unit="SAR"
                summary="Monthly expenses by category"
              />
            } @else {
              <div class="empty">
                <h3>{{ 'No expenses yet' | t }}</h3>
                <p>{{ 'Record an expense to see your breakdown.' | t }}</p>
                <a routerLink="/finance/new">{{ 'Add your first expense →' | t }}</a>
              </div>
            }
            <div class="legend">
              @for (c of d.categories; track c.id) {
                @if (c.amountHalalas) {
                  <div>
                    <span>{{ c.name }}</span
                    ><strong>{{ c.amountHalalas | sar }}</strong>
                  </div>
                }
              }
            </div>
          </section>
          <section class="card">
            <h2>{{ 'Spending pace' | t }}</h2>
            <p class="muted">
              {{ 'Actual cumulative expenses, estimated pace and consumption budget.' | t }}
            </p>
            <growth-chart
              [data]="projectionChart()"
              type="line"
              unit="SAR"
              summary="Actual versus estimated cumulative spending and expense budget"
            />
            <p class="chart-caption">
              {{
                'Estimate = month-to-date expenses ÷ elapsed calendar days × month length. Dashed lines are estimates. Category filter applies only to the daily chart.'
                  | t
              }}
            </p>
          </section>
          <section class="card">
            <h2>{{ 'Monthly spending trend' | t }}</h2>
            <growth-chart
              [data]="trendChart()"
              type="line"
              unit="SAR"
              summary="Actual monthly expenses for the selected year"
            />
            <p class="chart-caption">
              {{ d.report.changeHalalas | sar }} change from the previous full month. Current month
              may be incomplete.
            </p>
          </section>
        </div>
        <section class="card section-space">
          <div class="section-heading">
            <div>
              <h2>{{ 'Explore a period' | t }}</h2>
              <p>{{ 'Separate totals for expenses, income and transfers' | t }}</p>
            </div>
          </div>
          <div class="history-filters">
            <label
              >{{ 'Period' | t
              }}<select [(ngModel)]="period" (change)="load()">
                <option value="day">{{ 'Daily' | t }}</option>
                <option value="week">{{ 'Weekly' | t }}</option>
                <option value="month">{{ 'Monthly' | t }}</option>
                <option value="year">{{ 'Yearly' | t }}</option>
              </select></label
            ><label
              >{{ 'Reference date' | t
              }}<input type="date" [(ngModel)]="date" (change)="month = date.slice(0, 7); load()"
            /></label>
          </div>
          <p>{{ d.period.from }} — {{ d.period.to }}</p>
          <div class="facts">
            <div>
              <p>
                <small>{{ 'Expenses' | t }}</small
                ><strong>{{ d.period.spentHalalas | sar }}</strong>
              </p>
            </div>
            <div>
              <p>
                <small>{{ 'Recorded income' | t }}</small
                ><strong>{{ d.period.incomeHalalas | sar }}</strong>
              </p>
            </div>
            <div>
              <p>
                <small>{{ 'Transfers' | t }}</small
                ><strong>{{ d.period.transferredHalalas | sar }}</strong>
              </p>
            </div>
          </div>
        </section>
      }
      @if (reportMode) {
        <section class="card finance-hero">
          <div>
            <div class="eyebrow">{{ d.closed ? 'MONTH IN REVIEW' : 'PROVISIONAL REPORT' }}</div>
            <h2>{{ d.report.assessment }}</h2>
            <p>{{ 'Assessment based on recorded expenses and actual transfers.' | t }}</p>
          </div>
          <span class="status">{{ month }}</span>
        </section>
        <div class="metrics finance-metrics">
          @for (card of reportCards(); track card.label) {
            <article class="card metric">
              <span class="metric-label">{{ card.label | t }}</span>
              <div class="finance-value">{{ card.value }}</div>
            </article>
          }
        </div>
        <section class="card section-space">
          <h2>{{ 'What changed' | t }}</h2>
          <ul class="insights">
            @for (note of d.report.observations; track note) {
              <li>{{ note }}</li>
            }
          </ul>
          <p>
            {{ 'Highest spending category:' | t
            }}<strong>{{ d.report.highestCategory || 'No expenses recorded' }}</strong>
          </p>
          @if (d.report.largestExpense; as e) {
            <p>
              Largest expense: {{ e.description }} · <strong>{{ e.amountHalalas | sar }}</strong>
            </p>
          }
          <p>Expenses vs previous full month: {{ d.report.changeHalalas | sar }}</p>
        </section>
        <section class="card section-space">
          <h2>{{ 'Expenses by category' | t }}</h2>
          <div class="legend">
            @for (c of d.categories; track c.id) {
              <div>
                <span>{{ c.name }}</span
                ><strong>{{ c.amountHalalas | sar }}</strong>
              </div>
            }
          </div>
        </section>
      }
      <section class="card section-space">
        <div class="section-heading">
          <div>
            <h2>{{ 'Budget vs actual' | t }}</h2>
            <p>{{ 'Transfers count toward savings targets, never consumption.' | t }}</p>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ 'Envelope' | t }}</th>
                <th>{{ 'Planned' | t }}</th>
                <th>{{ 'Actual' | t }}</th>
                <th>{{ 'Remaining' | t }}</th>
                <th>{{ 'Usage' | t }}</th>
                <th>{{ 'Estimated remaining' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (e of d.envelopes; track e.key) {
                <tr>
                  <td>
                    <strong>{{ e.name }}</strong
                    ><small class="description"
                      >{{ e.kind }} ·
                      {{ e.kind === 'expense' ? e.status : 'Recorded transfers' }}</small
                    >
                  </td>
                  <td>{{ e.amountHalalas | sar }}</td>
                  <td>{{ e.actualHalalas | sar }}</td>
                  <td>{{ e.remainingHalalas | sar }}</td>
                  <td>{{ e.usagePercent | number: '1.0-1' }}%</td>
                  <td>{{ e.kind === 'expense' ? (e.projectedRemainingHalalas | sar) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      @if (!reportMode) {
        <div class="alert-grid section-space">
          @for (e of d.envelopes; track e.key) {
            @if (e.kind === 'expense') {
              <article class="card alert-card" [class.warning]="e.status !== 'On Track'">
                <span class="status">{{ e.status | t }}</span>
                <h3>{{ e.name }}</h3>
                <p>{{ e.message }}</p>
              </article>
            }
          }
          @for (c of d.categories; track c.id) {
            @if (c.status !== 'On Track') {
              <article class="card alert-card warning">
                <h3>{{ c.name }} sublimit · {{ c.status }}</h3>
                <p>
                  {{ c.amountHalalas | sar }} spent of {{ c.limitHalalas | sar }}. This is included
                  in its envelope, not an extra budget.
                </p>
              </article>
            }
          }
        </div>
        <section class="card section-space">
          <h2>{{ 'What if I spent this every day?' | t }}</h2>
          <p>{{ 'An illustration, separate from your recorded-spending forecast.' | t }}</p>
          <div class="history-filters">
            <label
              >{{ 'Daily amount in SAR' | t
              }}<input
                inputmode="decimal"
                [(ngModel)]="hypothetical"
                (input)="illustrate()" /></label
            ><label
              >{{ 'Envelope' | t
              }}<select [(ngModel)]="scenarioKey" (change)="illustrate()">
                @for (e of d.envelopes; track e.key) {
                  @if (e.kind === 'expense') {
                    <option [value]="e.key">{{ e.name }}</option>
                  }
                }
              </select></label
            >
          </div>
          <p role="status">{{ scenario() }}</p>
        </section>
      }
      <section class="card section-space">
        <h2>Yearly financial overview · {{ month.slice(0, 4) }}</h2>
        <growth-chart
          [data]="yearChart()"
          unit="SAR"
          summary="Actual expenses, income and savings transfers by month"
        />
        <div class="facts">
          <div>
            <p>
              <small>{{ 'Year expenses' | t }}</small
              ><strong>{{ d.yearlyTotals.expenses | sar }}</strong>
            </p>
          </div>
          <div>
            <p>
              <small>{{ 'Year recorded income' | t }}</small
              ><strong>{{ d.yearlyTotals.income | sar }}</strong>
            </p>
          </div>
          <div>
            <p>
              <small>{{ 'Year savings transfers' | t }}</small
              ><strong>{{ d.yearlyTotals.savings | sar }}</strong>
            </p>
          </div>
        </div>
      </section>
    }
  `,
})
export class FinanceDashboardPage {
  api = inject(Api);
  reportMode = inject(ActivatedRoute).snapshot.data['report'] === true;
  data = signal<FinanceSummary | null>(null);
  categories = signal<FinanceCategory[]>([]);
  loading = signal(true);
  error = signal('');
  month = localDate('Asia/Riyadh').slice(0, 7);
  date = localDate('Asia/Riyadh');
  period = 'month';
  categoryId = '';
  hypothetical = '500';
  scenarioKey = 'general';
  scenario = signal('');
  private serial = 0;
  cards = computed(() => {
    const d = this.data();
    return d
      ? [
          {
            label: 'Monthly salary plan',
            value: money(d.salaryHalalas),
            note: 'Income is recorded separately',
          },
          {
            label: 'Total spent this month',
            value: money(d.spentHalalas),
            note: 'Expenses only; transfers excluded',
          },
          {
            label: 'Planned / actual savings',
            value: money(d.actualSavingsHalalas),
            note: `${money(d.plannedSavingsHalalas)} planned`,
          },
          {
            label: "Today's spending",
            value: money(d.todaySpentHalalas),
            note: d.today + ' · Riyadh',
          },
          {
            label: 'Monthly budget usage',
            value: d.usagePercent.toFixed(1) + '%',
            note: 'Expenses ÷ consumption budget',
          },
          {
            label: 'Projected month-end balance',
            value: money(d.projectedBalanceHalalas),
            note: 'Remaining consumption budget · estimate',
          },
        ]
      : [];
  });
  reportCards = computed(() => {
    const d = this.data();
    return d
      ? [
          { label: 'Recorded income', value: money(d.incomeHalalas) },
          { label: 'Actual expenses', value: money(d.spentHalalas) },
          { label: 'Net cash flow (income − expenses)', value: money(d.netCashFlowHalalas) },
          { label: 'Cash after recorded transfers', value: money(d.availableCashHalalas) },
          { label: 'Actual savings transfers', value: money(d.actualSavingsHalalas) },
          { label: 'Planned savings', value: money(d.plannedSavingsHalalas) },
          { label: 'Emergency contributions', value: money(d.emergencyHalalas) },
          { label: 'Emergency contribution target', value: money(d.plannedEmergencyHalalas) },
        ]
      : [];
  });
  dailyChart = computed<ChartData>(() => ({
    labels: this.data()?.daily.map((r) => r.date.slice(8)),
    datasets: [
      {
        label: 'Expenses',
        data:
          (this.data()?.filteredDaily || this.data()?.daily)?.map((r) => r.spentHalalas / 100) ||
          [],
        backgroundColor: '#0ea5e9',
        borderRadius: 4,
      },
    ],
  }));
  categoryChart = computed<ChartData>(() => ({
    labels: this.data()
      ?.categories.filter((c) => c.amountHalalas)
      .map((c) => c.name),
    datasets: [
      {
        data:
          this.data()
            ?.categories.filter((c) => c.amountHalalas)
            .map((c) => c.amountHalalas / 100) || [],
        backgroundColor: [
          '#0284c7',
          '#38bdf8',
          '#14b8a6',
          '#6366f1',
          '#818cf8',
          '#f59e0b',
          '#94a3b8',
          '#2563eb',
          '#22d3ee',
          '#64748b',
          '#a78bfa',
          '#2dd4bf',
        ],
        borderWidth: 0,
      },
    ],
  }));
  projectionChart = computed<ChartData>(() => {
    const d = this.data();
    return {
      labels: d?.daily.map((r) => r.date.slice(8)),
      datasets: [
        {
          label: 'Actual',
          data: d?.daily.map((r) => (r.date <= d.today ? r.cumulativeHalalas / 100 : null)) || [],
          borderColor: '#0284c7',
          pointRadius: 0,
        },
        {
          label: 'Estimated pace',
          data:
            d?.daily.map((r) =>
              r.projectedCumulativeHalalas === null ? null : r.projectedCumulativeHalalas / 100,
            ) || [],
          borderColor: '#14b8a6',
          borderDash: [6, 5],
          pointRadius: 0,
        },
        {
          label: 'Expense budget',
          data: d?.daily.map(() => d.expenseBudgetHalalas / 100) || [],
          borderColor: '#94a3b8',
          borderDash: [2, 4],
          pointRadius: 0,
        },
      ],
    };
  });
  trendChart = computed<ChartData>(() => ({
    labels: this.data()?.yearly.map((r) => r.month),
    datasets: [
      {
        label: 'Expenses',
        data: this.data()?.yearly.map((r) => r.expenses / 100) || [],
        borderColor: '#0284c7',
        backgroundColor: '#0284c7',
        tension: 0.2,
      },
    ],
  }));
  yearChart = computed<ChartData>(() => ({
    labels: this.data()?.yearly.map((r) => r.month.slice(5)),
    datasets: [
      {
        label: 'Expenses',
        data: this.data()?.yearly.map((r) => r.expenses / 100) || [],
        backgroundColor: '#0284c7',
      },
      {
        label: 'Income',
        data: this.data()?.yearly.map((r) => r.income / 100) || [],
        backgroundColor: '#38bdf8',
      },
      {
        label: 'Savings transfers',
        data: this.data()?.yearly.map((r) => r.savings / 100) || [],
        backgroundColor: '#14b8a6',
      },
    ],
  }));
  constructor() {
    void this.load();
  }
  async load() {
    const seq = ++this.serial;
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(this.month)) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const [d, c] = await Promise.all([
        this.api.get<FinanceSummary>(
          `finance/${this.reportMode ? 'report' : 'summary'}?` +
            new URLSearchParams({
              month: this.month,
              period: this.period,
              date: this.date,
              ...(this.categoryId ? { categoryId: this.categoryId } : {}),
            }),
        ),
        this.api.get<FinanceCategory[]>('finance/categories'),
      ]);
      if (seq !== this.serial) return;
      this.data.set(d);
      this.categories.set(c);
      this.illustrate();
    } catch (e) {
      if (seq === this.serial) this.error.set(errorMessage(e));
    } finally {
      if (seq === this.serial) this.loading.set(false);
    }
  }
  illustrate() {
    try {
      const amount = parseMoney(this.hypothetical),
        e = this.data()?.envelopes.find((e) => e.key === this.scenarioKey);
      this.scenario.set(
        amount && e
          ? `${money(amount)} every day would use the full ${money(e.amountHalalas)} allocation in ${(e.amountHalalas / amount).toFixed(1)} days (${(Math.max(0, e.remainingHalalas) / amount).toFixed(1)} days from the actual remaining budget). This is hypothetical, not a forecast.`
          : 'Enter an amount above zero.',
      );
    } catch {
      this.scenario.set('Enter a valid amount with at most two decimal places.');
    }
  }
}
