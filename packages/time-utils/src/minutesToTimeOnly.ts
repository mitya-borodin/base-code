import moment, { Moment } from "moment";

export function minutesToTimeOnly(minutes: number): Moment {
  const date = moment()
    .year(0)
    .month(0)
    .date(1)
    .hour(0)
    .minute(0)
    .second(0)
    .millisecond(0)
    .utc(true);

  date.add(minutes, "m");

  return date;
}
