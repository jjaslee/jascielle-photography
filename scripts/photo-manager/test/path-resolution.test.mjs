import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { resolveUserPath } from '../paths.mjs'

const testCwd = path.join(path.parse(process.cwd()).root, 'tmp', 'photo-manager-cwd')

test('expands a leading ~/ using the current home directory', () => {
  assert.equal(
    resolveUserPath('~/Desktop/example.jpg', { currentDirectory: testCwd }),
    path.join(os.homedir(), 'Desktop', 'example.jpg'),
  )
})

test('expands ~ alone to the current home directory', () => {
  assert.equal(resolveUserPath('~', { currentDirectory: testCwd }), os.homedir())
})

test('leaves absolute paths absolute and unchanged', () => {
  const absolutePath = path.join(path.parse(testCwd).root, 'tmp', 'example.jpg')
  assert.equal(
    resolveUserPath(absolutePath, { currentDirectory: testCwd }),
    absolutePath,
  )
})

test('continues resolving relative paths against the current directory', () => {
  assert.equal(
    resolveUserPath('fixtures/example.jpg', { currentDirectory: testCwd }),
    path.resolve(testCwd, 'fixtures/example.jpg'),
  )
})

test('does not expand a ~ that appears elsewhere in a path', () => {
  assert.equal(
    resolveUserPath('fixtures/~archive/example.jpg', { currentDirectory: testCwd }),
    path.resolve(testCwd, 'fixtures/~archive/example.jpg'),
  )
})
