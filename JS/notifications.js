import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
    if (!user) return;

    const normalizedRole = String(user.role || '').toUpperCase();
    if (normalizedRole === 'AGENT') return;

    const adminInfo = document.querySelector('.admin-info');
    if (!adminInfo) return;

    const notifBtn = document.createElement('button');
    notifBtn.id = 'notification-btn';
    notifBtn.className = 'btn-notification';
    notifBtn.setAttribute('type', 'button');
    notifBtn.setAttribute('aria-label', 'Notifications');
    notifBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
        <span class="notification-badge" id="notification-count">0</span>
    `;
    adminInfo.insertBefore(notifBtn, adminInfo.firstChild);

    const notifPanel = document.createElement('div');
    notifPanel.id = 'notification-panel';
    notifPanel.className = 'notification-panel';
    notifPanel.innerHTML = `
        <div class="notification-panel-header">
            <h3>Notifications</h3>
            <button id="notification-close" class="notification-close" type="button" aria-label="Fermer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
        </div>
        <div class="notification-list" id="notification-list">
            <p style="padding: 1rem; text-align: center; color: #94a3b8;">Chargement...</p>
        </div>
        <div class="notification-panel-footer">
            <a href="admin-alerts.html" class="notification-view-all">Voir toutes les alertes →</a>
        </div>
    `;
    document.body.appendChild(notifPanel);

    try {
        const q = query(collection(db, "alerts"), orderBy("date", "desc"), limit(5));
        const snapshot = await getDocs(q);

        const list = document.getElementById('notification-list');
        const countBadge = document.getElementById('notification-count');

        if (snapshot.empty) {
            list.innerHTML = '<p style="padding: 1rem; text-align: center; color: #94a3b8;">Aucune notification.</p>';
            countBadge.style.display = 'none';
        } else {
            list.innerHTML = '';
            countBadge.textContent = snapshot.size;
            countBadge.style.display = 'flex';

            snapshot.forEach(doc => {
                const a = doc.data();
                const item = document.createElement('a');
                item.href = 'admin-alerts.html';
                item.className = 'notification-item notification-critical';
                item.innerHTML = `
                    <div class="notification-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4M12 16h.01"/></svg>
                    </div>
                    <div class="notification-content">
                        <strong>${a.message || 'Alerte'}</strong>
                        <p>${a.matricule || '—'}</p>
                    </div>
                `;
                list.appendChild(item);
            });
        }
    } catch (e) {
        console.error('Erreur chargement notifications', e);
    }

    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifPanel.classList.toggle('open');
    });

    document.getElementById('notification-close').addEventListener('click', () => {
        notifPanel.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
        if (!notifPanel.contains(e.target) && e.target !== notifBtn) {
            notifPanel.classList.remove('open');
        }
    });
});
