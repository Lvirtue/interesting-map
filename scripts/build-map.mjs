import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const root = fileURLToPath(new URL("..", import.meta.url));
const atlas = JSON.parse(await readFile(join(root, "assets/cn-atlas-2023.json"), "utf8"));
const official = JSON.parse(await readFile(join(root, "official-xzqh-2025.json"), "utf8"));
const provinces = feature(atlas, atlas.objects.provinces).features;
const prefectures = feature(atlas, atlas.objects.prefectures).features;
const provinceShapes = new Map(provinces.map((item) => [item.properties.id, item]));
const prefectureShapes = new Map(prefectures.map((item) => [item.properties.id, item]));
const nationalProjection = geoMercator().fitExtent([[28, 24], [1172, 784]], {
  type: "FeatureCollection", features: provinces,
});
const nationalPath = geoPath(nationalProjection).digits(1);

function shape(item, path) {
  const [x, y] = path.centroid(item);
  return {
    path: path(item),
    anchor: [Number(x.toFixed(1)), Number(y.toFixed(1))],
    area: Math.round(path.area(item)),
  };
}

const entries = official.data.children.map((province) => {
  const code = /^\d{2,6}$/.test(province.code || "") ? province.code.padEnd(6, "0") : "710000";
  const outline = provinceShapes.get(code);
  if (!outline) throw new Error(`Missing province boundary: ${code} ${province.name}`);
  const divisions = (province.children || []).filter((item) => item.level === 2);
  const projection = geoMercator().fitExtent([[30, 30], [1170, 770]], outline);
  const path = geoPath(projection).digits(1);
  return {
    code,
    name: province.name,
    type: province.type,
    ...shape(outline, nationalPath),
    detail: {
      outline: path(outline),
      regions: divisions.map((division) => {
        const divisionCode = division.code.padEnd(6, "0");
        const boundary = prefectureShapes.get(divisionCode);
        if (!boundary) throw new Error(`Missing prefecture boundary: ${divisionCode} ${division.name}`);
        return {
          code: divisionCode,
          name: division.name,
          type: division.type,
          ...shape(boundary, path),
        };
      }),
      direct: (province.children || []).filter((item) => item.level === 3)
        .map((item) => ({ code: item.code, name: item.name, type: item.type })),
    },
  };
});

await writeFile(join(root, "public/map-data.json"), `${JSON.stringify({
  boundaryAsOf: "2023",
  divisionsAsOf: "2025-12-31",
  boundarySource: "https://github.com/BarbarossaWang/cn-atlas",
  upstreamSource: "https://github.com/ruiduobao/shengshixian.com",
  width: 1200,
  height: 810,
  provinces: entries,
})}\n`);
console.log(`Built map for ${entries.length} provinces and ${entries.reduce((n, p) => n + p.detail.regions.length, 0)} prefectures.`);
