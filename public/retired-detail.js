const loading = document.getElementById("detail-loading");
const article = document.getElementById("detail");
const code = new URLSearchParams(location.search).get("code");

function put(id, text) {
  document.getElementById(id).textContent = text;
}

function sourceLink(id, source) {
  const link = document.getElementById(id);
  link.textContent = source.title;
  link.href = source.url;
}

if (!/^\d{6}$/.test(code || "")) {
  loading.textContent = "无效的历史代码。";
} else {
  try {
    const response = await fetch("./retired-divisions.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const record = data.records.find((item) => item.code === code);
    if (!record) {
      loading.textContent = "未找到这条历史代码记录。";
    } else {
      document.title = `${record.name}（${record.code}）· 历史代码`;
      put("detail-name", record.name);
      put("detail-code", record.code);
      put("detail-type", record.type);
      put("detail-province", record.province);
      put("detail-year", String(record.year));
      put("detail-change", record.change);
      put("detail-relation", `对应关系：${record.successor.relation}`);
      const successor = document.getElementById("detail-successor");
      successor.textContent = `${record.successor.name} · ${record.successor.code} →`;
      successor.href = `./divisions.html?q=${encodeURIComponent(record.successor.code)}`;
      sourceLink("detail-decision", record.source);
      sourceLink("detail-history", data.historicalCodeSource);
      loading.hidden = true;
      article.hidden = false;
    }
  } catch {
    loading.textContent = "详情加载失败，请稍后重试。";
  }
}
