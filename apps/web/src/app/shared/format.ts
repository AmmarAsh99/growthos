import { Pipe, PipeTransform } from '@angular/core';
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}
export function localDate(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function validDuration(hours: number, minutes: number) {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 24 &&
    minutes >= 0 &&
    minutes <= 59 &&
    hours * 60 + minutes >= 1 &&
    hours * 60 + minutes <= 1440
  );
}
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(value: number) {
    return duration(value);
  }
}
