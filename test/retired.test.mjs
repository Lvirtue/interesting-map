import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterRetired, retiredCsv } from "../public/retired-utils.js";

const data = JSON.parse(readFileSync(new URL("../public/retired-divisions.json", import.meta.url)));
const current = JSON.parse(readFileSync(new URL("../official-xzqh-2025.json", import.meta.url)));
const currentByCode = new Map();
function visit(node) {
  if (node.code !== "资料暂缺") currentByCode.set(node.code.padEnd(6, "0"), node);
  for (const child of node.children || []) visit(child);
}
for (const province of current.data.children) visit(province);

test("historical prefectural codes are unique, absent from current data, and have matching successors", () => {
  const codes = data.records.map((record) => record.code);
  assert.deepEqual(codes, [...codes].sort());
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(data.scope.includes("非完整"));
  for (const record of data.records) {
    assert.match(record.code, /^\d{4}00$/);
    assert.equal(currentByCode.has(record.code), false, record.code);
    assert.equal(currentByCode.get(record.successor.code)?.name, record.successor.name);
    assert.ok(record.change && record.year && record.province);
    assert.match(record.source.url, /^https:\/\/[^/]+\.gov\.cn\//);
  }
});

test("search includes old and successor fields and remains ordered by old code", () => {
  assert.deepEqual(filterRetired(data.records, "哈密").map((record) => record.code), ["652200"]);
  assert.deepEqual(filterRetired(data.records, "540200").map((record) => record.code), ["542300"]);
  assert.deepEqual(filterRetired([...data.records].reverse(), "").map((record) => record.code),
    data.records.map((record) => record.code));
});

test("CSV export contains BOM, header, ordered rows, and quoted sources", () => {
  const csv = retiredCsv(filterRetired(data.records, ""));
  assert.ok(csv.startsWith("\uFEFF\"旧代码\",\"原行政区\""));
  assert.equal(csv.trimEnd().split("\r\n").length, data.records.length + 1);
  assert.ok(csv.indexOf("\"371200\"") < csv.indexOf("\"652200\""));
  assert.ok(csv.includes(data.records[0].source.url));
  assert.ok(retiredCsv([{ ...data.records[0], change: '=1,"bad"' }]).includes("\"'=1,\"\"bad\"\"\""));
});
