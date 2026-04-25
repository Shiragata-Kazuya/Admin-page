/**
 * kegiatan.js  –  Modul Manajemen Kegiatan
 * ============================================================
 * BUG FIX UTAMA:
 *   Sebelumnya modal ditutup dengan bootstrap.Modal.getInstance()
 *   yang mengembalikan null karena modal dibuka lewat data-bs-toggle
 *   (implicit instance). Sekarang modal dibuka secara PROGRAMATIK
 *   dengan `new bootstrap.Modal(el)` agar instance tersimpan
 *   dan bisa dipanggil `.hide()` dengan benar setelah simpan.
 *
 * KEAMANAN:
 *   - Input di-sanitasi dengan escapeHtml sebelum dimasukkan ke DOM
 *   - URL gambar divalidasi agar hanya http/https
 *   - Field dibatasi maxlength di HTML dan dicek ulang di JS
 * ============================================================
 */

import {
    getDocs, addDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { showNotification, setButtonLoading } from "./ui.js";
import { escapeHtml, isSafeUrl }              from "./security.js";

// Instance modal — disimpan agar bisa ditutup secara programatik
let _kegiatanModal     = null;
let _kegiatanColRef    = null;
let _db                = null;

// -------------------------------------------------------
// Init modul kegiatan
// -------------------------------------------------------
export function initKegiatan(refs) {
    _kegiatanColRef = refs.kegiatan;
    _db             = refs.db;

    // Inisialisasi modal Bootstrap secara programatik (FIX BUG)
    const modalEl = document.getElementById('modalAddKegiatan');
    if (modalEl) {
        _kegiatanModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

        // Reset form setiap kali modal ditutup
        modalEl.addEventListener('hidden.bs.modal', () => {
            document.getElementById('formKegiatanBaru').reset();
            document.getElementById('kegiatanFormError').classList.add('d-none');
            document.getElementById('shortDescCount').textContent = '0/150';
        });
    }

    // Tombol buka modal (tidak lagi pakai data-bs-toggle)
    const btnOpen = document.getElementById('btnOpenTambahKegiatan');
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            if (_kegiatanModal) _kegiatanModal.show();
        });
    }

    // Counter karakter deskripsi singkat
    const shortDescEl = document.getElementById('kegShortDesc');
    if (shortDescEl) {
        shortDescEl.addEventListener('input', function () {
            document.getElementById('shortDescCount').textContent = `${this.value.length}/150`;
        });
    }

    // Form submit tambah kegiatan
    const form = document.getElementById('formKegiatanBaru');
    if (form) {
        form.addEventListener('submit', handleTambahKegiatan);
    }

    // Load data pertama kali
    loadKegiatanData();
}

// -------------------------------------------------------
// Load & render tabel kegiatan
// -------------------------------------------------------
export async function loadKegiatanData() {
    const tbody = document.getElementById('tableBodyKegiatan');
    if (!tbody || !_kegiatanColRef) return;

    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">
        <span class="spinner-border spinner-border-sm me-2"></span>Memuat kegiatan...
    </td></tr>`;

    try {
        const snapshot = await getDocs(_kegiatanColRef);
        tbody.innerHTML = '';
        let count = 0;

        snapshot.forEach(docSnap => {
            // Lewati dokumen sentinel 'data' jika ada
            if (docSnap.id === 'data') return;
            count++;
            const d  = docSnap.data();
            const tr = document.createElement('tr');

            // Validasi URL gambar – fallback ke placeholder jika tidak aman
            const imgSrc = isSafeUrl(d.image) ? d.image : 'https://placehold.co/60x60?text=No+Image';

            tr.innerHTML = `
                <td>
                    <img src="${escapeHtml(imgSrc)}"
                         class="kegiatan-img-preview"
                         alt="${escapeHtml(d.title || 'Kegiatan')}"
                         onerror="this.onerror=null; this.src='https://placehold.co/60x60?text=Error'">
                </td>
                <td class="fw-bold">${escapeHtml(d.title    || '-')}</td>
                <td><span class="badge bg-secondary">${escapeHtml(d.category || '-')}</span></td>
                <td>${escapeHtml(d.date || '-')}</td>
                <td>
                    <button class="btn btn-sm btn-danger btn-delete-kegiatan"
                            data-id="${escapeHtml(docSnap.id)}"
                            title="Hapus kegiatan ini">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (count === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">
                <i class="fas fa-calendar-times me-2"></i>Belum ada kegiatan.
            </td></tr>`;
        }

        // Pasang event listener hapus
        tbody.querySelectorAll('.btn-delete-kegiatan').forEach(btn => {
            btn.addEventListener('click', handleHapusKegiatan);
        });

    } catch (err) {
        console.error('Gagal load kegiatan:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">
            <i class="fas fa-exclamation-circle me-2"></i>Gagal memuat kegiatan. Periksa koneksi.
        </td></tr>`;
    }
}

// -------------------------------------------------------
// Handler: Tambah Kegiatan Baru
// -------------------------------------------------------
async function handleTambahKegiatan(e) {
    e.preventDefault();

    const errEl = document.getElementById('kegiatanFormError');
    errEl.classList.add('d-none');

    const title     = document.getElementById('kegTitle').value.trim();
    const date      = document.getElementById('kegDate').value.trim();
    const category  = document.getElementById('kegCategory').value;
    const image     = document.getElementById('kegImage').value.trim();
    const shortDesc = document.getElementById('kegShortDesc').value.trim();
    const fullDesc  = document.getElementById('kegFullDesc').value.trim();

    // Validasi
    if (!title || !date || !category || !image || !shortDesc || !fullDesc) {
        errEl.classList.remove('d-none');
        errEl.textContent = 'Semua field wajib diisi.';
        return;
    }

    if (!isSafeUrl(image)) {
        errEl.classList.remove('d-none');
        errEl.textContent = 'URL gambar tidak valid. Harus diawali https:// atau http://';
        return;
    }

    if (shortDesc.length > 150) {
        errEl.classList.remove('d-none');
        errEl.textContent = 'Deskripsi singkat maksimal 150 karakter.';
        return;
    }

    const btn     = document.getElementById('btnSimpanKegiatanBaru');
    const restore = setButtonLoading(btn, 'Menyimpan...');

    const newData = {
        title,
        date,
        category,
        image,
        shortDesc,
        fullDesc,
        createdAt: new Date().toISOString(),
    };

    try {
        await addDoc(_kegiatanColRef, newData);
        showNotification('Kegiatan baru berhasil ditambahkan!');

        // FIX: Tutup modal dengan instance yang tersimpan (bukan getInstance)
        if (_kegiatanModal) _kegiatanModal.hide();

        await loadKegiatanData();
    } catch (err) {
        console.error('Gagal tambah kegiatan:', err);
        errEl.classList.remove('d-none');
        errEl.textContent = 'Gagal menyimpan kegiatan. Coba lagi.';
    } finally {
        restore('<i class="fas fa-save me-1"></i> Simpan Kegiatan');
    }
}

// -------------------------------------------------------
// Handler: Hapus Kegiatan
// -------------------------------------------------------
async function handleHapusKegiatan() {
    const id = this.getAttribute('data-id');
    if (!id) return;
    if (!confirm('Yakin ingin menghapus kegiatan ini? Tindakan tidak bisa dibatalkan.')) return;

    const btn     = this;
    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        await deleteDoc(doc(_db, 'kegiatan', id));
        showNotification('Kegiatan berhasil dihapus.');
        await loadKegiatanData();
    } catch (err) {
        console.error('Gagal hapus kegiatan:', err);
        showNotification('Gagal menghapus kegiatan.', 'danger');
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-trash"></i>';
    }
}
