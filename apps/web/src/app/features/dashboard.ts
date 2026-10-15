import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Api, Auth, errorMessage } from '../core/api';
import type { ActivityPage, Breakdown, Bucket, Category, Overview } from '../core/models';
import { DurationPipe } from '../shared/format';
import { GrowthChart } from '../shared/chart';
import type { ChartData } from 'chart.js';
@Component({
  imports: [RouterLink, FormsModule, DecimalPipe, DurationPipe, GrowthChart],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">YOUR GROWTH, AT A GLANCE</div>
        <h1>Keep growing, {{ auth.user()?.displayName }}<span class="heading-dot">.</span></h1>
        <p>Small steps today. A stronger foundation tomorrow.</p>
      </div>
      <a class="button primary" routerLink="/activities/new">＋ Log activity</a>
    </div>
    <div class="filterbar">
      <span class="date-label"
        >{{ overview()?.asOfDate || 'Your local day' }}
        <span class="muted">· {{ auth.user()?.settings?.timezone }}</span></span
      >
      <div>
        <label class="sr-only" for="dashboard-category">Filter category</label
        ><select id="dashboard-category" [(ngModel)]="categoryId" (change)="load()">
          <option value="">All categories</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }</select
        ><label class="sr-only" for="period">Selected period</label
        ><select id="period" [(ngModel)]="period" (change)="load()">
          <option value="day">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="year">This year</option>
        </select>
      </div>
    </div>
    @if (error()) {
      <div class="error" role="alert">
        {{ error() }} <button (click)="load()">Try again</button>
      </div>
    }
    @if (loading()) {
      <div class="metrics" aria-label="Loading dashboard" aria-busy="true">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="card skeleton"></div>
        }
      </div>
    } @else if (overview(); as o) {
      <div class="metrics">
        @for (card of cards(); track card.label) {
          <article class="card metric">
            <div class="metric-label">
              {{ card.label
              }}<span class="metric-icon" [class.cyan]="card.label === 'This week'">{{
                card.icon
              }}</span>
            </div>
            <div class="metric-value">
              {{ card.goal.goalProgressPct | number: '1.0-1' }}<span>%</span>
            </div>
            <div class="progress"><i [style.width.%]="card.goal.goalProgressPct"></i></div>
            <p>
              {{ card.goal.actualMinutes | duration }}
              <span class="muted">/ {{ card.goal.goalMinutes | duration }} goal</span>
            </p>
            <small
              >Full {{ card.period }} goal · {{ o.dailyGoalMinutes }} min ×
              {{ card.goal.goalMinutes / o.dailyGoalMinutes }} days</small
            >
          </article>
        }
        <article class="card metric streak">
          <div class="metric-label">Active streak<span class="metric-icon amber">ϟ</span></div>
          <div class="metric-value">{{ o.currentActivityStreakDays }}<span> days</span></div>
          <p>
            {{
              o.currentActivityStreakDays
                ? 'Keep your momentum going.'
                : 'Your next chapter starts today.'
            }}
          </p>
          <small
            >Consecutive days with activity.<br />Today or yesterday can be the last day.</small
          >
        </article>
      </div>
      <div class="facts">
        <div>
          <span class="fact-icon">◷</span>
          <p>
            <small>Time invested · {{ period }}</small
            ><strong>{{ o.selectedPeriod.totalMinutes | duration }}</strong>
          </p>
        </div>
        <div>
          <span class="fact-icon">▦</span>
          <p>
            <small>Active days</small><strong>{{ o.selectedPeriod.activeDays }}</strong>
          </p>
        </div>
        <div>
          <span class="fact-icon">✓</span>
          <p>
            <small>Activities logged</small><strong>{{ o.selectedPeriod.activityCount }}</strong>
          </p>
        </div>
        <div>
          <span class="fact-icon">↗</span>
          <p>
            <small>Logged time vs previous period</small
            ><strong
              [title]="
                'Equivalent elapsed calendar days; prior period clamped to its length. Comparison: ' +
                o.selectedPeriod.comparisonWindow.from +
                ' to ' +
                o.selectedPeriod.comparisonWindow.to
              "
              >{{
                o.selectedPeriod.changePct === null
                  ? 'No comparison yet'
                  : (o.selectedPeriod.changePct | number: '1.0-1') + '%'
              }}</strong
            >
          </p>
        </div>
      </div>
      <div class="dashboard-charts">
        <section class="card">
          <div class="section-heading">
            <div>
              <h2>Time invested</h2>
              <p>Showing up adds up.</p>
            </div>
            <label
              ><span class="sr-only">Trend range</span
              ><select [(ngModel)]="range" (change)="load()">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="weeks">Last 12 weeks</option>
                <option value="months">Last 12 months</option>
                <option value="years">Last 5 years</option>
              </select></label
            >
          </div>
          <growth-chart [data]="trendData()" [summary]="trendSummary()" />
          <p class="chart-caption">
            Minutes invested per {{ granularity() }} · Includes days with no logged activity
          </p>
        </section>
        <section class="card">
          <div class="section-heading">
            <div>
              <h2>Where your time goes</h2>
              <p>Category breakdown · {{ period }}</p>
            </div>
            <span>◉</span>
          </div>
          @if (breakdown().length) {
            <div class="donut-wrap">
              <growth-chart [data]="categoryData()" type="doughnut" [summary]="categorySummary()" />
            </div>
            <div class="legend">
              @for (c of breakdown(); track c.category.id) {
                <div>
                  <span><i [style.background]="c.category.color"></i>{{ c.category.name }}</span
                  ><strong
                    >{{ c.minutes | duration }}
                    <small>{{ c.percentage | number: '1.0-1' }}%</small></strong
                  >
                </div>
              }
            </div>
          } @else {
            <div class="empty">
              <span>◉</span>
              <h3>A fresh canvas</h3>
              <p>Log your first activity to see<br />where you invest your time.</p>
              <a routerLink="/activities/new">Log an activity →</a>
            </div>
          }
        </section>
      </div>
      <section class="card heatmap-card">
        <div class="section-heading">
          <div>
            <h2>A little more consistent</h2>
            <p>Your last 90 days. Every square is a day.</p>
          </div>
          <span class="muted">{{ heatmapActive() }} active days</span>
        </div>
        <div class="heatmap" role="list" aria-label="Daily activity over the last 90 days">
          @for (day of heatmap(); track day.date) {
            <div
              role="listitem"
              tabindex="0"
              [attr.aria-label]="day.date + ': ' + day.minutes + ' minutes'"
              [title]="day.date + ' · ' + day.minutes + ' minutes'"
              [style.background]="intensity(day.minutes)"
            ></div>
          }
        </div>
        <div class="heatmap-footer">
          <span>Consistency is built one day at a time.</span
          ><span>Less <i></i><i></i><i></i><i></i> More</span>
        </div>
      </section>
      <section class="card recent">
        <div class="section-heading">
          <div>
            <h2>Recent activities</h2>
            <p>Your latest investments in yourself.</p>
          </div>
          <a routerLink="/activities">View all →</a>
        </div>
        @for (a of recent(); track a.id) {
          <a class="activity-row" [routerLink]="['/activities', a.id, 'edit']"
            ><span class="activity-icon" [style.color]="a.category.color">{{
              a.category.icon === 'book' ? '▤' : '↗'
            }}</span>
            <div>
              <strong>{{ a.title }}</strong
              ><small
                >{{ a.category.name }} <span>· {{ a.activityDate }}</span></small
              >
            </div>
            <span class="duration-badge">{{ a.durationMinutes | duration }}</span
            ><span class="muted">↗</span></a
          >
        } @empty {
          <div class="empty compact">
            <p>Your story is ready for its first entry.</p>
            <a routerLink="/activities/new">＋ Log your first activity</a>
          </div>
        }
      </section>
      <p class="formula-note">
        Goal progress measures logged time, not skill mastery. Percentages = logged minutes ÷ full
        calendar-period goal, capped at 100%. Raw minutes are always shown.
      </p>
    }
  `,
})
export class DashboardPage {
  api = inject(Api);
  auth = inject(Auth);
  overview = signal<Overview | null>(null);
  categories = signal<Category[]>([]);
  trends = signal<Bucket[]>([]);
  breakdown = signal<Breakdown[]>([]);
  heatmap = signal<Bucket[]>([]);
  recent = signal<ActivityPage['items']>([]);
  loading = signal(true);
  error = signal('');
  period = 'month';
  range = '30';
  categoryId = '';
  private request = 0;
  cards = computed(() => {
    const o = this.overview();
    return o
      ? [
          { label: 'Today’s goal', icon: '◎', period: 'day', goal: o.today },
          { label: 'This week', icon: '▥', period: 'week', goal: o.week },
          { label: 'This month', icon: '▦', period: 'month', goal: o.month },
        ]
      : [];
  });
  trendData = computed<ChartData>(() => ({
    labels: this.trends().map((b) => b.date),
    datasets: [
      {
        label: 'Time invested',
        data: this.trends().map((b) => b.minutes),
        backgroundColor: '#8b6cf0',
        borderColor: '#9d82f6',
        borderWidth: 0,
        borderRadius: 4,
      },
    ],
  }));
  categoryData = computed<ChartData>(() => ({
    labels: this.breakdown().map((b) => b.category.name),
    datasets: [
      {
        data: this.breakdown().map((b) => b.minutes),
        backgroundColor: this.breakdown().map((b) => b.category.color),
        borderColor: '#141c2e',
        borderWidth: 5,
      },
    ],
  }));
  trendSummary = computed(() =>
    this.trends()
      .map((b) => `${b.date}: ${b.minutes} minutes`)
      .join('; '),
  );
  categorySummary = computed(() =>
    this.breakdown()
      .map((b) => `${b.category.name}: ${b.minutes} minutes, ${b.percentage.toFixed(1)}%`)
      .join('; '),
  );
  heatmapActive = computed(() => this.heatmap().filter((b) => b.minutes > 0).length);
  constructor() {
    void this.load();
  }
  granularity() {
    return this.range === 'weeks'
      ? 'week'
      : this.range === 'months'
        ? 'month'
        : this.range === 'years'
          ? 'year'
          : 'day';
  }
  intensity(minutes: number) {
    return minutes === 0
      ? '#232d42'
      : minutes < 30
        ? '#43336e'
        : minutes < 90
          ? '#6750ad'
          : minutes < 120
            ? '#8968da'
            : '#ad8aff';
  }
  async load() {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    const filter = `period=${this.period}${this.categoryId ? '&categoryId=' + this.categoryId : ''}`;
    try {
      const [o, c, t, b, h, r] = await Promise.all([
        this.api.get<Overview>('dashboard/overview?' + filter),
        this.api.get<Category[]>('categories?includeArchived=true'),
        this.api.get<Bucket[]>(
          `analytics/trends?granularity=${this.granularity()}&points=${this.range === 'years' ? 5 : ['weeks', 'months'].includes(this.range) ? 12 : this.range}&${filter}`,
        ),
        this.api.get<Breakdown[]>('analytics/categories?' + filter),
        this.api.get<Bucket[]>('analytics/heatmap?days=90&' + filter),
        this.api.get<ActivityPage>(
          'activities?limit=5' + (this.categoryId ? '&categoryId=' + this.categoryId : ''),
        ),
      ]);
      if (request !== this.request) return;
      this.overview.set(o);
      this.categories.set(c);
      this.trends.set(t);
      this.breakdown.set(b);
      this.heatmap.set(h);
      this.recent.set(r.items);
    } catch (e) {
      if (request === this.request) this.error.set(errorMessage(e));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}
