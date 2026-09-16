const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

exports.activate = (context) => {
    const output = vscode.window.createOutputChannel("WhereHouse Formatting");
    context.subscriptions.push(output);
    const languages = ["csharp", "python", "javascript", "javascriptreact", "typescript", "typescriptreact"];
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(
        languages.map(language => ({ language, scheme: "file" })),
        {
            async provideDocumentFormattingEdits(document, _options, cancellation) {
                if (!vscode.workspace.isTrusted || cancellation.isCancellationRequested) return [];
                const folder = vscode.workspace.getWorkspaceFolder(document.uri);
                if (!folder) return [];
                let root = path.dirname(document.uri.fsPath);
                let script;
                while (true) {
                    const candidate = path.join(root, "tools", "formatting", "format.mjs");
                    if (fs.existsSync(candidate)) { script = candidate; break; }
                    if (root === folder.uri.fsPath || path.dirname(root) === root) break;
                    root = path.dirname(root);
                }
                if (!script) throw new Error("Open the WhereHouse repository root and run tools/formatting/setup.sh.");
                const source = document.getText();
                const version = document.version;
                try {
                    const formatted = await new Promise((resolve, reject) => {
                        const child = spawn("node", [script, "--stdin-filepath", document.uri.fsPath], { cwd: root, shell: false });
                        let stdout = "", stderr = "", settled = false;
                        const finish = (error) => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timer);
                            subscription.dispose();
                            if (error) reject(error); else resolve(stdout);
                        };
                        const timer = setTimeout(() => { child.kill(); finish(new Error("Formatting timed out.")); }, 45000);
                        const subscription = cancellation.onCancellationRequested(() => child.kill());
                        child.stdout.on("data", data => {
                            stdout += data;
                            if (stdout.length > 16 * 1024 * 1024) { child.kill(); finish(new Error("Formatter output exceeds 16 MB.")); }
                        });
                        child.stderr.on("data", data => { stderr = (stderr + data).slice(-16000); });
                        child.on("error", finish);
                        child.on("close", code => finish(code === 0 ? null : new Error(stderr || "Formatter stopped.")));
                        child.stdin.on("error", () => {});
                        child.stdin.end(source);
                    });
                    if (cancellation.isCancellationRequested || document.version !== version || source === formatted) return [];
                    return [vscode.TextEdit.replace(new vscode.Range(document.positionAt(0), document.positionAt(source.length)), formatted)];
                } catch (error) {
                    if (cancellation.isCancellationRequested) return [];
                    output.appendLine(error.message);
                    throw error;
                }
            },
        },
    ));
};
