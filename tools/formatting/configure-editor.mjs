import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsonc from "jsonc-parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const directory = path.join(root, ".vscode");
const file = path.join(directory, "settings.json");
let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "{}\n";
const errors = [];
jsonc.parse(text, errors, { allowTrailingComma: true });
if (errors.length) throw new Error("Fix syntax errors in .vscode/settings.json before configuring the formatter.");
const languages = ["csharp", "python", "javascript", "javascriptreact", "typescript", "typescriptreact"];
for (const language of languages) {
    for (const [key, value] of Object.entries({
        "editor.defaultFormatter": "wherehouse.vertical-format",
        "editor.formatOnSave": true,
        "editor.formatOnSaveMode": "file",
        "editor.tabSize": 4,
        "editor.insertSpaces": true,
        "editor.detectIndentation": false,
    })) {
        text = jsonc.applyEdits(text, jsonc.modify(text, [`[${language}]`, key], value,
            { formattingOptions: { insertSpaces: true, tabSize: 4, eol: "\n" } }));
    }
}
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(file, text.endsWith("\n") ? text : text + "\n");
console.log("Configured formatting on save in .vscode/settings.json.");
