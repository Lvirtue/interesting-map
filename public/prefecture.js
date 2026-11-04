const code = new URLSearchParams(location.search).get("code");
const status = document.getElementById("profile-status");
const article = document.getElementById("profile");
const fields = [
  ["history", "历史沿革"],
  ["population", "人口"],
  ["economy", "经济"],
  ["area", "面积"],
  ["geography", "地理"],
  ["climate", "气候"],
  ["resources", "资源"],
  ["religion", "宗教"],
  ["ethnic", "民族"],
];

async function readJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

if (!/^\d{4}00$/.test(code || "")) {
  status.textContent = "无效的地级行政区代码。";
} else {
  try {
    const [data, retired] = await Promise.all([
      readJson("./prefecture-profiles.json"),
      readJson("./retired-divisions.json"),
    ]);
    const profile = data.records.find((item) => item.code === code);
    if (!profile) {
      status.textContent = "暂未收录这条地级行政区概况。";
    } else {
      document.title = `${profile.name}（${profile.code}）· 行政区概况`;
      for (const [id, value] of [
        ["profile-name", profile.name],
        ["profile-code", profile.code],
        ["profile-type", profile.type],
        ["profile-province", profile.province],
      ]) document.getElementById(id).textContent = value;
      if (profile.summary) {
        document.getElementById("profile-summary").textContent = profile.summary;
        document.getElementById("profile-summary").hidden = false;
      }
      const container = document.getElementById("profile-fields");
      for (const [key, label] of fields) {
        if (!profile[key]) continue;
        const section = document.createElement("section");
        section.className = "retired-section";
        const heading = document.createElement("h2");
        heading.textContent = label;
        const text = document.createElement("p");
        text.textContent = profile[key];
        section.append(heading, text);
        container.append(section);
      }
      const related = retired.records.filter((entry) =>
        (entry.successors || [entry.successor]).some((successor) => successor.code === code));
      if (related.length) {
        const links = document.getElementById("profile-retired-links");
        for (const entry of related) {
          const line = document.createElement("p");
          const link = document.createElement("a");
          link.href = `./retired-detail.html?code=${encodeURIComponent(entry.code)}`;
          link.textContent = `${entry.name} · ${entry.code}（${entry.year} 年调整）`;
          line.append(link);
          links.append(line);
        }
        document.getElementById("profile-retired").hidden = false;
      }
      const source = document.getElementById("profile-source");
      source.href = `https://zh.wikipedia.org/w/index.php?oldid=${profile.revisionId}`;
      source.textContent = `中文维基百科：${profile.name}（修订版本）`;
      document.getElementById("profile-revision").textContent =
        `原文修订于 ${profile.revisedAt?.slice(0, 10) || "日期不详"}；资料以修订版本为准。`;
      status.hidden = true;
      article.hidden = false;
    }
  } catch {
    status.textContent = "资料加载失败，请稍后重试。";
  }
}
