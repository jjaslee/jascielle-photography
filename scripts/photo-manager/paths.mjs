import os from 'node:os'
import path from 'node:path'

export function resolveUserPath(
  userInput,
  {
    homeDirectory = os.homedir(),
    currentDirectory = process.cwd(),
  } = {},
) {
  const value = userInput.trim()
  const expanded =
    value === '~'
      ? homeDirectory
      : value.startsWith('~/') || value.startsWith('~\\')
        ? path.join(homeDirectory, value.slice(2))
        : value

  return path.resolve(currentDirectory, expanded)
}
