import {
  Document, Page, View, Text, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { Cotizacion } from '@/types'

/* ── Registrar fuente (opcional, usa Helvetica por defecto) ──── */
Font.registerHyphenationCallback(w => [w])   // evita cortes de palabras raros

/* ── Paleta de marca ─────────────────────────────────────────── */
const NAVY    = '#072B5A'
const BLUE    = '#0E78D8'
const CYAN    = '#38D6D4'
const MUTED   = '#5F6B7A'
const SURFACE = '#F4F7FA'
const BORDER  = '#E5E9EE'

const fmt = (n: number) =>
  'L ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/* ── Estilos ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: NAVY, backgroundColor: '#FFFFFF', padding: 36 },

  /* Header */
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logoBox:     { width: 40, height: 40, backgroundColor: BLUE, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoText:    { color: '#fff', fontSize: 16, fontFamily: 'Helvetica-Bold' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 2 },
  companyMeta: { fontSize: 8, color: MUTED },

  titleBox:    { alignItems: 'flex-end' },
  docTitle:    { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BLUE, letterSpacing: 1 },
  docNum:      { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 2 },
  docEstado:   { fontSize: 8, color: MUTED, marginTop: 2 },

  /* Divider */
  divider:     { height: 2, backgroundColor: BLUE, marginBottom: 16, borderRadius: 1 },
  dividerThin: { height: 1, backgroundColor: BORDER, marginVertical: 10 },

  /* Info grid */
  infoRow:     { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoBox:     { flex: 1, backgroundColor: SURFACE, borderRadius: 6, padding: 10 },
  infoLabel:   { fontSize: 7, color: MUTED, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  infoValue:   { fontSize: 9, color: NAVY, fontFamily: 'Helvetica-Bold' },
  infoSub:     { fontSize: 8, color: MUTED, marginTop: 1 },

  /* Table */
  tableHead:   { flexDirection: 'row', backgroundColor: NAVY, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 1 },
  thText:      { color: '#fff', fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  row:         { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  rowAlt:      { backgroundColor: SURFACE },
  cellProd:    { flex: 4 },
  cellQty:     { flex: 1, textAlign: 'center' },
  cellPrice:   { flex: 2, textAlign: 'right' },
  cellSub:     { flex: 2, textAlign: 'right' },
  tdProd:      { fontSize: 9, color: NAVY, fontFamily: 'Helvetica-Bold' },
  tdCode:      { fontSize: 7, color: MUTED },
  tdNum:       { fontSize: 9, color: MUTED },
  tdTotal:     { fontSize: 9, color: NAVY, fontFamily: 'Helvetica-Bold' },

  /* Totals */
  totalsWrap:  { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  totalsBox:   { width: 200 },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel:  { fontSize: 9, color: MUTED },
  totalValue:  { fontSize: 9, color: MUTED, fontFamily: 'Helvetica-Bold' },
  grandBox:    { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: NAVY, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, marginTop: 6 },
  grandLabel:  { fontSize: 10, color: '#fff', fontFamily: 'Helvetica-Bold' },
  grandValue:  { fontSize: 12, color: CYAN, fontFamily: 'Helvetica-Bold' },

  /* Observaciones */
  obsBox:      { marginTop: 20, padding: 10, borderLeftWidth: 3, borderLeftColor: BLUE, backgroundColor: SURFACE, borderRadius: 4 },
  obsLabel:    { fontSize: 7, color: BLUE, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  obsText:     { fontSize: 9, color: MUTED, lineHeight: 1.5 },

  /* Footer */
  footer:      { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  footerText:  { fontSize: 7, color: MUTED },
  footerDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: CYAN },
})

/* ── Componente ──────────────────────────────────────────────── */
interface Props {
  cotizacion: Cotizacion
  empresaNombre: string
}

const estadoLabel: Record<string, string> = {
  borrador: 'BORRADOR', enviada: 'ENVIADA', aprobada: 'APROBADA',
  rechazada: 'RECHAZADA', convertida: 'CONVERTIDA', vencida: 'VENCIDA',
}

export default function CotizacionPDF({ cotizacion: c, empresaNombre }: Props) {
  const detalles = c.detalles ?? []
  const isv = c.impuesto > 0

  return (
    <Document title={`${c.numero_cotizacion} — Cotización`} author={empresaNombre}>
      <Page size="A4" style={s.page}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <View style={s.logoBox}><Text style={s.logoText}>V</Text></View>
            <Text style={[s.companyName, { marginTop: 8 }]}>{empresaNombre}</Text>
            <Text style={s.companyMeta}>Sistema de Gestión Empresarial</Text>
          </View>
          <View style={s.titleBox}>
            <Text style={s.docTitle}>COTIZACIÓN</Text>
            <Text style={s.docNum}>{c.numero_cotizacion}</Text>
            <Text style={s.docEstado}>{estadoLabel[c.estado] ?? c.estado}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Info: cliente + fechas ─────────────────────────── */}
        <View style={s.infoRow}>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Cotizado para</Text>
            <Text style={s.infoValue}>{c.cliente?.nombre ?? 'Consumidor general'}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Fecha de emisión</Text>
            <Text style={s.infoValue}>{c.fecha_cotizacion}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Válida hasta</Text>
            <Text style={[s.infoValue, { color: c.fecha_vencimiento ? NAVY : MUTED }]}>
              {c.fecha_vencimiento ?? 'Sin vencimiento'}
            </Text>
          </View>
        </View>

        {/* ── Tabla de productos ─────────────────────────────── */}
        <View style={s.tableHead}>
          <Text style={[s.thText, s.cellProd]}>Descripción</Text>
          <Text style={[s.thText, s.cellQty, { textAlign: 'center' }]}>Cant.</Text>
          <Text style={[s.thText, s.cellPrice, { textAlign: 'right' }]}>Precio unit.</Text>
          <Text style={[s.thText, s.cellSub, { textAlign: 'right' }]}>Subtotal</Text>
        </View>

        {detalles.map((d, i) => (
          <View key={d.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]}>
            <View style={s.cellProd}>
              <Text style={s.tdProd}>{d.producto?.nombre ?? `Producto #${d.producto_id}`}</Text>
              {d.producto?.codigo && <Text style={s.tdCode}>{d.producto.codigo}</Text>}
            </View>
            <Text style={[s.tdNum, s.cellQty]}>{Number(d.cantidad).toFixed(2)}</Text>
            <Text style={[s.tdNum, s.cellPrice]}>{fmt(d.precio_unitario)}</Text>
            <Text style={[s.tdTotal, s.cellSub]}>{fmt(d.subtotal)}</Text>
          </View>
        ))}

        {/* ── Totales ────────────────────────────────────────── */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmt(c.subtotal)}</Text>
            </View>
            {c.descuento > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Descuento</Text>
                <Text style={[s.totalValue, { color: '#DC2626' }]}>− {fmt(c.descuento)}</Text>
              </View>
            )}
            {isv && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>ISV (15%)</Text>
                <Text style={s.totalValue}>{fmt(c.impuesto)}</Text>
              </View>
            )}
            <View style={s.grandBox}>
              <Text style={s.grandLabel}>TOTAL</Text>
              <Text style={s.grandValue}>{fmt(c.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Observaciones ──────────────────────────────────── */}
        {c.observaciones && (
          <View style={s.obsBox}>
            <Text style={s.obsLabel}>Observaciones y condiciones</Text>
            <Text style={s.obsText}>{c.observaciones}</Text>
          </View>
        )}

        {/* ── Footer ─────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{empresaNombre} · {c.numero_cotizacion}</Text>
          <View style={s.footerDot} />
          <Text style={s.footerText}>Generado con Sistema de Gestión Empresarial</Text>
        </View>

      </Page>
    </Document>
  )
}
