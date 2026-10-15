import { Component, computed, input } from '@angular/core';
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
  data = input.required<ChartData>();
  type = input<ChartType>('bar');
  summary = input.required<string>();
  options = computed<ChartOptions>(() => ({
    responsive: true,
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) =>
            `${c.dataset.label || c.label || 'Time'}: ${typeof c.raw === 'number' ? c.raw : 0} minutes`,
        },
      },
    },
    ...(this.type() === 'doughnut'
      ? {}
      : {
          scales: {
            x: { grid: { display: false }, ticks: { color: '#96a3bd', maxTicksLimit: 8 } },
            y: { beginAtZero: true, grid: { color: '#202a40' }, ticks: { color: '#96a3bd' } },
          },
        }),
  }));
}
