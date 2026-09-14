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
                if (!vscode.workspace.isTrusted) return [];
                const folder = vscode.workspace.getWorkspaceFolder(document.uri);
                if (!folder) return [];
                let root = path.dirname(document.uri.fsPath);
                let script;
                while (root.startsWith(folder.uri.fsPath)) {
                    const candidate = path.join(root, "tools", "formatting", "format.mjs");
                    if (fs.existsSync(candidate)) { script = candidate; break; }
                    const parent = path.dirname(root);
                    if (parent === root) break;
                    root = parent;
                }
                if (!script) throw new Error("Run the repository formatting setup first.");
                const source = document.getText();
                const version = document.version;
                try {
                    const formatted = await new Promise((resolve, reject) => {
                        const child = spawn("node", [script, "--stdin-filepath", document.uri.fsPath], {
                            cwd: root, shell: false,
                        });
                        let stdout = "", stderr = "";
                        const timer = setTimeout(() => { child.kill(); reject(new Error("Formatting timed out.")); }, 45000);
                        const subscription = cancellation.onCancellationRequested(() => child.kill());
                        child.stdout.on("data", data => { stdout += data; });
                        child.stderr.on("data", data => { stderr += data; });
                        child.on("error", reject);
                        child.on("close", code => {
                            clearTimeout(timer);
                            subscription.dispose();
                            if (code === 0) resolve(stdout);
                            else reject(new Error(stderr || "Formatter stopped. See WhereHouse Formatting output."));
                        });
                        child.stdin.on("error", () => {});
                        child.stdin.end(source);
                    });
                    if (cancellation.isCancellationRequested || document.version !== version || source === formatted) return [];
                    return [vscode.TextEdit.replace(new vscode.Range(document.positionAt(0), document.positionAt(source.length)), formatted)];
                } catch (error) {
                    if (!cancellation.isCancellationRequested) output.appendLine(error.message);
                    throw error;
                }
            },
        },
    ));
};
