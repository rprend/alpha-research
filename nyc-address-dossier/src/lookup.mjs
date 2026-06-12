// Shared address-resolution helpers (dossier CLI + viewer server).
export const BORO = { manhattan: '1', mn: '1', bronx: '2', bx: '2', brooklyn: '3', bk: '3', queens: '4', qn: '4', 'staten island': '5', si: '5' };
const ORDINALS = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6', seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11', twelfth: '12' };

export function normalizeStreet(s) {
  let t = s.toUpperCase().trim()
    .replace(/\b(\d+)(ST|ND|RD|TH)\b/g, '$1')
    .replace(/\bST\.? (NICHOLAS|MARKS|JOHNS|PAULS)\b/g, 'SAINT $1') // before ST -> STREET
    .replace(/\bAVE\.?\b/g, 'AVENUE').replace(/\bST\.?\b/g, 'STREET')
    .replace(/\bBLVD\.?\b/g, 'BOULEVARD').replace(/\bRD\.?\b/g, 'ROAD')
    .replace(/\bPL\.?\b/g, 'PLACE').replace(/\bPKWY\.?\b/g, 'PARKWAY')
    .replace(/\bE\.?\b/g, 'EAST').replace(/\bW\.?\b/g, 'WEST')
    .replace(/\bFT\.?\b/g, 'FORT').replace(/\bMT\.?\b/g, 'MOUNT')
    .replace(/\s+/g, ' ');
  for (const [word, num] of Object.entries(ORDINALS)) {
    t = t.replace(new RegExp(`\\b${word.toUpperCase()}\\b`, 'g'), num);
  }
  return t;
}

export function parseAddress(addr, boroArg = 'manhattan') {
  const boro = BORO[(boroArg ?? 'manhattan').toLowerCase()] ?? '1';
  const m = (addr ?? '').match(/^\s*([\d-]+)\s+(.+)$/);
  if (!m) return null;
  return { house: m[1], street: normalizeStreet(m[2]), boro };
}
