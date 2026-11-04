import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { makeProfile, splitSections } from "../scripts/profile-extract.mjs";

test("extracts dated figures and relevant sections without inventing absent topics", () => {
  const raw = {
    code: "123400", name: "示例市", type: "地级市", province: "某省",
    source: "https://zh.wikipedia.org/wiki/example",
    revisionId: 10, revisedAt: "2026-01-01T00:00:00Z",
    extract: `示例市是某省的地级市。2020年常住人口为100万人。全市总面积100平方公里。
== 历史 ==
=== 建制沿革 ===
1988年撤销示例地区，设立地级示例市。唐代此处设州。
== 经济 ==
2022年地区生产总值为100亿元。
== 民族 ==
汉族占大多数。少数民族包括苗族和侗族。
== 参考文献 ==
此处不应被展示。`,
  };
  const profile = makeProfile(raw);
  assert.match(profile.summary, /^示例市是某省的地级市/);
  assert.match(profile.history, /1988年撤销示例地区/);
  assert.match(profile.population, /2020年/);
  assert.match(profile.area, /100平方公里/);
  assert.match(profile.economy, /2022年/);
  assert.match(profile.ethnic, /苗族和侗族/);
  assert.equal(profile.religion, null);
  assert.equal(profile.climate, null);
  assert.equal(splitSections(raw.extract)[1].heading, "历史");
  assert.equal(splitSections(raw.extract)[2].parent, "历史");
});

test("processed profiles follow the official prefectural codes and retain provenance", () => {
  const path = new URL("../public/prefecture-profiles.json", import.meta.url);
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const official = JSON.parse(readFileSync(new URL("../official-xzqh-2025.json", import.meta.url)));
  const names = new Map(official.data.children.flatMap((province) =>
    (province.children || []).filter((item) => item.level === 2).map((item) =>
      [item.code.padEnd(6, "0"), item.name])));
  assert.ok(data.records.length > 0 && data.records.length <= 333);
  assert.equal(data.totalCount, 333);
  assert.equal(data.availableCount, data.records.length);
  assert.equal(new Set(data.records.map((record) => record.code)).size, data.records.length);
  for (const record of data.records) {
    assert.equal(names.get(record.code), record.name);
    assert.match(record.source, /^https:\/\/zh\.wikipedia\.org\/wiki\//);
    assert.ok(record.revisionId && record.revisedAt);
    assert.ok(!record.ethnic || !/^(?:汉族|全市以汉族)/.test(record.ethnic));
  }
});

test("processed province profiles match the official province list", () => {
  const data = JSON.parse(readFileSync(new URL("../public/province-profiles.json", import.meta.url)));
  const official = JSON.parse(readFileSync(new URL("../official-xzqh-2025.json", import.meta.url)));
  const names = new Map(official.data.children.map((item) =>
    [/^\d+$/.test(item.code) ? item.code.padEnd(6, "0") : "710000", item.name]));
  assert.equal(data.totalCount, 34);
  assert.equal(data.availableCount, data.records.length);
  assert.ok(data.records.length <= 34);
  assert.deepEqual(data.records.map((item) => item.code),
    data.records.map((item) => item.code).sort());
  for (const record of data.records) {
    assert.equal(names.get(record.code), record.name);
    assert.ok(record.revisionId && record.revisedAt);
    assert.match(record.source, /^https:\/\/zh\.wikipedia\.org\/wiki\//);
  }
});
