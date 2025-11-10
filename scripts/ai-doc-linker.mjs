import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const verify = args.includes("--verify");
const previewFlag = args.includes("--preview");
const preview = previewFlag || (!apply && !verify && !previewFlag);

const root = process.cwd();

const TARGETS = [
  { dir: path.join(root, "docs", "domains"), type: "Domains" },
  { dir: path.join(root, "docs", "development"), type: "Development" },
  { dir: path.join(root, "docs", "catalog"), type: "Catalog" }
];

const EXTRA_FILES = [
  { file: path.join(root, "docs", "API_REFERENCE.md"), type: "Core" }
];

const KEYWORD_PATTERNS = [
  { name: "moderation", regex: /\bmoderation\b/i, weight: 3 },
  { name: "trust_score", regex: /\btrust[_\s-]*score\b/i, weight: 4 },
  { name: "trust", regex: /\btrust\b/i, weight: 2 },
  { name: "adverts", regex: /\badvert(s|ising)?\b/i, weight: 4 },
  { name: "media", regex: /\bmedia\b/i, weight: 2 },
  { name: "profile", regex: /\bprofile(s)?\b/i, weight: 3 },
  { name: "phones", regex: /\bphone(s)?\b/i, weight: 3 },
  { name: "otp", regex: /\bOTP\b/i, weight: 3 },
  { name: "consents", regex: /\bconsent(s)?\b/i, weight: 2 },
  { name: "api", regex: /\bAPI\b/i, weight: 2 },
  { name: "categories", regex: /\bcategor(y|ies)\b/i, weight: 3 },
  { name: "catalog", regex: /\bcatalog\b/i, weight: 4 },
  { name: "search", regex: /\bsearch\b/i, weight: 3 },
  { name: "filters", regex: /\bfilter(s)?\b/i, weight: 2 },
  { name: "billing", regex: /\bbilling\b/i, weight: 3 },
  { name: "subscription", regex: /\bsubscription(s)?\b/i, weight: 3 },
  { name: "chat", regex: /\bchat\b/i, weight: 3 },
  { name: "messages", regex: /\bmessage(s)?\b/i, weight: 2 },
  { name: "notifications", regex: /\bnotification(s)?\b/i, weight: 3 },
  { name: "i18n", regex: /\bi18n\b/i, weight: 4 },
  { name: "localization", regex: /\blocali[sz]ation\b/i, weight: 3 },
  { name: "seo", regex: /\bSEO\b/i, weight: 4 },
  { name: "analytics", regex: /\banalytics\b/i, weight: 3 },
  { name: "support", regex: /\bsupport\b/i, weight: 2 },
  { name: "disputes", regex: /\bdispute(s)?\b/i, weight: 2 },
  { name: "devops", regex: /\bdevops\b/i, weight: 3 },
  { name: "vehicles", regex: /\bvehicle(s)?\b/i, weight: 4 },
  { name: "jobs", regex: /\bjob(s)?\b/i, weight: 2 },
  { name: "real_estate", regex: /\breal estate\b/i, weight: 2 },
  { name: "verification", regex: /\bverif(?:ication|ied|y)\b/i, weight: 3 },
  { name: "auth", regex: /\bauth(entication)?\b/i, weight: 3 },
  { name: "mfa", regex: /\bMFA\b/i, weight: 3 },
  { name: "webauthn", regex: /\bWebAuthn\b/i, weight: 3 },
  { name: "totp", regex: /\bTOTP\b/i, weight: 3 },
  { name: "rate_limiting", regex: /rate limit/i, weight: 2 },
  { name: "storage", regex: /\bstorage\b/i, weight: 2 },
  { name: "logs", regex: /\blog(s)?\b/i, weight: 2 },
  { name: "rls", regex: /\bRLS\b/i, weight: 4 },
  { name: "supabase", regex: /\bSupabase\b/i, weight: 3 },
  { name: "ai", regex: /\bAI\b/i, weight: 2 },
  { name: "moderator_queue", regex: /moderation queue/i, weight: 3 },
  { name: "catalog_ai", regex: /AI enrichment/i, weight: 3 },
  { name: "postform", regex: /PostForm/i, weight: 3 },
  { name: "trust_flows", regex: /reputation|fraud/i, weight: 2 },
  { name: "analytics_pipeline", regex: /pipeline|metrics/i, weight: 2 }
];

function gatherDocs() {
  const docs = [];
  for (const target of TARGETS) {
    const files = walkDir(target.dir);
    for (const filePath of files) {
      docs.push({ path: filePath, type: target.type });
    }
  }
  for (const extra of EXTRA_FILES) {
    docs.push({ path: extra.file, type: extra.type });
  }
  return docs;
}

function walkDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

function addToken(map, token, weight) {
  const current = map.get(token);
  if (!current || current < weight) {
    map.set(token, weight);
  }
}

function extractTokens(doc) {
  const content = doc.content;
  const tokens = new Map();
  const tables = new Set();
  const endpoints = new Set();
  const tasks = new Set();

  const tableRegex = /\b(public\.[a-z0-9_]+)\b/gi;
  let match;
  while ((match = tableRegex.exec(content))) {
    const table = match[1].toLowerCase();
    tables.add(table);
    addToken(tokens, `table:${table}`, 6);
  }

  const endpointRegex = /\/(api\/[a-z0-9\/_-]+)/gi;
  while ((match = endpointRegex.exec(content))) {
    let endpoint = match[1].toLowerCase();
    endpoint = endpoint.replace(/[\.,;:\)\]\}]+$/, "");
    endpoints.add(endpoint);
    addToken(tokens, `api:${endpoint}`, 5);
  }

  const taskRegex = /\b([A-Z]{2,}-\d+)\b/g;
  while ((match = taskRegex.exec(content))) {
    const task = match[1];
    tasks.add(task);
    addToken(tokens, `task:${task}`, 4);
  }

  const lower = content.toLowerCase();
  for (const kw of KEYWORD_PATTERNS) {
    if (kw.regex.test(content)) {
      addToken(tokens, `kw:${kw.name}`, kw.weight);
    }
  }

  const baseName = path.basename(doc.path, ".md");
  const baseParts = baseName.split(/[-_]/g);
  for (const part of baseParts) {
    if (part.length >= 3) {
      addToken(tokens, `kw:${part.toLowerCase()}`, 2);
    }
  }

  return { tokens, tables: Array.from(tables), endpoints: Array.from(endpoints), tasks: Array.from(tasks) };
}

function computeScore(aTokens, bTokens) {
  let score = 0;
  for (const [token, weightA] of aTokens.entries()) {
    const weightB = bTokens.get(token);
    if (weightB) {
      score += Math.min(weightA, weightB);
    }
  }
  return score;
}

function posixPath(p) {
  return p.split(path.sep).join("/");
}

function relativeLink(fromPath, toPath) {
  const fromDir = path.dirname(fromPath);
  const relative = path.relative(fromDir, toPath);
  let rel = posixPath(relative);
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  return rel;
}

function labelFor(docPath, type) {
  const docsRoot = path.join(root, "docs");
  if (type === "Core") {
    return path.basename(docPath);
  }
  const typeDir = path.join(docsRoot, type.toLowerCase());
  const relative = path.relative(typeDir, docPath);
  return posixPath(relative);
}

function selectLinks(doc, docs) {
  const MIN_SCORE = 3;
  const selected = [];
  const selectedByType = new Map();

  const candidates = [];
  for (const target of docs) {
    if (target.path === doc.path) continue;
    const score = computeScore(doc.tokens, target.tokens);
    if (score <= 0) continue;
    candidates.push({ target, score });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return posixPath(a.target.path).localeCompare(posixPath(b.target.path));
  });

  for (const cand of candidates) {
    if (selected.length >= 5) break;
    if (cand.score < MIN_SCORE && selected.length >= 1) continue;
    selected.push(cand);
    if (!selectedByType.has(cand.target.type)) {
      selectedByType.set(cand.target.type, []);
    }
    selectedByType.get(cand.target.type).push(cand);
  }

  const ensureCore = () => {
    if (!doc.endpoints.length) return;
    const hasCore = selected.some((c) => c.target.type === "Core");
    if (!hasCore) {
      const apiDoc = docs.find((d) => d.type === "Core");
      if (apiDoc) {
        selected.push({ target: apiDoc, score: 3 });
        if (!selectedByType.has("Core")) selectedByType.set("Core", []);
        selectedByType.get("Core").push({ target: apiDoc, score: 3 });
      }
    }
  };

  ensureCore();

  if (selected.length < 2 && doc.tables.length) {
    const schemaDoc = docs.find((d) => posixPath(d.path).endsWith("docs/development/database-schema.md"));
    if (schemaDoc && !selected.some((c) => c.target.path === schemaDoc.path)) {
      selected.push({ target: schemaDoc, score: 3 });
      if (!selectedByType.has(schemaDoc.type)) selectedByType.set(schemaDoc.type, []);
      selectedByType.get(schemaDoc.type).push({ target: schemaDoc, score: 3 });
    }
  }

  if (selected.length < 2 && doc.type === "Development") {
    const checklist = docs.find((d) => posixPath(d.path).endsWith("docs/development/MASTER_CHECKLIST.md"));
    if (checklist && !selected.some((c) => c.target.path === checklist.path)) {
      selected.push({ target: checklist, score: 3 });
      if (!selectedByType.has(checklist.type)) selectedByType.set(checklist.type, []);
      selectedByType.get(checklist.type).push({ target: checklist, score: 3 });
    }
  }

  if (selected.length > 5) {
    selected.length = 5;
    for (const [type, arr] of selectedByType.entries()) {
      selectedByType.set(type, arr.filter((item) => selected.some((s) => s.target.path === item.target.path)));
    }
  }

  const linksByType = new Map();
  for (const cand of selected) {
    const type = cand.target.type;
    const rel = relativeLink(doc.path, cand.target.path);
    const label = labelFor(cand.target.path, type);
    if (!linksByType.has(type)) {
      linksByType.set(type, []);
    }
    const existing = linksByType.get(type).find((l) => l.href === rel);
    if (!existing) {
      linksByType.get(type).push({ href: rel, label });
    }
  }

  return linksByType;
}

function buildSection(linksByType) {
  if (!linksByType.size) return "";
  const orderedTypes = ["Domains", "Development", "Catalog", "Core"];
  const lines = ["---", "", "## \uD83D\uDD17 Related Docs", ""];
  for (const type of orderedTypes) {
    const links = linksByType.get(type);
    if (!links || !links.length) continue;
    const rendered = links
      .slice(0, 5)
      .map((l) => `[${l.label}](${l.href})`)
      .join(" \u2022 ");
    lines.push(`**${type}:** ${rendered}`);
  }
  return lines.join("\n") + "\n";
}

function removeExistingSection(content) {
  const pattern = /\n?-{3,}\s*\n## \uD83D\uDD17 Related Docs[\s\S]*$/;
  return content.replace(pattern, "").trimEnd() + "\n";
}

function updateDoc(doc, section) {
  const original = fs.readFileSync(doc.path, "utf8");
  const cleaned = removeExistingSection(original);
  const updated = cleaned + (cleaned.endsWith("\n\n") ? "" : "\n") + section;
  fs.writeFileSync(doc.path, updated, "utf8");
}

function generateIndex(relationships) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const lines = [
    "# AI Documentation Cross-Reference",
    "",
    `last_sync: ${timestamp}`,
    "",
    "## Cross-Reference Index",
    ""
  ];
  const docsRoot = path.join(root, "docs");
  const sources = Array.from(relationships.keys())
    .map((absPath) => ({
      abs: absPath,
      rel: posixPath(path.relative(docsRoot, absPath))
    }))
    .sort((a, b) => a.rel.localeCompare(b.rel));
  for (const sourceInfo of sources) {
    const rel = relationships.get(sourceInfo.abs);
    const targets = [];
    for (const [, links] of rel.entries()) {
      for (const link of links) {
        const normalized = normalizeIndexTarget(sourceInfo.abs, link.href);
        targets.push(normalized);
      }
    }
    const uniqueTargets = Array.from(new Set(targets));
    lines.push(`${sourceInfo.rel} \u2192 [${uniqueTargets.join(", ")}]`);
  }
  lines.push("\n");
  const indexPath = path.join(root, "docs", "AI_LINKS_INDEX.md");
  fs.writeFileSync(indexPath, lines.join("\n"), "utf8");
}

function normalizeIndexTarget(sourcePath, href) {
  const sourceDir = path.dirname(sourcePath);
  const targetPath = path.resolve(sourceDir, href);
  const docsRoot = path.join(root, "docs");
  const relative = path.relative(docsRoot, targetPath);
  return posixPath(relative);
}

function verifyLinks(docs, relationships) {
  const docsRoot = path.join(root, "docs");
  const issues = [];
  for (const doc of docs) {
    const rel = relationships.get(doc.path);
    if (!rel) continue;
    for (const links of rel.values()) {
      for (const link of links) {
        const absoluteTarget = path.resolve(path.dirname(doc.path), link.href);
        if (!fs.existsSync(absoluteTarget)) {
          issues.push({
            source: posixPath(path.relative(docsRoot, doc.path)),
            href: link.href
          });
        }
      }
    }
  }
  return issues;
}

function updateKnowledgeMap() {
  const kmPath = path.join(root, "docs", "KNOWLEDGE_MAP.md");
  let content = fs.readFileSync(kmPath, "utf8");
  const section = "## \uD83E\uDD16 AI Enrichment & Cross-Reference System\n\nThis workspace maintains AI-generated links between domain, development, and catalog documents.\n\nSee `docs/AI_LINKS_INDEX.md` for the full matrix of relationships.\n";
  const regex = /## \uD83E\uDD16 AI Enrichment & Cross-Reference System[\s\S]*/;
  if (regex.test(content)) {
    content = content.replace(regex, section.trim() + "\n");
  } else {
    if (!content.endsWith("\n")) content += "\n";
    content += "\n" + section + "\n";
  }
  fs.writeFileSync(kmPath, content, "utf8");
}

function main() {
  const docs = gatherDocs();
  for (const doc of docs) {
    doc.content = fs.readFileSync(doc.path, "utf8");
    const tokens = extractTokens(doc);
    doc.tokens = tokens.tokens;
    doc.tables = tokens.tables;
    doc.endpoints = tokens.endpoints;
    doc.tasks = tokens.tasks;
  }

  const relationships = new Map();

  for (const doc of docs) {
    const linksByType = selectLinks(doc, docs);
    relationships.set(doc.path, linksByType);
  }

  const verificationIssues = verifyLinks(docs, relationships);

  if (preview) {
    let totalLinks = 0;
    for (const rel of relationships.values()) {
      for (const links of rel.values()) {
        totalLinks += links.length;
      }
    }
    console.log(`Docs analyzed: ${docs.length}`);
    console.log(`Total links identified: ${totalLinks}`);
    if (args.includes("--debug")) {
      for (const [docPath, linksByType] of relationships.entries()) {
        console.log(`\n${posixPath(path.relative(root, docPath))}`);
        for (const [type, links] of linksByType.entries()) {
          const line = links.map((l) => `${l.label} -> ${l.href}`).join(", ");
          console.log(`  ${type}: ${line}`);
        }
      }
    }
  }

  if (verify) {
    if (verificationIssues.length) {
      console.error("Cross-reference verification failed:");
      for (const issue of verificationIssues) {
        console.error(`  ${issue.source} → ${issue.href}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log("All cross-reference targets exist.");
  }

  if (apply) {
    if (verificationIssues.length) {
      console.error("Warning: applying updates despite missing targets:");
      for (const issue of verificationIssues) {
        console.error(`  ${issue.source} → ${issue.href}`);
      }
    }
    for (const doc of docs) {
      const rel = relationships.get(doc.path);
      const section = buildSection(rel);
      if (!section.trim()) continue;
      updateDoc(doc, section);
    }
    generateIndex(relationships);
    updateKnowledgeMap();
    console.log("Applied AI linking updates." );
  }
}

main();
