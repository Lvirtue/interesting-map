import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const map = JSON.parse(await readFile(new URL("public/map-data.json", root)));
const official = JSON.parse(await readFile(new URL("official-xzqh-2025.json", root)));

test("map contains every official province and prefecture in code order", () => {
  assert.equal(map.provinces.length, 34);
  assert.equal(map.provinces.reduce((n, item) => n + item.detail.regions.length, 0), 333);
  const codes = new Set();
  for (const [index, province] of map.provinces.entries()) {
    assert.equal(province.name, official.data.children[index].name);
    assert.match(province.path, /^M/);
    assert.match(province.detail.outline, /^M/);
    assert.ok(province.anchor.every(Number.isFinite));
    const officialRegions = official.data.children[index].children?.filter((item) => item.level === 2) || [];
    assert.deepEqual(province.detail.regions.map((item) => item.code),
      officialRegions.map((item) => item.code.padEnd(6, "0")));
    for (const region of province.detail.regions) {
      assert.match(region.path, /^M/);
      assert.ok(region.anchor.every(Number.isFinite));
      assert.ok(!codes.has(region.code));
      codes.add(region.code);
    }
  }
});
