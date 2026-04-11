# Security Policy

## Supported Versions

| Version | Status |
|---------|--------|
| 1.x (latest) | Active support |
| < 1.0 | End of life |

---

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Report using [GitHub Security Advisories](https://github.com/huynhtrungcsc/bach-dang-waf/security/advisories/new) or contact the maintainer via GitHub private messaging.

**Include in your report:**

- Vulnerability description and potential impact
- Steps to reproduce
- Affected component and version
- Proof-of-concept code (if applicable)
- Suggested fix or mitigation (optional)

**Response timeline:**

- Acknowledgement within 48 hours
- Assessment and timeline within 7 days
- Coordinated disclosure date agreed before any public release

---

## Deployment Security Checklist

### Credentials

- Replace all default passwords (`admin/admin123`, `operator/operator123`, `viewer/viewer123`) immediately after first login
- Enable TOTP two-factor authentication for all admin accounts
- Rotate JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) and `SESSION_SECRET` — use `openssl rand -hex 48`
- Set `BCRYPT_ROUNDS` to 12 or higher in production

### Network

- Run the management console (port 8080) behind a reverse proxy
- Restrict console access to trusted IP ranges using firewall rules
- Always use HTTPS in production — the ACME integration supports Let's Encrypt
- Do not expose `PORT` (3001) or `DB_PORT` (5432) to the internet

### Database

- Use a dedicated PostgreSQL user with least-privilege access (`GRANT` only what is needed)
- Enable PostgreSQL SSL for connections in production environments
- Schedule regular database backups using the built-in backup module

### Updates

- Follow [GitHub releases](https://github.com/huynhtrungcsc/bach-dang-waf/releases) for security patches
- Run `scripts/update.sh` to apply updates with zero downtime on bare-metal deployments

---

## Scope

**In scope:**

- Authentication and authorization bypasses
- SQL injection and other injection attacks
- Cross-site scripting (XSS)
- Remote code execution
- Sensitive data exposure
- Insecure direct object references

**Out of scope:**

- Vulnerabilities in third-party packages (report to those projects directly)
- Denial-of-service without demonstrated application-level impact
- Social engineering
- Issues requiring physical server access

---

## Disclosure Policy

This project follows coordinated responsible disclosure. Researchers acting in good faith will not face legal action, and will be credited in release notes upon request.
