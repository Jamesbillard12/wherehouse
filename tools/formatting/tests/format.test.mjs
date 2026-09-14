import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { format } from "../format.mjs";

for (const [extension, source, expected] of [
    ["py", 'def add(a, b):\n    return a + b\nx = add(1, 2)\nd = {"a": 1, "b": 2}\n',
        ['def add(\n    a,\n    b,\n)', 'add(\n    1,\n    2,\n)', '"a": 1,\n    "b": 2,']],
    ["js", 'function add(a,b) { return a+b; } const x = add(1,2); const d={a:1,b:2};',
        ['function add(\n    a,\n    b,\n)', 'add(\n    1,\n    2,\n)', 'a: 1,\n    b: 2,']],
    ["cs", 'class C { int Add(int a, int b) { return a+b; } void Run() { var x = Add(1,2); var d = new { A=1, B=2 }; } }',
        ['int Add(\n        int a,\n        int b\n    )', 'Add(\n            1,\n            2\n        )', 'A = 1,\n            B = 2']],
]) {
    test(`${extension}: short calls, parameters and properties always expand`, async () => {
        const result = await format(source, `test.${extension}`);
        for (const fragment of expected) assert.ok(result.includes(fragment), result);
        assert.equal(await format(result, `test.${extension}`), result, "Formatting must be idempotent");
    });
}

for (const [extension, source] of [
    ["py", 'def f(a, /, b=1, *, c=2, **kwargs):\n    return call(a, nested(b), c=c)\nx = consume(v for v in data)\nd = {"value": "comma, brace }", **other}\n'],
    ["py", 'def f(a):\n    # keep this comment\n    return call(\n        a, # argument comment\n        "a,b",\n    )\n'],
    ["py", 'async def f(a, b):\n    return await call(a, b)\ndef positional(a, /):\n    return a\n'],
    ["py", 'f = lambda a, b: a + b\nx = call(lambda a: a)\n'],
    ["cs", 'class C { void Run() { var x = Call(1, Nested(2, 3)); var s = "comma, brace }"; /* keep this comment */ } }'],
    ["cs", 'app.MapGet("/devices", async (int a, int b) => { return await Call(a,b); });'],
    ["cs", 'class C { void Run() { Call(1, // argument comment\n2); } }'],
    ["cs", 'class C { void Run() { var f = x => Call(x); var s = $"value: {Call(1,2)}"; } }'],
    ["ts", 'const f = (a: string, b: number) => ({a,b}); const x = f("a",1);'],
    ["tsx", 'const x = <View onPress={() => call("a",1)} />;'],
    ["js", 'const f = x => call(x); const s = "comma, brace }"; /* keep this comment */'],
    ["js", 'call(1, // argument comment\n2); const x = {a: 1, /* property comment */ b: 2};'],
]) {
    test(`${extension}: preserve syntax and repeated formatting: ${source.slice(0, 45)}`, async () => {
        const result = await format(source, `test.${extension}`);
        assert.equal(await format(result, `test.${extension}`), result);
        if (source.includes("keep this comment")) assert.ok(result.includes("keep this comment"));
        if (source.includes("argument comment")) assert.ok(result.includes("argument comment"));
        if (source.includes("comma, brace }")) assert.ok(result.includes("comma, brace }"));
    });
}

for (const [extension, source] of [["py", "def broken("], ["cs", "class C { void F("], ["js", "function f("]]) {
    test(`${extension}: refuse invalid syntax`, async () => {
        await assert.rejects(format(source, `test.${extension}`));
    });
}

test("C#: current endpoint formats repeatedly without changing its syntax", async () => {
    const source = await readFile(new URL("../../../device-service/src/WhereHouse.DeviceService/Program.cs", import.meta.url), "utf8");
    const result = await format(source, "Program.cs");
    assert.equal(await format(result, "Program.cs"), result);
});
