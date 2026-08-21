import path from 'node:path'
import { catalogDefinitions } from '../../src/data/photoSchema.js'
import { RESPONSIVE_IMAGE_LONG_EDGES } from '../../src/data/responsiveImages.js'

export const projectRoot = path.resolve(import.meta.dirname, '../..')

export function createConfig(rootDir = projectRoot) {
  const manifestDir = path.join(rootDir, 'src/data/photos')
  return {
    rootDir,
    publicDir: path.join(rootDir, 'public'),
    manifestDir,
    proposalDir: path.join(rootDir, '.photo-manager/proposals'),
    placementsPath: path.join(manifestDir, 'sitePlacements.json'),
    maxLongEdge: 2200,
    responsiveLongEdges: RESPONSIVE_IMAGE_LONG_EDGES,
    jpegQuality: 82,
    largeFileWarningBytes: 900 * 1024,
    supportedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    catalogFiles: Object.fromEntries(
      Object.keys(catalogDefinitions).map((name) => [
        name,
        path.join(manifestDir, `${name}.json`),
      ]),
    ),
    managedFolders: Object.fromEntries(
      Object.entries(catalogDefinitions).map(([name, definition]) => [
        name,
        path.join(rootDir, 'public/images', definition.folder),
      ]),
    ),
  }
}

export const photoManagerConfig = createConfig()
