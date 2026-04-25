/**
 * security.js
 * ============================================================
 * Modul keamanan: sanitasi input, rate limiting login,
 * hashing password (SHA-256 via Web Crypto API), dan
 * validasi URL agar tidak ada JavaScript injection.
 * ============================================================
 */

// -------------------------------------------------------
// 1. SANITASI HTML (cegah XSS)
//    Gunakan fungsi ini sebelum memasukkan teks dari user
//    ke dalam innerHTML.
// -------------------------------------------------------
export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// -------------------------------------------------------
// 2. VALIDASI URL
//    Hanya izinkan http:// dan https://
// -------------------------------------------------------
export function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
        return false;
    }
}

// -------------------------------------------------------
// 3. HASH PASSWORD (SHA-256)
//    Password TIDAK boleh disimpan plain text.
//    Gunakan fungsi ini saat menyimpan atau membandingkan
//    password di Firestore.
//
//    CATATAN: Untuk produksi, sebaiknya gunakan Firebase
//    Authentication agar lebih aman. Hashing di sisi client
//    masih lebih baik dari plain text, namun idealnya
//    autentikasi dilakukan di server.
// -------------------------------------------------------
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// -------------------------------------------------------
// 4. RATE LIMITING LOGIN (client-side)
//    Kunci sementara setelah 5 kali gagal.
//    Data disimpan di sessionStorage.
// -------------------------------------------------------
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 5 * 60 * 1000; // 5 menit
const ATTEMPT_KEY   = 'loginAttempts';
const LOCKOUT_KEY   = 'loginLockedUntil';

export function isLoginLocked() {
    const lockedUntil = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
    return Date.now() < lockedUntil;
}

export function getLockoutRemainingMs() {
    const lockedUntil = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
    return Math.max(0, lockedUntil - Date.now());
}

export function recordFailedAttempt() {
    let attempts = parseInt(sessionStorage.getItem(ATTEMPT_KEY) || '0', 10) + 1;
    sessionStorage.setItem(ATTEMPT_KEY, attempts);
    if (attempts >= MAX_ATTEMPTS) {
        sessionStorage.setItem(LOCKOUT_KEY, Date.now() + LOCKOUT_MS);
    }
    return attempts;
}

export function resetLoginAttempts() {
    sessionStorage.removeItem(ATTEMPT_KEY);
    sessionStorage.removeItem(LOCKOUT_KEY);
}

export function getRemainingAttempts() {
    const attempts = parseInt(sessionStorage.getItem(ATTEMPT_KEY) || '0', 10);
    return Math.max(0, MAX_ATTEMPTS - attempts);
}
