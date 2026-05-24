/** Discourage casual copy/save/drag of gallery and hero images. CSS-first; light JS. */

function isProtectedImage(target) {
  return target?.closest?.('.protected-image')
}

function isInProtectedZone(target) {
  return Boolean(isProtectedImage(target) || target?.closest?.('.gallery-protected'))
}

function blockImageContextMenu(e) {
  if (!isInProtectedZone(e.target)) return
  e.preventDefault()
}

function blockProtectedClipboard(e) {
  if (isInProtectedZone(e.target)) {
    e.preventDefault()
    return
  }

  const sel = window.getSelection()
  if (!sel?.rangeCount) return

  const node = sel.anchorNode
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node
  if (el && isInProtectedZone(el)) {
    e.preventDefault()
  }
}

function blockProtectedDrag(e) {
  if (isInProtectedZone(e.target)) {
    e.preventDefault()
  }
}

export const protectedGalleryHandlers = {
  onContextMenu: blockImageContextMenu,
  onCopy: blockProtectedClipboard,
  onCut: blockProtectedClipboard,
  onDragStart: blockProtectedDrag,
}
