/**
 * ui.js  –  Helper UI bersama
 * ============================================================
 * Notifikasi, spinner, dan utilitas tampilan.
 * ============================================================
 */

const notificationArea = document.getElementById('notificationArea');
let _notifTimer = null;

/**
 * Tampilkan notifikasi toast di pojok kanan atas.
 * @param {string} message  - Pesan yang ditampilkan (teks biasa, bukan HTML)
 * @param {'success'|'danger'|'warning'|'info'} type
 */
export function showNotification(message, type = 'success') {
    // Escape untuk keamanan – message tidak langsung jadi innerHTML mentah
    const safeMsg = document.createTextNode(message);
    const wrapper = document.createElement('div');
    wrapper.className = `alert alert-${type} alert-dismissible fade show shadow d-flex align-items-center`;
    wrapper.setAttribute('role', 'alert');

    const iconMap = { success: 'check-circle', danger: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    const icon = document.createElement('i');
    icon.className = `fas fa-${iconMap[type] || 'info-circle'} me-2`;
    wrapper.appendChild(icon);
    wrapper.appendChild(safeMsg);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close ms-auto';
    closeBtn.setAttribute('data-bs-dismiss', 'alert');
    wrapper.appendChild(closeBtn);

    notificationArea.innerHTML = '';
    notificationArea.appendChild(wrapper);

    clearTimeout(_notifTimer);
    _notifTimer = setTimeout(() => { notificationArea.innerHTML = ''; }, 4500);
}

/**
 * Set tombol ke state loading.
 * @returns {Function} restore() – panggil untuk mengembalikan tombol
 */
export function setButtonLoading(btn, loadingText = 'Menyimpan...') {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>${loadingText}`;
    return (restoredHtml) => {
        btn.disabled = false;
        btn.innerHTML = restoredHtml || original;
    };
}
