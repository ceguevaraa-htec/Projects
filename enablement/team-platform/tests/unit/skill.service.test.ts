import { describe, expect, it } from "vitest";
import { SkillService } from "../../src/domain/skill.service.js";
import { FakeSkillRepository } from "../helpers/fakes.js";
import {
  DuplicateSkillNameError,
  SkillNotFoundError,
  ValidationError,
} from "../../src/domain/errors/domain-errors.js";

function makeService() {
  const skills = new FakeSkillRepository();
  const service = new SkillService(skills);
  return { service, skills };
}

describe("SkillService — catalog CRUD (FR-0006/FR-0007)", () => {
  it("creates a skill with a unique name", async () => {
    const { service } = makeService();
    const skill = await service.createSkill("React");
    expect(skill.name).toBe("React");
  });

  it("rejects creating a skill with a colliding name", async () => {
    const { service } = makeService();
    await service.createSkill("React");
    await expect(service.createSkill("React")).rejects.toBeInstanceOf(DuplicateSkillNameError);
  });

  it("rejects creating a skill with an empty name", async () => {
    const { service } = makeService();
    await expect(service.createSkill("")).rejects.toBeInstanceOf(ValidationError);
  });

  it("renames a skill to an unused name", async () => {
    const { service } = makeService();
    const skill = await service.createSkill("Vue");
    const renamed = await service.renameSkill(skill.skillId, "Vue.js");
    expect(renamed.name).toBe("Vue.js");
  });

  it("rejects renaming a skill to a colliding name", async () => {
    const { service } = makeService();
    await service.createSkill("Angular");
    const other = await service.createSkill("Svelte");
    await expect(service.renameSkill(other.skillId, "Angular")).rejects.toBeInstanceOf(
      DuplicateSkillNameError,
    );
  });
});

describe("SkillService — not-found handling", () => {
  it("getSkill throws SkillNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.getSkill("missing")).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it("renameSkill throws SkillNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.renameSkill("missing", "New Name")).rejects.toBeInstanceOf(
      SkillNotFoundError,
    );
  });

  it("getDeletionImpact throws SkillNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.getDeletionImpact("missing")).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it("deleteSkill throws SkillNotFoundError for a nonexistent id", async () => {
    const { service } = makeService();
    await expect(service.deleteSkill("missing")).rejects.toBeInstanceOf(SkillNotFoundError);
  });
});

describe("SkillService — deletion impact (FR-0008)", () => {
  it("returns zero counts for a skill with no associations", async () => {
    const { service } = makeService();
    const skill = await service.createSkill("Rust");
    const impact = await service.getDeletionImpact(skill.skillId);
    expect(impact).toEqual({
      skillId: skill.skillId,
      affectedEmployeeCount: 0,
      affectedProjectRoleCount: 0,
    });
  });

  it("returns a real, non-zero project-role count (EPIC-0002 discharge of EPIC-0001's follow-up)", async () => {
    const { service, skills } = makeService();
    const skill = await service.createSkill("Kotlin");
    await skills.insertEmployeeSkill("employee-1", skill.skillId, "Expert");
    await skills.insertEmployeeSkill("employee-2", skill.skillId, "Beginner");
    // Simulates two project roles requiring this skill — previously impossible to assert
    // meaningfully, since EPIC-0001's stub (and the fake mirroring it) always returned 0.
    skills.projectRoleAssociationCounts.set(skill.skillId, 2);

    const impact = await service.getDeletionImpact(skill.skillId);
    expect(impact.affectedEmployeeCount).toBe(2);
    expect(impact.affectedProjectRoleCount).toBe(2);
  });
});

describe("SkillService — cascading delete (FR-0008)", () => {
  it("removes employee_skills associations when the skill is deleted", async () => {
    const { service, skills } = makeService();
    const skill = await service.createSkill("Go");
    await skills.insertEmployeeSkill("employee-1", skill.skillId, "Intermediate");
    expect(await skills.countEmployeeAssociations(skill.skillId)).toBe(1);

    await service.deleteSkill(skill.skillId);

    expect(await skills.countEmployeeAssociations(skill.skillId)).toBe(0);
    expect(await skills.findById(skill.skillId)).toBeUndefined();
  });
});
