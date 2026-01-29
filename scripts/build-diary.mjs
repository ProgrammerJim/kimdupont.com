import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const DIARY_DIR = path.join(ROOT, "diary");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function writeUtf8(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Very small frontmatter parser for:
// ---
// key: value
// key2: value2
// ---
// markdown...
function parseFrontmatter(md) {
  const s = String(md ?? "");
  if (!s.startsWith("---\n")) {
    return { data: {}, body: s };
  }

  const end = s.indexOf("\n---\n", 4);
  if (end === -1) {
    return { data: {}, body: s };
  }

  const fmRaw = s.slice(4, end).trim();
  const body = s.slice(end + "\n---\n".length);

  const data = {};
  for (const line of fmRaw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    // Strip simple quotes if present
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    data[key] = val;
  }

  return { data, body };
}

function diaryIndexHtml(itemsHtml, hasItems) {
  const emptyHtml = hasItems
    ? ""
    : `<div class="empty">No entries yet.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Diary — Kim Dupont</title>

  <style>
    :root {
      --bg: #050505;
      --fg: #f5f5f5;
      --muted: #888;
      --border-subtle: #1a1a1a;
      --accent: #ffffff;
    }

    body {
      margin: 0;
      padding: 40px 22px;
      background: var(--bg);
      color: var(--fg);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .title {
      font-size: 34px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .subtitle {
      font-size: 13px;
      color: var(--muted);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    a.back {
      text-decoration: none;
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      border: 1px solid var(--border-subtle);
      padding: 6px 12px;
      border-radius: 10px;
      width: fit-content;
    }

    a.back:hover {
      color: var(--fg);
      border-color: var(--fg);
    }

    .list {
      list-style: none;
      padding: 0;
      margin: 0;
      border-top: 1px solid var(--border-subtle);
    }

    .list li {
      padding: 16px 0;
      border-bottom: 1px solid var(--border-subtle);
    }

    .list a {
      color: var(--fg);
      text-decoration: none;
      font-size: 16px;
      line-height: 1.4;
      display: inline-block;
    }

    .list a:hover {
      text-decoration: underline;
    }

    .meta {
      display: block;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      margin-top: 6px;
    }

    .empty {
      color: var(--muted);
      font-size: 14px;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back">← Home</a>

    <div>
      <h1 class="title">Diary</h1>
      <div class="subtitle">Unfiltered thoughts · Discipline · Truth</div>
    </div>

    <ul class="list">
${itemsHtml}
    </ul>

    ${emptyHtml}
  </div>
</body>
</html>`;
}

function diaryEntryHtml({ title, date, bodyHtml }) {
  const safeTitle = escapeHtml(title || "Diary Entry");
  const safeDate = escapeHtml(date || "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} — Diary</title>

  <style>
    :root {
      --bg: #050505;
      --fg: #f5f5f5;
      --muted: #888;
      --border-subtle: #1a1a1a;
      --accent: #ffffff;
    }

    body {
      margin: 0;
      padding: 40px 22px;
      background: var(--bg);
      color: var(--fg);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    a.back {
      text-decoration: none;
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      border: 1px solid var(--border-subtle);
      padding: 6px 12px;
      border-radius: 10px;
      width: fit-content;
    }

    a.back:hover {
      color: var(--fg);
      border-color: var(--fg);
    }

    h1 {
      font-size: 30px;
      font-weight: 650;
      margin: 0;
    }

    .date {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-top: -6px;
    }

    article {
      border-top: 1px solid var(--border-subtle);
      padding-top: 18px;
      line-height: 1.7;
      font-size: 17px;
    }

    article a { color: var(--fg); }
    article code {
      background: #111;
      border: 1px solid var(--border-subtle);
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 0.95em;
    }
    article pre {
      background: #0b0b0b;
      border: 1px solid var(--border-subtle);
      padding: 12px;
      border-radius: 12px;
      overflow: auto;
    }
    article h2, article h3 { margin-top: 26px; }
    article p { margin: 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/diary/" class="back">← Diary</a>
    <h1>${safeTitle}</h1>
    ${safeDate ? `<div class="date">${safeDate}</div>` : ""}
    <article>
      ${bodyHtml}
    </article>
  </div>
</body>
</html>`;
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"));
  const posts = [];

  for (const f of files) {
    const full = path.join(POSTS_DIR, f);
    const raw = readUtf8(full);
    const { data, body } = parseFrontmatter(raw);

    const title = data.title || f.replace(/\.md$/i, "");
    const slug = data.slug || f.replace(/\.md$/i, "");
    const date = data.date || "";

    posts.push({
      title,
      slug,
      date,
      bodyMd: body,
    });
  }

  // sort newest first (date string YYYY-MM-DD sorts nicely)
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return posts;
}

async function main() {
  ensureDir(DIARY_DIR);

  const posts = loadPosts();

  // Generate entry pages
  for (const p of posts) {
    const bodyHtml = marked.parse(p.bodyMd || "");
    const out = diaryEntryHtml({
      title: p.title,
      date: p.date,
      bodyHtml,
    });

    const outPath = path.join(DIARY_DIR, p.slug, "index.html");
    writeUtf8(outPath, out);
  }

  // Generate index
  const itemsHtml = posts
    .map(p => {
      const t = escapeHtml(p.title);
      const d = escapeHtml(p.date || "");
      return `      <li>
        <a href="/diary/${escapeHtml(p.slug)}/">${t}</a>
        ${d ? `<span class="meta">${d}</span>` : ""}
      </li>`;
    })
    .join("\n");

  const indexHtml = diaryIndexHtml(itemsHtml, posts.length > 0);
  writeUtf8(path.join(DIARY_DIR, "index.html"), indexHtml);

  console.log(`Diary generated: ${posts.length} entries`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
