'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import styles from './AgentFormTooltips.module.css'

const TOOLTIP_BY_TEXT: Record<string, string> = {
  'Was the phone contacted?': 'Choose Yes only when you successfully reached the customer by phone.',
  'Apakah pelanggan berhasil dihubungi?': 'Pilih Ya hanya jika pelanggan berhasil dihubungi melalui telepon.',
  'Contact result': 'Record the clearest outcome of the contact attempt.',
  'Hasil kontak': 'Catat hasil yang paling sesuai dari upaya menghubungi pelanggan.',
  'Is the customer available?': 'Confirm whether the customer can continue the pre-visit discussion now.',
  'Apakah pelanggan tersedia?': 'Konfirmasi apakah pelanggan dapat melanjutkan pembahasan pra-kunjungan sekarang.',
  'Is the customer willing to reschedule?': 'Use this when the customer is unavailable but agrees to another time.',
  'Apakah pelanggan bersedia menjadwalkan ulang?': 'Gunakan jika pelanggan tidak tersedia tetapi bersedia dihubungi pada waktu lain.',
  'Reschedule date & time': 'Select the next agreed contact date and time.',
  'Tanggal & waktu penjadwalan ulang': 'Pilih tanggal dan waktu kontak berikutnya yang telah disepakati.',
  'Is the address confirmed?': 'Confirm whether the installation address matches what the customer provides.',
  'Apakah alamat sudah dikonfirmasi?': 'Konfirmasi apakah alamat instalasi sesuai dengan informasi dari pelanggan.',
  'Corrected / confirmed address': 'Enter the corrected address when the registered address is inaccurate.',
  'Alamat yang dikoreksi / dikonfirmasi': 'Masukkan alamat yang benar jika alamat terdaftar tidak sesuai.',
  'Landmark / access note': 'Add a landmark, gate, tower, floor, or access instruction that helps the field visit.',
  'Patokan / catatan akses': 'Tambahkan patokan, gerbang, tower, lantai, atau petunjuk akses untuk membantu kunjungan.',
  'Does the customer want to make an appointment?': 'Choose Yes only when the customer agrees to a visit schedule.',
  'Apakah pelanggan ingin membuat janji kunjungan?': 'Pilih Ya hanya jika pelanggan menyetujui jadwal kunjungan.',
  'Appointment date & time': 'Use the date and time agreed with the customer.',
  'Tanggal & waktu kunjungan': 'Gunakan tanggal dan waktu yang telah disepakati dengan pelanggan.',
  'Visit directly?': 'Choose Yes when the phone cannot be reached but the agent will continue directly to the address.',
  'Kunjungi langsung?': 'Pilih Ya jika pelanggan tidak dapat dihubungi tetapi agen tetap langsung menuju alamat.',
  'Notes': 'Add only useful context that another agent or supervisor may need later.',
  'Catatan': 'Tambahkan konteks penting yang mungkin dibutuhkan agen atau supervisor nanti.',
  'Visit address': 'Confirm or correct the address where this visit is actually taking place.',
  'Alamat kunjungan': 'Konfirmasi atau koreksi alamat lokasi kunjungan yang sebenarnya.',
  'Current phone number': 'This is the phone currently stored on the customer record.',
  'Nomor telepon saat ini': 'Ini adalah nomor telepon yang saat ini tersimpan pada data pelanggan.',
  'Updated phone number': 'Change this only when the customer provides a newer reachable number.',
  'Nomor telepon terbaru': 'Ubah hanya jika pelanggan memberikan nomor terbaru yang dapat dihubungi.',
  'Visit photo': 'Capture field evidence after GPS is recorded. The app stamps GPS, time, and customer ID on the image.',
  'Foto kunjungan': 'Ambil bukti kunjungan setelah GPS direkam. Aplikasi memberi cap GPS, waktu, dan ID pelanggan pada foto.',
  'Visit status': 'Select what physically happened when the agent arrived at the location.',
  'Status kunjungan': 'Pilih kondisi yang benar-benar terjadi saat agen tiba di lokasi.',
  'Conversation result': 'Select the customer outcome from the collection or retention conversation.',
  'Hasil percakapan': 'Pilih hasil pelanggan dari percakapan collection atau retention.',
  'Approved offer': 'Select only the offer that the customer actually accepted during the visit.',
  'Offer yang disetujui': 'Pilih hanya offer yang benar-benar disetujui pelanggan saat kunjungan.',
  'Planned payment date': 'For Promise to Pay, enter the payment date committed by the customer.',
  'Rencana tanggal pembayaran': 'Untuk Promise to Pay, masukkan tanggal pembayaran yang dijanjikan pelanggan.',
  'Unpaid reason': 'Choose the main reason the outstanding bill is still unpaid.',
  'Alasan belum bayar': 'Pilih alasan utama tagihan masih belum dibayar.',
  'Additional notes': 'Add visit details that are not already captured by the structured fields.',
  'Catatan tambahan': 'Tambahkan detail kunjungan yang belum tercatat pada field terstruktur.',
  'Capture GPS': 'Capture your current device location before taking visit evidence.',
  'Ambil GPS': 'Ambil lokasi perangkat saat ini sebelum mengambil bukti kunjungan.',
  'Open in Google Maps': 'Open the captured visit point in Google Maps for verification.',
  'Buka di Google Maps': 'Buka titik kunjungan yang direkam di Google Maps untuk verifikasi.',
  'Submit Visit': 'Submit only after the visit outcome, GPS, photo evidence, and required fields are complete.',
  'Kirim Kunjungan': 'Kirim hanya setelah hasil kunjungan, GPS, bukti foto, dan field wajib lengkap.',
}

function normalize(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export default function AgentFormTooltips() {
  const pathname = usePathname()

  useEffect(() => {
    const isPreVisit = /^\/agent\/customers\/[^/]+\/pre-visit$/.test(pathname)
    const isVisit = /^\/agent\/customers\/[^/]+\/visit$/.test(pathname)
    if (!isPreVisit && !isVisit) return

    const apply = () => {
      const candidates = document.querySelectorAll<HTMLElement>('label, button, .dui-fieldset-label span')
      candidates.forEach((element) => {
        const text = normalize(element.textContent)
        const tip = TOOLTIP_BY_TEXT[text]
        if (!tip || element.dataset.formTooltipApplied === 'true') return

        element.dataset.formTooltipApplied = 'true'
        element.setAttribute('data-form-tip', tip)
        element.setAttribute('aria-label', element.getAttribute('aria-label') || `${text}. ${tip}`)
        element.classList.add(styles.tipTarget)

        if (!element.matches('button, a, input, select, textarea') && !element.hasAttribute('tabindex')) {
          element.setAttribute('tabindex', '0')
        }
      })
    }

    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])

  return null
}
