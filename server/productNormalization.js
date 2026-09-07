const translations = { sugars:'Azúcares', sugar:'Azúcar', mayonnaises:'Mayonesas', mayonnaise:'Mayonesa', condiments:'Condimentos', sauces:'Salsas', argentina:'Argentina' }
export function cleanProductText(value) {
  return String(value || '').split(',').map(part => {
    const cleaned = part.trim().replace(/^[a-z]{2}:/i, '')
    return translations[cleaned.toLowerCase()] || cleaned
  }).filter(Boolean).join(', ')
}
export function parsePresentation(text, barcode = '') {
  const label = String(text || '').trim().toLowerCase()
  const unit = '(kg|mg|g|ml|l)'
  const multiple = label.match(new RegExp('(?:^|\\s)(\\d+)\\s*(?:x|u(?:nidades)?|sobres?|sachets?)\\s*(?:x\\s*)?(\\d+(?:[.,]\\d+)?)\\s*' + unit + '(?:\\s|$)'))
  if (multiple) return { net_quantity:Number(multiple[2].replace(',','.')), net_unit:multiple[3], units_per_package:Number(multiple[1]), packaging_level:'case' }
  const single = label.match(new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*' + unit + '$'))
  if (single && barcode.length !== 14) return { net_quantity:Number(single[1].replace(',','.')), net_unit:single[2], units_per_package:'', packaging_level:'unit' }
  return { net_quantity:'', net_unit:'', units_per_package:'', packaging_level:'unknown' }
}
