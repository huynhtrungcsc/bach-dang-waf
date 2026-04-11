import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { modSecService } from './modsec.service';
import { AddCustomRuleDto, UpdateModSecRuleDto, ToggleCRSRuleDto, SetGlobalModSecDto } from './dto';
export class ModSecController {
  async listCrsRules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { domainId } = req.query;

      const rules = await modSecService.listCrsRules(domainId as string | undefined);

      res.json({
        success: true,
        data: rules,
      });
    } catch (error) {
      logger.error('Get CRS rules error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async switchCrsRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { ruleFile } = req.params;
      const { domainId } = req.body;

      const dto: ToggleCRSRuleDto = { domainId };

      const updatedRule = await modSecService.switchCrsRule(ruleFile, dto);

      res.json({
        success: true,
        message: `Rule ${updatedRule.enabled ? 'enabled' : 'disabled'} successfully`,
        data: updatedRule,
      });
    } catch (error: any) {
      if (error.message === 'CRS rule not found') {
        res.status(404).json({
          success: false,
          message: 'CRS rule not found',
        });
        return;
      }

      logger.error('Toggle CRS rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async listCustomRules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { domainId } = req.query;

      const rules = await modSecService.listCustomRules(domainId as string | undefined);

      res.json({
        success: true,
        data: rules,
      });
    } catch (error) {
      logger.error('Get ModSec rules error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async findCustomRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const rule = await modSecService.findCustomRule(id);

      res.json({
        success: true,
        data: rule,
      });
    } catch (error: any) {
      if (error.message === 'ModSecurity rule not found') {
        res.status(404).json({
          success: false,
          message: 'ModSecurity rule not found',
        });
        return;
      }

      logger.error('Get ModSec rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async switchCustomRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const updatedRule = await modSecService.switchCustomRule(id);

      logger.info(`ModSecurity rule ${updatedRule.name} ${updatedRule.enabled ? 'enabled' : 'disabled'}`, {
        ruleId: id,
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        message: `Rule ${updatedRule.enabled ? 'enabled' : 'disabled'} successfully`,
        data: updatedRule,
      });
    } catch (error: any) {
      if (error.message === 'ModSecurity rule not found') {
        res.status(404).json({
          success: false,
          message: 'ModSecurity rule not found',
        });
        return;
      }

      logger.error('Toggle ModSec rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async addRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const { name, category, ruleContent, description, domainId, enabled = true } = req.body;

      const dto: AddCustomRuleDto = {
        name,
        category,
        ruleContent,
        description,
        domainId,
        enabled,
      };

      const rule = await modSecService.addRule(dto);

      logger.info(`Custom ModSecurity rule added: ${rule.name}`, {
        ruleId: rule.id,
        userId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        message: 'Custom rule added successfully',
        data: rule,
      });
    } catch (error: any) {
      if (error.message === 'Domain not found') {
        res.status(404).json({
          success: false,
          message: 'Domain not found',
        });
        return;
      }

      // Handle validation errors (rule ID duplicates, nginx config errors)
      if (error.message.includes('Rule ID(s) already exist') ||
          error.message.includes('Nginx configuration test failed') ||
          error.message.includes('Nginx reload failed')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      logger.error('Add custom rule error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }
  async editRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const { name, category, ruleContent, description, enabled } = req.body;

      const dto: UpdateModSecRuleDto = {
        name,
        category,
        ruleContent,
        description,
        enabled,
      };

      const updatedRule = await modSecService.editRule(id, dto);

      logger.info(`ModSecurity rule updated: ${updatedRule.name}`, {
        ruleId: id,
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Rule updated successfully',
        data: updatedRule,
      });
    } catch (error: any) {
      if (error.message === 'ModSecurity rule not found') {
        res.status(404).json({
          success: false,
          message: 'ModSecurity rule not found',
        });
        return;
      }

      // Handle validation errors (rule ID duplicates, nginx config errors)
      if (error.message.includes('Rule ID(s) already exist') ||
          error.message.includes('Nginx configuration test failed') ||
          error.message.includes('Nginx reload failed')) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      logger.error('Update ModSec rule error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }
  async removeRule(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await modSecService.removeRule(id);

      logger.info(`ModSecurity rule deleted`, {
        ruleId: id,
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Rule deleted successfully',
      });
    } catch (error: any) {
      if (error.message === 'ModSecurity rule not found') {
        res.status(404).json({
          success: false,
          message: 'ModSecurity rule not found',
        });
        return;
      }

      logger.error('Delete ModSec rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async getGlobalSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await modSecService.getGlobalSettings();

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      logger.error('Get global ModSec settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async setGlobalSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const { enabled } = req.body;

      const dto: SetGlobalModSecDto = { enabled };

      const config = await modSecService.setGlobalSettings(dto);

      logger.info(`Global ModSecurity ${enabled ? 'enabled' : 'disabled'}`, {
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        message: `ModSecurity globally ${enabled ? 'enabled' : 'disabled'}`,
        data: config,
      });
    } catch (error) {
      logger.error('Set global ModSec error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
  async resetConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await modSecService.resetConfig();

      logger.info('ModSecurity configuration reinitialized', {
        userId: req.user?.userId,
        success: result.success,
      });

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      logger.error('Reinitialize ModSec config error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}

export const modSecController = new ModSecController();
