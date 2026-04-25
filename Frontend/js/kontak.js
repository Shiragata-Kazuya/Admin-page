/**
 * kontak.js  –  Modul Manajemen Kontak & Sosial Media
 */

import { getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showNotification, setButtonLoading } from "./ui.js";

let _kontakDataRef = null;

export function initKontak(refs) {
    _kontakDataRef = refs.kontakData;
    document.getElementById('btnSaveKontak').addEventListener('click', handleSaveKontak);
    loadKontakData();
}

async function loadKontakData() {
    try {
        const snap = await getDoc(_kontakDataRef);
        if (!snap.exists()) return;
        const data = snap.data();

        document.getElementById('kontakEmail').value   = data.email   || '';
        document.getElementById('kontakPhone').value   = data.phone   || '';
        document.getElementById('kontakAddress').value = data.address || '';

        if (data.social) {
            document.getElementById('kontakIg').value       = data.social.instagram || '';
            document.getElementById('kontakTwitter').value  = data.social.twitter   || '';
            document.getElementById('kontakLinkedin').value = data.social.linkedin  || '';
        }
    } catch (err) {
        console.error('Gagal load kontak:', err);
    }
}

async function handleSaveKontak() {
    const btn     = document.getElementById('btnSaveKontak');
    const restore = setButtonLoading(btn, 'Menyimpan...');

    // Validasi email sederhana
    const email = document.getElementById('kontakEmail').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Format email tidak valid.', 'warning');
        restore('<i class="fas fa-save me-2"></i> Simpan Kontak');
        return;
    }

    try {
        await updateDoc(_kontakDataRef, {
            email  : email,
            phone  : document.getElementById('kontakPhone').value.trim(),
            address: document.getElementById('kontakAddress').value.trim(),
            social : {
                instagram: document.getElementById('kontakIg').value.trim(),
                twitter  : document.getElementById('kontakTwitter').value.trim(),
                linkedin : document.getElementById('kontakLinkedin').value.trim(),
            },
        });
        showNotification('Data kontak berhasil diperbarui!');
    } catch (err) {
        console.error(err);
        showNotification('Gagal menyimpan kontak.', 'danger');
    } finally {
        restore('<i class="fas fa-save me-2"></i> Simpan Kontak');
    }
}
