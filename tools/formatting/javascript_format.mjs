import { ESLint } from "eslint";
import stylistic from "@stylistic/eslint-plugin";
import parser from "@typescript-eslint/parser";
import prettier from "prettier";

// Stylistic provides the whitespace rules; this rule supplies the missing
// requirement to split every declaration parameter, even in short signatures.
const parameterLines = {
    meta: { type: "layout", fixable: "whitespace", schema: [] },
    create(context) {
        const source = context.sourceCode;
        return {
            "*:exit"(node) {
                const items = node.params ?? (node.type === "ObjectExpression" || node.type === "ObjectPattern" ? node.properties : undefined);
                if (!Array.isArray(items)) return;
                for (let i = 1; i < items.length; i++) {
                    const previous = items[i - 1];
                    const current = items[i];
                    if (previous.loc.end.line !== current.loc.start.line) continue;
                    const comma = source.getTokenAfter(previous);
                    if (comma?.value !== ",") continue;
                    context.report({
                        node: current,
                        message: "Put each parameter on its own line.",
                        fix: fixer => fixer.insertTextAfter(comma, "\n"),
                    });
                }
            },
        };
    },
};

const eslint = new ESLint({
    overrideConfigFile: true,
    fix: true,
    overrideConfig: [{
        files: ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}"],
        languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "@stylistic": stylistic, vertical: { rules: { parameters: parameterLines } } },
        rules: {
            ...stylistic.configs.customize({ indent: 4, quotes: "double", semi: true, jsx: true }).rules,
            "@stylistic/function-paren-newline": ["error", { minItems: 1 }],
            "@stylistic/function-call-argument-newline": ["error", "always"],
            "@stylistic/object-curly-newline": ["error", { multiline: true, minProperties: 1 }],
            "@stylistic/object-property-newline": ["error", { allowAllPropertiesOnSameLine: false }],
            "@stylistic/arrow-parens": ["error", "always"],
            "vertical/parameters": "error",
        },
    }],
});

export async function formatJavaScript(source, extension) {
    const baseline = await prettier.format(source, { filepath: `input.${extension}`, tabWidth: 4, printWidth: 100 });
    const [result] = await eslint.lintText(baseline, { filePath: `input.${extension}` });
    if (result.errorCount) {
        throw new Error(result.messages.map(m => `${m.line}:${m.column} ${m.message}`).join("\n"));
    }
    return result.output ?? baseline;
}
