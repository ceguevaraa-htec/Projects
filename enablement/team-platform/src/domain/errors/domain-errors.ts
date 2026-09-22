/**
 * Typed exception hierarchy for Domain Logic errors, mapped by the Express error-handling
 * middleware (src/api/middleware/error-handler.ts) to the { error_code, message } envelope
 * per SDP NFR-0005/ADR-0009. See specs/001-employee-management/contracts/employee-management.md
 * for the authoritative error_code -> HTTP status table.
 */
export abstract class DomainError extends Error {
  abstract readonly errorCode: string;
  abstract readonly httpStatus: number;
}

export class ValidationError extends DomainError {
  readonly errorCode = "VALIDATION_ERROR";
  readonly httpStatus = 400;
}

export class EmployeeNotFoundError extends DomainError {
  readonly errorCode = "NOT_FOUND";
  readonly httpStatus = 404;

  constructor(employeeId: string) {
    super(`Employee "${employeeId}" does not exist.`);
  }
}

export class SkillNotFoundError extends DomainError {
  readonly errorCode = "NOT_FOUND";
  readonly httpStatus = 404;

  constructor(skillId: string) {
    super(`Skill "${skillId}" does not exist.`);
  }
}

export class EmployeeSkillNotFoundError extends DomainError {
  readonly errorCode = "EMPLOYEE_SKILL_NOT_FOUND";
  readonly httpStatus = 404;

  constructor(employeeId: string, skillId: string) {
    super(`Employee "${employeeId}" has no association with skill "${skillId}".`);
  }
}

export class EmployeeHasAssignmentsError extends DomainError {
  readonly errorCode = "EMPLOYEE_HAS_ASSIGNMENTS";
  readonly httpStatus = 409;

  constructor(employeeId: string) {
    super(`Can't delete employee "${employeeId}" — they have existing assignments.`);
  }
}

export class DuplicateSkillNameError extends DomainError {
  readonly errorCode = "SKILL_NAME_NOT_UNIQUE";
  readonly httpStatus = 409;

  constructor(name: string) {
    super(`A skill named "${name}" already exists.`);
  }
}

export class DuplicateEmployeeSkillError extends DomainError {
  readonly errorCode = "DUPLICATE_EMPLOYEE_SKILL";
  readonly httpStatus = 409;

  constructor(employeeId: string, skillId: string) {
    super(`Employee "${employeeId}" already has an association with skill "${skillId}".`);
  }
}
