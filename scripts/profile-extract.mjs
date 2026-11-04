const sections = new Map([
  ["history", /^(?:历史|历史沿革|建制沿革|行政区划沿革|沿革|行政区划|辖区变动)$/],
  ["economy", /^(?:经济|经济概况|经济发展|产业|产业经济)$/],
  ["geography", /^(?:地理|地理环境|自然地理|地形地貌)$/],
  ["climate", /^(?:气候|气候特征)$/],
  ["resources", /^(?:自然资源|资源)$/],
  ["ethnic", /^(?:民族|民族构成|人口与民族)$/],
  ["religion", /^(?:宗教|宗教信仰)$/],
]);

export function splitSections(extract) {
  const result = [{ heading: "导言", parent: "", level: 0, text: "" }];
  const stack = [];
  for (const line of extract.split("\n")) {
    const heading = line.match(/^(={2,4})\s*(.*?)\s*\1\s*$/);
    if (heading) {
      const level = heading[1].length;
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      result.push({ heading: heading[2], parent: stack[0]?.heading || "", level, text: "" });
      stack.push({ heading: heading[2], level });
    } else result.at(-1).text += `${line}\n`;
  }
  return result;
}

function sentences(text) {
  return text
    .replace(/\[\d+(?:[-–,]\d+)*\]/g, "")
    .split(/(?<=[。！？])|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 12 && sentence.length <= 180 && /[。！？]$/.test(sentence));
}

function firstMatching(parts, predicate) {
  return parts.find((sentence) => predicate(sentence)) || null;
}

function sectionText(parts, key) {
  const pattern = sections.get(key);
  return parts.filter((part) => pattern.test(part.heading) || pattern.test(part.parent))
    .map((part) => part.text).join("\n");
}

export function makeProfile(raw) {
  const parts = splitSections(raw.extract);
  const intro = sentences(parts[0].text);
  const lead = parts[0].text.replace(/\[\d+(?:[-–,]\d+)*\]/g, "")
    .replace(/（\s*）/g, "").replace(/\s+/g, " ").trim()
    .match(/^[^。！？]+[。！？]/)?.[0];
  const from = (key, predicate = () => true) => firstMatching(sentences(sectionText(parts, key)), predicate);
  const historical = sentences(sectionText(parts, "history"))
    .filter((sentence) => /(?:19[5-9]\d|20[0-2]\d)年/.test(sentence) &&
      /(?:地区|盟|自治州|专区|地级|行政区划|市辖|设市)/.test(sentence) &&
      /(?:撤|设|改|并|划|升)/.test(sentence));
  const history = historical.slice(-2).join("") || null;
  const populationCandidate = (s) => /(?:常住人口|总人口)/.test(s) &&
    /(?:201[5-9]|202\d)年/.test(s) &&
    !/(?:汉族人口|各少数民族人口)/.test(s);
  const population = firstMatching(intro, populationCandidate) ||
    firstMatching(sentences(parts.filter((part) => /^(?:人口|人口概况)$/.test(part.heading))
      .map((part) => part.text).join("\n")), populationCandidate);
  const area = firstMatching(intro, (s) => /(?:总面积|面积约|面积为)/.test(s) && /(?:平方公里|平方千米)/.test(s)) ||
    firstMatching(sentences(sectionText(parts, "geography")), (s) => /(?:总面积|面积约|面积为)/.test(s) && /(?:平方公里|平方千米)/.test(s));
  const economy = from("economy", (s) => /(?:地区生产总值|GDP)/.test(s) &&
    /(?:202[0-6])年/.test(s)) ||
    from("economy", (s) => /(?:工业|农业|旅游业|服务业|制造业)/.test(s) &&
      !/(?:19[5-9]\d|200\d|201\d)年/.test(s));
  const ethnic = from("ethnic", (s) => /(?:藏族|维吾尔族|蒙古族|壮族|回族|苗族|彝族|侗族|傣族|哈萨克族|朝鲜族|满族|土家族)/.test(s) &&
    /(?:少数民族|民族人口|各民族|主要有|人口占|居民)/.test(s) &&
    !/(?:当时|古代|清朝|民国)/.test(s) &&
    !/^(?:汉族|全市以汉族)/.test(s));
  const profile = {
    code: raw.code,
    name: raw.name,
    type: raw.type,
    province: raw.province,
    source: raw.source,
    revisionId: raw.revisionId,
    revisedAt: raw.revisedAt,
    summary: (lead || intro[0])?.slice(0, 180) || null,
    history,
    population,
    economy,
    area,
    geography: from("geography", (s) => /(?:位于|地处|地形|地势|山地|平原)/.test(s)),
    climate: from("climate", (s) => /(?:气候|降水|气温)/.test(s)),
    resources: from("resources", (s) => /(?:矿|森林|水资源|能源|草原|湿地)/.test(s)),
    religion: from("religion", (s) => /(?:佛教|伊斯兰教|道教|基督教|天主教)/.test(s) &&
      /(?:主要有|市内|全市|当地|境内|信仰|宗教活动)/.test(s) &&
      !/(?:当时|清朝|民国)/.test(s)),
    ethnic: ethnic === population ? null : ethnic,
  };
  return profile;
}
