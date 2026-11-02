/**
 * Pre-rendered 3D logos for the cut-ins (scripts/fx-logos/build.mjs renders them with Blender).
 * Shared by the build script and the effects layer, so this file stays plain (Node strips the types).
 */
export interface FxLogo {
  id: string;
  /** The cut-in text (fxState) this logo replaces */
  text: string;
  style: 'gold' | 'red' | 'silver';
  /** One or two lines; two lines are staggered */
  lines: string[];
}

export const FX_LOGOS: FxLogo[] = [
  { id: 'kakuhen', text: '確変突入', style: 'gold', lines: ['確変', '突入'] },
  { id: 'jackpot', text: '大当たり', style: 'gold', lines: ['大当', 'たり'] },
  { id: 'reach', text: 'リーチ', style: 'gold', lines: ['リーチ'] },
  { id: 'hot', text: '激アツ', style: 'red', lines: ['激アツ'] },
  { id: 'tenraku', text: '転落', style: 'silver', lines: ['転落'] },
  { id: 'zannen', text: '残念…', style: 'silver', lines: ['残念'] },
  { id: 'double', text: 'ダブル揃い', style: 'red', lines: ['ダブル', '揃い'] },
  { id: 'triple', text: 'トリプル揃い', style: 'red', lines: ['トリプル', '揃い'] },
  { id: 'block', text: 'ブロック完成', style: 'gold', lines: ['ブロック', '完成'] },
  { id: 'tate', text: 'タテ一列揃い', style: 'gold', lines: ['タテ一列', '揃い'] },
  { id: 'yoko', text: 'ヨコ一列揃い', style: 'gold', lines: ['ヨコ一列', '揃い'] },
];

/** Public URL of a logo (public/fx/logos), relative to the page like the rest of the app */
export const logoUrl = (logo: FxLogo): string => `./fx/logos/${logo.id}.webp`;

export const logoForText = (text: string): FxLogo | undefined => FX_LOGOS.find((l) => l.text === text);
