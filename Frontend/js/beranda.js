/**
 * beranda.js  –  Modul Manajemen Beranda (Slider + About + Visi Misi)
 */

import { getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showNotification, setButtonLoading } from "./ui.js";
import { escapeHtml, isSafeUrl }              from "./security.js";

let _homeDataRef = null;

export function initBeranda(refs) {
    _homeDataRef = refs.homeData;

    document.getElementById('btnAddSlide').addEventListener('click', () => tambahSlideKeLayar());
    document.getElementById('btnAddMisi').addEventListener('click',  () => tambahInputMisiKeLayar());
    document.getElementById('btnSaveBeranda').addEventListener('click', handleSaveBeranda);

    _initSlideImgEditorModal();
    loadBerandaData();
}

// -------------------------------------------------------

// ═══════════════════════════════════════════════════════════════
// IMAGE EDITOR MODAL KHUSUS HERO SLIDE (rasio 16:9 / h-[500px])
// ═══════════════════════════════════════════════════════════════
let _activeSlideContainer = null;

function _initSlideImgEditorModal() {
    if (document.getElementById('slideImgEditorModal')) return;

    const modal = document.createElement('div');
    modal.id = 'slideImgEditorModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.75);justify-content:center;align-items:center;';

    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;width:min(580px,95vw);overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.4);">
            <div style="background:#0a192f;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:700;font-size:15px;">
                    <i class="fas fa-image me-2"></i>Atur Posisi &amp; Zoom Foto Hero/Slider
                </span>
                <button id="slideImgEditorClose" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <div style="background:#f4f6f9;padding:18px;text-align:center;">
                <p style="font-size:12px;color:#6c757d;margin-bottom:10px;">
                    <i class="fas fa-info-circle me-1 text-primary"></i>
                    Preview <strong>persis seperti hero slider</strong> di website (16:9). Drag atau pakai slider.
                </p>
                <div id="slideImgEditorFrame" style="
                    width:100%;max-width:480px;height:180px;border-radius:10px;
                    border:3px solid #0a192f;margin:0 auto 8px;
                    background-color:#1a2a4a;background-repeat:no-repeat;
                    background-size:100%;background-position:50% 50%;
                    cursor:grab;user-select:none;
                    box-shadow:0 4px 20px rgba(0,0,0,0.3);
                    position:relative;overflow:hidden;
                ">
                    <!-- Overlay gelap seperti di website (opacity-40) -->
                    <div style="position:absolute;inset:0;background:rgba(0,0,0,0.4);pointer-events:none;z-index:1;"></div>
                    <!-- Teks preview -->
                    <div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
                        <span id="slidePreviewTitle" style="color:#fff;font-weight:700;font-size:16px;text-shadow:0 2px 4px rgba(0,0,0,0.5);"></span>
                        <span id="slidePreviewSub" style="color:#F59E0B;font-size:11px;margin-top:4px;"></span>
                    </div>
                    <div id="slideImgEditorPH" style="position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#adb5bd;font-size:13px;">
                        <i class="fas fa-image fa-2x mb-2"></i><span>Masukkan URL foto dulu</span>
                    </div>
                </div>
                <p style="font-size:11px;color:#adb5bd;"><i class="fas fa-mouse me-1"></i>Drag untuk geser &nbsp;|&nbsp; Scroll untuk zoom</p>
            </div>
            <div style="padding:16px 20px 20px;">
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;"><i class="fas fa-search me-1 text-primary"></i>Zoom</label>
                        <span id="slideLblScale" style="font-size:13px;font-weight:700;color:#0d6efd;">1.0×</span>
                    </div>
                    <input type="range" id="slideSlScale" min="0.5" max="3" step="0.05" value="1" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;"><span>0.5×</span><span>3.0×</span></div>
                </div>
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;"><i class="fas fa-arrows-alt-h me-1 text-success"></i>Geser Kiri ↔ Kanan</label>
                        <span id="slideLblPosX" style="font-size:13px;font-weight:700;color:#198754;">50%</span>
                    </div>
                    <input type="range" id="slideSlPosX" min="0" max="100" step="1" value="50" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;"><span>← Kiri</span><span>Kanan →</span></div>
                </div>
                <div class="mb-4">
                    <div class="d-flex justify-content-between mb-1">
                        <label style="font-size:13px;font-weight:700;color:#495057;"><i class="fas fa-arrows-alt-v me-1 text-warning"></i>Geser Atas ↕ Bawah</label>
                        <span id="slideLblPosY" style="font-size:13px;font-weight:700;color:#ffc107;">50%</span>
                    </div>
                    <input type="range" id="slideSlPosY" min="0" max="100" step="1" value="50" class="form-range">
                    <div class="d-flex justify-content-between" style="font-size:11px;color:#adb5bd;"><span>↑ Atas</span><span>Bawah ↓</span></div>
                </div>
                <div class="d-flex gap-2">
                    <button id="slideImgEditorReset" class="btn btn-outline-secondary btn-sm flex-fill"><i class="fas fa-undo me-1"></i>Reset</button>
                    <button id="slideImgEditorApply" class="btn btn-dark btn-sm flex-fill fw-bold"><i class="fas fa-check me-1"></i>Terapkan</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    let _drag = false, _lx = 0, _ly = 0;

    function _refresh() {
        const frame = document.getElementById('slideImgEditorFrame');
        const scale = parseFloat(document.getElementById('slideSlScale').value);
        const posX  = parseFloat(document.getElementById('slideSlPosX').value);
        const posY  = parseFloat(document.getElementById('slideSlPosY').value);
        frame.style.backgroundSize     = `${scale * 100}%`;
        frame.style.backgroundPosition = `${posX}% ${posY}%`;
        document.getElementById('slideLblScale').textContent = `${scale.toFixed(2)}×`;
        document.getElementById('slideLblPosX').textContent  = `${Math.round(posX)}%`;
        document.getElementById('slideLblPosY').textContent  = `${Math.round(posY)}%`;
    }

    ['slideSlScale','slideSlPosX','slideSlPosY'].forEach(id =>
        document.getElementById(id).addEventListener('input', _refresh)
    );

    const frame = document.getElementById('slideImgEditorFrame');
    frame.addEventListener('mousedown', e => { _drag=true; _lx=e.clientX; _ly=e.clientY; frame.style.cursor='grabbing'; });
    window.addEventListener('mousemove', e => {
        if (!_drag) return;
        const sx = document.getElementById('slideSlPosX');
        const sy = document.getElementById('slideSlPosY');
        sx.value = Math.min(100,Math.max(0,parseFloat(sx.value)-(e.clientX-_lx)*0.2));
        sy.value = Math.min(100,Math.max(0,parseFloat(sy.value)-(e.clientY-_ly)*0.2));
        _lx=e.clientX; _ly=e.clientY; _refresh();
    });
    window.addEventListener('mouseup', () => { _drag=false; frame.style.cursor='grab'; });
    frame.addEventListener('wheel', e => {
        e.preventDefault();
        const sl = document.getElementById('slideSlScale');
        sl.value = Math.min(3,Math.max(0.5,parseFloat(sl.value)+(e.deltaY<0?0.1:-0.1)));
        _refresh();
    }, { passive: false });

    document.getElementById('slideImgEditorClose').addEventListener('click', () => { modal.style.display='none'; });
    modal.addEventListener('click', e => { if(e.target===modal) modal.style.display='none'; });

    document.getElementById('slideImgEditorReset').addEventListener('click', () => {
        document.getElementById('slideSlScale').value=1;
        document.getElementById('slideSlPosX').value=50;
        document.getElementById('slideSlPosY').value=50;
        _refresh();
    });

    document.getElementById('slideImgEditorApply').addEventListener('click', () => {
        if (!_activeSlideContainer) return;
        const scale = parseFloat(document.getElementById('slideSlScale').value);
        const posX  = parseFloat(document.getElementById('slideSlPosX').value);
        const posY  = parseFloat(document.getElementById('slideSlPosY').value);

        _activeSlideContainer.dataset.posX  = posX;
        _activeSlideContainer.dataset.posY  = posY;
        _activeSlideContainer.dataset.scale = scale;

        // Update mini preview & badge di slide card
        const mini  = _activeSlideContainer.querySelector('.slide-mini-preview');
        const badge = _activeSlideContainer.querySelector('.slide-pos-badge');
        if (mini) {
            mini.style.backgroundSize     = `${scale * 100}%`;
            mini.style.backgroundPosition = `${posX}% ${posY}%`;
        }
        if (badge) {
            badge.textContent = `zoom:${scale.toFixed(1)}x pos:${Math.round(posX)}/${Math.round(posY)}`;
            badge.style.color = '#198754';
        }

        modal.style.display = 'none';
        showNotification('Posisi foto slide diatur! Jangan lupa Simpan Beranda.', 'info');
    });
}

function _openSlideImgEditor(slideDiv, url) {
    _activeSlideContainer = slideDiv;
    const frame = document.getElementById('slideImgEditorFrame');
    const ph    = document.getElementById('slideImgEditorPH');
    const titleEl = document.getElementById('slidePreviewTitle');
    const subEl   = document.getElementById('slidePreviewSub');

    if (isSafeUrl(url)) {
        frame.style.backgroundImage = `url('${url}')`;
        if (ph) ph.style.display = 'none';
    } else {
        frame.style.backgroundImage = 'none';
        if (ph) ph.style.display = 'flex';
    }

    // Tampilkan judul/subjudul di preview
    if (titleEl) titleEl.textContent = slideDiv.querySelector('.slide-title-input')?.value || '';
    if (subEl)   subEl.textContent   = slideDiv.querySelector('.slide-subtitle-input')?.value || '';

    document.getElementById('slideSlScale').value = parseFloat(slideDiv.dataset.scale ?? 1);
    document.getElementById('slideSlPosX').value  = parseFloat(slideDiv.dataset.posX  ?? 50);
    document.getElementById('slideSlPosY').value  = parseFloat(slideDiv.dataset.posY  ?? 50);
    document.getElementById('slideSlScale').dispatchEvent(new Event('input'));

    const modal = document.getElementById('slideImgEditorModal');
    modal._activeContainer = slideDiv;
    modal.style.display = 'flex';
}

async function loadBerandaData() {
    try {
        const docSnap = await getDoc(_homeDataRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (data.about) {
            document.getElementById('aboutDesc').value = data.about.description || '';
        }

        const heroContainer = document.getElementById('heroContainer');
        heroContainer.innerHTML = '';
        if (data.hero?.slides?.length > 0) {
            data.hero.slides.forEach(s => tambahSlideKeLayar(s.image, s.title, s.subtitle, s.posX, s.posY, s.scale));
        } else {
            heroContainer.innerHTML = '<p class="text-muted small">Belum ada slide. Klik "Tambah Foto" untuk menambahkan.</p>';
        }

        const misiContainer = document.getElementById('misiContainer');
        misiContainer.innerHTML = '';
        if (data.visiMisi?.misi?.items?.length > 0) {
            data.visiMisi.misi.items.forEach(m => tambahInputMisiKeLayar(m));
        } else {
            misiContainer.innerHTML = '<p class="text-muted small">Belum ada misi.</p>';
        }
    } catch (err) {
        console.error('Gagal load beranda:', err);
    }
}

// -------------------------------------------------------
function tambahSlideKeLayar(imgUrl = '', judul = '', subjudul = '', posX = 50, posY = 50, scale = 1) {
    const safeUrl   = isSafeUrl(imgUrl) ? imgUrl : '';
    const isDefault = (scale === 1 && posX === 50 && posY === 50);

    const div     = document.createElement('div');
    div.className = 'slide-item-card hero-slide-item';
    div.setAttribute('data-slide-container', '');
    div.dataset.posX  = posX;
    div.dataset.posY  = posY;
    div.dataset.scale = scale;

    div.innerHTML = `
        <button type="button" class="btn btn-sm btn-danger btn-remove-slide position-absolute top-0 end-0 m-2">
            <i class="fas fa-times"></i> Hapus
        </button>
        <div class="row align-items-end g-2">
            <div class="col-md-4">
                <label class="small text-muted fw-bold">URL Gambar</label>
                <input type="url" class="form-control form-control-sm slide-img-input mb-2"
                       value="${escapeHtml(safeUrl)}" maxlength="500" placeholder="https://...">
                <!-- Mini preview slide (landscape) + tombol atur -->
                <div style="
                    height:60px; border-radius:6px; margin-bottom:6px;
                    background-color:#e9ecef; background-repeat:no-repeat;
                    background-image:${safeUrl ? `url('${safeUrl}')` : 'none'};
                    background-size:${scale * 100}%;
                    background-position:${posX}% ${posY}%;
                " class="slide-mini-preview"></div>
                <div class="d-flex align-items-center gap-1">
                    <span class="slide-pos-badge flex-fill" style="font-size:10px;color:${isDefault ? '#adb5bd' : '#198754'};">
                        zoom:${parseFloat(scale).toFixed(1)}x pos:${Math.round(posX)}/${Math.round(posY)}
                    </span>
                    <button type="button" class="btn btn-outline-primary btn-sm btn-atur-slide py-0" style="font-size:11px;white-space:nowrap;">
                        <i class="fas fa-crop-alt me-1"></i>Atur
                    </button>
                </div>
            </div>
            <div class="col-md-4">
                <label class="small text-muted fw-bold">Judul Utama</label>
                <input type="text" class="form-control form-control-sm slide-title-input"
                       value="${escapeHtml(judul)}" maxlength="100" placeholder="Judul slide...">
            </div>
            <div class="col-md-4">
                <label class="small text-muted fw-bold">Subjudul</label>
                <input type="text" class="form-control form-control-sm slide-subtitle-input"
                       value="${escapeHtml(subjudul)}" maxlength="150" placeholder="Kalimat pendek...">
            </div>
        </div>`;

    // Update mini preview saat URL berubah
    const imgInput  = div.querySelector('.slide-img-input');
    const miniPrev  = div.querySelector('.slide-mini-preview');
    imgInput.addEventListener('input', function () {
        miniPrev.style.backgroundImage = isSafeUrl(this.value) ? `url('${this.value}')` : 'none';
        // Update frame editor jika sedang terbuka untuk slide ini
        const modal = document.getElementById('slideImgEditorModal');
        if (modal?.style.display === 'flex' && modal._activeContainer === div) {
            document.getElementById('slideImgEditorFrame').style.backgroundImage =
                isSafeUrl(this.value) ? `url('${this.value}')` : 'none';
        }
    });

    // Tombol Atur Posisi slide
    div.querySelector('.btn-atur-slide').addEventListener('click', () => {
        _openSlideImgEditor(div, imgInput.value.trim());
    });

    div.querySelector('.btn-remove-slide').addEventListener('click', () => div.remove());
    document.getElementById('heroContainer').appendChild(div);
}

// -------------------------------------------------------
function tambahInputMisiKeLayar(val = '') {
    const div       = document.createElement('div');
    div.className   = 'input-group mb-2 misi-row';
    div.innerHTML   = `
        <span class="input-group-text"><i class="fas fa-check text-success"></i></span>
        <input type="text" class="form-control input-misi" value="${escapeHtml(val)}" maxlength="200" placeholder="Tulis misi...">
        <button class="btn btn-danger btn-delete-misi" type="button" title="Hapus misi ini">
            <i class="fas fa-trash"></i>
        </button>`;
    div.querySelector('.btn-delete-misi').addEventListener('click', () => div.remove());
    document.getElementById('misiContainer').appendChild(div);
}

// -------------------------------------------------------
async function handleSaveBeranda() {
    const btn     = document.getElementById('btnSaveBeranda');
    const restore = setButtonLoading(btn, 'Menyimpan...');

    const slides = Array.from(document.querySelectorAll('.hero-slide-item'))
        .map(el => ({
            image   : el.querySelector('.slide-img-input').value.trim(),
            title   : el.querySelector('.slide-title-input').value.trim(),
            subtitle: el.querySelector('.slide-subtitle-input').value.trim(),
            alt     : el.querySelector('.slide-title-input').value.trim(),
            posX    : parseFloat(el.dataset.posX  ?? 50),
            posY    : parseFloat(el.dataset.posY  ?? 50),
            scale   : parseFloat(el.dataset.scale ?? 1),
        }))
        .filter(s => s.image || s.title);

    // Validasi URL slide
    for (const s of slides) {
        if (s.image && !isSafeUrl(s.image)) {
            showNotification('URL gambar slide tidak valid: ' + s.image, 'warning');
            restore('<i class="fas fa-save me-2"></i> Simpan Beranda');
            return;
        }
    }

    const misis = Array.from(document.querySelectorAll('.input-misi'))
        .map(el => el.value.trim())
        .filter(v => v !== '');

    try {
        await updateDoc(_homeDataRef, {
            'hero.slides'         : slides,
            'about.description'   : document.getElementById('aboutDesc').value.trim(),
            'visiMisi.misi.items' : misis,
        });
        showNotification('Beranda berhasil disimpan!');
    } catch (err) {
        console.error(err);
        showNotification('Gagal menyimpan beranda. Coba lagi.', 'danger');
    } finally {
        restore('<i class="fas fa-save me-2"></i> Simpan Beranda');
    }
}
