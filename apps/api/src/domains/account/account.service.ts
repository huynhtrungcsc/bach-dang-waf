import { hashPassword, comparePassword } from '../../utils/password';
import logger from '../../utils/logger';
import { AccountRepository } from './account.repository';
import { TwoFactorService } from './services/two-factor.service';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  Enable2FADto,
} from './dto';
import {
  ProfileData,
  UpdatedProfileData,
  TwoFactorSetupData,
  TwoFactorStatusData,
  ActivityLogData,
  RequestMetadata,
  SessionData,
} from './account.types';
import {
  UnauthorizedException,
  NotFoundException,
  DuplicateException,
  RequestException,
} from '../../shared/errors/app-error';
export class AccountService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly twoFactorService: TwoFactorService
  ) {}
  async getProfile(userId: string): Promise<ProfileData> {
    const user = await this.accountRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      timezone: user.timezone,
      language: user.language,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactor?.enabled || false,
    };
  }
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    metadata: RequestMetadata
  ): Promise<UpdatedProfileData> {
    const { fullName, email, phone, timezone, language } = dto;

    // Check if email already exists (if changing)
    if (email) {
      const existingUser = await this.accountRepository.findUserByEmail(email, userId);

      if (existingUser) {
        throw new DuplicateException('Email already in use');
      }
    }

    // Update user
    const updatedUser = await this.accountRepository.editUser(userId, {
      ...(fullName && { fullName }),
      ...(email && { email }),
      ...(phone !== undefined && { phone }),
      ...(timezone && { timezone }),
      ...(language && { language }),
    });

    // Log activity
    await this.accountRepository.createActivityLog(
      userId,
      'Updated profile information',
      'user_action',
      metadata,
      true
    );

    logger.info(`User ${userId} updated profile`);

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      phone: updatedUser.phone,
      timezone: updatedUser.timezone,
      language: updatedUser.language,
    };
  }
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    metadata: RequestMetadata
  ): Promise<void> {
    const { currentPassword, newPassword } = dto;

    const user = await this.accountRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isPasswordValid) {
      // Log failed attempt
      await this.accountRepository.createActivityLog(
        userId,
        'Failed password change attempt',
        'security',
        metadata,
        false,
        'Invalid current password'
      );

      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await this.accountRepository.updatePassword(userId, hashedPassword);

    // Revoke all refresh tokens
    await this.accountRepository.revokeAllRefreshTokens(userId);

    // Log successful password change
    await this.accountRepository.createActivityLog(
      userId,
      'Changed account password',
      'security',
      metadata,
      true
    );

    logger.info(`User ${userId} changed password`);
  }
  async get2FAStatus(userId: string): Promise<TwoFactorStatusData> {
    const twoFactor = await this.accountRepository.findTwoFactorAuth(userId);

    return {
      enabled: twoFactor?.enabled || false,
      method: twoFactor?.method || 'totp',
    };
  }
  async setup2FA(userId: string, username: string): Promise<TwoFactorSetupData> {
    // Generate secret
    const { secret, otpauth_url } = this.twoFactorService.generate2FASecret(username);
    const qrCode = await this.twoFactorService.generateQRCode(otpauth_url);

    // Generate backup codes
    const backupCodes = this.twoFactorService.generateBackupCodes(5);

    // Save to database (not enabled yet)
    await this.accountRepository.upsertTwoFactorAuth(userId, {
      enabled: false,
      secret,
      backupCodes,
    });

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }
  async enable2FA(
    userId: string,
    dto: Enable2FADto,
    metadata: RequestMetadata
  ): Promise<void> {
    const { token } = dto;

    const twoFactor = await this.accountRepository.findTwoFactorAuth(userId);

    if (!twoFactor || !twoFactor.secret) {
      throw new RequestException('Please setup 2FA first');
    }

    // Verify token
    const isValid = this.twoFactorService.verify2FAToken(token, twoFactor.secret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    // Enable 2FA
    await this.accountRepository.updateTwoFactorAuthStatus(userId, true);

    // Log activity
    await this.accountRepository.createActivityLog(
      userId,
      'Enabled 2FA authentication',
      'security',
      metadata,
      true
    );

    logger.info(`User ${userId} enabled 2FA`);
  }
  async disable2FA(userId: string, metadata: RequestMetadata): Promise<void> {
    await this.accountRepository.updateTwoFactorAuthStatus(userId, false);

    // Log activity
    await this.accountRepository.createActivityLog(
      userId,
      'Disabled 2FA authentication',
      'security',
      metadata,
      true
    );

    logger.info(`User ${userId} disabled 2FA`);
  }
  async getActivityLogs(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ActivityLogData> {
    const skip = (page - 1) * limit;

    const [logs, total] = await this.accountRepository.getActivityLogs(userId, skip, limit);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  async getSessions(userId: string): Promise<SessionData[]> {
    return this.accountRepository.getActiveSessions(userId);
  }
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.accountRepository.revokeSession(userId, sessionId);
  }
}
