/**
 * struktur.js  –  Modul Manajemen Struktur Organisasi (ADMIN)
 *
 * FIX: Preview lingkaran sekarang pakai background-image (bukan <img>)
 * agar zoom + posisi bekerja benar — sama persis dengan tampilan frontend.
 *
 * Cara kerja:
 *   background-size  = scale * 100%   → kontrol zoom
 *   background-position = posX% posY% → kontrol posisi
 *
 * Data disimpan ke Firestore: { name, img, posX, posY, scale }
 */

import { getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showNotification, setButtonLoading } from "./ui.js";
import { escapeHtml, isSafeUrl }              from "./security.js";

let _docStrukturRef  = null;
let _allStrukturData = {};

export function initStruktur(refs) {
    _docStrukturRef = refs.struktur;

    document.getElementById('btnAddPeriode').addEventListener('click',  handleAddPeriode);
    document.getElementById('btnAddDivisi').addEventListener('click',   () => addDivisiUI());
    document.getElementById('btnAddGaleri').addEventListener('click',   () => addGaleriUI());
    document.getElementById('btnSaveStruktur').addEventListener('click', handleSaveStruktur);
    document.getElementById('selectPeriode').addEventListener('change', function () {
        if (this.value) renderStrukturForm(this.value);
        else {
            document.getElementById('strukturEditorArea').style.display = 'none';
            document.getElementById('strukturEmptyState').style.display = 'block';
        }
    });

    _initImageEditorModal();
    loadStrukturData();
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Hitung background-size & background-position dari nilai
// ═══════════════════════════════════════════════════════════════
function _toBgStyle(posX, posY, scale) {
    return `background-size:${scale * 100}%; background-position:${posX}% ${posY}%; background-repeat:no-repeat;`;
}

function _applyBgToEl(el, url, posX, posY, scale) {
    if (!el) return;
    el.style.backgroundImage    = isSafeUrl(url) ? `url('${url}')` : 'none';
    el.style.backgroundSize     = `${scale * 100}%`;
    el.style.backgroundPosition = `${posX}% ${posY}%`;
    el.style.backgroundRepeat   = 'no-repeat';
}

// ═══════════════════════════════════════════════════════════════
// IMAGE EDITOR MODAL
// ═══════════════════════════════════════════════════════════════
function _initImageEditorModal() {
    if (document.getElementById('imgEditorModal')) return;

    const modal = document.createElement('div');
    modal.id = 'imgEditorModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);justify-content:center;align-items:center;';

    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;width:min(500px,95vw);overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.4);">
            <!-- Header -->
            <div style="background:#212529;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:700;font-size:15px;">
                    <i class="fas fa-crop-alt me-2"></i>Atur Posisi &amp; Zoom Foto
                </span>
                <button id="imgEditorClose" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>
            </div>

            <!-- Preview -->
            <div style="background:#f4f6f9;padding:20px;text-align:center;">
                <p style="font-size:12px;color:#6c757d;margin-bottom:12px;">
                    <i class="fas fa-info-circle me-1 text-primary"></i>
                    Preview <strong>persis seperti di website</strong>. Drag foto atau pakai slider.
                </p>
                <!-- Bingkai lingkaran pakai background-image bukan <img> -->
                <div id="imgEditorFrame" style="
                    width:160px; height:160px; border-radius:50%;
                    border:4px solid #0a192f; margin:0 auto 8px;
                    background-color:#e9ecef; background-repeat:no-repeat;
                    background-size:100%; background-position:50% 20%;
                    cursor:grab; user-select:none;
                    box-shadow:0 4px 20px rgba(0,0,0,0.25);
                    position:relative;
                ">
                    <!-- Overlay placeholder saat tidak ada foto -->
                    <div id="imgEditorPlaceholder" style="
                        position:absolute;inset:0;display:flex;flex-direction:column;
                        align-items:center;justify-content:center;color:#adb5bd;font-size:12px;
                    ">
                        <i class="fas fa-image fa-2x mb-1"></i>
                        <span>Belum ada foto</span>
                    </div>
                </div>
                <p style="font-size:11px;color:#adb5bd;">
                    <i class="fas fa-mouse me-1"></i>Drag untuk geser &nbsp;|&nbsp; Scroll untuk zoom
                </p>
            </div>

            <!-- Kontrol slider -->
            <div style="padding:18px 20px 20px;">
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;">
                            <i class="fas fa-search me-1 text-primary"></i>Zoom
                        </label>
                        <span id="lblScale" style="font-size:13px;font-weight:700;color:#0d6efd;">1.0×</span>
                    </div>
                    <input type="range" id="slScale" min="0.5" max="3" step="0.05" value="1" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;">
                        <span>0.5× (perkecil)</span><span>3.0× (perbesar)</span>
                    </div>
                </div>

                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;">
                            <i class="fas fa-arrows-alt-h me-1 text-success"></i>Geser Kiri ↔ Kanan
                        </label>
                        <span id="lblPosX" style="font-size:13px;font-weight:700;color:#198754;">50%</span>
                    </div>
                    <input type="range" id="slPosX" min="0" max="100" step="1" value="50" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;">
                        <span>← Kiri</span><span>Kanan →</span>
                    </div>
                </div>

                <div class="mb-4">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;">
                            <i class="fas fa-arrows-alt-v me-1 text-warning"></i>Geser Atas ↕ Bawah
                        </label>
                        <span id="lblPosY" style="font-size:13px;font-weight:700;color:#ffc107;">50%</span>
                    </div>
                    <input type="range" id="slPosY" min="0" max="100" step="1" value="50" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;">
                        <span>↑ Atas</span><span>Bawah ↓</span>
                    </div>
                </div>

                <div class="d-flex gap-2">
                    <button id="imgEditorReset" class="btn btn-outline-secondary btn-sm flex-fill">
                        <i class="fas fa-undo me-1"></i>Reset
                    </button>
                    <button id="imgEditorApply" class="btn btn-primary btn-sm flex-fill fw-bold">
                        <i class="fas fa-check me-1"></i>Terapkan
                    </button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    let _activeContainer = null;
    let _dragging = false, _lastX = 0, _lastY = 0;

    // Refresh preview frame pakai background-image
    function _refresh() {
        const frame = document.getElementById('imgEditorFrame');
        const scale = parseFloat(document.getElementById('slScale').value);
        const posX  = parseFloat(document.getElementById('slPosX').value);
        const posY  = parseFloat(document.getElementById('slPosY').value);

        // background-size: scale*100% agar zoom benar
        frame.style.backgroundSize     = `${scale * 100}%`;
        frame.style.backgroundPosition = `${posX}% ${posY}%`;

        document.getElementById('lblScale').textContent = `${scale.toFixed(2)}×`;
        document.getElementById('lblPosX').textContent  = `${Math.round(posX)}%`;
        document.getElementById('lblPosY').textContent  = `${Math.round(posY)}%`;
    }

    ['slScale','slPosX','slPosY'].forEach(id =>
        document.getElementById(id).addEventListener('input', _refresh)
    );

    // Drag pada frame
    const frame = document.getElementById('imgEditorFrame');
    frame.addEventListener('mousedown', e => {
        _dragging = true; _lastX = e.clientX; _lastY = e.clientY;
        frame.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
        if (!_dragging) return;
        const slX = document.getElementById('slPosX');
        const slY = document.getElementById('slPosY');
        // Geser kanan → posX turun (foto gerak ke kiri = area terlihat geser ke kanan)
        slX.value = Math.min(100, Math.max(0, parseFloat(slX.value) - (e.clientX - _lastX) * 0.4));
        slY.value = Math.min(100, Math.max(0, parseFloat(slY.value) - (e.clientY - _lastY) * 0.4));
        _lastX = e.clientX; _lastY = e.clientY;
        _refresh();
    });
    window.addEventListener('mouseup', () => { _dragging = false; frame.style.cursor = 'grab'; });

    // Scroll zoom
    frame.addEventListener('wheel', e => {
        e.preventDefault();
        const sl = document.getElementById('slScale');
        sl.value = Math.min(3, Math.max(0.5, parseFloat(sl.value) + (e.deltaY < 0 ? 0.1 : -0.1)));
        _refresh();
    }, { passive: false });

    // Close
    document.getElementById('imgEditorClose').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    // Reset
    document.getElementById('imgEditorReset').addEventListener('click', () => {
        document.getElementById('slScale').value = 1;
        document.getElementById('slPosX').value  = 50;
        document.getElementById('slPosY').value  = 20; // default sedikit ke atas
        _refresh();
    });

    // Terapkan
    document.getElementById('imgEditorApply').addEventListener('click', () => {
        if (!_activeContainer) return;
        const scale = parseFloat(document.getElementById('slScale').value);
        const posX  = parseFloat(document.getElementById('slPosX').value);
        const posY  = parseFloat(document.getElementById('slPosY').value);

        _activeContainer.dataset.scale = scale;
        _activeContainer.dataset.posX  = posX;
        _activeContainer.dataset.posY  = posY;

        // Update badge
        const badge = _activeContainer.querySelector('.img-pos-badge');
        if (badge) {
            badge.textContent = `zoom:${scale.toFixed(1)}× pos:${Math.round(posX)}/${Math.round(posY)}`;
            badge.style.color = '#198754';
        }

        // Update mini preview (juga pakai background-image)
        const miniCircle = _activeContainer.querySelector('.photo-mini-circle');
        const url = _activeContainer.querySelector('.photo-img-input')?.value.trim() || '';
        if (miniCircle) _applyBgToEl(miniCircle, url, posX, posY, scale);

        modal.style.display = 'none';
        showNotification('Posisi foto diatur. Jangan lupa klik Simpan Struktur!', 'info');
    });

    // Buka editor dari tombol "Atur Foto"
    window._openImgEditor = function(container) {
        _activeContainer = container;
        const url   = container.querySelector('.photo-img-input')?.value.trim() || '';
        const posX  = parseFloat(container.dataset.posX  ?? 50);
        const posY  = parseFloat(container.dataset.posY  ?? 20);
        const scale = parseFloat(container.dataset.scale ?? 1);

        const frame       = document.getElementById('imgEditorFrame');
        const placeholder = document.getElementById('imgEditorPlaceholder');

        if (isSafeUrl(url)) {
            frame.style.backgroundImage = `url('${url}')`;
            if (placeholder) placeholder.style.display = 'none';
        } else {
            frame.style.backgroundImage = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        }

        document.getElementById('slScale').value = scale;
        document.getElementById('slPosX').value  = posX;
        document.getElementById('slPosY').value  = posY;
        _refresh();
        modal.style.display = 'flex';
    };
}

// ═══════════════════════════════════════════════════════════════
// PHOTO INPUT GROUP — input URL + mini preview lingkaran + tombol
// ═══════════════════════════════════════════════════════════════
function createPhotoInputGroup(imgUrl = '', posX = 50, posY = 20, scale = 1, placeholder = 'URL Foto') {
    const safeUrl  = isSafeUrl(imgUrl) ? imgUrl : '';
    const wrapper  = document.createElement('div');
    wrapper.setAttribute('data-photo-container', '');
    wrapper.dataset.posX  = posX;
    wrapper.dataset.posY  = posY;
    wrapper.dataset.scale = scale;
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const isDefault = (scale === 1 && posX === 50 && posY === 20);

    wrapper.innerHTML = `
        <input type="url" class="form-control form-control-sm photo-img-input"
               value="${escapeHtml(safeUrl)}" placeholder="${escapeHtml(placeholder)}" maxlength="500">
        <div style="display:flex;align-items:center;gap:10px;">
            <!-- Mini preview lingkaran pakai background-image -->
            <div class="photo-mini-circle" style="
                width:52px; height:52px; border-radius:50%; flex-shrink:0;
                border:2px solid #dee2e6; background-color:#e9ecef;
                background-image:${safeUrl ? `url('${safeUrl}')` : 'none'};
                background-size:${scale * 100}%;
                background-position:${posX}% ${posY}%;
                background-repeat:no-repeat;
            "></div>
            <!-- Badge & tombol -->
            <div style="flex:1;min-width:0;">
                <span class="img-pos-badge d-block mb-1"
                      style="font-size:10px;color:${isDefault ? '#adb5bd' : '#198754'};">
                    zoom:${parseFloat(scale).toFixed(1)}× pos:${Math.round(posX)}/${Math.round(posY)}
                </span>
                <button type="button" class="btn btn-outline-primary btn-sm btn-atur-foto w-100 py-1" style="font-size:12px;">
                    <i class="fas fa-crop-alt me-1"></i>Atur Posisi &amp; Zoom
                </button>
            </div>
        </div>`;

    // Update mini preview saat URL diubah
    const input      = wrapper.querySelector('.photo-img-input');
    const miniCircle = wrapper.querySelector('.photo-mini-circle');
    input.addEventListener('input', function () {
        const url = this.value.trim();
        miniCircle.style.backgroundImage = isSafeUrl(url) ? `url('${url}')` : 'none';
        // Update preview modal jika sedang terbuka
        const modal = document.getElementById('imgEditorModal');
        if (modal?.style.display === 'flex') {
            const frame = document.getElementById('imgEditorFrame');
            const ph    = document.getElementById('imgEditorPlaceholder');
            if (isSafeUrl(url)) {
                frame.style.backgroundImage = `url('${url}')`;
                if (ph) ph.style.display = 'none';
            } else {
                frame.style.backgroundImage = 'none';
                if (ph) ph.style.display = 'flex';
            }
        }
    });

    // Tombol buka editor
    wrapper.querySelector('.btn-atur-foto').addEventListener('click', () => {
        window._openImgEditor(wrapper);
    });

    return wrapper;
}

// ═══════════════════════════════════════════════════════════════
// LOAD & DROPDOWN
// ═══════════════════════════════════════════════════════════════
async function loadStrukturData() {
    try {
        const snap = await getDoc(_docStrukturRef);
        _allStrukturData = snap.exists() ? snap.data() : {};
        renderPeriodeDropdown();
    } catch (err) {
        console.error('Gagal memuat struktur:', err);
        showNotification('Gagal memuat data struktur.', 'danger');
    }
}

function renderPeriodeDropdown() {
    const select = document.getElementById('selectPeriode');
    select.innerHTML = '<option value="">-- Pilih Periode --</option>';
    const periodes = Object.keys(_allStrukturData).sort((a, b) => b - a);
    periodes.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = `Periode ${p} - ${parseInt(p) + 1}`;
        select.appendChild(opt);
    });
    if (periodes.length > 0) {
        select.value = periodes[0];
        renderStrukturForm(periodes[0]);
    } else {
        document.getElementById('strukturEditorArea').style.display = 'none';
        document.getElementById('strukturEmptyState').style.display = 'block';
    }
}

function handleAddPeriode() {
    const thn = prompt('Masukkan Tahun Mulai Periode Baru (Contoh: 2024):');
    if (!thn) return;
    if (!/^\d{4}$/.test(thn)) { alert('Format tahun tidak valid. Harap masukkan 4 digit angka.'); return; }
    if (!_allStrukturData[thn]) _allStrukturData[thn] = { ketua: {}, wakil: {}, divisi: [], galeri: [] };
    renderPeriodeDropdown();
    document.getElementById('selectPeriode').value = thn;
    renderStrukturForm(thn);
    showNotification(`Periode ${thn} disiapkan. Isi form lalu klik Simpan Struktur.`, 'info');
}

// ═══════════════════════════════════════════════════════════════
// RENDER FORM
// ═══════════════════════════════════════════════════════════════
function renderStrukturForm(periode) {
    document.getElementById('strukturEmptyState').style.display = 'none';
    document.getElementById('strukturEditorArea').style.display = 'block';
    const data = _allStrukturData[periode] || { ketua: {}, wakil: {}, divisi: [], galeri: [] };

    document.getElementById('ketuaNama').value = data.ketua?.name || '';
    document.getElementById('wakilNama').value = data.wakil?.name || '';

    _mountPhotoGroup('ketuaImgWrapper', data.ketua || {});
    _mountPhotoGroup('wakilImgWrapper', data.wakil || {});

    const divContainer = document.getElementById('divisiContainer');
    divContainer.innerHTML = '';
    (data.divisi || []).forEach(div => addDivisiUI(div));

    const galContainer = document.getElementById('galeriContainer');
    galContainer.innerHTML = '';
    (data.galeri || []).forEach(gal => addGaleriUI(gal));
}

function _mountPhotoGroup(wrapperId, personData = {}) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    wrapper.innerHTML = '';
    wrapper.appendChild(createPhotoInputGroup(
        personData.img,
        personData.posX ?? 50,
        personData.posY ?? 20,
        personData.scale ?? 1,
        'URL Foto (https://...)'
    ));
}

// ═══════════════════════════════════════════════════════════════
// DIVISI UI
// ═══════════════════════════════════════════════════════════════
function addDivisiUI(divData = { nama: '', kadiv: {}, anggota: [] }) {
    const divEl = document.createElement('div');
    divEl.className = 'divisi-item border border-2 border-primary rounded p-3 mb-4 bg-light position-relative';

    divEl.innerHTML = `
        <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 btn-del-divisi">
            <i class="fas fa-times"></i> Hapus Divisi
        </button>
        <div class="row mb-3">
            <div class="col-md-5">
                <label class="small fw-bold text-primary">Nama Divisi</label>
                <input type="text" class="form-control divisi-nama fw-bold border-primary"
                       value="${escapeHtml(divData.nama || '')}" placeholder="Misal: Humas" maxlength="80">
            </div>
        </div>
        <div class="bg-white p-2 rounded shadow-sm mb-3">
            <h6 class="fw-bold border-bottom pb-1 text-dark mb-3">Kepala Divisi</h6>
            <div class="row g-2">
                <div class="col-md-5">
                    <label class="small text-muted">Nama</label>
                    <input type="text" class="form-control form-control-sm kadiv-nama"
                           value="${escapeHtml(divData.kadiv?.name || '')}" placeholder="Nama Kadiv" maxlength="100">
                </div>
                <div class="col-md-7">
                    <label class="small text-muted">Foto</label>
                    <div class="kadiv-img-wrapper"></div>
                </div>
            </div>
        </div>
        <div class="bg-white p-2 rounded shadow-sm">
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <h6 class="fw-bold mb-0 text-dark">Anggota Divisi</h6>
                <button type="button" class="btn btn-sm btn-outline-primary btn-add-anggota">
                    <i class="fas fa-plus"></i> Tambah Anggota
                </button>
            </div>
            <div class="anggota-container"></div>
        </div>`;

    // Photo group Kadiv
    divEl.querySelector('.kadiv-img-wrapper').appendChild(
        createPhotoInputGroup(
            divData.kadiv?.img,
            divData.kadiv?.posX ?? 50,
            divData.kadiv?.posY ?? 20,
            divData.kadiv?.scale ?? 1,
            'URL Foto Kadiv'
        )
    );

    // Anggota
    const anggotaContainer = divEl.querySelector('.anggota-container');
    (divData.anggota || []).forEach(ang => anggotaContainer.appendChild(_createAnggotaRow(ang)));

    divEl.querySelector('.btn-del-divisi').addEventListener('click', () => {
        if (confirm('Hapus divisi ini secara permanen?')) divEl.remove();
    });
    divEl.querySelector('.btn-add-anggota').addEventListener('click', () => {
        anggotaContainer.appendChild(_createAnggotaRow());
    });

    document.getElementById('divisiContainer').appendChild(divEl);
}

function _createAnggotaRow(ang = {}) {
    const row = document.createElement('div');
    row.className = 'anggota-item border-bottom pb-3 mb-3';
    row.innerHTML = `
        <div class="d-flex align-items-start gap-2">
            <div class="flex-fill">
                <div class="row g-2">
                    <div class="col-md-4">
                        <label class="small text-muted">Nama Anggota</label>
                        <input type="text" class="form-control form-control-sm anggota-nama"
                               value="${escapeHtml(ang.name || '')}" placeholder="Nama Anggota" maxlength="100">
                    </div>
                    <div class="col-md-8">
                        <label class="small text-muted">Foto</label>
                        <div class="anggota-img-wrapper"></div>
                    </div>
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-danger btn-del-anggota mt-4" title="Hapus">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;

    row.querySelector('.anggota-img-wrapper').appendChild(
        createPhotoInputGroup(ang.img, ang.posX ?? 50, ang.posY ?? 20, ang.scale ?? 1, 'URL Foto Anggota')
    );
    row.querySelector('.btn-del-anggota').addEventListener('click', () => row.remove());
    return row;
}

// ═══════════════════════════════════════════════════════════════
// GALERI UI
// ═══════════════════════════════════════════════════════════════
function addGaleriUI(galData = { url: '', caption: '' }) {
    const galEl = document.createElement('div');
    galEl.className = 'col-md-4 col-lg-3 galeri-item';
    const safeUrl = isSafeUrl(galData.url) ? galData.url : '';

    galEl.innerHTML = `
        <div class="card shadow-sm border-0 bg-light p-2 h-100 position-relative">
            <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 btn-del-galeri" style="z-index:5;">
                <i class="fas fa-times"></i>
            </button>
            <img src="${escapeHtml(safeUrl) || 'https://placehold.co/300x200?text=Preview'}"
                 class="card-img-top rounded mb-2 galeri-preview"
                 style="height:120px;object-fit:cover;"
                 onerror="this.onerror=null;this.src='https://placehold.co/300x200?text=Error'">
            <input type="url" class="form-control form-control-sm mb-1 galeri-url"
                   value="${escapeHtml(safeUrl)}" placeholder="URL Foto Valid" maxlength="500">
            <input type="text" class="form-control form-control-sm galeri-caption"
                   value="${escapeHtml(galData.caption || '')}" placeholder="Caption (Opsional)" maxlength="150">
        </div>`;

    galEl.querySelector('.galeri-url').addEventListener('input', function () {
        galEl.querySelector('.galeri-preview').src = isSafeUrl(this.value) ? this.value : 'https://placehold.co/300x200?text=Preview';
    });
    galEl.querySelector('.btn-del-galeri').addEventListener('click', () => galEl.remove());
    document.getElementById('galeriContainer').appendChild(galEl);
}

// ═══════════════════════════════════════════════════════════════
// HELPER BACA PHOTO GROUP
// ═══════════════════════════════════════════════════════════════
function _readPhotoGroup(wrapperEl) {
    const g = wrapperEl?.querySelector('[data-photo-container]');
    return {
        img  : g?.querySelector('.photo-img-input')?.value.trim() || '',
        posX : parseFloat(g?.dataset.posX  ?? 50),
        posY : parseFloat(g?.dataset.posY  ?? 20),
        scale: parseFloat(g?.dataset.scale ?? 1),
    };
}

// ═══════════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════════
async function handleSaveStruktur() {
    const periode = document.getElementById('selectPeriode').value;
    if (!periode) { showNotification('Pilih periode kepengurusan terlebih dahulu!', 'danger'); return; }

    const btn     = document.getElementById('btnSaveStruktur');
    const restore = setButtonLoading(btn, 'Menyimpan...');

    const ketuaPhoto = _readPhotoGroup(document.getElementById('ketuaImgWrapper'));
    const wakilPhoto = _readPhotoGroup(document.getElementById('wakilImgWrapper'));

    const newData = {
        ketua : { name: document.getElementById('ketuaNama').value.trim(), ...ketuaPhoto },
        wakil : { name: document.getElementById('wakilNama').value.trim(), ...wakilPhoto },
        divisi: [],
        galeri: [],
    };

    document.querySelectorAll('.divisi-item').forEach(divEl => {
        const nama       = divEl.querySelector('.divisi-nama').value.trim();
        const kadivName  = divEl.querySelector('.kadiv-nama').value.trim();
        const kadivPhoto = _readPhotoGroup(divEl.querySelector('.kadiv-img-wrapper'));
        const anggota    = [];

        divEl.querySelectorAll('.anggota-item').forEach(angEl => {
            const aName  = angEl.querySelector('.anggota-nama').value.trim();
            const aPhoto = _readPhotoGroup(angEl.querySelector('.anggota-img-wrapper'));
            if (aName || aPhoto.img) anggota.push({ name: aName, ...aPhoto });
        });

        if (nama || kadivName || kadivPhoto.img) {
            newData.divisi.push({ nama, kadiv: { name: kadivName, ...kadivPhoto }, anggota });
        }
    });

    document.querySelectorAll('.galeri-item').forEach(galEl => {
        const url     = galEl.querySelector('.galeri-url').value.trim();
        const caption = galEl.querySelector('.galeri-caption').value.trim();
        if (url && isSafeUrl(url)) newData.galeri.push({ url, caption });
    });

    _allStrukturData[periode] = newData;

    try {
        await updateDoc(_docStrukturRef, _allStrukturData);
        showNotification(`Struktur periode ${periode} berhasil disimpan!`);
    } catch (err) {
        console.error(err);
        showNotification('Gagal menyimpan data struktur!', 'danger');
    } finally {
        restore('<i class="fas fa-save me-2"></i> Simpan Struktur');
    }
}