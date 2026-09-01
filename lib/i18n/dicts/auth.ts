import { defineMessages } from '../index'

export const authMessages = defineMessages({
  // Auth entry shell
  'auth.shell.ariaLabel': { en: 'CRL workspace introduction', id: 'Pengenalan ruang kerja CRL' },
  'auth.logo.alt': { en: 'CRL logo', id: 'Logo CRL' },
  'auth.brand.subtitle': { en: 'Field operations', id: 'Operasi lapangan' },
  'auth.shell.footer': { en: 'Secure workspace for authorised teams', id: 'Ruang kerja aman untuk tim yang berwenang' },

  // Login card
  'auth.card.eyebrow': { en: 'Secure access', id: 'Akses aman' },
  'auth.login.title': { en: 'Welcome back', id: 'Selamat datang kembali' },
  'auth.login.copy': { en: 'Sign in using an email registered by the CRL administrator.', id: 'Masuk menggunakan email yang terdaftar oleh administrator CRL.' },
  'auth.button.opening': { en: 'Opening Google…', id: 'Membuka Google…' },
  'auth.button.google': { en: 'Continue with Google', id: 'Lanjutkan dengan Google' },
  'auth.login.note': { en: 'Access is limited to registered CRL team members.', id: 'Akses dibatasi untuk anggota tim CRL yang terdaftar.' },

  // Auth route / redirect status
  'auth.route.checking': { en: 'Checking your CRL account…', id: 'Memeriksa akun CRL Anda…' },
  'auth.error.database': { en: 'Database error: {message}', id: 'Kesalahan basis data: {message}' },
  'auth.error.notRegistered': { en: 'Email {email} is not registered as a CRL user.', id: 'Email {email} tidak terdaftar sebagai pengguna CRL.' },
  'auth.error.inactive': { en: 'Your CRL account exists but is currently inactive.', id: 'Akun CRL Anda ada tetapi saat ini tidak aktif.' },
})
