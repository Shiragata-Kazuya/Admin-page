/**
 * auth.js  –  Modul Autentikasi Login / Logout
 * ============================================================
 * Perubahan keamanan:
 *  - Password di-hash SHA-256 sebelum dibandingkan
 *  - Rate limiting: maksimal 5 percobaan, kunci 5 menit
 *  - Session token acak disimpan di sessionStorage (bukan 'true')
 *  - Auto-logout setelah 60 menit tidak aktif
 *  - Toggle show/hide password
 * ============================================================
 */

import { getDoc }    from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showNotification }  from "./ui.js";
import {
    hashPassword,
    isLoginLocked,
    getLockoutRemainingMs,
    recordFailedAttempt,
    resetLoginAttempts,
    getRemainingAttempts,
} from "./security.js";

// Kunci yang disimpan di sessionStorage
const SESSION_KEY      = 'himaAdminSession';   // random token
const SESSION_NAME_KEY = 'himaAdminName';
const SESSION_EXP_KEY  = 'himaAdminExpiry';    // timestamp kedaluwarsa
const SESSION_DURATION = 60 * 60 * 1000;       // 60 menit

let _inactivityTimer = null;

// -------------------------------------------------------
// Cek apakah sesi masih valid
// -------------------------------------------------------
function isSessionValid() {
    const token  = sessionStorage.getItem(SESSION_KEY);
    const expiry = parseInt(sessionStorage.getItem(SESSION_EXP_KEY) || '0', 10);
    return !!token && Date.now() < expiry;
}

// -------------------------------------------------------
// Reset timer inaktivitas (diperpanjang setiap ada interaksi)
// -------------------------------------------------------
function resetInactivityTimer(logoutFn) {
    clearTimeout(_inactivityTimer);
    _inactivityTimer = setTimeout(() => {
        showNotification('Sesi habis karena tidak aktif. Silakan login kembali.', 'warning');
        logoutFn();
    }, SESSION_DURATION);
}

// -------------------------------------------------------
// Tampilkan UI Admin
// -------------------------------------------------------
function showAdminUI(name, logoutFn) {
    document.getElementById('loginScreen').style.display    = 'none';
    document.getElementById('adminLayout').style.display    = 'block';
    document.getElementById('adminNameDisplay').textContent = name || 'Administrator';
    resetInactivityTimer(logoutFn);

    // Perpanjang timer setiap ada interaksi user
    ['click', 'keydown', 'mousemove', 'scroll'].forEach(evt => {
        document.addEventListener(evt, () => resetInactivityTimer(logoutFn), { passive: true });
    });
}

// -------------------------------------------------------
// Tampilkan sisa waktu lockout di UI
// -------------------------------------------------------
let _lockoutInterval = null;
function startLockoutDisplay() {
    const info = document.getElementById('lockoutInfo');
    const btn  = document.getElementById('btnLogin');
    if (!info) return;

    function update() {
        const ms      = getLockoutRemainingMs();
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        if (ms <= 0) {
            clearInterval(_lockoutInterval);
            info.classList.add('d-none');
            btn.disabled = false;
        } else {
            info.classList.remove('d-none');
            info.textContent = `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes}:${String(seconds).padStart(2,'0')} menit.`;
            btn.disabled = true;
        }
    }
    update();
    _lockoutInterval = setInterval(update, 1000);
}

// -------------------------------------------------------
// Export utama: initAuth
// -------------------------------------------------------
export function initAuth(refs, onLoginSuccess) {
    const loginForm  = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const btnLogin   = document.getElementById('btnLogin');
    const btnLogout  = document.getElementById('btnLogout');
    const btnToggle  = document.getElementById('btnTogglePass');
    const passInput  = document.getElementById('loginPassword');

    // Toggle show/hide password
    if (btnToggle && passInput) {
        btnToggle.addEventListener('click', () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            document.getElementById('iconTogglePass').className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }

    // Fungsi logout
    function doLogout() {
        clearTimeout(_inactivityTimer);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_NAME_KEY);
        sessionStorage.removeItem(SESSION_EXP_KEY);
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminLayout').style.display = 'none';
        if (loginForm) loginForm.reset();
    }

    // Cek status session saat load
    if (isSessionValid()) {
        const name = sessionStorage.getItem(SESSION_NAME_KEY);
        showAdminUI(name, doLogout);
        onLoginSuccess();
    } else {
        doLogout(); // bersihkan sesi lama yg sudah expire
        document.getElementById('loginScreen').style.display = 'flex';
        // Cek apakah sedang di-lock
        if (isLoginLocked()) startLockoutDisplay();
    }

    // Event logout
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('Yakin ingin keluar?')) doLogout();
        });
    }

    // Event submit form login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginError.classList.add('d-none');

            // Cek lockout
            if (isLoginLocked()) {
                startLockoutDisplay();
                return;
            }

            const usernameInput = document.getElementById('loginUsername').value.trim();
            const passwordInput = document.getElementById('loginPassword').value;

            // Validasi dasar input
            if (!usernameInput || !passwordInput) {
                loginError.classList.remove('d-none');
                loginError.textContent = 'Username dan password harus diisi.';
                return;
            }

            btnLogin.disabled = true;
            btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Memeriksa...';

            try {
                const adminSnap = await getDoc(refs.adminAuth);

                if (!adminSnap.exists() || !adminSnap.data().users) {
                    loginError.classList.remove('d-none');
                    loginError.textContent = 'Sistem database admin tidak valid.';
                    return;
                }

                const users = adminSnap.data().users;

                // Hash password input untuk dibandingkan
                const hashedInput = await hashPassword(passwordInput);

                // Cari user yang cocok
                // Mendukung dua mode: password tersimpan sebagai hash atau plain text (legacy)
                const userMatch = users.find(u => {
                    if (u.username !== usernameInput) return false;
                    // Jika password di DB sudah 64-char hex (SHA-256), bandingkan hash
                    if (u.password && u.password.length === 64 && /^[0-9a-f]+$/.test(u.password)) {
                        return u.password === hashedInput;
                    }
                    // Fallback legacy: plain text (TIDAK DISARANKAN, upgrade segera)
                    return u.password === passwordInput;
                });

                if (userMatch) {
                    // Login berhasil
                    resetLoginAttempts();

                    // Buat session token acak
                    const token = crypto.randomUUID ? crypto.randomUUID()
                                 : Math.random().toString(36).slice(2) + Date.now();

                    sessionStorage.setItem(SESSION_KEY,      token);
                    sessionStorage.setItem(SESSION_NAME_KEY, userMatch.name || 'Administrator');
                    sessionStorage.setItem(SESSION_EXP_KEY,  Date.now() + SESSION_DURATION);

                    loginForm.reset();
                    showAdminUI(userMatch.name, doLogout);
                    onLoginSuccess();
                } else {
                    // Login gagal
                    const attempts   = recordFailedAttempt();
                    const remaining  = getRemainingAttempts();
                    loginError.classList.remove('d-none');

                    if (isLoginLocked()) {
                        loginError.textContent = 'Terlalu banyak percobaan. Akun dikunci sementara.';
                        startLockoutDisplay();
                    } else {
                        loginError.textContent = `Username atau password salah. Sisa percobaan: ${remaining}.`;
                    }
                }
            } catch (err) {
                console.error('Login error:', err);
                loginError.classList.remove('d-none');
                loginError.textContent = 'Gagal terhubung ke database. Periksa koneksi internet.';
            } finally {
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i> Masuk';
                if (isLoginLocked()) btnLogin.disabled = true;
            }
        });
    }
}
