import type { EmployeeRepository } from "../repositories/employee.repository.js";
import type { AssignmentRepository } from "../repositories/assignment.repository.js";
import type { SkillRepository } from "../repositories/skill.repository.js";
import { addDays, rangesOverlap, today } from "./date-utils.js";
import type { EmployeeSkillRecord } from "./types.js";
import { ValidationError } from "./errors/domain-errors.js";

export type BenchWindow = "now" | "30d" | "60d" | "90d";

const WINDOW_DAYS: Record<BenchWindow, number> = {
  now: 0,
  "30d": 30,
  "60d": 60,
  "90d": 90,
};

export interface BenchEntry {
  employeeId: string;
  name: string;
  utilizationPercent: number;
  availableCapacityPercent: number;
  skills: EmployeeSkillRecord[];
}

/**
 * Bench view (FR-0019/FR-0020). The window algorithm is the resolved ambiguity from
 * specs/004-bench-reporting/spec.md's Assumptions: for a window of N days, utilization is the
 * MINIMUM per-day concurrent capacity across [today, today+N] — not a whole-range sum (which
 * double-counts non-overlapping assignments) and not a peak/maximum (which would exclude an
 * employee busy only at the start of a window but free for the rest of it). `now` (N=0) is a
 * true degenerate case of the same algorithm, not a separately maintained path — see
 * research.md's decision and tests/unit/bench.service.test.ts's consistency check against
 * AssignmentService.getCurrentUtilization.
 */
export class BenchService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly assignments: AssignmentRepository,
    private readonly skills: SkillRepository,
  ) {}

  private isValidWindow(window: string): window is BenchWindow {
    return window in WINDOW_DAYS;
  }

  async getBenchView(window: string): Promise<BenchEntry[]> {
    if (!this.isValidWindow(window)) {
      throw new ValidationError('window must be one of "now", "30d", "60d", "90d".');
    }

    const windowDays = this.buildWindowDays(WINDOW_DAYS[window]);
    const allEmployees = await this.employees.findAll({});

    const entries = await Promise.all(
      allEmployees.map(async (employee) => {
        const employeeAssignments = await this.assignments.findAllForEmployee(employee.employeeId);

        const utilizationPercent = windowDays.reduce((minSoFar, day) => {
          const concurrentCapacity = employeeAssignments
            .filter((a) =>
              rangesOverlap({ start: a.startDate, end: a.endDate }, { start: day, end: day }),
            )
            .reduce((sum, a) => sum + a.capacityPercent, 0);
          return Math.min(minSoFar, concurrentCapacity);
        }, 100);

        const employeeSkills = await this.skills.findSkillsForEmployee(employee.employeeId);

        return {
          employeeId: employee.employeeId,
          name: employee.name,
          utilizationPercent,
          availableCapacityPercent: 100 - utilizationPercent,
          skills: employeeSkills,
        };
      }),
    );

    return entries.filter((entry) => entry.utilizationPercent < 100);
  }

  /** Builds the inclusive list of ISO date strings [today, today+N]. */
  private buildWindowDays(n: number): string[] {
    const start = today();
    const days: string[] = [];
    for (let offset = 0; offset <= n; offset += 1) {
      days.push(addDays(start, offset));
    }
    return days;
  }
}
