import type { SkillRepository } from "../repositories/skill.repository.js";
import type { SkillDeletionImpact, SkillRecord } from "./types.js";
import {
  DuplicateSkillNameError,
  SkillNotFoundError,
  ValidationError,
} from "./errors/domain-errors.js";

/** Business rules for the shared Skills catalog (FR-0006–FR-0008). */
export class SkillService {
  constructor(private readonly skills: SkillRepository) {}

  async createSkill(name: string): Promise<SkillRecord> {
    if (!name || !name.trim()) {
      throw new ValidationError("name is required to create a skill.");
    }

    const existing = await this.skills.findByName(name);
    if (existing) {
      throw new DuplicateSkillNameError(name);
    }

    return this.skills.insert(name);
  }

  async getSkill(skillId: string): Promise<SkillRecord> {
    const skill = await this.skills.findById(skillId);
    if (!skill) {
      throw new SkillNotFoundError(skillId);
    }
    return skill;
  }

  async listSkills(): Promise<SkillRecord[]> {
    return this.skills.findAll();
  }

  async renameSkill(skillId: string, name: string): Promise<SkillRecord> {
    const existing = await this.skills.findById(skillId);
    if (!existing) {
      throw new SkillNotFoundError(skillId);
    }
    if (!name || !name.trim()) {
      throw new ValidationError("name is required to rename a skill.");
    }

    const collision = await this.skills.findByName(name);
    if (collision && collision.skillId !== skillId) {
      throw new DuplicateSkillNameError(name);
    }

    const updated = await this.skills.update(skillId, name);
    if (!updated) {
      throw new SkillNotFoundError(skillId);
    }
    return updated;
  }

  async getDeletionImpact(skillId: string): Promise<SkillDeletionImpact> {
    const skill = await this.skills.findById(skillId);
    if (!skill) {
      throw new SkillNotFoundError(skillId);
    }

    const [affectedEmployeeCount, affectedProjectRoleCount] = await Promise.all([
      this.skills.countEmployeeAssociations(skillId),
      this.skills.countProjectRoleAssociations(skillId),
    ]);

    return { skillId, affectedEmployeeCount, affectedProjectRoleCount };
  }

  async deleteSkill(skillId: string): Promise<void> {
    const existing = await this.skills.findById(skillId);
    if (!existing) {
      throw new SkillNotFoundError(skillId);
    }

    await this.skills.delete(skillId);
  }
}
