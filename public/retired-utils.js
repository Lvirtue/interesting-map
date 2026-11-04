export function filterRetired(records, query) {
  const term = query.trim();
  return records
    .filter((record) => !term || [
      record.code, record.name, record.type, record.province,
      record.successor.code, record.successor.name,
    ].some((value) => value.includes(term)))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function csvCell(value) {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function retiredCsv(records) {
  const headings = ["旧代码", "原行政区", "原类型", "省级行政区", "调整批准年份", "调整原因", "现行对应代码", "现行对应名称", "对应关系", "调整依据"];
  const rows = records.map((record) => [
    record.code, record.name, record.type, record.province, record.year,
    record.change, record.successor.code, record.successor.name,
    record.successor.relation, record.source.url,
  ]);
  return `\uFEFF${[headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
