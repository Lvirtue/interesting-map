import { filterRetired, retiredCsv } from "./retired-utils.js";

const list = document.getElementById("retired-list");
const empty = document.getElementById("retired-empty");
const count = document.getElementById("retired-count");
const search = document.getElementById("retired-search");
const csvButton = document.getElementById("export-csv");
const jsonButton = document.getElementById("export-json");
let data;

function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function render() {
  const records = filterRetired(data.records, search.value);
  const fragment = document.createDocumentFragment();
  for (const record of records) {
    const link = document.createElement("a");
    link.className = "retired-row";
    link.href = `./retired-detail.html?code=${encodeURIComponent(record.code)}`;
    link.setAttribute("aria-label", `${record.name}，原代码 ${record.code}，查看调整详情`);

    const name = document.createElement("span");
    name.className = "retired-name";
    name.textContent = record.name;
    const type = document.createElement("small");
    type.textContent = `${record.province} · ${record.type}`;
    name.append(type);
    const year = document.createElement("span");
    year.textContent = String(record.year);
    const successor = document.createElement("span");
    successor.className = "retired-successor";
    successor.textContent = `${record.successor.name} · ${record.successor.code}`;
    const code = document.createElement("code");
    code.textContent = record.code;
    link.append(name, year, successor, code);
    fragment.append(link);
  }
  list.replaceChildren(fragment);
  count.textContent = `${records.length} 条记录`;
  empty.hidden = records.length !== 0;
}

try {
  const response = await fetch("./retired-divisions.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  data = await response.json();
  csvButton.disabled = false;
  jsonButton.disabled = false;
  search.addEventListener("input", render);
  csvButton.addEventListener("click", () => {
    download(retiredCsv(filterRetired(data.records, search.value)), "text/csv;charset=utf-8", "historical-division-codes.csv");
  });
  jsonButton.addEventListener("click", () => {
    download(JSON.stringify({
      asOf: data.asOf,
      scope: data.scope,
      historicalCodeSource: data.historicalCodeSource,
      records: filterRetired(data.records, search.value),
    }, null, 2), "application/json;charset=utf-8", "historical-division-codes.json");
  });
  render();
} catch {
  count.textContent = "数据加载失败";
  empty.textContent = "无法读取历史代码，请稍后重试。";
  empty.hidden = false;
}
