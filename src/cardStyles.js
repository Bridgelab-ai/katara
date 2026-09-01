export const CARD_COLORS = [
  { key: null,          label: 'Standard',        hex: null       },
  { key: 'navy',        label: 'Dunkelblau',      hex: '#1A2A5E' },
  { key: 'midnight',    label: 'Mitternacht',     hex: '#0D1B2A' },
  { key: 'forest',      label: 'Waldgrün',        hex: '#1C3A2A' },
  { key: 'ruby',        label: 'Rubinrot',        hex: '#7A1A1A' },
  { key: 'gold',        label: 'Gold',            hex: '#7A5A00' },
  { key: 'slate',       label: 'Schiefergrau',    hex: '#3A4A5C' },
  { key: 'violet',      label: 'Tiefviolett',     hex: '#3D1A6E' },
  { key: 'ocean',       label: 'Ozeanblau',       hex: '#1A4A6E' },
  { key: 'chestnut',    label: 'Kastanienbraun',  hex: '#5C2A1A' },
  { key: 'ivory',       label: 'Elfenbein',       hex: '#F5F0DC' },
  { key: 'onyx',        label: 'Onyx',            hex: '#1A1A1A' },
]

export const CARD_FONT_SIZES = [
  { key: null,  label: 'Standard', px: null },
  { key: 'xs',  label: 'XS',       px: 12   },
  { key: 's',   label: 'S',        px: 14   },
  { key: 'm',   label: 'M',        px: 16   },
  { key: 'l',   label: 'L',        px: 20   },
  { key: 'xl',  label: 'XL',       px: 26   },
]

export const CARD_FONT_FAMILIES = [
  { key: null,        label: 'Standard',  css: null },
  { key: 'system',    label: 'System',    css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { key: 'serif',     label: 'Serif',     css: "Georgia, 'Times New Roman', serif" },
  { key: 'mono',      label: 'Mono',      css: "'Courier New', 'Fira Code', monospace" },
  { key: 'rounded',   label: 'Rounded',   css: "'Nunito', 'Varela Round', system-ui, sans-serif" },
  { key: 'condensed', label: 'Condensed', css: "'Arial Narrow', 'Roboto Condensed', sans-serif" },
]

export function getColorHex(key) {
  return CARD_COLORS.find(c => c.key === key)?.hex ?? null
}

export function getFontSizePx(key) {
  return CARD_FONT_SIZES.find(f => f.key === key)?.px ?? null
}

export function getFontCss(key) {
  return CARD_FONT_FAMILIES.find(f => f.key === key)?.css ?? null
}

export function resolveCardStyle(card, groupStyle) {
  return {
    bgColor:    card?.bgColor    ?? groupStyle?.defaultBgColor    ?? null,
    textColor:  card?.textColor  ?? groupStyle?.defaultTextColor  ?? null,
    fontSize:   card?.fontSize   ?? groupStyle?.defaultFontSize   ?? null,
    fontFamily: card?.fontFamily ?? groupStyle?.defaultFontFamily ?? null,
  }
}

export function extractGroupStyle(obj) {
  if (!obj) return null
  const { defaultBgColor, defaultTextColor, defaultFontSize, defaultFontFamily } = obj
  if (!defaultBgColor && !defaultTextColor && !defaultFontSize && !defaultFontFamily) return null
  return { defaultBgColor, defaultTextColor, defaultFontSize, defaultFontFamily }
}
