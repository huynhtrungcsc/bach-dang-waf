import fs from 'fs/promises';
import path from 'path';
import { execFileSync } from 'child_process';
import logger from '../../../utils/logger';
import { AccessListWithRelations } from '../access-lists.types';
export class NginxConfigService {
  private readonly configDir = '/etc/nginx/access-lists';
  private readonly htpasswdDir = '/etc/nginx/htpasswd';

  constructor() {
    this.ensureDirectories();
  }
  private async ensureDirectories() {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      await fs.mkdir(this.htpasswdDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create access lists directories', error);
    }
  }
  private generateIpWhitelistConfig(accessList: AccessListWithRelations): string {
    if (!accessList.allowedIps || accessList.allowedIps.length === 0) {
      return '# No IPs configured\ndeny all;';
    }

    const config: string[] = [];
    config.push(`# IP Whitelist: ${accessList.name}`);
    config.push(`# ${accessList.description || 'No description'}`);
    config.push('');

    // Add allow rules for each IP
    accessList.allowedIps.forEach((ip) => {
      config.push(`allow ${ip};`);
    });

    // Deny all other IPs
    config.push('deny all;');

    return config.join('\n');
  }
  private async generateBasicAuthConfig(
    accessList: AccessListWithRelations
  ): Promise<string> {
    const htpasswdFile = path.join(this.htpasswdDir, `${accessList.name}.htpasswd`);

    const config: string[] = [];
    config.push(`# HTTP Basic Auth: ${accessList.name}`);
    config.push(`# ${accessList.description || 'No description'}`);
    config.push('');
    config.push('auth_basic "Restricted Access";');
    config.push(`auth_basic_user_file ${htpasswdFile};`);

    return config.join('\n');
  }
  private async generateCombinedConfig(
    accessList: AccessListWithRelations
  ): Promise<string> {
    const ipConfig = this.generateIpWhitelistConfig(accessList);
    const authConfig = await this.generateBasicAuthConfig(accessList);

    const config: string[] = [];
    config.push(`# Combined Access List: ${accessList.name}`);
    config.push(`# ${accessList.description || 'No description'}`);
    config.push('');
    config.push('# IP Whitelist');
    config.push(ipConfig);
    config.push('');
    config.push('# HTTP Basic Authentication');
    config.push(authConfig);

    return config.join('\n');
  }
  private validateUsername(username: string): string {
    // Check for null bytes which can be used for command injection
    if (username.includes('\0')) {
      throw new Error('Username contains invalid null byte character');
    }
    
    // Username should only contain alphanumeric, dash, underscore, dot, and @
    const validUsernamePattern = /^[a-zA-Z0-9._@-]+$/;
    if (!validUsernamePattern.test(username)) {
      throw new Error('Username contains invalid characters. Only alphanumeric, dash, underscore, dot, and @ are allowed');
    }
    
    // Length check
    if (username.length === 0 || username.length > 255) {
      throw new Error('Username must be between 1 and 255 characters');
    }
    
    return username;
  }
  private escapePassword(password: string): string {
    // Check for null bytes
    if (password.includes('\0')) {
      throw new Error('Password contains invalid null byte character');
    }
    
    // Length check
    if (password.length === 0 || password.length > 255) {
      throw new Error('Password must be between 1 and 255 characters');
    }
    
    // Escape single quotes by replacing ' with '\''
    // This allows the password to be safely wrapped in single quotes
    return password.replace(/'/g, "'\\''");
  }
  private async generateHtpasswdFile(accessList: AccessListWithRelations): Promise<void> {
    if (!accessList.authUsers || accessList.authUsers.length === 0) {
      return;
    }

    const htpasswdFile = path.join(this.htpasswdDir, `${accessList.name}.htpasswd`);

    // Remove existing file first
    try {
      await fs.unlink(htpasswdFile);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.warn(`Failed to delete existing htpasswd file: ${error.message}`);
      }
    }

    // Use htpasswd tool to generate entries with proper apr1/MD5 hash format
    for (const user of accessList.authUsers) {
      try {
        // Validate username (strict) and escape password (allow all chars but escape properly)
        const safeUsername = this.validateUsername(user.username);
        const escapedPassword = this.escapePassword(user.passwordHash);
        
        // -b: batch mode (password on command line)
        // -B: use bcrypt (if you want bcrypt, but apr1 is more compatible)
        // -m: use MD5 (default, most compatible with Nginx)
        // -c: create new file (only for first user)
        const isFirstUser = accessList.authUsers.indexOf(user) === 0;

        // Use execFileSync with array args — no shell interpretation, immune to injection
        const args = ['-b', '-m'];
        if (isFirstUser) args.push('-c');
        args.push(htpasswdFile, safeUsername, escapedPassword);
        execFileSync('htpasswd', args, { stdio: 'pipe' });
      } catch (error: any) {
        logger.error(`Failed to add user ${user.username} to htpasswd: ${error.message}`);
        throw error;
      }
    }

    // Set proper permissions
    await fs.chmod(htpasswdFile, 0o644);
    logger.info(`Generated htpasswd file with ${accessList.authUsers.length} users: ${htpasswdFile}`);
  }
  async generateConfig(accessList: AccessListWithRelations): Promise<string> {
    try {
      let config = '';

      switch (accessList.type) {
        case 'ip_whitelist':
          config = this.generateIpWhitelistConfig(accessList);
          break;

        case 'http_basic_auth':
          await this.generateHtpasswdFile(accessList);
          config = await this.generateBasicAuthConfig(accessList);
          break;

        case 'combined':
          await this.generateHtpasswdFile(accessList);
          config = await this.generateCombinedConfig(accessList);
          break;

        default:
          throw new Error(`Unknown access list type: ${accessList.type}`);
      }

      const configFile = path.join(this.configDir, `${accessList.name}.conf`);
      await fs.writeFile(configFile, config, { mode: 0o644 });

      logger.info(`Generated access list config: ${configFile}`);
      return configFile;
    } catch (error) {
      logger.error('Failed to generate access list config', error);
      throw error;
    }
  }
  async deleteConfig(accessListName: string): Promise<void> {
    try {
      const configFile = path.join(this.configDir, `${accessListName}.conf`);
      const htpasswdFile = path.join(this.htpasswdDir, `${accessListName}.htpasswd`);

      // Delete config file
      try {
        await fs.unlink(configFile);
        logger.info(`Deleted access list config: ${configFile}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Delete htpasswd file
      try {
        await fs.unlink(htpasswdFile);
        logger.info(`Deleted htpasswd file: ${htpasswdFile}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      logger.error('Failed to delete access list config', error);
      throw error;
    }
  }
  getIncludePath(accessListName: string): string {
    return path.join(this.configDir, `${accessListName}.conf`);
  }
  async testConfig(): Promise<{ success: boolean; message: string }> {
    try {
      execFileSync('nginx', ['-t'], { stdio: 'pipe' });
      return {
        success: true,
        message: 'Nginx configuration is valid',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.stderr?.toString() || 'Nginx configuration test failed',
      };
    }
  }
  async reloadNginx(): Promise<{ success: boolean; message: string }> {
    try {
      // Test config first
      const testResult = await this.testConfig();
      if (!testResult.success) {
        return testResult;
      }

      execFileSync('nginx', ['-s', 'reload'], { stdio: 'pipe' });
      return {
        success: true,
        message: 'Nginx reloaded successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.stderr?.toString() || 'Failed to reload Nginx',
      };
    }
  }
}

export const nginxConfigService = new NginxConfigService();
