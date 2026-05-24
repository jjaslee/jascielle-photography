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

Place images in `public/images/portraits`, `events`, and `places`, then update `src/data/galleries.js`.

## Customize

- **Email:** `jascielle.photos@gmail.com` (About, Book, footer)
- **Region:** edit copy on `Home.jsx` and `About.jsx`
- **Theme:** stored in `localStorage` under `jascielle-theme`
