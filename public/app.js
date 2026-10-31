import { countMatches, filterDivisionTree, typesByLevel } from "./division-filter.js";

const { divisions, counts } = window.DIVISIONS_DATA;
const tree = document.getElementById("tree");
const search = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const empty = document.getElementById("empty");
const typeFilter = document.getElementById("type-filter");
const typePicker = document.getElementById("type-picker");
const viewButtons = {
  hierarchy: document.getElementById("hierarchy-view"),
  type: document.getElementById("type-view"),
};
const expanded = new Set();
let query = "";
let view = "hierarchy";

const typeGroups = typesByLevel(divisions);
const cityCount = ["直辖市", "地级市", "县级市"].reduce(
  (total, type) => total + [...typeGroups.values()].reduce((sum, group) => sum + (group.get(type) || 0), 0),
  0,
);
const cityGroup = document.createElement("optgroup");
cityGroup.label = "跨级";
const cityOption = document.createElement("option");
cityOption.value = "city";
cityOption.textContent = `市（直辖市、地级市、县级市） · ${cityCount}`;
cityGroup.append(cityOption);
typeFilter.append(cityGroup);
for (const [level, label] of [[1, "省级"], [2, "地级"], [3, "县级"]]) {
  const group = document.createElement("optgroup");
  group.label = label;
  for (const [type, count] of typeGroups.get(level)) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = `${type} · ${count}`;
    group.append(option);
  }
  typeFilter.append(group);
}

document.getElementById("province-count").textContent = counts.province;
document.getElementById("prefecture-count").textContent = counts.prefecture;
document.getElementById("county-count").textContent = counts.county;

function keyOf(node) {
  return node.code || `missing:${node.name}`;
}

function highlighted(text, term) {
  const fragment = document.createDocumentFragment();
  const position = term ? text.indexOf(term) : -1;
  if (position < 0) {
    fragment.append(document.createTextNode(text));
  } else {
    fragment.append(document.createTextNode(text.slice(0, position)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(position, position + term.length);
    fragment.append(mark, document.createTextNode(text.slice(position + term.length)));
  }
  return fragment;
}

function createNode(node, term, ancestors = []) {
  const hasChildren = node.children.length > 0 ||
    (view === "hierarchy" && term && node.expandable && node.matched);
  const open = hasChildren && (term ? node.children.length > 0 : expanded.has(keyOf(node)));
  const wrapper = document.createElement("div");
  wrapper.className = "tree-node";
  wrapper.setAttribute("role", "none");

  const row = document.createElement("button");
  row.type = "button";
  row.className = `row level-${node.level}${open ? " is-open" : ""}${hasChildren ? "" : " leaf"}${view === "type" && !node.matched ? " context-row" : ""}`;
  row.dataset.key = keyOf(node);
  row.style.setProperty("--level", node.level);
  row.setAttribute("role", "treeitem");
  row.setAttribute("aria-level", String(node.level));
  row.setAttribute("aria-label", `${node.name}，${node.type}，${node.code || "代码资料暂缺"}`);
  if (hasChildren) row.setAttribute("aria-expanded", String(open));

  const name = document.createElement("span");
  name.className = "name-cell";
  const caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "name-text";
  label.append(highlighted(node.name, term));
  name.append(caret, label);

  const type = document.createElement("span");
  type.className = "type-cell";
  type.textContent = node.type;
  const code = document.createElement("span");
  code.className = "code-cell";
  code.append(highlighted(node.code || "资料暂缺", term));
  row.append(name, type, code);
  if (hasChildren) {
    row.addEventListener("click", () => {
      const key = keyOf(node);
      if (term) {
        search.value = "";
        query = "";
        ancestors.forEach((ancestor) => expanded.add(ancestor));
        expanded.add(key);
      } else if (expanded.has(key)) {
        expanded.delete(key);
      } else {
        expanded.add(key);
      }
      render(key);
    });
  }
  wrapper.append(row);

  if (open) {
    const group = document.createElement("div");
    group.className = "children";
    group.setAttribute("role", "group");
    for (const child of node.children) group.append(createNode(child, term, [...ancestors, keyOf(node)]));
    wrapper.append(group);
  }
  return wrapper;
}

function render(focusKey) {
  const nodes = filterDivisionTree(divisions, {
    type: view === "type" ? typeFilter.value : "",
    query,
  });
  const fragment = document.createDocumentFragment();
  for (const node of nodes) fragment.append(createNode(node, query));
  tree.replaceChildren(fragment);
  empty.hidden = nodes.length !== 0;
  tree.hidden = nodes.length === 0;
  if (query || view === "type") {
    resultCount.textContent = `找到 ${countMatches(nodes)} 个匹配词条`;
  } else {
    resultCount.textContent = `${counts.province} 个省级行政区`;
  }
  if (focusKey) {
    const focused = [...tree.querySelectorAll(".row")].find(
      (row) => row.dataset.key === focusKey,
    );
    focused?.focus();
  }
}

function setView(nextView) {
  view = nextView;
  typePicker.hidden = view !== "type";
  for (const [name, button] of Object.entries(viewButtons)) {
    button.setAttribute("aria-pressed", String(name === view));
  }
  render();
}

viewButtons.hierarchy.addEventListener("click", () => setView("hierarchy"));
viewButtons.type.addEventListener("click", () => setView("type"));
typeFilter.addEventListener("change", () => render());
search.addEventListener("input", () => {
  query = search.value.trim();
  render();
});
document.getElementById("expand-all").addEventListener("click", () => {
  function visit(node) {
    if (node.children.length) expanded.add(keyOf(node));
    node.children.forEach(visit);
  }
  divisions.forEach(visit);
  render();
});
document.getElementById("collapse-all").addEventListener("click", () => {
  expanded.clear();
  search.value = "";
  query = "";
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== search && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape" && document.activeElement === search) {
    search.value = "";
    query = "";
    render();
    search.blur();
  }
});

render();

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery) {
  search.value = initialQuery;
  query = initialQuery.trim();
  render();
}
