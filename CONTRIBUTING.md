# Contributing to Bach Dang WAF

Contributions of all types are welcome — bug fixes, features, documentation, and test coverage.

---

## Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/bach-dang-waf.git
   cd bach-dang-waf
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure your environment:
   ```bash
   cp .env.example .env
   # Edit .env — set DATABASE_URL and JWT secrets at minimum
   ```

4. Initialize the database:
   ```bash
   pnpm --filter @bach-dang-waf/api db:generate
   pnpm --filter @bach-dang-waf/api db:push
   pnpm --filter @bach-dang-waf/api db:seed
   ```

5. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

---

## Development Workflow

```bash
pnpm dev          # Start API + frontend in parallel
pnpm lint         # Run ESLint across all packages
pnpm typecheck    # TypeScript check (strict, no emit)
pnpm build        # Production build
```

Project structure:

```
apps/api/    Express backend (TypeScript, Prisma)
apps/web/    React frontend (TypeScript, Vite, TanStack)
packages/    Shared code (if any)
```

---

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `docs` | Documentation only |
| `style` | Formatting, whitespace |
| `perf` | Performance improvement |
| `test` | Tests |
| `chore` | Tooling, build, CI |
| `security` | Security fix or hardening |

Examples:
```
feat(domains): add upstream health check endpoint
fix(auth): handle expired refresh token edge case
security(acl): validate CIDR notation before regex match
```

---

## Pull Request Guidelines

- One logical change per PR — keep scope focused
- Update documentation when changing user-facing behavior
- Verify no regressions with `pnpm typecheck && pnpm lint` before submitting
- Link related issues with `Closes #NNN` in the PR description
- PR title must follow the same Conventional Commits format

---

## Reporting Issues

| Type | Where |
|------|-------|
| Bug | [Open an issue](https://github.com/huynhtrungcsc/bach-dang-waf/issues/new?labels=bug) |
| Feature request | [Open an issue](https://github.com/huynhtrungcsc/bach-dang-waf/issues/new?labels=enhancement) |
| Security vulnerability | See [SECURITY.md](SECURITY.md) — do not open a public issue |
| Question | [GitHub Discussions](https://github.com/huynhtrungcsc/bach-dang-waf/discussions) |

---

## Code Standards

- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`)
- No `any` types — use proper generics or unknown where needed
- Domain-based folder structure in the backend — add new features as a new domain under `apps/api/src/domains/`
- API endpoints follow REST conventions — use HTTP verbs correctly
- All user-facing strings are in English; Vietnamese comments in source code are acceptable
