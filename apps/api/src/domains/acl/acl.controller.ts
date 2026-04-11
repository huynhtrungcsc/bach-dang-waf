import { Request, Response } from 'express';
import { aclService } from './acl.service';
import { CreateAclRuleDto, UpdateAclRuleDto, validateCreateAclRuleDto, validateUpdateAclRuleDto } from './dto';
import logger from '../../utils/logger';
export class AclController {
  async fetchRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = await aclService.listRules();

      res.json({
        success: true,
        data: rules
      });
    } catch (error: any) {
      logger.error('Failed to fetch ACL rules:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch ACL rules',
        error: error.message
      });
    }
  }
  async fetchRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rule = await aclService.findRule(id);

      res.json({
        success: true,
        data: rule
      });
    } catch (error: any) {
      logger.error('Failed to fetch ACL rule:', error);

      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to fetch ACL rule',
        ...(statusCode === 500 && { error: error.message })
      });
    }
  }
  async storeRule(req: Request, res: Response): Promise<void> {
    try {
      const dto: CreateAclRuleDto = req.body;

      // Validate DTO
      const validation = validateCreateAclRuleDto(dto);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
          errors: validation.errors
        });
        return;
      }

      const rule = await aclService.addRule(dto);

      res.status(201).json({
        success: true,
        message: 'ACL rule created successfully',
        data: rule
      });
    } catch (error: any) {
      logger.error('Failed to create ACL rule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create ACL rule',
        error: error.message
      });
    }
  }
  async modifyRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dto: UpdateAclRuleDto = req.body;

      // Validate DTO
      const validation = validateUpdateAclRuleDto(dto);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Invalid update data',
          errors: validation.errors
        });
        return;
      }

      const rule = await aclService.editRule(id, dto);

      res.json({
        success: true,
        message: 'ACL rule updated successfully',
        data: rule
      });
    } catch (error: any) {
      logger.error('Failed to update ACL rule:', error);

      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update ACL rule',
        ...(statusCode === 500 && { error: error.message })
      });
    }
  }
  async destroyRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await aclService.removeRule(id);

      res.json({
        success: true,
        message: 'ACL rule deleted successfully'
      });
    } catch (error: any) {
      logger.error('Failed to delete ACL rule:', error);

      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete ACL rule',
        ...(statusCode === 500 && { error: error.message })
      });
    }
  }
  async flipRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rule = await aclService.switchRule(id);

      res.json({
        success: true,
        message: `ACL rule ${rule.enabled ? 'enabled' : 'disabled'} successfully`,
        data: rule
      });
    } catch (error: any) {
      logger.error('Failed to toggle ACL rule:', error);

      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to toggle ACL rule',
        ...(statusCode === 500 && { error: error.message })
      });
    }
  }
  async previewRules(req: Request, res: Response): Promise<void> {
    try {
      const config = await aclService.previewConfig();

      res.json({
        success: true,
        data: {
          config,
          rulesCount: await aclService.countActive()
        }
      });
    } catch (error: any) {
      logger.error('Failed to preview ACL config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to preview ACL configuration',
        error: error.message
      });
    }
  }
  async importRules(req: Request, res: Response): Promise<void> {
    try {
      const { rules, mode = 'merge' } = req.body;

      if (!Array.isArray(rules)) {
        res.status(400).json({ success: false, message: 'Request body must contain a "rules" array' });
        return;
      }

      if (rules.length === 0) {
        res.status(400).json({ success: false, message: 'No rules provided in import file' });
        return;
      }

      if (!['merge', 'replace'].includes(mode)) {
        res.status(400).json({ success: false, message: 'mode must be "merge" or "replace"' });
        return;
      }

      const result = await aclService.bulkImport(rules, mode as 'merge' | 'replace');

      res.json({
        success: true,
        message: `Imported ${result.imported} rule(s)${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}`,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to import ACL rules:', error);
      res.status(500).json({ success: false, message: 'Failed to import ACL rules', error: error.message });
    }
  }
  async applyRules(req: Request, res: Response): Promise<void> {
    try {
      const result = await aclService.applyToNginx();

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message
        });
      }
    } catch (error: any) {
      logger.error('Failed to apply ACL rules:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to apply ACL rules',
        error: error.message
      });
    }
  }
}

// Export singleton instance
export const aclController = new AclController();
