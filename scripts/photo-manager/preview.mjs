import { spawn } from 'node:child_process'
import { constants, accessSync } from 'node:fs'
import path from 'node:path'

export function publicPathForSrc(config, src) {
  const publicRoot = path.resolve(config.publicDir)
  const resolved = path.resolve(publicRoot, src.replace(/^\/+/, ''))
  if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error(`Image src escapes the public directory: ${src}`)
  }
  return resolved
}

function resolveExecutable(name) {
  if (path.isAbsolute(name)) {
    try {
      accessSync(name, constants.X_OK)
      return name
    } catch {
      return null
    }
  }
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue
    const candidate = path.join(directory, name)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Keep searching PATH.
    }
  }
  return null
}

export function previewPhoto(config, src, options = {}) {
  const filePath = publicPathForSrc(config, src)
  if (options.open === false) return { opened: false, filePath }

  const command =
    process.platform === 'darwin'
      ? { bin: 'open', args: [filePath] }
      : process.platform === 'win32'
        ? { bin: 'explorer.exe', args: [filePath] }
        : { bin: 'xdg-open', args: [filePath] }

  const executable = resolveExecutable(command.bin)
  if (!executable) return { opened: false, filePath }

  try {
    const child = spawn(executable, command.args, {
      detached: true,
      stdio: 'ignore',
      shell: false,
    })
    child.on('error', () => {})
    child.unref()
    return { opened: true, filePath }
  } catch {
    return { opened: false, filePath }
  }
}
