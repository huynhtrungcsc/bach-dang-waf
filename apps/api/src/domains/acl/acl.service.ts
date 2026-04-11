import logger from '../../utils/logger';
import { aclRepository } from './acl.repository';
import { aclNginxService } from './services/acl-nginx.service';
import { AclRuleEntity, CreateAclRuleData, UpdateAclRuleData, AclNginxResult } from './acl.types';
import { NotFoundException } from '../../shared/errors/app-error';
export class AclService {
  async listRules(): Promise<AclRuleEntity[]> {
    return aclRepository.listAll();
  }
  async findRule(id: string): Promise<AclRuleEntity> {
    const rule = await aclRepository.getById(id);

    if (!rule) {
      throw new NotFoundException('ACL rule not found');
    }

    return rule;
  }
  async addRule(data: CreateAclRuleData): Promise<AclRuleEntity> {
    // Create the rule
    const rule = await aclRepository.insert(data);

    logger.info(`ACL rule created: ${rule.name} (${rule.id})`);

    // Auto-apply ACL rules to Nginx
    await aclNginxService.applyAclRules();

    return rule;
  }
  async editRule(id: string, data: UpdateAclRuleData): Promise<AclRuleEntity> {
    // Check if rule exists
    const exists = await aclRepository.checkExists(id);
    if (!exists) {
      throw new NotFoundException('ACL rule not found');
    }

    // Update the rule
    const rule = await aclRepository.patch(id, data);

    logger.info(`ACL rule updated: ${rule.name} (${rule.id})`);

    // Auto-apply ACL rules to Nginx
    await aclNginxService.applyAclRules();

    return rule;
  }
  async removeRule(id: string): Promise<void> {
    // Check if rule exists
    const rule = await aclRepository.getById(id);
    if (!rule) {
      throw new NotFoundException('ACL rule not found');
    }

    // Delete the rule
    await aclRepository.remove(id);

    logger.info(`ACL rule deleted: ${rule.name} (${id})`);

    // Auto-apply ACL rules to Nginx
    await aclNginxService.applyAclRules();
  }
  async switchRule(id: string): Promise<AclRuleEntity> {
    // Check if rule exists
    const existingRule = await aclRepository.getById(id);
    if (!existingRule) {
      throw new NotFoundException('ACL rule not found');
    }

    // Toggle the rule
    const rule = await aclRepository.setEnabled(id, !existingRule.enabled);

    logger.info(`ACL rule toggled: ${rule.name} (${rule.id}) - enabled: ${rule.enabled}`);

    // Auto-apply ACL rules to Nginx
    await aclNginxService.applyAclRules();

    return rule;
  }
  async previewConfig(): Promise<string> {
    return aclNginxService.generateAclConfig();
  }
  async countActive(): Promise<number> {
    const rules = await aclRepository.getEnabled();
    return rules.length;
  }
  async applyToNginx(): Promise<AclNginxResult> {
    logger.info('Manual ACL rules application triggered');
    return aclNginxService.applyAclRules();
  }
  async bulkImport(
    rules: CreateAclRuleData[],
    mode: 'replace' | 'merge' = 'merge'
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    if (mode === 'replace') {
      await aclRepository.removeAll();
      logger.info('ACL import: cleared existing rules (replace mode)');
    }

    for (const rule of rules) {
      try {
        if (!rule.name || !rule.conditionField || !rule.conditionValue || !rule.action) {
          result.skipped++;
          result.errors.push(`Skipped rule "${rule.name || '(unnamed)'}": missing required fields`);
          continue;
        }
        await aclRepository.insert({
          name: rule.name,
          type: rule.type || 'blacklist',
          conditionField: rule.conditionField,
          conditionOperator: rule.conditionOperator || 'equals',
          conditionValue: rule.conditionValue,
          action: rule.action,
          enabled: rule.enabled ?? true,
        });
        result.imported++;
      } catch (err: any) {
        result.skipped++;
        result.errors.push(`Failed to import "${rule.name}": ${err.message}`);
      }
    }

    logger.info(`ACL import complete: ${result.imported} imported, ${result.skipped} skipped`);

    // Apply to Nginx
    if (result.imported > 0) {
      await aclNginxService.applyAclRules();
    }

    return result;
  }
  async initializeConfig(): Promise<void> {
    return aclNginxService.initializeAclConfig();
  }
}

// Export singleton instance
export const aclService = new AclService();
