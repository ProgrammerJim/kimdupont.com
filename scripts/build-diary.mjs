import fs from "node:fs";
import path from "node:path";
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

const DB_ID = process.env.NOTION_DATABASE_ID;

if (!process.env.NOTION_TOKEN || !DB_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DATABASE_ID");
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), "content", "posts");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\-]+/g, "-")
    .replace(/\-+/g, "-")
    .replace(/^\-|\-$/g, "");
}

function getPropText(page, propName) {
  const prop = page.properties?.[propName];
  if (!prop) return "";
  if (prop.type === "title") return (prop.title || []).map(t => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
  if (prop.type === "checkbox") return !!prop.checkbox;
  if (prop.type === "date") return prop.date?.start || "";
  return "";
}

function frontmatter(obj) {
  const lines = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v).includes(":") ? JSON.stringify(v) : v}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

async function main() {
  ensureDir(OUT_DIR);

  const dbId = DB_ID.replaceAll("-", "");

  const res = await notion.databases.query({
    database_id: dbId,
    filter: {
      property: "Published",
      checkbox: { equals: true },
    },
    sorts: [{ property: "Date", direction: "descending" }],
  });

  const pages = res.results || [];
  console.log(`Found ${pages.length} published posts`);

  for (const page of pages) {
    const title = getPropText(page, "Title") || "Untitled";
    const slugRaw = getPropText(page, "Slug");
    const date = getPropText(page, "Date");

    const slug = safeSlug(slugRaw || title);
    if (!slug) continue;

    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const md = n2m.toMarkdownString(mdBlocks).parent || "";

    const outPath = path.join(OUT_DIR, `${slug}.md`);
    fs.writeFileSync(
      outPath,
      frontmatter({ title, slug, date }) + md,
      "utf8"
    );

    console.log(`Wrote ${outPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
