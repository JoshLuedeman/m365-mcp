# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

Older versions receive no security patches. Update to the latest release before reporting.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues through one of these channels:

- **Email**: security@m365-mcp (PGP not yet published; include "SECURITY" in the subject line)
- **GitHub private advisory**: [Open a private security advisory](https://github.com/joshluedeman/m365-mcp/security/advisories/new) — this is the preferred channel

### Response SLA

| Milestone | Target |
| --------- | ------ |
| Acknowledgement | 72 hours |
| Triage and severity assessment | 5 business days |
| Patch for critical issues | 14 days from acknowledgement |
| Patch for high/medium issues | 30 days from acknowledgement |

You will receive updates as the issue progresses. If you do not hear back within 72 hours, follow up via GitHub private advisory.

## Scope

### In scope

- **Token cache file permissions**: The token cache at `~/.config/m365-mcp/token-cache.json` is written with `0o600` (owner read/write only) on every write and explicitly re-`chmod`'d to enforce this even if the file already existed. Any code path where this is not enforced — for example, if the cache directory is created with world-readable permissions or if an error path bypasses the `chmod` call — is in scope.
- **Authentication flow issues**: Vulnerabilities in the MSAL device code flow that could allow token theft or session hijacking.
- **Microsoft Graph credential exposure**: Any path where access tokens, refresh tokens, or client secrets could be written to logs, stdout, or error messages surfaced to the MCP client.
- **MCP input validation bypasses**: Inputs to tool handlers that bypass Zod schema validation and reach the Graph API or file system in an unsafe way (e.g., path traversal, injection into Graph filter strings).

### Out of scope

- Microsoft Azure AD infrastructure, the Microsoft identity platform, or Graph API service availability — report those directly to Microsoft (https://msrc.microsoft.com).
- Issues that require physical access to the user's device or OS-level root/admin privileges.
- Social engineering or phishing attacks not specific to this codebase.
- Findings from automated scanners without a demonstrated impact.

## Disclosure Policy

Once a patch is released, reporters are credited in the CHANGELOG unless they request anonymity. There is no bug bounty program at this time.
