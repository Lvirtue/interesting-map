import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { countMatches, filterDivisionTree, typesByLevel } from "../public/division-filter.js";

const source = await readFile(new URL("../public/divisions.js", import.meta.url), "utf8");
const context = { window: {} };
runInNewContext(source, context);
const divisions = context.window.DIVISIONS_DATA.divisions;

function matchedNodes(nodes) {
  return nodes.flatMap((node) => [...(node.matched ? [node] : []), ...matchedNodes(node.children)]);
}

test("city filter includes only the three city types and keeps ascending code order", () => {
  const filtered = filterDivisionTree(divisions, { type: "city" });
  const matches = matchedNodes(filtered);
  assert.equal(matches.length, 695);
  assert.deepEqual(new Set(matches.map((node) => node.type)), new Set(["直辖市", "地级市", "县级市"]));
  const codes = matches.map((node) => node.code);
  assert.equal(codes.join(","), [...codes].sort().join(","));
  assert.equal(filtered.find((node) => node.name === "北京市").matched, true);
  assert.equal(filtered.find((node) => node.name === "北京市").children.length, 0);
});

test("official types keep ancestor context and direct-administered cities", () => {
  const types = typesByLevel(divisions);
  assert.equal(types.get(1).get("直辖市"), 4);
  assert.equal(types.get(2).get("地级市"), 293);
  assert.equal(types.get(3).get("县级市"), 398);
  for (const [level, group] of types) {
    for (const [type, count] of group) {
      const matches = matchedNodes(filterDivisionTree(divisions, { type }));
      assert.equal(matches.filter((node) => node.level === level).length, count);
    }
  }
  const countyCities = filterDivisionTree(divisions, { type: "县级市" });
  const henan = countyCities.find((node) => node.name === "河南省");
  assert.equal(henan.matched, false);
  assert.equal(henan.children.some((node) => node.name === "济源市" && node.level === 3), true);
});

test("search and type selection intersect without losing the parent path", () => {
  const nodes = filterDivisionTree(divisions, { type: "city", query: "1301" });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].name, "河北省");
  assert.equal(nodes[0].matched, false);
  assert.equal(nodes[0].children[0].name, "石家庄市");
  assert.equal(countMatches(nodes), 4);
  assert.equal(filterDivisionTree(divisions, { type: "直辖市", query: "东城" }).length, 0);
});
