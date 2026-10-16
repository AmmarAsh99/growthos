import { Component, computed, input, inject } from '@angular/core';
import { Theme } from '../core/theme';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions, ChartType } from 'chart.js';
@Component({
  selector: 'growth-chart',
  imports: [BaseChartDirective],
  template: `<div class="chart">
      <canvas
        baseChart
        [data]="data()"
        [type]="type()"
        [options]="options()"
        role="img"
        [attr.aria-label]="summary()"
      ></canvas>
    </div>
    <p class="sr-only">{{ summary() }}</p>`,
})
export class GrowthChart {
  theme = inject(Theme);
  unit = input<'minutes' | 'SAR'>('minutes');
  data = input.required<ChartData>();
  type = input<ChartType>('bar');
  summary = input.required<string>();
  options = computed<ChartOptions>(() => ({
    responsive: true,
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: this.data().datasets.length > 1,
        labels: { color: this.theme.dark() ? '#b9cce1' : '#475569', usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: (c) =>
            `${c.dataset.label || c.label || 'Total'}: ${typeof c.raw === 'number' ? c.raw.toLocaleString('en-SA', { maximumFractionDigits: 2 }) : 0} ${this.unit()}`,
        },
      },
    },
    ...(this.type() === 'doughnut'
      ? {}
      : {
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: this.theme.dark() ? '#b9cce1' : '#475569', maxTicksLimit: 8 },
            },
            y: {
              beginAtZero: true,
              grid: { color: this.theme.dark() ? '#24374e' : '#e2eaf4' },
              ticks: { color: this.theme.dark() ? '#b9cce1' : '#475569' },
            },
          },
        }),
  }));
}
