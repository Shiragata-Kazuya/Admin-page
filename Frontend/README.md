# Admin Panel – HIMA Akuntansi UT Bandung

## Struktur File

```
admin-panel/
├── index.html              # Halaman utama (HTML saja, tanpa inline script)
├── style.css               # Semua style / CSS
└── js/
    ├── firebase-config.js  # Konfigurasi Firebase (⚠️ jangan commit ke repo publik)
    ├── security.js         # Utilitas keamanan: sanitasi, hashing, rate limit
    ├── ui.js               # Helper UI: notifikasi, spinner tombol
    ├── app.js              # Entry point: inisialisasi Firebase + navigasi
    ├── auth.js             # Login / logout
    ├── beranda.js          # Manajemen beranda (slider, about, visi misi)
    ├── kegiatan.js         # Manajemen kegiatan (FIX BUG tambah kegiatan)
    ├── kontak.js           # Manajemen kontak & sosial media
    └── struktur.js         # Manajemen struktur organisasi
```

---

## Bug yang Diperbaiki

### 🐛 Tambah Kegiatan Tidak Bisa Menutup Modal
**Root cause:** Modal dibuka lewat `data-bs-toggle="modal"` (implicit Bootstrap instance).
Ketika kode memanggil `bootstrap.Modal.getInstance(el)`, hasilnya `null` karena
instance tidak tersimpan secara eksplisit. Akibatnya modal tidak bisa ditutup setelah simpan.

**Fix:** Modal sekarang diinisialisasi secara **programatik** di `kegiatan.js`:
```js
_kegiatanModal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
```
Dan dibuka/ditutup lewat `_kegiatanModal.show()` / `_kegiatanModal.hide()`.

---

## Keamanan yang Ditambahkan

| Fitur | Keterangan |
|---|---|
| **Sanitasi HTML (XSS)** | Semua input user di-escape dengan `escapeHtml()` sebelum dimasukkan ke DOM |
| **Validasi URL** | URL gambar dicek dengan `isSafeUrl()` agar hanya http/https |
| **Hash Password (SHA-256)** | Password di-hash sebelum dibandingkan. Mendukung mode legacy plain text |
| **Rate Limiting Login** | Maksimal 5 percobaan gagal → kunci 5 menit, countdown ditampilkan |
| **Session Token Acak** | Session disimpan sebagai UUID acak, bukan string `'true'` |
| **Auto-Logout** | Sesi kedaluwarsa otomatis setelah 60 menit tidak aktif |
| **Content Security Policy** | Header CSP di meta tag membatasi sumber script/style yang boleh dimuat |
| **Toggle Show/Hide Password** | UX lebih baik dan aman |
| **Input maxlength** | Semua field dibatasi panjang input |
| **Validasi form** | Validasi dilakukan di JS sebelum dikirim ke Firestore |

---

## Cara Menjalankan

Karena file menggunakan ES Modules (`import/export`), **harus dijalankan dari server HTTP**,
bukan dibuka langsung sebagai file (file://).

**Opsi 1 – VS Code Live Server:**
Klik kanan `index.html` → "Open with Live Server"

**Opsi 2 – Python:**
```bash
cd admin-panel
python -m http.server 8080
# Buka: http://localhost:8080
```

**Opsi 3 – Node.js (npx):**
```bash
npx serve admin-panel
```

---

## Upgrade Password ke Hash (Rekomendasi)

Password yang tersimpan plain text di Firestore perlu diupgrade.
Di console browser, jalankan:

```js
const encoder = new TextEncoder();
const data = encoder.encode('password_baru_kamu');
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
console.log(hashHex); // Simpan string ini sebagai field password di Firestore
```

Kemudian update dokumen `admin/users` di Firestore:
- Field `password` → ganti dengan string hex di atas (64 karakter).

---

## Rekomendasi Selanjutnya

- Gunakan **Firebase Authentication** (email/password) sebagai pengganti sistem custom ini.
- Tambahkan **Firebase Security Rules** di Firestore agar hanya user terautentikasi yang bisa read/write.
- Jangan push `firebase-config.js` ke GitHub publik.
