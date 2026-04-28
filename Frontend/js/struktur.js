/**
 * struktur.js  –  Modul Manajemen Struktur Organisasi (ADMIN)
 *
 * PERUBAHAN:
 *  - Galeri foto sekarang support posisi & zoom (posX, posY, scale)
 *  - Tombol "Atur Posisi & Zoom" di setiap item galeri
 *  - Modal editor galeri pakai _openImgEditor yang sama dengan foto profil
 *  - Data galeri tersimpan: { url, caption, posX, posY, scale }
 *
 * Cara kerja preview galeri:
 *   background-size     = scale * 100%
 *   background-position = posX% posY%
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
// HELPER: background-size & background-position dari nilai
// ═══════════════════════════════════════════════════════════════
function _applyBgToEl(el, url, posX, posY, scale) {
    if (!el) return;
    el.style.backgroundImage    = isSafeUrl(url) ? `url('${url}')` : 'none';
    el.style.backgroundSize     = `${scale * 100}%`;
    el.style.backgroundPosition = `${posX}% ${posY}%`;
    el.style.backgroundRepeat   = 'no-repeat';
}

// ═══════════════════════════════════════════════════════════════
// IMAGE EDITOR MODAL (dipakai untuk foto profil DAN foto galeri)
// ═══════════════════════════════════════════════════════════════
function _initImageEditorModal() {
    if (document.getElementById('imgEditorModal')) return;

    const modal = document.createElement('div');
    modal.id = 'imgEditorModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);justify-content:center;align-items:center;';

    modal.innerHTML = `
        <div style="
            background:#fff; border-radius:16px; width:min(500px,95vw);
            max-height:92vh; display:flex; flex-direction:column;
            box-shadow:0 25px 60px rgba(0,0,0,0.4); overflow:hidden;">

            <!-- ── HEADER (sticky atas) ── -->
            <div style="background:#212529;color:#fff;padding:14px 20px;
                        display:flex;justify-content:space-between;align-items:center;
                        flex-shrink:0;">
                <span style="font-weight:700;font-size:15px;" id="imgEditorTitle">
                    <i class="fas fa-crop-alt me-2"></i>Atur Posisi &amp; Zoom Foto
                </span>
                <button id="imgEditorClose" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>
            </div>

            <!-- ── KONTEN TENGAH (bisa scroll jika layar kecil) ── -->
            <div style="flex:1;overflow-y:auto;overflow-x:hidden;">

                <!-- Preview -->
                <div style="background:#f4f6f9;padding:12px 16px 8px;text-align:center;">
                    <p style="font-size:11px;color:#6c757d;margin-bottom:10px;">
                        <i class="fas fa-info-circle me-1 text-primary"></i>
                        Preview <strong>persis seperti di website</strong>. Drag atau pakai slider.
                    </p>

                    <!-- Bingkai profil (lingkaran) -->
                    <div id="imgEditorFrame" style="
                        width:140px; height:140px; border-radius:50%;
                        border:4px solid #0a192f; margin:0 auto 6px;
                        background-color:#e9ecef; background-repeat:no-repeat;
                        background-size:100%; background-position:50% 20%;
                        cursor:grab; user-select:none;
                        box-shadow:0 4px 20px rgba(0,0,0,0.25);
                        position:relative;">
                        <div id="imgEditorPlaceholder" style="
                            position:absolute;inset:0;display:flex;flex-direction:column;
                            align-items:center;justify-content:center;color:#adb5bd;font-size:12px;">
                            <i class="fas fa-image fa-2x mb-1"></i>
                            <span>Belum ada foto</span>
                        </div>
                    </div>

                    <!-- Bingkai galeri (persegi panjang responsif rasio 4:3) -->
                    <div id="imgEditorFrameRectOuter" style="display:none;width:100%;max-width:400px;margin:0 auto 6px;padding:0 8px;">
                        <div style="position:relative;width:100%;padding-top:75%;border-radius:10px;overflow:hidden;
                                    border:3px solid #0a192f;box-shadow:0 4px 20px rgba(0,0,0,0.25);">
                            <div id="imgEditorFrameRect" style="
                                position:absolute;inset:0;
                                background-color:#e9ecef;background-repeat:no-repeat;
                                background-size:100%;background-position:50% 50%;
                                cursor:grab;user-select:none;">
                                <div id="imgEditorPlaceholderRect" style="
                                    position:absolute;inset:0;display:flex;flex-direction:column;
                                    align-items:center;justify-content:center;color:#adb5bd;font-size:12px;">
                                    <i class="fas fa-image fa-2x mb-1"></i>
                                    <span>Belum ada foto</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p style="font-size:10px;color:#adb5bd;margin-bottom:0;">
                        <i class="fas fa-mouse me-1"></i>Drag untuk geser &nbsp;|&nbsp; Scroll untuk zoom
                    </p>
                </div>

                <!-- Slider kontrol -->
                <div style="padding:14px 20px 16px;">
                    <div class="mb-2">
                        <div class="d-flex justify-content-between mb-1">
                            <label style="font-size:13px;font-weight:700;color:#495057;">
                                <i class="fas fa-search me-1 text-primary"></i>Zoom
                            </label>
                            <span id="lblScale" style="font-size:13px;font-weight:700;color:#0d6efd;">1.0×</span>
                        </div>
                        <input type="range" id="slScale" min="0.5" max="3" step="0.05" value="1" class="form-range">
                        <div class="d-flex justify-content-between" style="font-size:10px;color:#adb5bd;">
                            <span>0.5× (perkecil)</span><span>3.0× (perbesar)</span>
                        </div>
                    </div>
                    <div class="mb-2">
                        <div class="d-flex justify-content-between mb-1">
                            <label style="font-size:13px;font-weight:700;color:#495057;">
                                <i class="fas fa-arrows-alt-h me-1 text-success"></i>Geser Kiri ↔ Kanan
                            </label>
                            <span id="lblPosX" style="font-size:13px;font-weight:700;color:#198754;">50%</span>
                        </div>
                        <input type="range" id="slPosX" min="0" max="100" step="1" value="50" class="form-range">
                        <div class="d-flex justify-content-between" style="font-size:10px;color:#adb5bd;">
                            <span>← Kiri</span><span>Kanan →</span>
                        </div>
                    </div>
                    <div class="mb-2">
                        <div class="d-flex justify-content-between mb-1">
                            <label style="font-size:13px;font-weight:700;color:#495057;">
                                <i class="fas fa-arrows-alt-v me-1 text-warning"></i>Geser Atas ↕ Bawah
                            </label>
                            <span id="lblPosY" style="font-size:13px;font-weight:700;color:#ffc107;">50%</span>
                        </div>
                        <input type="range" id="slPosY" min="0" max="100" step="1" value="50" class="form-range">
                        <div class="d-flex justify-content-between" style="font-size:10px;color:#adb5bd;">
                            <span>↑ Atas</span><span>Bawah ↓</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── TOMBOL (sticky bawah, selalu kelihatan) ── -->
            <div style="padding:12px 20px;border-top:1px solid #dee2e6;display:flex;gap:8px;flex-shrink:0;background:#fff;">
                <button id="imgEditorReset" class="btn btn-outline-secondary btn-sm flex-fill">
                    <i class="fas fa-undo me-1"></i>Reset
                </button>
                <button id="imgEditorApply" class="btn btn-primary btn-sm flex-fill fw-bold">
                    <i class="fas fa-check me-1"></i>Terapkan
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    let _activeContainer = null;
    let _activeMode      = 'circle'; // 'circle' | 'rect'
    let _dragging        = false, _lastX = 0, _lastY = 0;

    // Aktif frame sesuai mode
    const _getFrame = () => _activeMode === 'rect'
        ? document.getElementById('imgEditorFrameRect')
        : document.getElementById('imgEditorFrame');

    function _refresh() {
        const frame = _getFrame();
        const scale = parseFloat(document.getElementById('slScale').value);
        const posX  = parseFloat(document.getElementById('slPosX').value);
        const posY  = parseFloat(document.getElementById('slPosY').value);

        frame.style.backgroundSize     = `${scale * 100}%`;
        frame.style.backgroundPosition = `${posX}% ${posY}%`;

        document.getElementById('lblScale').textContent = `${scale.toFixed(2)}×`;
        document.getElementById('lblPosX').textContent  = `${Math.round(posX)}%`;
        document.getElementById('lblPosY').textContent  = `${Math.round(posY)}%`;
    }

    ['slScale','slPosX','slPosY'].forEach(id =>
        document.getElementById(id).addEventListener('input', _refresh)
    );

    // Drag pada kedua frame
    ['imgEditorFrame','imgEditorFrameRect'].forEach(frameId => {
        const el = document.getElementById(frameId);
        el.addEventListener('mousedown', e => {
            _dragging = true; _lastX = e.clientX; _lastY = e.clientY;
            el.style.cursor = 'grabbing';
        });
    });
    window.addEventListener('mousemove', e => {
        if (!_dragging) return;
        const frame = _getFrame();
        const slX = document.getElementById('slPosX');
        const slY = document.getElementById('slPosY');
        slX.value = Math.min(100, Math.max(0, parseFloat(slX.value) - (e.clientX - _lastX) * 0.4));
        slY.value = Math.min(100, Math.max(0, parseFloat(slY.value) - (e.clientY - _lastY) * 0.4));
        _lastX = e.clientX; _lastY = e.clientY;
        _refresh();
    });
    window.addEventListener('mouseup', () => {
        _dragging = false;
        _getFrame().style.cursor = 'grab';
    });

    // Scroll zoom
    ['imgEditorFrame','imgEditorFrameRect'].forEach(frameId => {
        document.getElementById(frameId).addEventListener('wheel', e => {
            e.preventDefault();
            const sl = document.getElementById('slScale');
            sl.value = Math.min(3, Math.max(0.5, parseFloat(sl.value) + (e.deltaY < 0 ? 0.1 : -0.1)));
            _refresh();
        }, { passive: false });
    });

    // Close
    document.getElementById('imgEditorClose').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    // Reset
    document.getElementById('imgEditorReset').addEventListener('click', () => {
        document.getElementById('slScale').value = 1;
        document.getElementById('slPosX').value  = 50;
        // galeri default center, profil default sedikit ke atas
        document.getElementById('slPosY').value  = _activeMode === 'rect' ? 50 : 20;
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

        if (_activeMode === 'rect') {
            // Update preview galeri
            const prevEl = _activeContainer.querySelector('.galeri-bg-preview');
            const url    = _activeContainer.querySelector('.galeri-url')?.value.trim() || '';
            if (prevEl) _applyBgToEl(prevEl, url, posX, posY, scale);

            // Update badge
            const badge = _activeContainer.querySelector('.galeri-pos-badge');
            if (badge) {
                badge.textContent = `zoom:${scale.toFixed(1)}× pos:${Math.round(posX)}/${Math.round(posY)}`;
                badge.style.color = '#198754';
            }
        } else {
            // Update mini preview profil
            const badge      = _activeContainer.querySelector('.img-pos-badge');
            const miniCircle = _activeContainer.querySelector('.photo-mini-circle');
            const url        = _activeContainer.querySelector('.photo-img-input')?.value.trim() || '';
            if (badge) {
                badge.textContent = `zoom:${scale.toFixed(1)}× pos:${Math.round(posX)}/${Math.round(posY)}`;
                badge.style.color = '#198754';
            }
            if (miniCircle) _applyBgToEl(miniCircle, url, posX, posY, scale);
        }

        modal.style.display = 'none';
        showNotification('Posisi foto diatur. Jangan lupa klik Simpan Struktur!', 'info');
    });

    // ── Buka editor PROFIL (lingkaran)
    window._openImgEditor = function(container) {
        _activeContainer = container;
        _activeMode      = 'circle';

        const url   = container.querySelector('.photo-img-input')?.value.trim() || '';
        const posX  = parseFloat(container.dataset.posX  ?? 50);
        const posY  = parseFloat(container.dataset.posY  ?? 20);
        const scale = parseFloat(container.dataset.scale ?? 1);

        const frame          = document.getElementById('imgEditorFrame');
        const frameRectOuter = document.getElementById('imgEditorFrameRectOuter');
        const ph             = document.getElementById('imgEditorPlaceholder');
        const phRect         = document.getElementById('imgEditorPlaceholderRect');

        frame.style.display          = 'block';
        frameRectOuter.style.display = 'none';

        document.getElementById('imgEditorTitle').innerHTML =
            '<i class="fas fa-crop-alt me-2"></i>Atur Posisi &amp; Zoom Foto Profil';

        if (isSafeUrl(url)) {
            frame.style.backgroundImage = `url('${url}')`;
            if (ph) ph.style.display = 'none';
        } else {
            frame.style.backgroundImage = 'none';
            if (ph) ph.style.display = 'flex';
        }
        if (phRect) phRect.style.display = 'none';

        document.getElementById('slScale').value = scale;
        document.getElementById('slPosX').value  = posX;
        document.getElementById('slPosY').value  = posY;
        _refresh();
        modal.style.display = 'flex';
    };

    // ── Buka editor GALERI (persegi panjang)
    window._openGaleriEditor = function(container) {
        _activeContainer = container;
        _activeMode      = 'rect';

        const url   = container.querySelector('.galeri-url')?.value.trim() || '';
        const posX  = parseFloat(container.dataset.posX  ?? 50);
        const posY  = parseFloat(container.dataset.posY  ?? 50);
        const scale = parseFloat(container.dataset.scale ?? 1);

        const frame          = document.getElementById('imgEditorFrame');
        const frameRectOuter = document.getElementById('imgEditorFrameRectOuter');
        const ph             = document.getElementById('imgEditorPlaceholder');
        const phRect         = document.getElementById('imgEditorPlaceholderRect');

        frame.style.display          = 'none';
        frameRectOuter.style.display = 'block';

        document.getElementById('imgEditorTitle').innerHTML =
            '<i class="fas fa-crop-alt me-2"></i>Atur Posisi &amp; Zoom Foto Galeri';

        if (isSafeUrl(url)) {
            frameRect.style.backgroundImage = `url('${url}')`;
            if (phRect) phRect.style.display = 'none';
        } else {
            frameRect.style.backgroundImage = 'none';
            if (phRect) phRect.style.display = 'flex';
        }
        if (ph) ph.style.display = 'none';

        document.getElementById('slScale').value = scale;
        document.getElementById('slPosX').value  = posX;
        document.getElementById('slPosY').value  = posY;
        _refresh();
        modal.style.display = 'flex';
    };
}

// ═══════════════════════════════════════════════════════════════
// PHOTO INPUT GROUP (foto profil — lingkaran)
// ═══════════════════════════════════════════════════════════════
function createPhotoInputGroup(imgUrl = '', posX = 50, posY = 20, scale = 1, placeholder = 'URL Foto') {
    const safeUrl = isSafeUrl(imgUrl) ? imgUrl : '';
    const wrapper = document.createElement('div');
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
            <div class="photo-mini-circle" style="
                width:52px; height:52px; border-radius:50%; flex-shrink:0;
                border:2px solid #dee2e6; background-color:#e9ecef;
                background-image:${safeUrl ? `url('${safeUrl}')` : 'none'};
                background-size:${scale * 100}%;
                background-position:${posX}% ${posY}%;
                background-repeat:no-repeat;
            "></div>
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

    const input      = wrapper.querySelector('.photo-img-input');
    const miniCircle = wrapper.querySelector('.photo-mini-circle');
    input.addEventListener('input', function () {
        const url = this.value.trim();
        miniCircle.style.backgroundImage = isSafeUrl(url) ? `url('${url}')` : 'none';
        const editorModal = document.getElementById('imgEditorModal');
        if (editorModal?.style.display === 'flex') {
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

    divEl.querySelector('.kadiv-img-wrapper').appendChild(
        createPhotoInputGroup(
            divData.kadiv?.img,
            divData.kadiv?.posX ?? 50,
            divData.kadiv?.posY ?? 20,
            divData.kadiv?.scale ?? 1,
            'URL Foto Kadiv'
        )
    );

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
// GALERI UI — DENGAN KONTROL POSISI FOTO
// ═══════════════════════════════════════════════════════════════
function addGaleriUI(galData = { url: '', caption: '', posX: 50, posY: 50, scale: 1 }) {
    const galEl   = document.createElement('div');
    galEl.className = 'col-md-4 col-lg-3 galeri-item';

    const safeUrl = isSafeUrl(galData.url) ? galData.url : '';
    const posX    = galData.posX  ?? 50;
    const posY    = galData.posY  ?? 50;
    const scale   = galData.scale ?? 1;
    const isDefault = (scale === 1 && posX === 50 && posY === 50);

    // Simpan posisi di dataset container
    galEl.dataset.posX  = posX;
    galEl.dataset.posY  = posY;
    galEl.dataset.scale = scale;

    galEl.innerHTML = `
        <div class="card shadow-sm border-0 bg-light p-2 h-100 position-relative">
            <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 btn-del-galeri" style="z-index:5;">
                <i class="fas fa-times"></i>
            </button>

            <!-- Preview foto galeri pakai background-image agar posisi berlaku -->
            <div class="galeri-bg-preview rounded mb-2" style="
                height:120px;
                background-color:#e9ecef;
                background-image:${safeUrl ? `url('${safeUrl}')` : 'none'};
                background-size:${scale * 100}%;
                background-position:${posX}% ${posY}%;
                background-repeat:no-repeat;
            "></div>

            <input type="url" class="form-control form-control-sm mb-1 galeri-url"
                   value="${escapeHtml(safeUrl)}" placeholder="URL Foto Valid" maxlength="500">
            <input type="text" class="form-control form-control-sm mb-2 galeri-caption"
                   value="${escapeHtml(galData.caption || '')}" placeholder="Caption (Opsional)" maxlength="150">

            <!-- Badge posisi & tombol atur -->
            <div class="d-flex align-items-center justify-content-between">
                <span class="galeri-pos-badge" style="font-size:10px;color:${isDefault ? '#adb5bd' : '#198754'};">
                    zoom:${parseFloat(scale).toFixed(1)}× pos:${Math.round(posX)}/${Math.round(posY)}
                </span>
                <button type="button" class="btn btn-outline-primary btn-sm btn-atur-galeri py-0 px-2" style="font-size:11px;">
                    <i class="fas fa-crop-alt me-1"></i>Atur Posisi
                </button>
            </div>
        </div>`;

    // Live preview saat URL diubah
    const urlInput  = galEl.querySelector('.galeri-url');
    const bgPreview = galEl.querySelector('.galeri-bg-preview');
    urlInput.addEventListener('input', function () {
        const url = this.value.trim();
        bgPreview.style.backgroundImage = isSafeUrl(url) ? `url('${url}')` : 'none';
        // Sync ke frame rect di modal jika sedang terbuka
        const editorModal = document.getElementById('imgEditorModal');
        if (editorModal?.style.display === 'flex') {
            const frameRect = document.getElementById('imgEditorFrameRect');
            const phRect    = document.getElementById('imgEditorPlaceholderRect');
            if (isSafeUrl(url)) {
                frameRect.style.backgroundImage = `url('${url}')`;
                if (phRect) phRect.style.display = 'none';
            } else {
                frameRect.style.backgroundImage = 'none';
                if (phRect) phRect.style.display = 'flex';
            }
        }
    });

    // Tombol atur posisi galeri
    galEl.querySelector('.btn-atur-galeri').addEventListener('click', () => {
        window._openGaleriEditor(galEl);
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

    // Galeri — sekarang simpan posX, posY, scale juga
    document.querySelectorAll('.galeri-item').forEach(galEl => {
        const url     = galEl.querySelector('.galeri-url').value.trim();
        const caption = galEl.querySelector('.galeri-caption').value.trim();
        const posX    = parseFloat(galEl.dataset.posX  ?? 50);
        const posY    = parseFloat(galEl.dataset.posY  ?? 50);
        const scale   = parseFloat(galEl.dataset.scale ?? 1);
        if (url && isSafeUrl(url)) newData.galeri.push({ url, caption, posX, posY, scale });
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
