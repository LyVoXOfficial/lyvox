const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const CATEGORIES_YAML = path.resolve(__dirname, "..", "..", "seed", "categories.ru.yaml");
const OUTPUT_JSON = path.resolve(__dirname, "..", "..", "seed", "catalog", "taxonomy.json");

const translitMap = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => {
      if (translitMap[ch]) return translitMap[ch];
      if (/[a-z0-9]/.test(ch)) return ch;
      if (ch === " " || ch === "_" || ch === "/") return "-";
      return "";
    })
    .join("")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

function enrich(node, parentPath = "") {
  const slug = slugify(node.name_ru);
  const pathStr = parentPath ? `${parentPath}/${slug}` : slug;
  const children = (node.children || []).map((child) => enrich(child, pathStr));

  return {
    name_ru: node.name_ru,
    slug,
    path: pathStr,
    icon: node.icon ?? null,
    children,
  };
}

function main() {
  const raw = fs.readFileSync(CATEGORIES_YAML, "utf8");
  const doc = yaml.load(raw);
  const result = doc.map((node) => enrich(node));

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2), "utf8");
  console.log(`Saved taxonomy to ${OUTPUT_JSON}`);
}

main();

