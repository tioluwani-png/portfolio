# Tioluwani Akeju

Personal site. Figuring it out is the skill.

## Writing a post
Add a Markdown file to `content/posts/`, e.g. `content/posts/my-first-post.md`:

```
---
title: How a ₦2,500 ad started Relaks
date: 2026-05-24
shelf: life
summary: One line shown in the list.
---

The post, in Markdown.
```

Shelves: `life`, `building`, `ai-explained`, `ai-takes`, `poems`, `research`. Add `draft: true` to hide a post.
The Writing section appears on the site once there is at least one post.

## Updating the Now page
Edit `content/now.md` and change its `updated` date.

## Email signup
Put your Substack address in `site.config.json` under `substack` (for example `https://yourname.substack.com`).

## Build
`npm install` then `npm run build`. Vercel does this on every push and serves `dist/`.
