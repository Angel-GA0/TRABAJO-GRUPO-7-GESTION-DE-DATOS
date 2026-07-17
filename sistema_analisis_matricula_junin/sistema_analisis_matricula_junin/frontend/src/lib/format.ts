export const number = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('es-PE', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)

export const signedNumber = (value: number | null | undefined, digits = 0) => {
  if (value === null || value === undefined) return '—'
  const formatted = number(Math.abs(value), digits)
  return value > 0 ? `+${formatted}` : value < 0 ? `−${formatted}` : formatted
}

export const percent = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : `${signedNumber(value, digits)} %`

export const titleCase = (value: string) =>
  value.toLocaleLowerCase('es-PE').replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('es-PE'))
