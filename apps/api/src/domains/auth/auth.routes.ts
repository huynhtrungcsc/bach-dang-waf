import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  loginValidation,
  verify2FAValidation,
  refreshTokenValidation,
  firstLoginPasswordValidation,
} from './dto';

const router = Router();
const authController = new AuthController();
router.post('/login', loginValidation, authController.login);
router.post('/verify-2fa', verify2FAValidation, authController.verify2FA);
router.post('/logout', authController.logout);
router.post('/refresh', refreshTokenValidation, authController.refreshAccessToken);
router.post('/first-login/change-password', firstLoginPasswordValidation, authController.changePasswordFirstLogin);

export default router;
