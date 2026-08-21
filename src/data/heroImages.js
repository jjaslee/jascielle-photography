const HERO_WIDTHS = [640, 960, 1400, 1536]
const HERO_SIZES = '(max-width: 767px) 72vw, (min-width: 1474px) 560px, 38vw'

function responsiveHeroAsset(name) {
  return {
    src: `/images/hero/${name}-1536.webp`,
    srcSet: HERO_WIDTHS.map(
      (width) => `/images/hero/${name}-${width}.webp ${width}w`,
    ).join(', '),
    sizes: HERO_SIZES,
    width: 1536,
    height: 1024,
  }
}

/** Homepage hero photographs — swap sources here. */
export const heroImages = [
  {
    id: 'harbour',
    alt: 'Silhouette at a harbour railing at twilight',
    poster: responsiveHeroAsset('hero-poster'),
    layers: {
      background: responsiveHeroAsset('hero-background'),
      midground: responsiveHeroAsset('hero-midground'),
      foreground: responsiveHeroAsset('hero-foreground'),
    },
  },
  {
    id: 'stream',
    alt: 'Forest stream with mossy rocks and a stone bridge',
    layers: {
      background: responsiveHeroAsset('stream-background'),
      foreground: responsiveHeroAsset('stream-foreground'),
      canopy: responsiveHeroAsset('stream-canopy'),
    },
  },
  {
    id: 'jaguar',
    alt: 'Jaguar in dappled forest light',
    layers: {
      background: responsiveHeroAsset('jaguar-canopy'),
      foreground: responsiveHeroAsset('jaguar-foreground'),
      reflection: responsiveHeroAsset('jaguar-reflection'),
    },
  },
]
