#!/usr/bin/env bash
set -euo pipefail

# Best-effort, non-fatal, idempotent installer for the GitHub Copilot CLI and the
# hve-core-all plugin from github.com/microsoft/hve-core.
#
# This script is shared by the Copilot cloud sandbox (copilot-setup-steps.yml) and
# the dev container (devcontainer.json). Every step degrades to a warning instead
# of aborting so the sandbox/dev container still starts even when a step fails
# (e.g. no network, or the Copilot CLI needs interactive authentication).

echo "==> Ensuring GitHub Copilot CLI is installed"
command -v copilot >/dev/null 2>&1 || npm install -g @github/copilot || echo "::warning::copilot CLI install failed"

echo "==> Adding hve-core plugin marketplace (microsoft/hve-core)"
copilot plugin marketplace add microsoft/hve-core || echo "::warning::marketplace add failed"

echo "==> Installing hve-core-all plugin"
copilot plugin install hve-core-all@hve-core || echo "::warning::hve-core-all install failed"

echo "==> Installed Copilot plugins:"
copilot plugin list || true
