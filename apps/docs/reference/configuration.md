# Configuration

This section covers the configuration options available in nginx waf.

## Environment Variables

nginx waf can be configured using environment variables. These can be set in a `.env` file or directly in the environment.

### Database Configuration

```bash
# Database connection
DATABASE_URL="postgresql://bach_dang_waf_user:bach_dang_waf_password@localhost:5432/bach_dang_waf_db?schema=public"

```

### Application Configuration

```bash
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# JWT Secret
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-secret-key


### Email Configuration

```bash
# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASSWORD=password
SMTP_FROM=noreply@example.com
```

