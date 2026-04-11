export const PATHS = {
  NGINX: {
    SITES_AVAILABLE: '/etc/nginx/sites-available',
    SITES_ENABLED:   '/etc/nginx/sites-enabled',
    SSL_STORE:       process.env.SSL_STORE_DIR || '/etc/nginx/ssl',
    LOG_DIR:         '/var/log/nginx',
    ACCESS_LOG:      '/var/log/nginx/access.log',
    ERROR_LOG:       '/var/log/nginx/error.log',
    MODSEC_AUDIT:    '/var/log/modsec_audit.log',
  },
} as const;
