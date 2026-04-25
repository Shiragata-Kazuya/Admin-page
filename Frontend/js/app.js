/**
 * app.js  –  Entry point utama Admin Panel
 * ============================================================
 * Mengimport semua modul dan menginisialisasi aplikasi.
 * ============================================================
 */

import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, collection }
                                  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { firebaseConfig }         from "./firebase-config.js";
import { showNotification }       from "./ui.js";
import { initAuth }               from "./auth.js";
import { initBeranda }            from "./beranda.js";
import { initKegiatan }           from "./kegiatan.js";
import { initStruktur }           from "./struktur.js";
import { initKontak }             from "./kontak.js";

// -------------------------------------------------------
// Inisialisasi Firebase
// -------------------------------------------------------
let db = null;

const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "MASUKKAN_API_KEY_DISINI";

if (isConfigured) {
    const fbApp = initializeApp(firebaseConfig);
    db = getFirestore(fbApp);
} else {
    document.getElementById('configWarning').classList.remove('d-none');
}

// -------------------------------------------------------
// Referensi Firestore (diekspor agar bisa dipakai modul lain)
// -------------------------------------------------------
export const refs = db ? {
    homeData  : doc(db, "home",    "data"),
    adminAuth : doc(db, "admin",   "users"),
    kontakData: doc(db, "kontak",  "data"),
    kegiatan  : collection(db, "kegiatan"),
    struktur  : doc(db, "struktur","data"),
    db,
} : null;

// -------------------------------------------------------
// Navigasi sidebar
// -------------------------------------------------------
function initNavigation() {
    const navLinks = document.querySelectorAll('#sidebarMenu .nav-link');
    const sections = document.querySelectorAll('.admin-section');

    function activateSection(targetId) {
        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        const targetLink = document.querySelector(`[data-target="${targetId}"]`);
        const targetSection = document.getElementById(targetId);
        if (targetLink)   targetLink.classList.add('active');
        if (targetSection) targetSection.classList.add('active');
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function () {
            activateSection(this.getAttribute('data-target'));
        });
        // Aksesibilitas: support Enter/Space
        link.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activateSection(this.getAttribute('data-target'));
            }
        });
    });
}

// -------------------------------------------------------
// Fungsi yang dipanggil setelah berhasil login
// -------------------------------------------------------
export function onLoginSuccess() {
    if (!refs) return;
    initBeranda(refs);
    initKontak(refs);
    initKegiatan(refs);
    initStruktur(refs);
}

// -------------------------------------------------------
// Bootstrap aplikasi
// -------------------------------------------------------
initNavigation();

if (refs) {
    initAuth(refs, onLoginSuccess);
} else {
    // Jika Firebase belum dikonfigurasi, tampilkan layar login
    // tapi tombol masuk akan nonaktif
    document.getElementById('loginScreen').style.display = 'flex';
}
