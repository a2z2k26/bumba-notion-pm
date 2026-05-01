# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in `bumba-notion-pm`, please report it privately rather than filing a public GitHub issue.

**How to report:**

- Use [GitHub Security Advisories](https://github.com/a2z2k26/bumba-notion-pm/security/advisories/new) (preferred)

Please include:

- A clear description of the issue
- Steps to reproduce
- Affected versions, if known
- Any potential impact assessment

We will acknowledge receipt within 72 hours and provide a more detailed response within 7 days.

## Supported versions

The latest minor release receives security fixes. Older releases are best-effort.

## Disclosure policy

We follow coordinated disclosure: we'll work with you on a fix, agree on a public disclosure date, and credit you in the changelog and release notes if you'd like.

## Scope

In scope:
- Vulnerabilities in this library's code
- Issues that could leak credentials, allow request forgery, or escalate privileges

Out of scope:
- Vulnerabilities in upstream dependencies (please report those upstream)
- Vulnerabilities in the Notion API or GitHub API themselves
- Issues that require an attacker to already control the user's machine or environment
