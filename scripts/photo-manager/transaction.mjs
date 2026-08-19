import { access, copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Stage every replacement beside its destination, then commit by rename.
 * Existing targets are held as backups until all renames succeed.
 */
export async function commitFiles(files, options = {}) {
  if (files.length === 0) return
  const transactionId = `${process.pid}-${randomUUID()}`
  const staged = []
  const committed = []

  try {
    for (const file of files) {
      if (file.mustNotExist && (await pathExists(file.targetPath))) {
        throw new Error(`${path.basename(file.targetPath)} already exists; existing files are never overwritten.`)
      }
      await mkdir(path.dirname(file.targetPath), { recursive: true })
      const tempPath = path.join(
        path.dirname(file.targetPath),
        `.${path.basename(file.targetPath)}.${transactionId}.tmp`,
      )
      if (file.sourcePath) await copyFile(file.sourcePath, tempPath)
      else await writeFile(tempPath, file.content)
      staged.push({ ...file, tempPath, backupPath: `${tempPath}.backup` })
    }

    for (let index = 0; index < staged.length; index += 1) {
      const file = staged[index]
      const existed = await pathExists(file.targetPath)
      if (file.mustNotExist && existed) {
        throw new Error(`${path.basename(file.targetPath)} already exists; existing files are never overwritten.`)
      }
      if (existed) await rename(file.targetPath, file.backupPath)
      try {
        if (options.failAfter === index) throw new Error('Simulated transaction failure')
        await rename(file.tempPath, file.targetPath)
        committed.push({ ...file, existed })
      } catch (error) {
        if (existed && (await pathExists(file.backupPath))) {
          await rename(file.backupPath, file.targetPath)
        }
        throw error
      }
    }

    await Promise.all(
      committed.filter((file) => file.existed).map((file) => rm(file.backupPath, { force: true })),
    )
  } catch (error) {
    for (const file of committed.reverse()) {
      await rm(file.targetPath, { force: true })
      if (file.existed && (await pathExists(file.backupPath))) {
        await rename(file.backupPath, file.targetPath)
      }
    }
    await Promise.all(
      staged.flatMap((file) => [
        rm(file.tempPath, { force: true }),
        rm(file.backupPath, { force: true }),
      ]),
    )
    throw error
  }
}
