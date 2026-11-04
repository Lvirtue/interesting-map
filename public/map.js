const svg = document.getElementById("division-map");
const stage = document.getElementById("map-stage");
const popover = document.getElementById("map-popover");
const list = document.getElementById("map-list");
const status = document.getElementById("map-status");
const provinceCode = new URLSearchParams(location.search).get("province");
const svgNS = "http://www.w3.org/2000/svg";
const mapWidth = 1200;
const mapHeight = 810;
const maxZoom = 4;
const zoomIn = document.getElementById("map-zoom-in");
const zoomOut = document.getElementById("map-zoom-out");
const zoomReset = document.getElementById("map-zoom-reset");
const zoomLevel = document.getElementById("map-zoom-level");
const view = { x: 0, y: 0, zoom: 1 };
let active = null;
let activeElement = null;
let drag = null;
let suppressClick = false;

function clearSelection() {
  activeElement?.classList.remove("is-selected");
  activeElement = null;
  active = null;
  popover.hidden = true;
}

function setView(x, y, zoom) {
  const width = mapWidth / zoom;
  const height = mapHeight / zoom;
  view.x = Math.max(0, Math.min(mapWidth - width, x));
  view.y = Math.max(0, Math.min(mapHeight - height, y));
  view.zoom = zoom;
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${width} ${height}`);
  zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  zoomIn.disabled = zoom >= maxZoom;
  zoomOut.disabled = zoom <= 1;
  zoomReset.disabled = zoom <= 1;
  stage.classList.toggle("is-zoomed", zoom > 1);
  placePopover();
}

function zoomTo(zoom, clientX, clientY) {
  const next = Math.max(1, Math.min(maxZoom, zoom));
  if (next === view.zoom) return false;
  const width = mapWidth / view.zoom;
  const height = mapHeight / view.zoom;
  const point = clientX === undefined
    ? { x: view.x + width / 2, y: view.y + height / 2 }
    : new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM().inverse());
  const ratioX = (point.x - view.x) / width;
  const ratioY = (point.y - view.y) / height;
  setView(point.x - ratioX * mapWidth / next, point.y - ratioY * mapHeight / next, next);
  return true;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function mapAnchor(anchor) {
  const point = new DOMPoint(anchor[0], anchor[1]).matrixTransform(svg.getScreenCTM());
  const bounds = stage.getBoundingClientRect();
  return { x: point.x - bounds.left, y: point.y - bounds.top };
}

function placePopover() {
  if (!active || popover.hidden) return;
  const { x, y } = mapAnchor(active.anchor);
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  popover.style.left = `${Math.max(8, Math.min(stage.clientWidth - width - 8, x - width / 2))}px`;
  popover.style.top = `${Math.max(8, Math.min(stage.clientHeight - height - 8, y - height - 12))}px`;
}

function select(item, target, profile, province) {
  if (activeElement) activeElement.classList.remove("is-selected");
  active = item;
  activeElement = target;
  target?.classList.add("is-selected");
  document.getElementById("map-popover-name").textContent = item.name;
  document.getElementById("map-popover-code").textContent =
    `${item.type} · ${item.code === "710000" ? "代码资料暂缺（地图参考码 710000）" : item.code}`;
  document.getElementById("map-popover-summary").textContent = province
    ? `${province.name}下辖的${item.type}，详情可在行政区划目录中查阅。`
    : profile?.summary || `${item.name}，${item.type}。${item.detail.regions.length
      ? `下辖 ${item.detail.regions.length} 个地级行政区。`
      : `下辖 ${item.detail.direct.length} 个县级行政区。`}`;
  const link = document.getElementById("map-popover-link");
  link.href = province
    ? `./prefecture.html?code=${encodeURIComponent(item.code)}`
    : `./index.html?province=${encodeURIComponent(item.code)}`;
  link.title = province ? "查看地级行政区概况" : "查看省级行政区划图";
  link.setAttribute("aria-label", link.title);
  link.hidden = !!province && !profile;
  const source = document.getElementById("map-popover-source");
  source.hidden = !profile?.revisionId;
  if (profile?.revisionId) source.href = `https://zh.wikipedia.org/w/index.php?oldid=${profile.revisionId}`;
  popover.hidden = false;
  placePopover();
}

function svgPath(item, selectItem) {
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", item.path);
  path.setAttribute("class", "map-region");
  path.setAttribute("tabindex", "0");
  path.setAttribute("role", "button");
  path.setAttribute("aria-label", `${item.name}，${item.code}`);
  const title = document.createElementNS(svgNS, "title");
  title.textContent = `${item.name} · ${item.code}`;
  path.append(title);
  path.addEventListener("click", () => {
    if (!suppressClick) selectItem(item, path);
  });
  path.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectItem(item, path);
    }
  });
  return path;
}

function svgLabel(item, threshold) {
  if (item.area < threshold) return null;
  const text = document.createElementNS(svgNS, "text");
  text.setAttribute("x", item.anchor[0]);
  text.setAttribute("y", item.anchor[1]);
  text.setAttribute("class", "map-label");
  text.textContent = item.name.replace(/(?:特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|地区|省|市)$/, "");
  return text;
}

function renderList(items, onSelect, direct = []) {
  list.replaceChildren();
  for (const item of items) {
    const button = element("button", "map-list-row");
    button.type = "button";
    button.append(element("span", "", item.name),
      element("code", "", item.code === "710000" ? "资料暂缺" : item.code));
    button.addEventListener("click", () => {
      onSelect(item, svg.querySelector(`[aria-label="${item.name}，${item.code}"]`));
    });
    list.append(button);
  }
  if (direct.length) {
    list.append(element("h3", "map-direct-heading", "省直辖县级行政区"));
    for (const item of direct) {
      const link = element("a", "map-list-row");
      link.href = `./divisions.html?q=${encodeURIComponent(item.code)}`;
      link.append(element("span", "", item.name), element("code", "", item.code));
      list.append(link);
    }
  }
}

async function start() {
  try {
    const [mapResponse, profileResponse, prefectureResponse] = await Promise.all([
      fetch("./map-data.json"), fetch("./province-profiles.json"), fetch("./prefecture-profiles.json"),
    ]);
    if (!mapResponse.ok) throw new Error("地图数据不可用");
    const data = await mapResponse.json();
    const profiles = profileResponse.ok ? (await profileResponse.json()).records : [];
    const prefectureProfiles = prefectureResponse.ok ? (await prefectureResponse.json()).records : [];
    const profileMap = new Map(profiles.map((profile) => [profile.code, profile]));
    const prefectureMap = new Map(prefectureProfiles.map((profile) => [profile.code, profile]));
    const province = data.provinces.find((item) => item.code === provinceCode);
    const items = province?.detail.regions || data.provinces;
    document.getElementById("map-title").textContent = province ? `${province.name}行政区划` : "中国行政区划";
    document.title = province ? `${province.name}行政区划地图 · 中国行政区划` : "中国行政区划地图";
    document.getElementById("map-subtitle").textContent = province
      ? `${province.type} · ${province.code === "710000" ? "代码资料暂缺" : province.code} · ${items.length ? "地级行政区按代码排序" : "市界与县级行政区清单"}`
      : "选择省级行政区，查看概况与地级行政区划。";
    document.getElementById("map-back").hidden = !province;
    document.getElementById("map-list-title").textContent = province
      ? (items.length ? "地级行政区" : "县级行政区") : "省级行政区";
    document.getElementById("map-count").textContent = `${items.length}${province?.detail.direct.length ? ` + ${province.detail.direct.length}` : ""}`;
    svg.setAttribute("aria-label", province ? `${province.name}地级行政区划地图` : "全国省级行政区划地图");
    if (province) {
      const outline = document.createElementNS(svgNS, "path");
      outline.setAttribute("d", province.detail.outline);
      outline.setAttribute("class", "map-outline");
      svg.append(outline);
    }
    const choose = (item, target) => select(item, target, province
      ? prefectureMap.get(item.code) : profileMap.get(item.code), province);
    for (const item of items) svg.append(svgPath(item, choose));
    for (const item of items) {
      const label = svgLabel(item, province ? 2400 : 1800);
      if (label) svg.append(label);
    }
    renderList(items, choose, province?.detail.direct);
    status.hidden = true;
  } catch (error) {
    status.textContent = `地图加载失败：${error.message}`;
  }
}

window.addEventListener("resize", placePopover);
zoomIn.addEventListener("click", () => zoomTo(Math.min(maxZoom, view.zoom * 1.5)));
zoomOut.addEventListener("click", () => zoomTo(Math.max(1, view.zoom / 1.5)));
zoomReset.addEventListener("click", () => setView(0, 0, 1));
svg.addEventListener("wheel", (event) => {
  if (zoomTo(view.zoom * (event.deltaY < 0 ? 1.25 : 0.8), event.clientX, event.clientY)) {
    event.preventDefault();
  }
}, { passive: false });
svg.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || view.zoom === 1) return;
  suppressClick = false;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: view.x, startY: view.y, moved: false };
});
svg.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) {
    drag.moved = true;
    svg.setPointerCapture(event.pointerId);
  }
  if (!drag.moved) return;
  const scale = svg.getScreenCTM().a;
  setView(drag.startX - (event.clientX - drag.x) / scale,
    drag.startY - (event.clientY - drag.y) / scale, view.zoom);
});
function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  suppressClick = drag.moved;
  if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  drag = null;
}
svg.addEventListener("pointerup", endDrag);
svg.addEventListener("pointercancel", endDrag);
stage.addEventListener("pointerdown", () => {
  suppressClick = false;
});
stage.addEventListener("click", (event) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (event.target === stage || event.target === svg || event.target.classList.contains("map-outline")) {
    clearSelection();
  }
});
document.addEventListener("pointerdown", (event) => {
  if (!stage.contains(event.target) && !list.contains(event.target)) clearSelection();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") clearSelection();
});
start();
