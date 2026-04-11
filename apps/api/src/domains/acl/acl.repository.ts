import prisma from '../../config/database';
import { AclRuleEntity, CreateAclRuleData, UpdateAclRuleData } from './acl.types';

/**
 * ACL Repository - Data access layer
 * Handles all database operations for ACL rules
 */
export class AclRepository {
  /**
   * Find all ACL rules
   */
  async listAll(): Promise<AclRuleEntity[]> {
    return prisma.aclRule.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Find ACL rule by ID
   */
  async getById(id: string): Promise<AclRuleEntity | null> {
    return prisma.aclRule.findUnique({
      where: { id }
    });
  }

  /**
   * Find enabled ACL rules
   */
  async getEnabled(): Promise<AclRuleEntity[]> {
    return prisma.aclRule.findMany({
      where: {
        enabled: true
      },
      orderBy: [
        { type: 'desc' }, // Whitelists first
        { createdAt: 'asc' }
      ]
    });
  }

  /**
   * Create new ACL rule
   */
  async insert(data: CreateAclRuleData): Promise<AclRuleEntity> {
    return prisma.aclRule.create({
      data: {
        name: data.name,
        type: data.type as any,
        conditionField: data.conditionField as any,
        conditionOperator: data.conditionOperator as any,
        conditionValue: data.conditionValue,
        action: data.action as any,
        enabled: data.enabled !== undefined ? data.enabled : true
      }
    });
  }

  /**
   * Update ACL rule
   */
  async patch(id: string, data: UpdateAclRuleData): Promise<AclRuleEntity> {
    return prisma.aclRule.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type as any }),
        ...(data.conditionField && { conditionField: data.conditionField as any }),
        ...(data.conditionOperator && { conditionOperator: data.conditionOperator as any }),
        ...(data.conditionValue && { conditionValue: data.conditionValue }),
        ...(data.action && { action: data.action as any }),
        ...(data.enabled !== undefined && { enabled: data.enabled })
      }
    });
  }

  /**
   * Delete ACL rule
   */
  async remove(id: string): Promise<void> {
    await prisma.aclRule.delete({
      where: { id }
    });
  }

  /**
   * Toggle ACL rule enabled status
   */
  async setEnabled(id: string, enabled: boolean): Promise<AclRuleEntity> {
    return prisma.aclRule.update({
      where: { id },
      data: { enabled }
    });
  }

  /**
   * Check if ACL rule exists
   */
  async checkExists(id: string): Promise<boolean> {
    const count = await prisma.aclRule.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * Delete all ACL rules (used for replace-mode import)
   */
  async removeAll(): Promise<void> {
    await prisma.aclRule.deleteMany({});
  }
}

// Export singleton instance
export const aclRepository = new AclRepository();
