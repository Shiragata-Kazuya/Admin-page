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
            data.hero.slides.forEach(s => tambahSlideKeLayar(s.image, s.title, s.subtitle));
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
function tambahSlideKeLayar(imgUrl = '', judul = '', subjudul = '') {
    const div       = document.createElement('div');
    div.className   = 'slide-item-card hero-slide-item';
    div.innerHTML   = `
        <button type="button" class="btn btn-sm btn-danger btn-remove-slide">
            <i class="fas fa-times"></i> Hapus
        </button>
        <div class="row">
            <div class="col-md-4">
                <label class="small text-muted">URL Gambar</label>
                <input type="url" class="form-control slide-img-input mb-2" value="${escapeHtml(imgUrl)}" maxlength="500" placeholder="https://...">
            </div>
            <div class="col-md-4">
                <label class="small text-muted">Judul Utama</label>
                <input type="text" class="form-control slide-title-input mb-2" value="${escapeHtml(judul)}" maxlength="100">
            </div>
            <div class="col-md-4">
                <label class="small text-muted">Subjudul</label>
                <input type="text" class="form-control slide-subtitle-input" value="${escapeHtml(subjudul)}" maxlength="150">
            </div>
        </div>`;
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
