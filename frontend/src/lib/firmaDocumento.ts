import type { DatosFirma } from '@/types'

const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Bloque de firma para documentos impresos. Si el documento está autorizado,
 * muestra la firma y el sello de la empresa sobre la línea, con el nombre de
 * quien autorizó y la fecha; si no, solo la línea para firmar a mano.
 */
export function bloqueFirma(firma: DatosFirma | null | undefined, etiqueta: string): string {
  if (!firma || (!firma.firma && !firma.sello)) {
    return `<div style="height:70px"></div>
      <div style="border-top:1px solid #999;padding-top:6px;font-size:10.5px;color:#555">${etiqueta}</div>`
  }

  return `
    <div style="position:relative;height:90px">
      ${firma.sello ? `<img src="${firma.sello}" alt="Sello" style="position:absolute;left:50%;bottom:-6px;transform:translateX(-10%);height:88px;max-width:130px;object-fit:contain;opacity:.9">` : ''}
      ${firma.firma ? `<img src="${firma.firma}" alt="Firma" style="position:absolute;left:50%;bottom:0;transform:translateX(-60%);height:70px;max-width:180px;object-fit:contain">` : ''}
    </div>
    <div style="border-top:1px solid #999;padding-top:6px;font-size:10.5px;color:#555">${etiqueta}</div>
    <div style="font-size:10.5px;font-weight:700;color:#333;margin-top:2px">${escapeHtml(firma.autorizado_por ?? '')}</div>
    <div style="font-size:9.5px;color:#888">Autorizado el ${firma.autorizado_at}</div>`
}
