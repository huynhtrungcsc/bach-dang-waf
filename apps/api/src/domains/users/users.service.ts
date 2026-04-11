import { usersRepository } from './users.repository';
import { User, UserWithProfile, UserStatistics } from './users.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, SelfUpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { hashPassword, generateSecurePassword } from '../../utils/password';
import { RequestException, NotFoundException, DuplicateException } from '../../shared/errors/app-error';
import { UserStatus, UserRole } from '../../shared/types/common.types';
import prisma from '../../config/database';
import logger from '../../utils/logger';
export class UsersService {
  async listUsers(filters: UserQueryDto): Promise<User[]> {
    return usersRepository.listAll(filters);
  }
  async findUser(id: string, requestingUserId: string, requestingUserRole: UserRole): Promise<UserWithProfile> {
    // Check permissions: viewer can only view their own profile
    if (requestingUserRole === 'viewer' && requestingUserId !== id) {
      throw new RequestException('Insufficient permissions');
    }

    const user = await usersRepository.getById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
  async addUser(data: CreateUserDto, creatorId: string, creatorUsername: string, ip: string, userAgent: string): Promise<User> {
    // Check if username or email already exists
    const existingUser = await usersRepository.findByUsernameOrEmail(data.username, data.email);
    if (existingUser) {
      throw new DuplicateException(
        existingUser.username === data.username ? 'Username already exists' : 'Email already exists'
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await usersRepository.insert({
      ...data,
      password: hashedPassword,
    });

    // Log activity
    await this.logActivity(
      creatorId,
      `Created user: ${data.username}`,
      'user_action',
      ip,
      userAgent,
      { userId: user.id, role: user.role }
    );

    logger.info(`User created: ${data.username} by ${creatorUsername}`);

    return user;
  }
  async editUser(
    id: string,
    data: UpdateUserDto,
    updaterId: string,
    updaterUsername: string,
    updaterRole: UserRole,
    ip: string,
    userAgent: string
  ): Promise<User> {
    // Check if user exists
    const existingUser = await usersRepository.getById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Self update: Only allow updating own profile with limited fields
    const isSelfUpdate = updaterId === id;
    if (isSelfUpdate && updaterRole !== 'admin') {
      // Extract only allowed fields for self-update
      const allowedFields: SelfUpdateUserDto = {};
      if (data.fullName !== undefined) allowedFields.fullName = data.fullName;
      if (data.phone !== undefined) allowedFields.phone = data.phone;
      if (data.timezone !== undefined) allowedFields.timezone = data.timezone;
      if (data.language !== undefined) allowedFields.language = data.language;
      if (data.avatar !== undefined) allowedFields.avatar = data.avatar;

      const updatedUser = await usersRepository.patch(id, allowedFields);
      return updatedUser;
    }

    // Admin update: Can update all fields except password
    if (updaterRole !== 'admin') {
      throw new RequestException('Insufficient permissions');
    }

    // Check if username/email is being changed and already exists
    if (data.username && data.username !== existingUser.username) {
      const duplicateUsername = await usersRepository.getByUsername(data.username);
      if (duplicateUsername) {
        throw new DuplicateException('Username already exists');
      }
    }

    if (data.email && data.email !== existingUser.email) {
      const duplicateEmail = await usersRepository.findByEmail(data.email);
      if (duplicateEmail) {
        throw new DuplicateException('Email already exists');
      }
    }

    const updatedUser = await usersRepository.patch(id, data);

    // Log activity
    await this.logActivity(
      updaterId,
      `Updated user: ${updatedUser.username}`,
      'user_action',
      ip,
      userAgent,
      { userId: id, changes: Object.keys(data) }
    );

    logger.info(`User updated: ${updatedUser.username} by ${updaterUsername}`);

    return updatedUser;
  }
  async removeUser(
    id: string,
    deleterId: string,
    deleterUsername: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    // Prevent deleting self
    if (deleterId === id) {
      throw new RequestException('Cannot delete your own account');
    }

    // Check if user exists
    const user = await usersRepository.getById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete user
    await usersRepository.remove(id);

    // Log activity
    await this.logActivity(
      deleterId,
      `Deleted user: ${user.username}`,
      'user_action',
      ip,
      userAgent,
      { userId: id, username: user.username }
    );

    logger.info(`User deleted: ${user.username} by ${deleterUsername}`);
  }
  async setUserStatus(
    id: string,
    status: UserStatus,
    updaterId: string,
    updaterUsername: string,
    ip: string,
    userAgent: string
  ): Promise<User> {
    // Prevent changing own status
    if (updaterId === id) {
      throw new RequestException('Cannot change your own status');
    }

    // Check if user exists
    const user = await usersRepository.getById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldStatus = user.status;

    // Update status
    const updatedUser = await usersRepository.updateStatus(id, status);

    // Log activity
    await this.logActivity(
      updaterId,
      `Changed user status: ${user.username} to ${status}`,
      'user_action',
      ip,
      userAgent,
      { userId: id, oldStatus, newStatus: status }
    );

    logger.info(`User status changed: ${user.username} to ${status} by ${updaterUsername}`);

    return updatedUser;
  }
  async resetPassword(
    id: string,
    resetById: string,
    resetByUsername: string,
    ip: string,
    userAgent: string
  ): Promise<string> {
    // Check if user exists
    const user = await usersRepository.getById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate secure temporary password (16 characters with all required types)
    const tempPassword = generateSecurePassword(16);
    const hashedPassword = await hashPassword(tempPassword);

    // Update user password
    await usersRepository.updatePassword(id, hashedPassword);

    // Log activity
    await this.logActivity(
      resetById,
      `Reset password for user: ${user.username}`,
      'security',
      ip,
      userAgent,
      { userId: id, username: user.username }
    );

    logger.info(`Password reset for user: ${user.username} by ${resetByUsername}`);

    return tempPassword;
  }
  async getStats(): Promise<UserStatistics> {
    const [total, active, inactive, suspended, adminCount, moderatorCount, viewerCount, recentLogins] =
      await Promise.all([
        usersRepository.count(),
        usersRepository.countByStatus('active'),
        usersRepository.countByStatus('inactive'),
        usersRepository.countByStatus('suspended'),
        usersRepository.countByRole('admin'),
        usersRepository.countByRole('moderator'),
        usersRepository.countByRole('viewer'),
        usersRepository.countRecentLogins(),
      ]);

    return {
      total,
      active,
      inactive,
      suspended,
      byRole: {
        admin: adminCount,
        moderator: moderatorCount,
        viewer: viewerCount,
      },
      recentLogins,
    };
  }
  private async logActivity(
    userId: string,
    action: string,
    type: string,
    ip: string,
    userAgent: string,
    details?: any
  ): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action,
          type: type as any,
          ip,
          userAgent,
          success: true,
          details: details ? JSON.stringify(details) : undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to log activity:', error);
      // Don't throw error, just log it
    }
  }
}

// Export singleton instance
export const usersService = new UsersService();
