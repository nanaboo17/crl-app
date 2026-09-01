import { defineMessages } from '../index'

export const sharedMessages = defineMessages({
  // Pagination
  'pagination.label': { en: 'Pagination', id: 'Paginasi' },
  'pagination.showing': { en: 'Showing {from}–{to} of {total}', id: 'Menampilkan {from}–{to} dari {total}' },
  'pagination.previous': { en: 'Previous', id: 'Sebelumnya' },
  'pagination.next': { en: 'Next', id: 'Berikutnya' },
  'pagination.previousPage': { en: 'Previous page', id: 'Halaman sebelumnya' },
  'pagination.nextPage': { en: 'Next page', id: 'Halaman berikutnya' },
  'pagination.pageAria': { en: 'Page {page}', id: 'Halaman {page}' },

  // Common status business terms
  'status.paid': { en: 'Paid', id: 'Lunas' },
  'status.unpaid': { en: 'Unpaid', id: 'Belum Bayar' },
  'status.visited': { en: 'Visited', id: 'Dikunjungi' },
  'status.needsVisit': { en: 'Needs Visit', id: 'Perlu Kunjungan' },
  'status.readyForVisit': { en: 'Ready for Visit', id: 'Siap Dikunjungi' },
  'status.inProgress': { en: 'In Progress', id: 'Proses' },
  'status.notStarted': { en: 'Not Started', id: 'Belum Mulai' },
  'status.completed': { en: 'Completed', id: 'Selesai' },
  'status.active': { en: 'Active', id: 'Aktif' },
  'status.inactive': { en: 'Inactive', id: 'Nonaktif' },
})
