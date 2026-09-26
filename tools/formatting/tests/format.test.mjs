import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { format } from "../format.mjs";

for (const [extension, source, expected] of [
    ["py", 'def add(a, b):\n    return a + b\nx = add(1, 2)\nd = {"a": 1, "b": 2}\n',
        ['def add(\n    a,\n    b,\n)', 'add(\n    1,\n    2,\n)', '"a": 1,\n    "b": 2,']],
    ["js", 'function add(a,b) { return a+b; } const x=add(1,2); const d={a:1,b:2};',
        ['function add(\n    a,\n    b,\n)', 'add(\n    1,\n    2,\n)', 'a: 1,\n    b: 2,']],
    ["cs", 'class C { int Add(int a, int b) { return a+b; } void Run() { var x=Add(1,2); var d=new { A=1, B=2 }; } }',
        ['int Add(\n        int a,\n        int b\n    )', 'Add(\n            1,\n            2\n        )', 'A = 1,\n            B = 2']],
]) {
    test(`${extension}: short calls, declarations, and properties always expand`, async () => {
        const result = await format(source, `test.${extension}`);
        for (const fragment of expected) assert.ok(result.includes(fragment), result);
        assert.equal(await format(result, `test.${extension}`), result);
    });
}

for (const [extension, source] of [
    ["py", 'def f(a, /, b=1, *, c=2, **kwargs):\n    return call(a, nested(b), c=c)\nx = consume(v for v in data)\nd = {"value": "comma, brace }", **other}\n'],
    ["py", 'def f(a):\n    # keep this comment\n    return call(\n        a, # argument comment\n        "a,b",\n    )\n'],
    ["py", 'async def f(a, b):\n    return await call(a, b)\ndef positional(a, /):\n    return a\n'],
    ["py", 'f = lambda a, b: a + b\nx = call(lambda a: a)\n'],
    ["py", 'def f():\n    x = call(a,b) # type: ignore[arg-type]\n    return x\n'],
    ["cs", 'class C { void Run() { var x = Call(1, Nested(2, 3)); var s = "comma, brace }"; /* keep this comment */ } }'],
    ["cs", 'app.MapGet("/devices", async (int a, int b) => { return await Call(a,b); });'],
    ["cs", 'class C { void Run() { Call(1, // argument comment\n2); } }'],
    ["cs", 'class C { void Run() { var f = x => Call(x); var s = $"value: {Call(1,2)}"; } }'],
    ["cs", '#if DEBUG\nCall(1,2);\n#else\nCall(3,4);\n#endif\n'],
    ["ts", 'const f = (a: string, b: number) => ({a,b}); const x = f("a",1);'],
    ["tsx", 'const x = <View onPress={() => call("a",1)} />;'],
    ["js", 'const f = x => call(x); const s = "comma, brace }"; /* keep this comment */'],
    ["js", 'call(1, // argument comment\n2); const x = {a: 1, /* property comment */ b: 2};'],
]) {
    test(`${extension}: stable formatting preserves syntax and comments: ${source.slice(0, 35)}`, async () => {
        const result = await format(source, `test.${extension}`);
        assert.equal(await format(result, `test.${extension}`), result);
        for (const marker of ["keep this comment", "argument comment", "comma, brace }"]) {
            if (source.includes(marker)) assert.ok(result.includes(marker));
        }
    });
}

test("JavaScript: layout changes preserve execution and string values", async () => {
    const source = 'function add(a,b) { return a+b; } globalThis.result={sum:add(2,3), text:"literal, stays { intact }"};';
    const before = {}, after = {};
    vm.runInNewContext(source, before);
    vm.runInNewContext(await format(source, "test.js"), after);
    assert.equal(JSON.stringify(before.result), JSON.stringify(after.result));
});

test("C#: nested argument indentation stays relative to the enclosing call", async () => {
    const result = await format('class C { void Run() { Call(1,Nested(2,3)); } }', "test.cs");
    assert.ok(result.includes('            Nested(\n                2,\n                3\n            )'), result);
});

for (const [extension, source] of [["py", "def broken("], ["cs", "class C { void F("], ["js", "function f("]]) {
    test(`${extension}: refuse invalid syntax`, async () => assert.rejects(format(source, `test.${extension}`)));
}
