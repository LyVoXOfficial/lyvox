// scripts/seedCategories.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

// @ts-ignore - js-yaml ships without types by default
import yaml from "js-yaml";

/**
 * Перед запуском установите переменные окружения:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (секретный ключ сервисной роли!)
 *
 * Скрипт заполняет таблицу public.categories структурой из seed/categories.ru.yaml.
 */

type Node = {
  name_ru: string;
  icon?: string;
  children?: Node[];
};

function slugify(input: string): string {
  const translitMap: Record<string, string> = {
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

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env before running.");
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const yamlPath = path.resolve("seed", "categories.ru.yaml");
  const doc = yaml.load(readFileSync(yamlPath, "utf8")) as Node[];

  let sortCounter = 0;

  async function upsertNode(
    node: Node,
    parent: { id: string | null; path: string; level: number },
  ) {
    const level = parent.level + 1;
    if (level > 3) return;

    const slug = slugify(node.name_ru);
    const myPath = parent.path ? `${parent.path}/${slug}` : slug;
    const icon = node.icon ?? null;

    sortCounter += 1;

    const { data, error } = await supabase
      .from("categories")
      .upsert(
        {
          parent_id: parent.id,
          slug,
          level,
          name_ru: node.name_ru,
          path: myPath,
          sort: sortCounter,
          icon,
          is_active: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (error) {
      console.error("Upsert error for", node.name_ru, error.message);
      throw error;
    }

    const currentId = data!.id as string;

    if (node.children?.length) {
      for (const child of node.children) {
        await upsertNode(child, { id: currentId, path: myPath, level });
      }
    }
  }

  for (const top of doc) {
    await upsertNode(top, { id: null, path: "", level: 0 });
  }

  console.log("Categories seeded successfully.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
