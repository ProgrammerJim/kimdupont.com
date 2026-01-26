import fs from "node:fs";
import path from "node:path";
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { marked } from "marked";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });
const DB_ID = process.env.NOTION_DATABASE_ID;

if (!process.env.NOTION_TOKEN || !DB_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DATABASE_ID env vars.");
  process.exit(1);
}

const ROOT = process.cwd();
const DIARY_DIR = path.join(ROOT, "diary");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeSlug(slug) {
  return String(slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function pageHtml({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{max-width:780px;margin:48px auto;padding:0 16px;font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,Arial}
    a{text-decoration:none}
    header{margin-bottom:24px}
    h1{line-height:1.2;margin:0 0 8px}
    time{opacity:.7}
    .meta{opacity:.6;font-size:14px}
    ul{padding-left:18px}
    li{margin:10px 0}
    article img{max-width:100%;height:auto}
    pre{overflow:auto;padding:12px;background:#f6f6f6;border-radius:10px}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function listProps(schema) {
  return Object.entries(schema).map(([name, def]) => ({ name, type: def.type }));
}

function findPropName(schema, { type, names }) {
  const entries = Object.entries(schema);
  const lowered = new Map(entries.map(([n, d]) => [n.toLowerCase(), { name: n, def: d }]));

  for (const wanted of names) {
    const hit = lowered.get(wanted.toLowerCase());
    if (hit && hit.def.type === type) return hit.name;
  }

  for (const [n, d] of entries) {
    if (d.type === type) return n;
  }

  return null;
}

function getProp(page, propName) {
  return page.properties?.[propName];
}

function readTitle(page, propName) {
  const p = getProp(page, propName);
  return p?.type === "title" ? (p.title?.[0]?.plain_text ?? "") : "";
}

function readText(page, propName) {
  const p = getProp(page, propName);
  if (!p) return "";
  if (p.type === "rich_text") return p.rich_text?.[0]?.plain_text ?? "";
  if (p.type === "title") return p.title?.[0]?.plain_text ?? "";
  return "";
}

function readDate(page, propName) {
  const p = getProp(page, propName);
  return p?.type === "date" ? (p.date?.start ?? "") : "";
}

async function main() {
  const db = await notion.databases.retrieve({ database_id: DB_ID });

  console.log("Notion DB title:", db.title?.[0]?.plain_text ?? "(no title)");
  console.log("DB properties:", listProps(db.properties));

  const titleProp = findPropName(db.properties, { type: "title", names: ["Title", "Name"] });
  const dateProp = findPropName(db.properties, { type: "date", names: ["Date", "Day", "Datum"] });
  const slugProp = findPropName(db.properties, { type: "rich_text", names: ["Slug", "URL", "Path"] });
  const pubProp = findPropName(db.properties, { type: "checkbox", names: ["Published", "Public", "Live"] });

  if (!titleProp) throw new Error("No Title/Name property found (type=title).");
  if (!slugProp) throw new Error("No Slug property found (type=rich_text). Create a Text column like 'Slug'.");
  if (!pubProp) throw new Error("No Published property found (type=checkbox). Create a Checkbox column like 'Published'.");

  console.log("Using properties:", { titleProp, dateProp, slugProp, pubProp });

  const query = {
    database_id: DB_ID,
    filter: { property: pubProp, checkbox: { equals: true } }
  };

  if (dateProp) {
    query.sorts = [{ property: dateProp, direction: "descending" }];
  }

  const res = await notion.databases.query(query);

  const entries = [];

  for (const page of res.results) {
    const title = readTitle(page, titleProp) || "Untitled";
    const date = dateProp ? readDate(page, dateProp) : "";
    const slugRaw = readText(page, slugProp) || date || page.id;
    const slug = safeSlug(slugRaw);
    if (!slug) continue;

    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks)?.parent ?? "";
    const contentHtml = marked.parse(mdString);

    const postBody = `
<header>
  <a href="/diary/">← Back to diary</a>
  <h1>${escapeHtml(title)}</h1>
  ${date ? `<time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>` : ""}
  <div class="meta">${escapeHtml(slug)}</div>
</header>
<article>${contentHtml}</article>
`;

    const outDir = path.join(DIARY_DIR, slug);
    writeFile(path.join(outDir, "index.html"), pageHtml({ title: `${title} — Diary`, body: postBody }));

    entries.push({ title, date, slug });
  }

  const list = entries
    .map((e) => `<li><a href="/diary/${escapeHtml(e.slug)}/">${escapeHtml(e.date)} — ${escapeHtml(e.title)}</a></li>`)
    .join("\n");

  const indexBody = `
<header>
  <h1>Diary</h1>
  <p class="meta">Entries from Notion</p>
</header>
<ul>
${list || "<li>No published entries yet.</li>"}
</ul>
`;

  writeFile(path.join(DIARY_DIR, "index.html"), pageHtml({ title: "Diary", body: indexBody }));

  console.log(`Built ${entries.length} diary entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
