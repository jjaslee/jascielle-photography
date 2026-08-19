# Jascielle Photography

Portrait and event photography site with clean B&W UI, full-color galleries, light/dark mode, subtle parallax, and smooth scroll (Lenis).

## Develop

```bash
cd ~/Desktop/jascielle-photography
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Add your photos

Use the local [Photo Catalog Manager](docs/photo-manager.md) to add, edit, audit, and validate Work photographs.

## Book form (Formspree)

1. Create a form at [formspree.io](https://formspree.io) and set notifications to `jascielle.photos@gmail.com`.
2. Copy the endpoint (e.g. `https://formspree.io/f/mqejdlwk`).
3. Local: copy `.env.example` to `.env` and set `VITE_FORMSPREE_ENDPOINT`.
4. Vercel: add the same variable under **Settings → Environment Variables**, then redeploy.

## Customize

- **Email:** `jascielle.photos@gmail.com` (About, Book, footer)
- **Region:** edit copy on `Home.jsx` and `About.jsx`
- **Theme:** stored in `localStorage` under `jascielle-theme`
