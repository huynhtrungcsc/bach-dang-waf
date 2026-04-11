import { Router, Request, Response } from 'express';
import { domainsController } from './domains.controller';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { body } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation rules
const createDomainValidation = [
  body('name')
    .notEmpty()
    .withMessage('Domain name is required')
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/)
    .withMessage('Invalid domain name format'),
  body('upstreams')
    .isArray({ min: 1 })
    .withMessage('At least one upstream is required'),
  body('upstreams.*.host')
    .notEmpty()
    .withMessage('Upstream host is required'),
  body('upstreams.*.port')
    .isInt({ min: 1, max: 65535 })
    .withMessage('Upstream port must be between 1 and 65535'),
  body('autoCreateSSL')
    .optional()
    .isBoolean()
    .withMessage('autoCreateSSL must be a boolean'),
  body('sslEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  // Custom validation: if autoCreateSSL is true, sslEmail is required
  body('sslEmail').custom((value, { req }) => {
    if (req.body.autoCreateSSL === true && !value) {
      throw new Error('SSL email is required when auto-creating SSL certificate');
    }
    return true;
  }),
];

const updateDomainValidation = [
  body('name')
    .optional()
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/)
    .withMessage('Invalid domain name format'),
];
router.get('/', (req: AuthRequest, res: Response) => domainsController.listDomains(req, res));
router.get('/:id', (req: AuthRequest, res: Response) => domainsController.findDomain(req, res));
router.post(
  '/',
  authorize('admin', 'moderator'),
  createDomainValidation,
  (req: AuthRequest, res: Response) => domainsController.addDomain(req, res)
);
router.put(
  '/:id',
  authorize('admin', 'moderator'),
  updateDomainValidation,
  (req: AuthRequest, res: Response) => domainsController.editDomain(req, res)
);
router.delete('/:id', authorize('admin'), (req: AuthRequest, res: Response) =>
  domainsController.removeDomain(req, res)
);
router.post('/:id/toggle-ssl', authorize('admin', 'moderator'), (req: AuthRequest, res: Response) =>
  domainsController.switchSSL(req, res)
);
router.post('/nginx/reload', authorize('admin'), (req: AuthRequest, res: Response) =>
  domainsController.reloadProxy(req, res)
);

export default router;
