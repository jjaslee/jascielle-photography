/** Discourage casual copy/save/drag of gallery images. CSS-first; minimal JS. */

function isProtectedImage(target) {
  return target?.closest?.('.protected-image')
}

function blockImageContextMenu(e) {
  if (!isProtectedImage(e.target)) return
  e.preventDefault()
}

export const protectedGalleryHandlers = {
  onContextMenu: blockImageContextMenu,
}
