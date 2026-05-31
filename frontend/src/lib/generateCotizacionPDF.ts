/**
 * Módulo separado para la generación de PDFs.
 * Se importa dinámicamente desde HistorialCotizacionesPage para que
 * @react-pdf/renderer solo se descargue cuando el usuario lo necesite.
 */
import React from 'react'
import { pdf } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import CotizacionPDF from '@/components/pdf/CotizacionPDF'
import type { Cotizacion } from '@/types'

export async function generarPDFCotizacion(
  cotizacion: Cotizacion,
  empresaNombre: string,
): Promise<void> {
  // pdf() espera ReactElement<DocumentProps>; el cast es seguro porque
  // CotizacionPDF devuelve un <Document> de react-pdf internamente
  const element = React.createElement(
    CotizacionPDF, { cotizacion, empresaNombre },
  ) as React.ReactElement<DocumentProps>
  const blob    = await pdf(element).toBlob()
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = `${cotizacion.numero_cotizacion}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
