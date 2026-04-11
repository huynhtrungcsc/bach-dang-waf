import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { LoginDto, LogoutDto, RefreshTokenDto, Verify2FADto, FirstLoginPasswordDto } from './dto';
import { RequestMetadata, LoginFirstTimeResult, Login2FARequiredResult } from './auth.types';
import logger from '../../utils/logger';
import { WafException } from '../../shared/errors/app-error';
export class AuthController {
  private readonly authService: AuthService;

  constructor() {
    const authRepository = new AuthRepository();
    this.authService = new AuthService(authRepository);
  }
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const dto: LoginDto = req.body;

      // Extract request metadata
      const metadata: RequestMetadata = {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      // Call service
      const result = await this.authService.login(dto, metadata);

      // Check if password change is required (first login)
      if ('requirePasswordChange' in result && result.requirePasswordChange) {
        const firstLoginResult = result as LoginFirstTimeResult;
        res.json({
          success: true,
          message: 'Password change required',
          data: {
            requirePasswordChange: true,
            userId: firstLoginResult.userId,
            tempToken: firstLoginResult.tempToken,
            user: firstLoginResult.user,
          },
        });
        return;
      }

      // Check if 2FA is required
      if ('requires2FA' in result && result.requires2FA) {
        const twoFAResult = result as Login2FARequiredResult;
        res.json({
          success: true,
          message: '2FA verification required',
          data: {
            requires2FA: true,
            userId: twoFAResult.userId,
            user: twoFAResult.user,
          },
        });
        return;
      }

      // Return successful login response (LoginResult type)
      if ('accessToken' in result && 'refreshToken' in result) {
        res.json({
          success: true,
          message: 'Login successful',
          data: {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          },
        });
      }
    } catch (error) {
      this.handleError(error, res);
    }
  };
  verify2FA = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const dto: Verify2FADto = req.body;

      // Extract request metadata
      const metadata: RequestMetadata = {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      // Call service
      const result = await this.authService.verify2FA(dto, metadata);

      // Return successful login response
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: LogoutDto = req.body;

      // Extract user ID from request (if authenticated)
      const userId = (req as any).user?.userId;

      // Extract request metadata
      const metadata: RequestMetadata = {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      // Call service
      await this.authService.logout(dto, userId, metadata);

      // Return success response
      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
  refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const dto: RefreshTokenDto = req.body;

      // Call service
      const result = await this.authService.refreshAccessToken(dto);

      // Return success response
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
  changePasswordFirstLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          errors: errors.array(),
        });
        return;
      }

      const dto: FirstLoginPasswordDto = req.body;

      // Extract request metadata
      const metadata: RequestMetadata = {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      // Call service
      const result = await this.authService.changePasswordFirstLogin(dto, metadata);

      // Return success response with tokens
      res.json({
        success: true,
        message: 'Password changed successfully',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          require2FASetup: result.require2FASetup,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
  private handleError(error: unknown, res: Response): void {
    // Handle WafException instances
    if (error instanceof WafException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Handle unexpected errors
    logger.error('Unexpected error in AuthController:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}