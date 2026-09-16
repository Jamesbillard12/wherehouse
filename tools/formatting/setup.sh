#!/usr/bin/env bash
set -euo pipefail
formatting_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
npm ci --prefix "$formatting_dir" --ignore-scripts --no-audit --no-fund
uv sync --project "$formatting_dir" --locked
dotnet build "$formatting_dir/csharp/WhereHouse.Formatter.csproj" --configuration Release -p:RestoreLockedMode=true --disable-build-servers
(cd "$formatting_dir/vscode" && npm exec --yes --package=@vscode/vsce@3.6.0 -- vsce package --no-dependencies --allow-missing-repository --skip-license --out "$formatting_dir/vertical-format.vsix")
code --install-extension "$formatting_dir/vertical-format.vsix" --force
node "$formatting_dir/configure-editor.mjs"
