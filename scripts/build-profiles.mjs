import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import wtf from "wtf_wikipedia";
import { makeProfile } from "./profile-extract.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const official = JSON.parse(await readFile(join(root, "official-xzqh-2025.json"), "utf8"));
function plainExtract(raw) {
  if (raw.extract) return raw.extract;
  const sections = wtf(raw.wikitext).sections();
  return sections.map((section) => {
    const title = section.title();
    const marks = "=".repeat(Math.min(section.depth() + 2, 4));
    const text = section.text().replace(/\.(?=\s|$)/g, "。");
    return `${title ? `${marks} ${title} ${marks}\n` : ""}${text}`;
  }).join("\n");
}

const records = [];
const missing = [];
const provinceRecords = [];
const provinceMissing = [];
for (const province of official.data.children) {
  const provinceCode = /^\d+$/.test(province.code) ? province.code.padEnd(6, "0") : "710000";
  try {
    const raw = JSON.parse(await readFile(join(root, "data", "wiki-provinces", `${provinceCode}.json`), "utf8"));
    if (raw.name !== province.name || raw.code !== provinceCode) throw new Error("Province mismatch");
    provinceRecords.push(makeProfile({ ...raw, type: province.type, extract: plainExtract(raw) }));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    provinceMissing.push(`${provinceCode} ${province.name}`);
  }
  for (const division of province.children || []) {
    if (division.level !== 2) continue;
    const code = division.code.padEnd(6, "0");
    try {
      const raw = JSON.parse(await readFile(join(root, "data", "wiki-prefectures", `${code}.json`), "utf8"));
      if (raw.name !== division.name || raw.code !== code) throw new Error("Division mismatch");
      records.push(makeProfile({ ...raw, type: division.type, extract: plainExtract(raw) }));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      missing.push(`${code} ${division.name}`);
    }
  }
}
records.sort((a, b) => a.code.localeCompare(b.code));
await writeFile(join(root, "public", "prefecture-profiles.json"), `${JSON.stringify({
  divisionAsOf: "2025-12-31",
  generatedAt: new Date().toISOString(),
  totalCount: 333,
  availableCount: records.length,
  source: "https://zh.wikipedia.org/",
  license: "CC BY-SA 4.0",
  note: "百科内容为自动摘录，非官方统计；未采集的行政区不显示详情入口，未找到可靠文字的栏目不展示。",
  records,
}, null, 2)}\n`);
provinceRecords.sort((a, b) => a.code.localeCompare(b.code));
await writeFile(join(root, "public", "province-profiles.json"), `${JSON.stringify({
  divisionAsOf: "2025-12-31",
  generatedAt: new Date().toISOString(),
  totalCount: 34,
  availableCount: provinceRecords.length,
  source: "https://zh.wikipedia.org/",
  license: "CC BY-SA 4.0",
  note: "百科内容为自动摘录，非官方统计；缺失或不可靠的栏目不展示。",
  records: provinceRecords,
}, null, 2)}\n`);
console.log(`Built ${records.length}/333 profiles; ${missing.length} not yet cached.`);
console.log(`Built ${provinceRecords.length}/34 province profiles; ${provinceMissing.length} not yet cached.`);
