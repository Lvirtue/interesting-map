import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../public/divisions.js", import.meta.url), "utf8");
const context = { window: {} };
runInNewContext(source, context);
const { divisions, counts } = context.window.DIVISIONS_DATA;

test("official counts and province order", () => {
  assert.equal(divisions.length, 34);
  assert.deepEqual(JSON.parse(JSON.stringify(counts)), { province: 34, prefecture: 333, county: 2847 });
  assert.equal(divisions[0].code, "110000");
  assert.equal(divisions.at(-1).name, "台湾省");
  assert.equal(divisions.at(-1).code, null);
});

test("all children are sorted and preserve hierarchy", () => {
  function inspect(nodes, parent) {
    const codes = nodes.map((item) => item.code || "999999");
    assert.equal(codes.join(","), [...codes].sort().join(","));
    for (const node of nodes) {
      assert.equal(node.code === null || /^\d{6}$/.test(node.code), true);
      if (parent) {
        assert.equal(node.level > parent.level, true);
        assert.equal(node.code.startsWith(parent.code.slice(0, parent.level * 2)), true);
      }
      inspect(node.children, node);
    }
  }
  inspect(divisions, null);
});

test("municipalities, direct-administered counties, and special regions", () => {
  const beijing = divisions.find((node) => node.name === "北京市");
  assert.equal(beijing.children[0].name, "东城区");
  assert.equal(beijing.children[0].level, 3);
  const henan = divisions.find((node) => node.name === "河南省");
  assert.equal(henan.children.some((node) => node.level === 3), true);
  assert.equal(divisions.find((node) => node.name === "香港特别行政区").children.length, 0);
});
