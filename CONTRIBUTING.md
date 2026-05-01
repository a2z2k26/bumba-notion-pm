# Contributing to Bumba Notion PM

Thanks for your interest. This is a small library and contributions are welcome.

## Development setup

```bash
git clone https://github.com/a2z2k26/bumba-notion-pm.git
cd bumba-notion-pm
npm install
cp .env.example .env   # fill in your own NOTION_API_KEY
npm test
```

## Running examples against a real workspace

```bash
node examples/01-verify-connection.js
node examples/02-create-page.js
```

## Pull requests

- Branch from `main`
- Add or update tests for any behavior change
- Run `npm test` and make sure it's green
- Keep commits focused. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- Open the PR with a clear description of *what* changed and *why*

## Code style

- Node ≥ 14, no transpiler
- CommonJS (`require` / `module.exports`)
- 2-space indent, single quotes, trailing commas where Node accepts them
- Prefer small files (< 400 lines) and small functions (< 50 lines)
- Throw typed errors from `src/utils/errors.js` rather than plain `Error`

## Reporting bugs

Open a GitHub issue with:
- Node version
- Steps to reproduce
- What you expected vs. what happened
- Stack trace if available

## Security

If you find a security issue, please follow [`SECURITY.md`](./SECURITY.md) — do not file a public issue.
