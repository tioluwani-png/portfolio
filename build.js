// Builds the site into dist/.
// Pages:  src/home.html -> /           content/now.md -> /now/
//         content/posts/*.md -> /writing/<slug>/ plus the /writing/ list.
// A post is a Markdown file that starts with a small header, e.g.
//   ---
//   title: How a ₦2,500 ad started Relaks
//   date: 2026-05-24
//   shelf: life
//   summary: One line shown in the list.
//   draft: false
//   ---
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (rel, html) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- front matter ------------------------------------------------------------
function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { meta, body };
}

const fmtDate = (iso) => {
  const d = new Date(iso + 'T12:00:00Z');
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// --- content -----------------------------------------------------------------
const postsDir = path.join(ROOT, 'content/posts');
const posts = (fs.existsSync(postsDir) ? fs.readdirSync(postsDir) : [])
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { meta, body } = parse(path.join(postsDir, f));
    const slug = meta.slug || f.replace(/\.md$/, '');
    if (!meta.title || !meta.date) throw new Error(`${f}: needs a title and a date`);
    if (meta.shelf && !config.shelves[meta.shelf]) throw new Error(`${f}: unknown shelf "${meta.shelf}"`);
    return { ...meta, slug, body };
  })
  .filter((p) => p.draft !== 'true')
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const hasWriting = posts.length > 0;

// --- shared pieces -----------------------------------------------------------
function nav(current) {
  const items = [['/#route', 'The route', 'home'], ['/#tickets', 'Tickets', 'home-t']];
  if (hasWriting) items.push(['/writing/', 'Writing', 'writing']);
  items.push(['/change/', 'Change Dey?', 'change'], ['/now/', 'Now', 'now'], ['/#contact', 'Last stop', 'contact']);
  return '<ul>' + items
    .map(([href, label, key]) => `<li><a href="${href}"${key === current ? ' aria-current="page"' : ''}>${label}</a></li>`)
    .join('') + '</ul>';
}

function signup() {
  if (!config.substack) return '';
  const base = config.substack.replace(/\/$/, '');
  return `<section class="signup" aria-labelledby="signup-h">
      <h2 id="signup-h">Get the next one by email</h2>
      <p>New writing and build updates, straight to your inbox. No spam.</p>
      <iframe src="${esc(base)}/embed" title="Subscribe by email" loading="lazy"></iframe>
    </section>`;
}

const shell = read('src/page.html');
function page({ title, description, current, body, head = '' }) {
  return shell
    .replace('{{TITLE}}', esc(title))
    .replace('{{DESCRIPTION}}', esc(description))
    .replace('{{HEAD}}', head)
    .replace('{{NAV}}', nav(current))
    .replace('{{SIGNUP}}', signup())
    .replace('{{BODY}}', body);
}

// --- build -------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });

// Home
write('index.html', read('src/home.html').replace('{{NAV}}', nav('')).replace('{{SIGNUP}}', signup()));

// Now
const now = parse(path.join(ROOT, 'content/now.md'));
write('now/index.html', page({
  title: `Now · ${config.name}`,
  description: 'What I am working on this month.',
  current: 'now',
  body: `    <p class="kicker">Now</p>
    <h1 class="page-title">${esc(now.meta.title || 'What I’m doing now')}</h1>
    ${now.meta.updated ? `<p class="updated">Updated ${fmtDate(now.meta.updated)}</p>` : ''}
    <div class="prose">${marked.parse(now.body)}</div>`,
}));

// Change Dey? (price tool). Data: content/change-data.json, built from NBS price watches.
const changeData = read('content/change-data.json').trim();
const changeDesc = 'See what your money bought before and what it buys now. Official NBS prices for food, fuel and transport.';
write('change/index.html', page({
  title: 'Change Dey? · What your money buys now',
  description: changeDesc,
  current: 'change',
  head: `<meta property="og:title" content="Change Dey?">
<meta property="og:description" content="${esc(changeDesc)}">
<meta property="og:image" content="${config.url}/change/og.png">
<meta property="og:url" content="${config.url}/change/">
<meta name="twitter:card" content="summary_large_image">`,
  body: read('src/change.html').replace('{{DATA}}', () => changeData),
}));

// Writing
if (hasWriting) {
  const usedShelves = Object.entries(config.shelves).filter(([k]) => posts.some((p) => p.shelf === k));
  const list = (items) => `<ul class="posts">${items.map((p) => `
      <li><a href="/writing/${p.slug}/">
        <span class="meta">${fmtDate(p.date)}${p.shelf ? ' · ' + esc(config.shelves[p.shelf]) : ''}</span>
        <span class="t">${esc(p.title)}</span>
        ${p.summary ? `<span class="s">${esc(p.summary)}</span>` : ''}
      </a></li>`).join('')}
    </ul>`;
  const shelfNav = (active) => usedShelves.length < 2 ? '' : `<ul class="shelves">
      <li><a href="/writing/"${active ? '' : ' aria-current="true"'}>All</a></li>
      ${usedShelves.map(([k, label]) => `<li><a href="/writing/${k}/"${k === active ? ' aria-current="true"' : ''}>${esc(label)}</a></li>`).join('')}
    </ul>`;

  write('writing/index.html', page({
    title: `Writing · ${config.name}`,
    description: 'Essays, AI explainers, opinions and research by Tioluwani Akeju.',
    current: 'writing',
    body: `    <p class="kicker">Writing</p>
    <h1 class="page-title">Things I’ve figured out so far</h1>
    ${shelfNav('')}
    ${list(posts)}`,
  }));

  for (const [k, label] of usedShelves) {
    write(`writing/${k}/index.html`, page({
      title: `${label} · ${config.name}`,
      description: `${label}: writing by Tioluwani Akeju.`,
      current: 'writing',
      body: `    <p class="kicker">Writing</p>
    <h1 class="page-title">${esc(label)}</h1>
    ${shelfNav(k)}
    ${list(posts.filter((p) => p.shelf === k))}`,
    }));
  }

  posts.forEach((p, i) => {
    const newer = posts[i - 1];
    const older = posts[i + 1];
    write(`writing/${p.slug}/index.html`, page({
      title: `${p.title} · ${config.name}`,
      description: p.summary || p.title,
      current: 'writing',
      body: `    <p class="kicker">${fmtDate(p.date)}${p.shelf ? ' · ' + esc(config.shelves[p.shelf]) : ''}</p>
    <h1 class="page-title">${esc(p.title)}</h1>
    <article class="prose">${marked.parse(p.body)}</article>
    <nav class="post-foot" aria-label="More writing">
      ${older ? `<a href="/writing/${older.slug}/">← ${esc(older.title)}</a>` : '<span></span>'}
      ${newer ? `<a href="/writing/${newer.slug}/">${esc(newer.title)} →</a>` : '<a href="/writing/">All writing →</a>'}
    </nav>`,
    }));
  });
}

console.log(`Built ${posts.length} post(s), writing section ${hasWriting ? 'on' : 'hidden'}, signup ${config.substack ? 'on' : 'hidden'}.`);
