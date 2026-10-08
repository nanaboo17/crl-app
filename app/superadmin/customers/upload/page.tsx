'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

type RawRow = Record<string, string>
type ValidationRow = { row: number; customer_id: string; case_month?: string; status: 'valid' | 'warning' | 'error'; messages: string[] }
type ValidationResponse = {
  summary: { total: number; valid: number; warnings: number; errors: number; existing: number }
  rows: ValidationRow[]
}

const fields = [
  ['customer_id', 'Customer ID', true],
  ['case_month', 'CRL Month', true],
  ['customer_name', 'Customer Name', true],
  ['phone_number', 'Phone Number', false],
  ['service_address', 'Service Address', false],
  ['product', 'Product', false],
  ['outstanding_amount', 'Outstanding Amount', false],
  ['payment_status', 'Payment Status', false],
  ['priority_rank', 'Priority', false],
  ['days_left_to_churn', 'Days Left to Churn', false],
  ['estimated_churn_date', 'Estimated Churn Date', false],
  ['region', 'Region', false],
  ['city', 'City', false],
  ['district', 'District', false],
  ['sub_district', 'Sub District', false],
  ['given_latitude', 'Latitude', true],
  ['given_longitude', 'Longitude', true],
  ['speed', 'Speed', false],
  ['agent_email', 'Agent Email', false],
] as const

type FieldKey = typeof fields[number][0]

const aliases: Record<FieldKey, string[]> = {
  customer_id: ['customer_id', 'customer id', 'cust_id', 'ba_id', 'billing_account', 'billing account'],
  case_month: ['case_month', 'case month', 'crl_month', 'crl month', 'month', 'bulan crl'],
  customer_name: ['customer_name', 'customer name', 'name', 'nama pelanggan'],
  phone_number: ['phone_number', 'phone number', 'phone', 'msisdn', 'nomor telepon'],
  service_address: ['service_address', 'service address', 'address', 'alamat'],
  product: ['product', 'package', 'package_name', 'nama paket'],
  outstanding_amount: ['outstanding_amount', 'outstanding amount', 'outstanding', 'invoice_amount', 'invoice amount'],
  payment_status: ['payment_status', 'payment status'],
  priority_rank: ['priority_rank', 'priority rank', 'priority'],
  days_left_to_churn: ['days_left_to_churn', 'days left to churn', 'days_to_churn'],
  estimated_churn_date: ['estimated_churn_date', 'estimated churn date', 'churn_date'],
  region: ['region'],
  city: ['city', 'kota'],
  district: ['district', 'kecamatan'],
  sub_district: ['sub_district', 'sub district', 'kelurahan'],
  given_latitude: ['given_latitude', 'latitude', 'lat'],
  given_longitude: ['given_longitude', 'longitude', 'long', 'lng'],
  speed: ['speed', 'speed_mbps'],
  agent_email: ['agent_email', 'agent email', 'email agent'],
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  return rows.filter((r) => r.some((value) => value.trim()))
}

function colIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0] || 'A'
  let result = 0
  for (const ch of letters) result = result * 26 + ch.charCodeAt(0) - 64
  return result - 1
}

async function unzipEntry(buffer: ArrayBuffer, entry: { method: number; offset: number; compressed: number }) {
  const view = new DataView(buffer)
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw new Error('Invalid XLSX ZIP entry.')
  const nameLen = view.getUint16(entry.offset + 26, true)
  const extraLen = view.getUint16(entry.offset + 28, true)
  const start = entry.offset + 30 + nameLen + extraLen
  const bytes = new Uint8Array(buffer, start, entry.compressed)
  if (entry.method === 0) return bytes
  if (entry.method !== 8) throw new Error('Unsupported XLSX compression method.')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const view = new DataView(buffer)
  let eocd = -1
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Invalid XLSX file.')
  const total = view.getUint16(eocd + 10, true)
  let pos = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  const entries = new Map<string, { method: number; offset: number; compressed: number }>()
  for (let n = 0; n < total; n += 1) {
    if (view.getUint32(pos, true) !== 0x02014b50) break
    const method = view.getUint16(pos + 10, true)
    const compressed = view.getUint32(pos + 20, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const offset = view.getUint32(pos + 42, true)
    const name = decoder.decode(new Uint8Array(buffer, pos + 46, nameLen))
    entries.set(name, { method, offset, compressed })
    pos += 46 + nameLen + extraLen + commentLen
  }
  const shared: string[] = []
  const sharedEntry = entries.get('xl/sharedStrings.xml')
  if (sharedEntry) {
    const xml = new DOMParser().parseFromString(decoder.decode(await unzipEntry(buffer, sharedEntry)), 'application/xml')
    xml.querySelectorAll('si').forEach((si) => shared.push(Array.from(si.querySelectorAll('t')).map((t) => t.textContent || '').join('')))
  }
  const sheetName = Array.from(entries.keys()).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
  if (!sheetName) throw new Error('No worksheet found in XLSX file.')
  const xml = new DOMParser().parseFromString(decoder.decode(await unzipEntry(buffer, entries.get(sheetName)!)), 'application/xml')
  const result: string[][] = []
  xml.querySelectorAll('sheetData > row').forEach((rowEl) => {
    const row: string[] = []
    rowEl.querySelectorAll('c').forEach((cell) => {
      const idx = colIndex(cell.getAttribute('r') || 'A1')
      const type = cell.getAttribute('t')
      let value = ''
      if (type === 'inlineStr') value = Array.from(cell.querySelectorAll('t')).map((t) => t.textContent || '').join('')
      else {
        const raw = cell.querySelector('v')?.textContent || ''
        value = type === 's' ? (shared[Number(raw)] ?? '') : raw
      }
      row[idx] = value
    })
    result.push(row.map((value) => value ?? ''))
  })
  return result.filter((r) => r.some((value) => String(value).trim()))
}

function buildRawRows(matrix: string[][]) {
  if (matrix.length < 2) return { headers: [] as string[], rows: [] as RawRow[] }
  const headers = matrix[0].map((value, index) => String(value || `Column ${index + 1}`).trim())
  const rows = matrix.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()])))
  return { headers, rows }
}

export default function UploadCustomersPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({})
  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [error, setError] = useState('')

  const normalizedRows = useMemo(() => rawRows.map((row) => {
    const out: Record<string, string> = {}
    for (const [key] of fields) {
      const source = mapping[key]
      out[key] = source ? (row[source] ?? '') : ''
    }
    return out
  }), [rawRows, mapping])

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(''); setValidation(null); setResult(null); setBusy(true)
    try {
      const matrix = file.name.toLowerCase().endsWith('.xlsx')
        ? await parseXlsx(await file.arrayBuffer())
        : parseCsv(await file.text())
      const parsed = buildRawRows(matrix)
      if (!parsed.headers.length || !parsed.rows.length) throw new Error(tx('No data rows found.', 'Tidak ada baris data yang ditemukan.'))
      const nextMapping: Partial<Record<FieldKey, string>> = {}
      for (const [key] of fields) {
        const options = aliases[key].map(normalizeHeader)
        const match = parsed.headers.find((header) => options.includes(normalizeHeader(header)))
        if (match) nextMapping[key] = match
      }
      setFileName(file.name); setHeaders(parsed.headers); setRawRows(parsed.rows); setMapping(nextMapping)
    } catch (err) {
      setError(err instanceof Error ? err.message : tx('Unable to read file.', 'File tidak dapat dibaca.'))
      setHeaders([]); setRawRows([])
    } finally { setBusy(false) }
  }

  async function callApi(action: 'validate' | 'import') {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/superadmin/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rows: normalizedRows }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Request failed.')
      if (action === 'validate') setValidation(data)
      else { setResult({ inserted: data.inserted, skipped: data.skipped }); setValidation(data.validation) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.')
    } finally { setBusy(false) }
  }

  const canValidate = rawRows.length > 0 && Boolean(mapping.customer_id && mapping.case_month && mapping.customer_name && mapping.given_latitude && mapping.given_longitude)
  const preview = normalizedRows.slice(0, 8)

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: tx('Customers', 'Pelanggan'), href: '/superadmin/customers' }, { label: tx('Upload Data', 'Upload Data'), icon: Upload }]}
        title={tx('Upload Customer Data', 'Upload Data Pelanggan')}
        description={tx('Upload CSV or XLSX, map columns, validate the rows, then import clean customer records.', 'Upload CSV atau XLSX, petakan kolom, validasi data, lalu impor data pelanggan yang bersih.')}
        actions={<Link href="/superadmin/customers" className={styles.back}><ArrowLeft className="size-4" />{tx('Back to Customers', 'Kembali ke Pelanggan')}</Link>}
      />

      <div className={styles.notice}><AlertTriangle /><div><strong>{tx('Safe import mode', 'Mode impor aman')}</strong><span>{tx('Each uploaded row creates a CRL case. The same Customer ID can appear in another month, but the same Customer ID + CRL Month combination cannot be imported twice.', 'Setiap baris upload membuat satu case CRL. Customer ID yang sama boleh muncul di bulan berbeda, tetapi kombinasi Customer ID + Bulan CRL yang sama tidak dapat diimpor dua kali.')}</span></div></div>

      <section className={styles.card}>
        <div className={styles.stepHead}><span>1</span><div><h2>{tx('Upload file', 'Upload file')}</h2><p>{tx('CSV and XLSX are supported. XLSX reads the first worksheet.', 'CSV dan XLSX didukung. XLSX membaca worksheet pertama.')}</p></div></div>
        <label className={styles.dropzone}>
          <FileSpreadsheet />
          <strong>{fileName || tx('Choose a customer file', 'Pilih file pelanggan')}</strong>
          <span>{tx('Click to browse · .csv or .xlsx', 'Klik untuk memilih · .csv atau .xlsx')}</span>
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile} />
        </label>
        {busy && !headers.length ? <div className={styles.inlineState}><Loader2 className="animate-spin" />{tx('Reading file…', 'Membaca file…')}</div> : null}
      </section>

      {headers.length > 0 && (
        <section className={styles.card}>
          <div className={styles.stepHead}><span>2</span><div><h2>{tx('Map columns', 'Petakan kolom')}</h2><p>{tx('We auto-mapped familiar headers. Review them before validation.', 'Header yang dikenal sudah dipetakan otomatis. Periksa sebelum validasi.')}</p></div></div>
          <div className={styles.mappingGrid}>{fields.map(([key, label, required]) => (
            <label key={key} className={styles.mapField}><span>{label}{required ? ' *' : ''}</span><select value={mapping[key] || ''} onChange={(e) => { setMapping((current) => ({ ...current, [key]: e.target.value || undefined })); setValidation(null); setResult(null) }}><option value="">{tx('Not mapped', 'Tidak dipetakan')}</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          ))}</div>
          <div className={styles.rowCount}>{rawRows.length.toLocaleString('id-ID')} {tx('rows loaded', 'baris dimuat')}</div>
        </section>
      )}

      {preview.length > 0 && (
        <section className={styles.card}>
          <div className={styles.stepHead}><span>3</span><div><h2>{tx('Preview & validate', 'Preview & validasi')}</h2><p>{tx('Previewing the first 8 rows. Validation checks required fields, coordinates, duplicate Customer ID + CRL Month cases, and assigned agents.', 'Menampilkan 8 baris pertama. Validasi memeriksa field wajib, koordinat, duplikasi Customer ID + Bulan CRL, dan agen yang ditugaskan.')}</p></div></div>
          <div className={styles.tableWrap}><table><thead><tr><th>Customer ID</th><th>CRL Month</th><th>Name</th><th>Region</th><th>City</th><th>Latitude</th><th>Longitude</th><th>Agent</th></tr></thead><tbody>{preview.map((row, index) => <tr key={index}><td>{row.customer_id || '—'}</td><td>{row.case_month || '—'}</td><td>{row.customer_name || '—'}</td><td>{row.region || '—'}</td><td>{row.city || '—'}</td><td>{row.given_latitude || '—'}</td><td>{row.given_longitude || '—'}</td><td>{row.agent_email || '—'}</td></tr>)}</tbody></table></div>
          <div className={styles.actionRow}><button disabled={!canValidate || busy} onClick={() => callApi('validate')} className={styles.primary}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{tx('Validate Data', 'Validasi Data')}</button></div>
        </section>
      )}

      {validation && (
        <section className={styles.card}>
          <div className={styles.stepHead}><span>4</span><div><h2>{tx('Validation result', 'Hasil validasi')}</h2><p>{tx('Only valid CRL cases will be imported. Existing Customer ID + CRL Month cases remain untouched.', 'Hanya case CRL valid yang akan diimpor. Kombinasi Customer ID + Bulan CRL yang sudah ada tidak akan diubah.')}</p></div></div>
          <div className={styles.stats}><Stat label={tx('Total', 'Total')} value={validation.summary.total} /><Stat label={tx('Valid', 'Valid')} value={validation.summary.valid} good /><Stat label={tx('Warnings', 'Peringatan')} value={validation.summary.warnings} /><Stat label={tx('Errors', 'Error')} value={validation.summary.errors} bad /><Stat label={tx('Existing', 'Sudah ada')} value={validation.summary.existing} /></div>
          {validation.rows.some((row) => row.status !== 'valid') && <div className={styles.issueList}>{validation.rows.filter((row) => row.status !== 'valid').slice(0, 50).map((row) => <div key={row.row} className={row.status === 'error' ? styles.issueError : styles.issueWarning}>{row.status === 'error' ? <XCircle /> : <AlertTriangle />}<div><strong>{tx('Row', 'Baris')} {row.row} · {row.customer_id || '—'}</strong><span>{row.messages.join(' · ')}</span></div></div>)}</div>}
          <div className={styles.actionRow}><button disabled={busy || validation.summary.valid === 0} onClick={() => callApi('import')} className={styles.primary}>{busy ? <Loader2 className="animate-spin" /> : <Upload />}{tx(`Import ${validation.summary.valid} Valid Rows`, `Impor ${validation.summary.valid} Baris Valid`)}</button></div>
        </section>
      )}

      {result && <div className={styles.success}><CheckCircle2 /><div><strong>{tx('Import complete', 'Impor selesai')}</strong><span>{result.inserted} {tx('rows inserted', 'baris berhasil diimpor')} · {result.skipped} {tx('rows skipped', 'baris dilewati')}</span></div></div>}
      {error && <div className={styles.error}><XCircle /><span>{error}</span></div>}
    </div>
  )
}

function Stat({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return <div className={`${styles.stat} ${good ? styles.statGood : ''} ${bad ? styles.statBad : ''}`}><strong>{value.toLocaleString('id-ID')}</strong><span>{label}</span></div>
}
