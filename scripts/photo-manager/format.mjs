import path from 'node:path'

export const rule = '─'.repeat(40)

export function heading(title) {
  console.log(`\n${rule}\n${title}\n${rule}\n`)
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function filenameFromSrc(src) {
  return path.posix.basename(src)
}

export function valueLabel(value, absent = '—not reviewed—') {
  if (value === undefined) return absent
  if (value === null) return '—intentionally blank—'
  return String(value)
}

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
