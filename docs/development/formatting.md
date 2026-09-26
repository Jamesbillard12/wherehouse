# Source formatting

The repository-owned **WhereHouse Vertical Formatting** VS Code extension applies
the same layout to Python, JavaScript/TypeScript (including JSX/TSX), and C#:

- Four spaces and LF line endings.
- Nonempty function parameter and call argument lists expand, even for short calls.
- Object initializer / dictionary properties each get their own line.
- Empty calls stay compact. Language-specific syntax remains language-specific.

For example, `Add(a, b)` becomes:

```csharp
Add(
    a,
    b
)
```

## Install and use

Requirements: Node.js 22.13+, npm, Python 3.13+, uv, .NET 10 SDK, and the VS Code
`code` command on PATH. Open the repository root in VS Code, then run:

```sh
bash tools/formatting/setup.sh
```

This restores locked dependencies, builds the C# adapter, installs a local VSIX,
and sets the formatter plus format-on-save for the six language modes. It preserves
unrelated workspace settings and comments. `.vscode/settings.json` is local and
gitignored; the setup command recreates those preferences on a new checkout.

Use **Format Document**, or **Option + Command + L** with the installed WebStorm
keymap. Saving also formats. Other installed formatters remain available, but do
not select CSharpier/Prettier/Black directly for these files: they do not enforce
this project's always-multiline layout. Reload VS Code if it has not discovered
the local extension after installation. The extension only runs in trusted workspaces.

From the repository root, the same formatter works without VS Code:

```sh
node tools/formatting/format.mjs --write path/to/file.cs path/to/file.py path/to/file.ts
node tools/formatting/format.mjs --check path/to/file.cs
npm test --prefix tools/formatting
```

Only explicitly named files are changed; installing the tooling does not reformat
the repository. Errors leave the editor buffer untouched. See **Output → WhereHouse
Formatting** for diagnostics. Unsaved edits are formatted directly from the buffer,
and results are discarded if the document changes while formatting is running.

## Implementation and maintenance

This is custom formatting tooling, rather than an option in CSharpier. Python uses
LibCST to retain comments and add trailing commas, Black for baseline layout, and
a final lambda layout pass. It compares Python ASTs before returning output.
JavaScript/TypeScript uses Prettier followed by ESLint Stylistic and a whitespace-only
rule for declaration parameters and commented property lists. C# uses Roslyn syntax
nodes, token trivia, and its whitespace formatter; a token-preservation check refuses
unsafe output. Single-parameter lambdas gain parentheses so they can wrap consistently.

Python AST equivalence and C# token checks are safeguards, not a proof covering all
language features. Regression tests cover short and nested lists, comments, literals,
async code, repeated formatting, and invalid syntax. Add a fixture before changing a
rule. C# preprocessor-disabled regions are preserved, not rewritten, and unsupported
or incomplete syntax can cause formatting to decline an edit.

Dependency versions are pinned in `tools/formatting/package-lock.json`, `uv.lock`,
and `csharp/packages.lock.json`. These dependencies are isolated from application
runtime dependencies. Re-run setup after changing the adapter or extension.
