/**
 * beranda.js  –  Modul Manajemen Beranda (Slider + About + Visi Misi)
 *
 * PERUBAHAN:
 *  - Slide bisa berupa FOTO (type: 'image') atau VIDEO (type: 'video')
 *  - Toggle tipe: Foto / Video di setiap card slide
 *  - Video support: MP4 (link langsung) atau YouTube Embed
 *  - Preview thumbnail gambar langsung di card
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

    loadBerandaData();
}

// -------------------------------------------------------
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
            data.hero.slides.forEach(s => tambahSlideKeLayar(s));
        } else {
            heroContainer.innerHTML = '<p class="text-muted small">Belum ada slide. Klik "Tambah Slide" untuk menambahkan.</p>';
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
/**
 * Tambah satu card slide ke layar.
 * @param {Object} slide - { type, image, videoUrl, videoType, title, subtitle }
 *   type      : 'image' | 'video'   (default: 'image')
 *   videoType : 'mp4' | 'youtube'   (default: 'mp4')
 */
function tambahSlideKeLayar(slide = {}) {
    const type      = slide.type      || 'image';
    const imgUrl    = slide.image     || '';
    const videoUrl  = slide.videoUrl  || '';
    const videoType = slide.videoType || 'mp4';
    const judul     = slide.title     || '';
    const subjudul  = slide.subtitle  || '';

    const div     = document.createElement('div');
    div.className = 'slide-item-card hero-slide-item card mb-3 shadow-sm';

    div.innerHTML = `
        <div class="card-header d-flex align-items-center justify-content-between py-2 px-3 bg-light">
            <!-- Toggle Tipe Foto / Video -->
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-type-toggle btn-type-image ${type === 'image' ? 'btn-primary' : 'btn-outline-primary'}">
                    <i class="fas fa-image me-1"></i>Foto
                </button>
                <button type="button" class="btn btn-type-toggle btn-type-video ${type === 'video' ? 'btn-danger' : 'btn-outline-danger'}">
                    <i class="fas fa-video me-1"></i>Video
                </button>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger btn-remove-slide">
                <i class="fas fa-times"></i> Hapus Slide
            </button>
        </div>

        <div class="card-body p-3">

            <!-- ─── PANEL FOTO ─── -->
            <div class="slide-panel-image ${type !== 'image' ? 'd-none' : ''}">
                <div class="row g-2">
                    <div class="col-md-5">
                        <label class="small fw-semibold text-muted">URL Gambar</label>
                        <input type="url" class="form-control form-control-sm slide-img-input"
                               value="${escapeHtml(imgUrl)}" maxlength="500" placeholder="https://...">
                        <!-- Thumbnail preview -->
                        <div class="slide-img-preview mt-2 rounded overflow-hidden ${imgUrl ? '' : 'd-none'}"
                             style="height:70px;background:#f0f0f0;">
                            <img src="${escapeHtml(imgUrl)}" alt="preview"
                                 style="width:100%;height:100%;object-fit:cover;"
                                 onerror="this.parentElement.classList.add('d-none')">
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label class="small fw-semibold text-muted">Judul Utama</label>
                        <input type="text" class="form-control form-control-sm slide-title-input"
                               value="${escapeHtml(judul)}" maxlength="100" placeholder="Judul hero...">
                    </div>
                    <div class="col-md-3">
                        <label class="small fw-semibold text-muted">Subjudul</label>
                        <input type="text" class="form-control form-control-sm slide-subtitle-input"
                               value="${escapeHtml(subjudul)}" maxlength="150" placeholder="Subjudul...">
                    </div>
                </div>
            </div>

            <!-- ─── PANEL VIDEO ─── -->
            <div class="slide-panel-video ${type !== 'video' ? 'd-none' : ''}">
                <div class="row g-2">
                    <div class="col-md-3">
                        <label class="small fw-semibold text-muted">Tipe Video</label>
                        <select class="form-select form-select-sm slide-video-type-input">
                            <option value="mp4"     ${videoType === 'mp4'     ? 'selected' : ''}>MP4 (link langsung)</option>
                            <option value="youtube" ${videoType === 'youtube' ? 'selected' : ''}>YouTube Embed</option>
                        </select>
                    </div>
                    <div class="col-md-5">
                        <label class="small fw-semibold text-muted">URL Video</label>
                        <input type="url" class="form-control form-control-sm slide-video-url-input"
                               value="${escapeHtml(videoUrl)}" maxlength="500"
                               placeholder="https://...">
                        <div class="slide-video-hint mt-1 text-muted" style="font-size:11px;">
                            ${_getVideoHint(videoType)}
                        </div>
                    </div>
                    <div class="col-md-2">
                        <label class="small fw-semibold text-muted">Judul</label>
                        <input type="text" class="form-control form-control-sm slide-title-input"
                               value="${escapeHtml(judul)}" maxlength="100" placeholder="Judul...">
                    </div>
                    <div class="col-md-2">
                        <label class="small fw-semibold text-muted">Subjudul</label>
                        <input type="text" class="form-control form-control-sm slide-subtitle-input"
                               value="${escapeHtml(subjudul)}" maxlength="150" placeholder="Subjudul...">
                    </div>
                </div>
                <!-- Badge info YouTube -->
                <div class="alert alert-warning py-1 px-2 mt-2 mb-0 slide-yt-alert ${videoType === 'youtube' ? '' : 'd-none'}" style="font-size:12px;">
                    <i class="fas fa-info-circle me-1"></i>
                    Format YouTube Embed: <code>https://www.youtube.com/embed/VIDEO_ID</code>
                    — bukan link biasa youtube.com/watch?v=...
                </div>
            </div>

        </div>`;

    // ── EVENT: hapus slide
    div.querySelector('.btn-remove-slide').addEventListener('click', () => div.remove());

    // ── EVENT: toggle Foto / Video
    div.querySelector('.btn-type-image').addEventListener('click', () => _setSlideType(div, 'image'));
    div.querySelector('.btn-type-video').addEventListener('click', () => _setSlideType(div, 'video'));

    // ── EVENT: update hint & alert saat ganti tipe video
    div.querySelector('.slide-video-type-input').addEventListener('change', function () {
        div.querySelector('.slide-video-hint').innerHTML = _getVideoHint(this.value);
        div.querySelector('.slide-yt-alert').classList.toggle('d-none', this.value !== 'youtube');
    });

    // ── EVENT: live preview thumbnail gambar
    div.querySelector('.slide-img-input').addEventListener('input', function () {
        const prev = div.querySelector('.slide-img-preview');
        const img  = prev.querySelector('img');
        if (isSafeUrl(this.value)) {
            img.src = this.value;
            img.onload = () => prev.classList.remove('d-none');
            img.onerror = () => prev.classList.add('d-none');
        } else {
            prev.classList.add('d-none');
        }
    });

    document.getElementById('heroContainer').appendChild(div);
}

// ── Set aktif tipe slide (image / video)
function _setSlideType(div, type) {
    div.querySelector('.slide-panel-image').classList.toggle('d-none', type !== 'image');
    div.querySelector('.slide-panel-video').classList.toggle('d-none', type !== 'video');

    const btnImg = div.querySelector('.btn-type-image');
    const btnVid = div.querySelector('.btn-type-video');
    btnImg.className = `btn btn-type-toggle btn-type-image ${type === 'image' ? 'btn-primary' : 'btn-outline-primary'}`;
    btnVid.className = `btn btn-type-toggle btn-type-video ${type === 'video' ? 'btn-danger' : 'btn-outline-danger'}`;
}

// ── Hint teks sesuai tipe video
function _getVideoHint(videoType) {
    return videoType === 'youtube'
        ? '<i class="fas fa-youtube text-danger me-1"></i>Pakai URL embed YouTube'
        : '<i class="fas fa-film me-1"></i>Link file .mp4 langsung';
}

// -------------------------------------------------------
function tambahInputMisiKeLayar(val = '') {
    const div     = document.createElement('div');
    div.className = 'input-group mb-2 misi-row';
    div.innerHTML = `
        <span class="input-group-text"><i class="fas fa-check text-success"></i></span>
        <input type="text" class="form-control input-misi" value="${escapeHtml(val)}"
               maxlength="200" placeholder="Tulis misi...">
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

    const slides = [];

    for (const el of document.querySelectorAll('.hero-slide-item')) {
        const isVideo = !el.querySelector('.slide-panel-video').classList.contains('d-none');

        if (isVideo) {
            const videoUrl  = el.querySelector('.slide-video-url-input').value.trim();
            const videoType = el.querySelector('.slide-video-type-input').value;
            const title     = el.querySelector('.slide-panel-video .slide-title-input').value.trim();
            const subtitle  = el.querySelector('.slide-panel-video .slide-subtitle-input').value.trim();

            if (!videoUrl) continue; // skip slide video kosong

            if (!isSafeUrl(videoUrl)) {
                showNotification('URL video tidak valid: ' + videoUrl, 'warning');
                restore('<i class="fas fa-save me-2"></i> Simpan Beranda');
                return;
            }
            slides.push({ type: 'video', videoUrl, videoType, title, subtitle });
        } else {
            const image    = el.querySelector('.slide-img-input').value.trim();
            const title    = el.querySelector('.slide-panel-image .slide-title-input').value.trim();
            const subtitle = el.querySelector('.slide-panel-image .slide-subtitle-input').value.trim();

            if (!image && !title) continue; // skip slide foto kosong

            if (image && !isSafeUrl(image)) {
                showNotification('URL gambar slide tidak valid: ' + image, 'warning');
                restore('<i class="fas fa-save me-2"></i> Simpan Beranda');
                return;
            }
            slides.push({ type: 'image', image, title, subtitle, alt: title });
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
