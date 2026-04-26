/**
 * kegiatan.js  –  Modul Manajemen Kegiatan (ADMIN)
 *
 * FITUR BARU:
 *   1. Tombol Edit — ubah semua field kegiatan yang sudah tersimpan
 *   2. Image Position & Zoom Editor — atur posisi foto agar pas
 *      di bingkai kartu kegiatan (h-48, object-cover)
 *      Data disimpan: { imgPosX, imgPosY, imgScale }
 *
 * BUG FIX (sebelumnya):
 *   Modal dibuka programatik agar .hide() bisa dipanggil dengan benar.
 */

import {
    getDocs, addDoc, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { showNotification, setButtonLoading } from "./ui.js";
import { escapeHtml, isSafeUrl }              from "./security.js";

let _kegiatanModal  = null;   // modal tambah / edit
let _kegiatanColRef = null;
let _db             = null;
let _editingId      = null;   // null = mode tambah, string = mode edit

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
export function initKegiatan(refs) {
    _kegiatanColRef = refs.kegiatan;
    _db             = refs.db;

    // Inisialisasi modal Bootstrap secara programatik
    const modalEl = document.getElementById('modalAddKegiatan');
    if (modalEl) {
        _kegiatanModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

        // Reset form + state edit setiap kali modal ditutup
        modalEl.addEventListener('hidden.bs.modal', _resetForm);
    }

    // Tombol Tambah Kegiatan
    document.getElementById('btnOpenTambahKegiatan')?.addEventListener('click', () => {
        _editingId = null;
        _resetForm();
        document.getElementById('modalKegiatanLabel').innerHTML =
            '<i class="fas fa-calendar-plus me-2"></i>Tambah Kegiatan Baru';
        document.getElementById('btnSimpanKegiatanBaru').innerHTML =
            '<i class="fas fa-save me-1"></i> Simpan Kegiatan';
        _kegiatanModal?.show();
    });

    // Counter karakter deskripsi singkat
    document.getElementById('kegShortDesc')?.addEventListener('input', function () {
        document.getElementById('shortDescCount').textContent = `${this.value.length}/150`;
    });

    // Form submit (Tambah atau Edit)
    document.getElementById('formKegiatanBaru')?.addEventListener('submit', handleSimpanKegiatan);

    // Inisialisasi image editor modal
    _initImgEditorModal();

    // Tombol "Atur Foto" di form kegiatan
    document.getElementById('btnAturFotoKegiatan')?.addEventListener('click', () => {
        const url = document.getElementById('kegImage').value.trim();
        _openImgEditor(url);
    });

    // Update preview mini saat URL diubah
    document.getElementById('kegImage')?.addEventListener('input', function () {
        _updateMiniPreview(this.value.trim());
        // Kalau editor sedang terbuka, update juga frame-nya
        const modal = document.getElementById('kegImgEditorModal');
        if (modal?.style.display === 'flex') {
            const frame = document.getElementById('kegImgEditorFrame');
            if (frame) frame.style.backgroundImage = isSafeUrl(this.value) ? `url('${this.value}')` : 'none';
        }
    });

    loadKegiatanData();
}

// ═══════════════════════════════════════════════════════════════
// IMAGE EDITOR MODAL (khusus kegiatan)
// ═══════════════════════════════════════════════════════════════

// Nilai sementara sebelum "Terapkan"
let _tmpPosX = 50, _tmpPosY = 50, _tmpScale = 1;

function _initImgEditorModal() {
    if (document.getElementById('kegImgEditorModal')) return;

    const modal = document.createElement('div');
    modal.id = 'kegImgEditorModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);justify-content:center;align-items:center;';

    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;width:min(520px,95vw);overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.4);">
            <div style="background:#212529;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:700;font-size:15px;">
                    <i class="fas fa-crop-alt me-2"></i>Atur Posisi &amp; Zoom Foto Kegiatan
                </span>
                <button id="kegImgEditorClose" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;">&times;</button>
            </div>

            <!-- Preview — pakai rasio kartu kegiatan (16:9 / h-48) -->
            <div style="background:#f4f6f9;padding:20px;text-align:center;">
                <p style="font-size:12px;color:#6c757d;margin-bottom:10px;">
                    <i class="fas fa-info-circle me-1 text-primary"></i>
                    Preview <strong>persis seperti bingkai kartu</strong> di website. Drag atau pakai slider.
                </p>
                <!-- Bingkai persegi panjang seperti h-48 di kartu kegiatan -->
                <div id="kegImgEditorFrame" style="
                    width:320px; height:192px; border-radius:10px;
                    border:3px solid #0a192f; margin:0 auto 8px;
                    background-color:#e9ecef; background-repeat:no-repeat;
                    background-size:100%; background-position:50% 50%;
                    cursor:grab; user-select:none;
                    box-shadow:0 4px 20px rgba(0,0,0,0.2);
                    position:relative; overflow:hidden;
                ">
                    <div id="kegImgEditorPlaceholder" style="
                        position:absolute;inset:0;display:flex;flex-direction:column;
                        align-items:center;justify-content:center;color:#adb5bd;font-size:13px;
                    ">
                        <i class="fas fa-image fa-2x mb-2"></i>
                        <span>Masukkan URL foto dulu</span>
                    </div>
                </div>
                <p style="font-size:11px;color:#adb5bd;">
                    <i class="fas fa-mouse me-1"></i>Drag untuk geser &nbsp;|&nbsp; Scroll untuk zoom
                </p>
            </div>

            <!-- Slider -->
            <div style="padding:16px 20px 20px;">
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;">
                            <i class="fas fa-search me-1 text-primary"></i>Zoom
                        </label>
                        <span id="kegLblScale" style="font-size:13px;font-weight:700;color:#0d6efd;">1.0×</span>
                    </div>
                    <input type="range" id="kegSlScale" min="0.5" max="3" step="0.05" value="1" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;">
                        <span>0.5× (perkecil)</span><span>3.0× (perbesar)</span>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;">
                            <i class="fas fa-arrows-alt-h me-1 text-success"></i>Geser Kiri ↔ Kanan
                        </label>
                        <span id="kegLblPosX" style="font-size:13px;font-weight:700;color:#198754;">50%</span>
                    </div>
                    <input type="range" id="kegSlPosX" min="0" max="100" step="1" value="50" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;">
                        <span>← Kiri</span><span>Kanan →</span>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;">
                            <i class="fas fa-arrows-alt-v me-1 text-warning"></i>Geser Atas ↕ Bawah
                        </label>
                        <span id="kegLblPosY" style="font-size:13px;font-weight:700;color:#ffc107;">50%</span>
                    </div>
                    <input type="range" id="kegSlPosY" min="0" max="100" step="1" value="50" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;">
                        <span>↑ Atas</span><span>Bawah ↓</span>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button id="kegImgEditorReset" class="btn btn-outline-secondary btn-sm flex-fill">
                        <i class="fas fa-undo me-1"></i>Reset
                    </button>
                    <button id="kegImgEditorApply" class="btn btn-primary btn-sm flex-fill fw-bold">
                        <i class="fas fa-check me-1"></i>Terapkan
                    </button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    let _dragging = false, _lastX = 0, _lastY = 0;

    function _refresh() {
        const frame = document.getElementById('kegImgEditorFrame');
        const scale = parseFloat(document.getElementById('kegSlScale').value);
        const posX  = parseFloat(document.getElementById('kegSlPosX').value);
        const posY  = parseFloat(document.getElementById('kegSlPosY').value);

        // background-size pakai % dari elemen frame (320×192)
        frame.style.backgroundSize     = `${scale * 100}%`;
        frame.style.backgroundPosition = `${posX}% ${posY}%`;

        document.getElementById('kegLblScale').textContent = `${scale.toFixed(2)}×`;
        document.getElementById('kegLblPosX').textContent  = `${Math.round(posX)}%`;
        document.getElementById('kegLblPosY').textContent  = `${Math.round(posY)}%`;
    }

    ['kegSlScale','kegSlPosX','kegSlPosY'].forEach(id =>
        document.getElementById(id).addEventListener('input', _refresh)
    );

    // Drag
    const frame = document.getElementById('kegImgEditorFrame');
    frame.addEventListener('mousedown', e => {
        _dragging = true; _lastX = e.clientX; _lastY = e.clientY;
        frame.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
        if (!_dragging) return;
        const slX = document.getElementById('kegSlPosX');
        const slY = document.getElementById('kegSlPosY');
        slX.value = Math.min(100, Math.max(0, parseFloat(slX.value) - (e.clientX - _lastX) * 0.3));
        slY.value = Math.min(100, Math.max(0, parseFloat(slY.value) - (e.clientY - _lastY) * 0.3));
        _lastX = e.clientX; _lastY = e.clientY;
        _refresh();
    });
    window.addEventListener('mouseup', () => { _dragging = false; frame.style.cursor = 'grab'; });

    // Scroll zoom
    frame.addEventListener('wheel', e => {
        e.preventDefault();
        const sl = document.getElementById('kegSlScale');
        sl.value = Math.min(3, Math.max(0.5, parseFloat(sl.value) + (e.deltaY < 0 ? 0.1 : -0.1)));
        _refresh();
    }, { passive: false });

    // Close
    document.getElementById('kegImgEditorClose').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    // Reset
    document.getElementById('kegImgEditorReset').addEventListener('click', () => {
        document.getElementById('kegSlScale').value = 1;
        document.getElementById('kegSlPosX').value  = 50;
        document.getElementById('kegSlPosY').value  = 50;
        _refresh();
    });

    // Terapkan → simpan ke variabel sementara + update badge
    document.getElementById('kegImgEditorApply').addEventListener('click', () => {
        _tmpScale = parseFloat(document.getElementById('kegSlScale').value);
        _tmpPosX  = parseFloat(document.getElementById('kegSlPosX').value);
        _tmpPosY  = parseFloat(document.getElementById('kegSlPosY').value);

        // Update badge di form
        const badge = document.getElementById('kegImgPosBadge');
        if (badge) {
            badge.textContent = `zoom:${_tmpScale.toFixed(1)}× pos:${Math.round(_tmpPosX)}/${Math.round(_tmpPosY)}`;
            badge.style.color = '#198754';
        }

        // Update mini preview di form
        _updateMiniPreview(document.getElementById('kegImage')?.value.trim() || '');

        modal.style.display = 'none';
        showNotification('Posisi foto diatur!', 'info');
    });
}

function _openImgEditor(url) {
    const modal = document.getElementById('kegImgEditorModal');
    const frame = document.getElementById('kegImgEditorFrame');
    const ph    = document.getElementById('kegImgEditorPlaceholder');

    if (isSafeUrl(url)) {
        frame.style.backgroundImage = `url('${url}')`;
        if (ph) ph.style.display = 'none';
    } else {
        frame.style.backgroundImage = 'none';
        if (ph) ph.style.display = 'flex';
    }

    document.getElementById('kegSlScale').value = _tmpScale;
    document.getElementById('kegSlPosX').value  = _tmpPosX;
    document.getElementById('kegSlPosY').value  = _tmpPosY;

    // Trigger refresh
    document.getElementById('kegSlScale').dispatchEvent(new Event('input'));

    modal.style.display = 'flex';
}

function _updateMiniPreview(url) {
    const mini = document.getElementById('kegMiniPreview');
    if (!mini) return;
    mini.style.backgroundImage    = isSafeUrl(url) ? `url('${url}')` : 'none';
    mini.style.backgroundSize     = `${_tmpScale * 100}%`;
    mini.style.backgroundPosition = `${_tmpPosX}% ${_tmpPosY}%`;
}

// ═══════════════════════════════════════════════════════════════
// LOAD & RENDER TABEL
// ═══════════════════════════════════════════════════════════════
export async function loadKegiatanData() {
    const tbody = document.getElementById('tableBodyKegiatan');
    if (!tbody || !_kegiatanColRef) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">
        <span class="spinner-border spinner-border-sm me-2"></span>Memuat kegiatan...
    </td></tr>`;

    try {
        const snapshot = await getDocs(_kegiatanColRef);
        tbody.innerHTML = '';
        let count = 0;

        snapshot.forEach(docSnap => {
            if (docSnap.id === 'data') return;
            count++;
            const d   = docSnap.data();
            const tr  = document.createElement('tr');
            const imgSrc = isSafeUrl(d.image) ? d.image : 'https://placehold.co/60x60?text=No+Image';

            // Preview mini di tabel pakai background-image agar posisi terlihat
            const previewStyle = `
                width:60px;height:60px;border-radius:6px;flex-shrink:0;
                background-color:#e9ecef;
                background-image:url('${escapeHtml(imgSrc)}');
                background-size:${(d.imgScale ?? 1) * 100}%;
                background-position:${d.imgPosX ?? 50}% ${d.imgPosY ?? 50}%;
                background-repeat:no-repeat;
            `;

            tr.innerHTML = `
                <td>
                    <div style="${previewStyle}"
                         onerror="this.style.backgroundImage='url(https://placehold.co/60x60?text=Error)'">
                    </div>
                </td>
                <td class="fw-bold">${escapeHtml(d.title    || '-')}</td>
                <td><span class="badge bg-secondary">${escapeHtml(d.category || '-')}</span></td>
                <td>${escapeHtml(d.date || '-')}</td>
                <td>
                    <button class="btn btn-sm btn-warning btn-edit-kegiatan me-1"
                            data-id="${escapeHtml(docSnap.id)}"
                            title="Edit kegiatan ini">
                        <i class="fas fa-edit"></i>
                    </button>
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
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">
                <i class="fas fa-calendar-times me-2"></i>Belum ada kegiatan.
            </td></tr>`;
        }

        // Event listeners
        tbody.querySelectorAll('.btn-delete-kegiatan').forEach(btn =>
            btn.addEventListener('click', handleHapusKegiatan)
        );
        tbody.querySelectorAll('.btn-edit-kegiatan').forEach(btn =>
            btn.addEventListener('click', handleBukaEdit)
        );

    } catch (err) {
        console.error('Gagal load kegiatan:', err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">
            <i class="fas fa-exclamation-circle me-2"></i>Gagal memuat kegiatan. Periksa koneksi.
        </td></tr>`;
    }
}

// ═══════════════════════════════════════════════════════════════
// RESET FORM
// ═══════════════════════════════════════════════════════════════
function _resetForm() {
    document.getElementById('formKegiatanBaru')?.reset();
    document.getElementById('kegiatanFormError')?.classList.add('d-none');
    document.getElementById('shortDescCount').textContent = '0/150';
    _editingId = null;
    _tmpPosX = 50; _tmpPosY = 50; _tmpScale = 1;

    const badge = document.getElementById('kegImgPosBadge');
    if (badge) { badge.textContent = 'zoom:1.0× pos:50/50'; badge.style.color = '#adb5bd'; }

    _updateMiniPreview('');
}

// ═══════════════════════════════════════════════════════════════
// BUKA FORM EDIT
// ═══════════════════════════════════════════════════════════════
async function handleBukaEdit() {
    const id = this.getAttribute('data-id');
    if (!id) return;

    // Ambil data dari Firestore
    try {
        const snap = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js")
            .then(m => m.getDoc(m.doc(_db, 'kegiatan', id)));

        if (!snap.exists()) { showNotification('Data tidak ditemukan.', 'danger'); return; }
        const d = snap.data();

        // Isi form
        document.getElementById('kegTitle').value     = d.title     || '';
        document.getElementById('kegDate').value      = d.date      || '';
        document.getElementById('kegCategory').value  = d.category  || 'Seminar';
        document.getElementById('kegImage').value     = d.image     || '';
        document.getElementById('kegShortDesc').value = d.shortDesc || '';
        document.getElementById('kegFullDesc').value  = d.fullDesc  || '';

        document.getElementById('shortDescCount').textContent = `${(d.shortDesc || '').length}/150`;

        // Set posisi foto
        _tmpPosX  = d.imgPosX  ?? 50;
        _tmpPosY  = d.imgPosY  ?? 50;
        _tmpScale = d.imgScale ?? 1;

        const badge = document.getElementById('kegImgPosBadge');
        if (badge) {
            badge.textContent = `zoom:${_tmpScale.toFixed(1)}× pos:${Math.round(_tmpPosX)}/${Math.round(_tmpPosY)}`;
            badge.style.color = (d.imgPosX != null) ? '#198754' : '#adb5bd';
        }

        _updateMiniPreview(d.image || '');

        // Set mode edit
        _editingId = id;

        document.getElementById('modalKegiatanLabel').innerHTML =
            '<i class="fas fa-edit me-2"></i>Edit Kegiatan';
        document.getElementById('btnSimpanKegiatanBaru').innerHTML =
            '<i class="fas fa-save me-1"></i> Simpan Perubahan';

        _kegiatanModal?.show();
    } catch (err) {
        console.error('Gagal load data kegiatan untuk edit:', err);
        showNotification('Gagal memuat data kegiatan.', 'danger');
    }
}

// ═══════════════════════════════════════════════════════════════
// SIMPAN (TAMBAH atau EDIT)
// ═══════════════════════════════════════════════════════════════
async function handleSimpanKegiatan(e) {
    e.preventDefault();

    const errEl = document.getElementById('kegiatanFormError');
    errEl.classList.add('d-none');

    const title     = document.getElementById('kegTitle').value.trim();
    const date      = document.getElementById('kegDate').value.trim();
    const category  = document.getElementById('kegCategory').value;
    const image     = document.getElementById('kegImage').value.trim();
    const shortDesc = document.getElementById('kegShortDesc').value.trim();
    const fullDesc  = document.getElementById('kegFullDesc').value.trim();

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

    const data = {
        title, date, category, image, shortDesc, fullDesc,
        imgPosX : _tmpPosX,
        imgPosY : _tmpPosY,
        imgScale: _tmpScale,
    };

    try {
        if (_editingId) {
            // MODE EDIT — updateDoc
            await updateDoc(doc(_db, 'kegiatan', _editingId), data);
            showNotification('Kegiatan berhasil diperbarui!');
        } else {
            // MODE TAMBAH — addDoc
            data.createdAt = new Date().toISOString();
            await addDoc(_kegiatanColRef, data);
            showNotification('Kegiatan baru berhasil ditambahkan!');
        }

        _kegiatanModal?.hide();
        await loadKegiatanData();
    } catch (err) {
        console.error('Gagal simpan kegiatan:', err);
        errEl.classList.remove('d-none');
        errEl.textContent = 'Gagal menyimpan kegiatan. Coba lagi.';
    } finally {
        restore(_editingId
            ? '<i class="fas fa-save me-1"></i> Simpan Perubahan'
            : '<i class="fas fa-save me-1"></i> Simpan Kegiatan'
        );
    }
}

// ═══════════════════════════════════════════════════════════════
// HAPUS
// ═══════════════════════════════════════════════════════════════
async function handleHapusKegiatan() {
    const id = this.getAttribute('data-id');
    if (!id) return;
    if (!confirm('Yakin ingin menghapus kegiatan ini? Tindakan tidak bisa dibatalkan.')) return;

    const btn = this;
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
