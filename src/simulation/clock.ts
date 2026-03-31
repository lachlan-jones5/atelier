export interface SimTime {
  logical_day: number; // Workday counter (1-indexed)
  hour: number; // 0-23 (work hours 9-17)
  sprint: number; // Sprint number (2-week = 10 workday sprints)
  sprint_day: number; // Day within sprint (1-10)
}

const WORK_START = 9;
const WORK_END = 17;
const SPRINT_LENGTH = 10; // workdays per sprint

export class SimulationClock {
  private time: SimTime;

  constructor(logicalDay: number = 1, hour: number = WORK_START) {
    this.time = {
      logical_day: logicalDay,
      hour: Math.max(WORK_START, Math.min(23, hour)),
      sprint: Math.ceil(logicalDay / SPRINT_LENGTH),
      sprint_day: ((logicalDay - 1) % SPRINT_LENGTH) + 1,
    };
  }

  get current(): SimTime {
    return { ...this.time };
  }

  /**
   * Advance by N hours. If past 17:00, roll to next day 9:00.
   * Update sprint tracking (new sprint every 10 workdays).
   */
  advance(hours: number): SimTime {
    let remaining = hours;

    while (remaining > 0) {
      const hoursLeftToday = WORK_END - this.time.hour;

      if (remaining <= hoursLeftToday) {
        this.time.hour += remaining;
        remaining = 0;
      } else {
        // Consume the rest of today and roll to next morning
        remaining -= hoursLeftToday;
        this.rollToNextDay();
      }
    }

    return this.current;
  }

  /** Jump to next workday 9:00. */
  advanceToNextMorning(): SimTime {
    this.rollToNextDay();
    return this.current;
  }

  /** Advance N full workdays (lands at 9:00 on day N+current). */
  advanceDays(days: number): SimTime {
    for (let i = 0; i < days; i++) {
      this.rollToNextDay();
    }
    return this.current;
  }

  /** Calculate elapsed work hours between a past time and now. */
  getElapsedHours(sinceDay: number, sinceHour: number): number {
    if (sinceDay > this.time.logical_day) return 0;
    if (sinceDay === this.time.logical_day) {
      return Math.max(0, this.time.hour - sinceHour);
    }

    // Hours remaining on the starting day
    const firstDayHours = WORK_END - sinceHour;
    // Full days in between
    const fullDays = this.time.logical_day - sinceDay - 1;
    const fullDayHours = fullDays * (WORK_END - WORK_START);
    // Hours elapsed on the current day
    const lastDayHours = this.time.hour - WORK_START;

    return firstDayHours + fullDayHours + lastDayHours;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private rollToNextDay(): void {
    this.time.logical_day += 1;
    this.time.hour = WORK_START;
    this.time.sprint = Math.ceil(this.time.logical_day / SPRINT_LENGTH);
    this.time.sprint_day =
      ((this.time.logical_day - 1) % SPRINT_LENGTH) + 1;
  }
}
