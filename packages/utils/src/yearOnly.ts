import { Moment } from "moment";
import moment from "moment";

export function yearOnly(date: Moment): Moment {
  return moment(`${date.year()}-01-01`).utc(true);
}
