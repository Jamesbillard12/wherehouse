#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { formatJavaScript } from "./javascript_format.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
function run(command, args, source) {
    const result = spawnSync(command, args, {
        input: source, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
        timeout: 30000, cwd: directory,
    });
    if (result.error || result.status !== 0) {
        throw new Error(result.error?.message ?? result.stderr ?? "Formatter failed");
    }
    return result.stdout;
}

export async function format(source, filename) {
    const extension = extname(filename).slice(1);
    switch (extension) {
        case "cs":
            return run("dotnet", [resolve(directory, "csharp/bin/Release/net10.0/WhereHouse.Formatter.dll")], source);
        case "py":
        case "pyi":
            return run(resolve(directory, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python"),
                [resolve(directory, "python_format.py")], source);
        case "js": case "jsx": case "mjs": case "cjs":
        case "ts": case "tsx": case "mts": case "cts":
            return formatJavaScript(source, extension);
        default:
            throw new Error(`Unsupported formatting extension: ${extension}`);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const [mode, ...files] = process.argv.slice(2);
        if (mode === "--stdin-filepath" && files.length === 1) {
            let input = "";
            for await (const chunk of process.stdin) input += chunk;
            process.stdout.write(await format(input, files[0]));
        } else if (["--write", "--check"].includes(mode) && files.length) {
            for (const filename of files) {
                const source = await readFile(filename, "utf8");
                const result = await format(source, filename);
                if (mode === "--write") await writeFile(filename, result);
                else if (source !== result) {
                    console.error(`Needs formatting: ${filename}`);
                    process.exitCode = 1;
                }
            }
        } else {
            throw new Error("Usage: node tools/formatting/format.mjs --write|--check FILE... or --stdin-filepath FILE");
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
