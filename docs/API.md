# Bach Dang WAF — REST API Reference

Base URL: `/api`

All endpoints (except `/auth/login`, `/auth/refresh`, `/api/health`) require a `Bearer` token in the `Authorization` header.

---

## Authentication

### POST `/auth/login`
Authenticate with username + password. Returns access and refresh tokens.

**Body**
```json
{ "username": "admin", "password": "secret" }
```
**Response 200**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "requirePasswordChange": false,
    "require2FA": false,
    "tempToken": null
  }
}
```

### POST `/auth/verify-2fa`
Complete 2FA challenge after login.

**Body** `{ "token": "123456", "tempToken": "<temp>" }`

### POST `/auth/refresh`
Exchange a refresh token for a new access token.

**Body** `{ "refreshToken": "<token>" }`

### POST `/auth/logout`
Invalidate the current session.

**Body** `{ "refreshToken": "<token>" }`

### POST `/auth/first-login`
Set a new password on first login.

**Body** `{ "tempToken": "<token>", "newPassword": "new-pass" }`

---

## Account

### GET `/account/profile`
Returns the authenticated user's profile.

### PUT `/account/profile`
Update display name, avatar, phone, timezone, language.

### PUT `/account/password`
Change password.

**Body** `{ "currentPassword": "old", "newPassword": "new" }`

### GET `/account/sessions`
List active sessions.

### DELETE `/account/sessions/:sessionId`
Revoke a specific session.

### GET `/account/2fa/status`
Return 2FA status for the current user.

### POST `/account/2fa/enable`
Generate TOTP secret + QR code URI.

**Body** `{ "password": "current-password" }`

### POST `/account/2fa/verify`
Confirm the TOTP code and activate 2FA.

**Body** `{ "token": "123456" }`

### POST `/account/2fa/disable`
Disable 2FA.

**Body** `{ "password": "current-password", "token": "123456" }`

### GET `/account/activity`
Paginated activity log for the current user.

---

## Users

Requires `admin` role unless noted.

### GET `/users`
List all users with optional filters.

**Query** `?role=admin&status=active&page=1&limit=20`

### POST `/users`
Create a user.

**Body**
```json
{
  "username": "jdoe",
  "email": "jdoe@example.com",
  "fullName": "John Doe",
  "password": "initial",
  "role": "moderator",
  "status": "active"
}
```

### GET `/users/:id`
Fetch a single user.

### PUT `/users/:id`
Update user details.

### DELETE `/users/:id`
Deactivate or delete a user.

### POST `/users/:id/reset-password`
Admin reset of a user's password.

### POST `/users/:id/toggle-status`
Toggle active/inactive.

---

## Domains (Reverse Proxy)

### GET `/domains`
List all proxied domains.

### POST `/domains`
Register a new domain.

**Body (minimal)**
```json
{
  "name": "app.example.com",
  "upstreams": [
    { "host": "10.0.0.10", "port": 8080, "protocol": "http", "weight": 1 }
  ],
  "sslEnabled": false,
  "modsecEnabled": false
}
```

### GET `/domains/:id`
Get domain details including upstream list.

### PUT `/domains/:id`
Update domain configuration.

### DELETE `/domains/:id`
Remove a domain and its Nginx config.

### POST `/domains/:id/ssl`
Attach or update an SSL certificate for this domain.

### DELETE `/domains/:id/ssl`
Remove SSL from this domain.

### POST `/domains/:id/reload`
Re-generate the Nginx config and reload Nginx for this domain.

### GET `/domains/:id/upstreams`
List upstreams for a domain.

### POST `/domains/:id/upstreams`
Add an upstream to a domain.

### PUT `/domains/:id/upstreams/:upstreamId`
Update an upstream.

### DELETE `/domains/:id/upstreams/:upstreamId`
Remove an upstream.

---

## SSL Certificates

### GET `/ssl`
List all certificates.

**Query** `?expiring=true` — only certificates expiring within 30 days.

### POST `/ssl`
Upload or paste a certificate.

**Body**
```json
{
  "commonName": "app.example.com",
  "certificate": "-----BEGIN CERTIFICATE-----\n...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
  "chain": "-----BEGIN CERTIFICATE-----\n...",
  "autoRenew": false
}
```

### GET `/ssl/:id`
Get certificate details (sans private key).

### PUT `/ssl/:id`
Replace a certificate.

### DELETE `/ssl/:id`
Delete a certificate.

### GET `/ssl/stats`
Aggregated certificate health stats.

---

## ModSecurity

### GET `/modsec/rules`
List all CRS rule files.

### PUT `/modsec/rules/:id`
Enable or disable a CRS rule.

**Body** `{ "enabled": true }`

### GET `/modsec/custom-rules`
List custom ModSecurity rules.

### POST `/modsec/custom-rules`
Create a custom rule.

**Body**
```json
{
  "name": "Block scanner",
  "category": "custom",
  "ruleContent": "SecRule REQUEST_HEADERS:User-Agent \"@rx nikto\" \"id:10001,phase:1,deny,status:403\""
}
```

### GET `/modsec/custom-rules/:id`
Get a custom rule.

### PUT `/modsec/custom-rules/:id`
Update a custom rule.

### DELETE `/modsec/custom-rules/:id`
Delete a custom rule.

### POST `/modsec/custom-rules/:id/toggle`
Toggle a custom rule on/off.

### GET `/modsec/config`
Get current ModSecurity global config (audit log path, engine mode, etc.).

### PUT `/modsec/config`
Update global ModSecurity config.

---

## Access Control Lists (ACL)

### GET `/acl`
List all ACL rules.

### POST `/acl`
Create an ACL rule.

**Body**
```json
{
  "name": "Office subnet",
  "type": "ip_whitelist",
  "value": "192.168.1.0/24",
  "action": "allow",
  "priority": 10,
  "enabled": true
}
```

### GET `/acl/:id`
Get a single ACL rule.

### PUT `/acl/:id`
Update an ACL rule.

### DELETE `/acl/:id`
Delete an ACL rule.

### GET `/acl/preview-config`
Return the generated Nginx ACL config block (read-only preview).

---

## IP Access Lists

Scoped access lists for individual domains.

### GET `/access-lists`
List all IP access list entries.

### POST `/access-lists`
Add an entry.

**Body** `{ "ip": "203.0.113.42", "type": "blacklist", "note": "Spam source" }`

### DELETE `/access-lists/:id`
Remove an entry.

### DELETE `/access-lists`
Bulk delete. **Body** `{ "ids": ["id1", "id2"] }`

---

## Logs

### GET `/logs`
Paginated WAF/Nginx access and security logs.

**Query** `?page=1&limit=50&severity=high&ip=1.2.3.4&domain=app.example.com&from=2026-01-01&to=2026-01-31`

### GET `/logs/:id`
Full detail for a single log entry.

### GET `/logs/geo-stats`
Aggregated geographic stats (requests by country).

### GET `/logs/attack-stats`
Aggregated attack type stats.

---

## Alerts

### GET `/alerts/rules`
List alert rules.

### POST `/alerts/rules`
Create an alert rule.

**Body**
```json
{
  "name": "High error rate",
  "metric": "error_rate",
  "operator": "gt",
  "threshold": 10,
  "checkInterval": 300,
  "severity": "warning",
  "enabled": true,
  "channelIds": ["ch_abc"]
}
```

### GET `/alerts/rules/:id`
Get an alert rule.

### PUT `/alerts/rules/:id`
Update an alert rule.

### DELETE `/alerts/rules/:id`
Delete an alert rule.

### GET `/alerts/channels`
List notification channels.

### POST `/alerts/channels`
Create a notification channel.

**Body**
```json
{
  "name": "Ops Slack",
  "type": "webhook",
  "config": { "url": "https://hooks.slack.com/..." }
}
```

### DELETE `/alerts/channels/:id`
Delete a notification channel.

---

## Performance Metrics

### GET `/performance/metrics`
Paginated performance metrics.

**Query** `?domain=app.example.com&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z`

### GET `/performance/summary`
Aggregated summary (p50/p95 response time, RPS, error rate) for the given window.

### DELETE `/performance/cleanup`
Delete metrics older than a retention threshold.

---

## Backup

### GET `/backup/files`
List backup archives.

### POST `/backup/files`
Trigger an on-demand backup.

**Body** `{ "note": "pre-deploy snapshot" }`

### GET `/backup/files/:id/download`
Download a backup archive.

### DELETE `/backup/files/:id`
Delete a backup archive.

### POST `/backup/files/:id/restore`
Restore a backup.

**Body** `{ "confirm": true }`

### GET `/backup/schedules`
List backup schedules.

### POST `/backup/schedules`
Create a schedule.

**Body** `{ "name": "Daily 2am", "cronExpr": "0 2 * * *", "retainCount": 7, "enabled": true }`

### PUT `/backup/schedules/:id`
Update a schedule.

### DELETE `/backup/schedules/:id`
Delete a schedule.

---

## Network Load Balancer (NLB)

### GET `/nlb`
List all NLB instances.

### POST `/nlb`
Create an NLB.

**Body**
```json
{
  "name": "edge-lb",
  "listenPort": 443,
  "protocol": "tcp",
  "algorithm": "round_robin",
  "upstreams": [
    { "host": "10.0.0.10", "port": 443, "weight": 1 }
  ]
}
```

### GET `/nlb/:id`
Get NLB details.

### PUT `/nlb/:id`
Update NLB.

### DELETE `/nlb/:id`
Delete NLB.

### POST `/nlb/:id/toggle`
Enable or disable an NLB.

---

## Cluster (Replica Nodes)

Multi-node replication: a **primary** node pushes its config to one or more **replica** nodes.

### GET `/replica/nodes`
List all registered replica nodes.

### POST `/replica/nodes`
Register a new replica node. Returns a one-time API key.

**Body**
```json
{ "name": "replica-sgp-01", "host": "10.1.0.20", "port": 3001, "syncInterval": 60 }
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": "cuid...",
    "name": "replica-sgp-01",
    "apiKey": "waf_rk_...",
    "status": "offline"
  },
  "message": "Store the API key — it will not be shown again."
}
```

### GET `/replica/nodes/:id`
Get node details and recent sync logs.

### PUT `/replica/nodes/:id`
Update node settings.

### DELETE `/replica/nodes/:id`
Deregister a replica node.

### POST `/replica/nodes/:id/sync`
Push current config to a specific replica.

**Body** `{ "force": false }`

### POST `/replica/nodes/sync-all`
Push config to all enabled replicas.

### GET `/replica/nodes/:id/status`
Current status of a replica node.

### GET `/replica/nodes/:id/sync-history`
Sync log history for a replica.

**Query** `?limit=50`

### POST `/replica/nodes/:id/regenerate-key`
Rotate the API key for a replica node.

---

### Node-Sync (Replica → Primary)

These endpoints are called **by** replica nodes, authenticated via `X-Replica-Api-Key`.

#### GET `/node-sync/config`
Replica pulls the current config export from the primary.

#### POST `/node-sync/health`
Replica heartbeat — updates `lastSeen` and `status` on the primary.

**Body** `{ "nodeId": "...", "status": "online" }`

---

## System

### GET `/system/info`
WAF version, Nginx version, ModSecurity status, uptime.

### GET `/system/stats`
Real-time stats: active domains, active rules, blocked requests today, CPU/memory/disk.

### GET `/system/health`
Simple liveness probe — no auth required.

### POST `/system/reload`
Reload Nginx configuration.

### GET `/system/config`
Get system-level settings (node mode, sync settings).

### PUT `/system/config`
Update system-level settings.

---

## Dashboard

### GET `/dashboard/summary`
Aggregated summary card data: domains, rules, blocked today, cert health.

### GET `/dashboard/traffic`
Hourly request/block/error counts for the last 24 h.

### GET `/dashboard/attack-map`
Geographic breakdown of the last 1000 blocked requests (country code + count).

### GET `/dashboard/top-rules`
Top 10 triggered ModSecurity rules (last 7 days).

---

## Response Format

All endpoints return JSON in the following envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message",
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Error responses:

```json
{
  "success": false,
  "message": "Short error description",
  "errors": [
    { "field": "username", "message": "Username already taken" }
  ]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200  | OK |
| 201  | Created |
| 400  | Validation error (`RequestException`) |
| 401  | Missing or invalid token (`UnauthorizedException`) |
| 403  | Insufficient permissions (`ForbiddenException`) |
| 404  | Resource not found (`NotFoundException`) |
| 409  | Duplicate resource (`DuplicateException`) |
| 500  | Internal server error (`WafException`) |

---

## Authentication Flow

```
POST /auth/login
  → { accessToken, refreshToken }

Authorization: Bearer <accessToken>       (expires in 15 min by default)

POST /auth/refresh  { refreshToken }
  → { accessToken, refreshToken }         (rotate refresh token)

POST /auth/logout   { refreshToken }
  → 200 OK
```

Access tokens are short-lived JWTs. Refresh tokens are stored server-side and can be revoked individually via `DELETE /account/sessions/:sessionId`.
