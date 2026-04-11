import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { modSecController } from './modsec.controller';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// CRS Rules (OWASP Core Rule Set)
router.get('/crs/rules', (req, res) => modSecController.listCrsRules(req, res));
router.patch('/crs/rules/:ruleFile/toggle', authorize('admin', 'moderator'), (req, res) =>
  modSecController.switchCrsRule(req, res)
);

// Custom Rules
router.get('/rules', (req, res) => modSecController.listCustomRules(req, res));

// Get single rule
router.get('/rules/:id', (req, res) => modSecController.findCustomRule(req, res));

// Toggle rule enabled/disabled
router.patch('/rules/:id/toggle', authorize('admin', 'moderator'), (req, res) =>
  modSecController.switchCustomRule(req, res)
);

// Add custom rule
router.post(
  '/rules',
  authorize('admin', 'moderator'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('ruleContent').notEmpty().withMessage('Rule content is required'),
    body('description').optional().isString(),
    body('domainId').optional().isString(),
    body('enabled').optional().isBoolean(),
  ],
  (req: AuthRequest, res: Response) => modSecController.addRule(req, res)
);

// Update rule
router.put(
  '/rules/:id',
  authorize('admin', 'moderator'),
  [
    body('name').optional().isString(),
    body('category').optional().isString(),
    body('ruleContent').optional().isString(),
    body('description').optional().isString(),
    body('enabled').optional().isBoolean(),
  ],
  (req: AuthRequest, res: Response) => modSecController.editRule(req, res)
);

// Delete rule
router.delete('/rules/:id', authorize('admin', 'moderator'), (req, res) =>
  modSecController.removeRule(req, res)
);

// Get global ModSecurity settings
router.get('/global', (req, res) => modSecController.getGlobalSettings(req, res));

// Set global ModSecurity enabled/disabled
router.post(
  '/global',
  authorize('admin', 'moderator'),
  [body('enabled').isBoolean().withMessage('Enabled must be a boolean')],
  (req: AuthRequest, res: Response) => modSecController.setGlobalSettings(req, res)
);

// Reinitialize ModSecurity configuration
router.post('/reinitialize', authorize('admin'), (req: AuthRequest, res: Response) =>
  modSecController.resetConfig(req, res)
);

export default router;
