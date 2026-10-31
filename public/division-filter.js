export const CITY_TYPES = new Set(["直辖市", "地级市", "县级市"]);

export function filterDivisionTree(nodes, { type = "", query = "" } = {}) {
  if (!type && !query) return nodes;

  function visit(node) {
    const children = node.children.map(visit).filter(Boolean);
    const typeMatches = !type || (type === "city" ? CITY_TYPES.has(node.type) : node.type === type);
    const textMatches = !query || node.name.includes(query) || (node.code && node.code.includes(query));
    const matched = typeMatches && textMatches;
    return matched || children.length
      ? { ...node, children, expandable: node.children.length > 0, matched }
      : null;
  }

  return nodes.map(visit).filter(Boolean);
}

export function countMatches(nodes) {
  return nodes.reduce((total, node) => total + Number(node.matched === true) + countMatches(node.children), 0);
}

export function typesByLevel(nodes) {
  const levels = new Map([[1, new Map()], [2, new Map()], [3, new Map()]]);
  function visit(node) {
    const types = levels.get(node.level);
    types.set(node.type, (types.get(node.type) || 0) + 1);
    node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return levels;
}
