import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    async function renderAudit() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement...</td></tr>';
        
        try {
            const querySnapshot = await getDocs(collection(db, "audit"));
            tbody.innerHTML = '';

            if (querySnapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Aucune action enregistrée pour le moment.</td></tr>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const log = doc.data();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="audit-date">${log.date || '—'}</td>
                    <td><strong>${log.utilisateur || '—'}</strong></td>
                    <td><span class="audit-action action-${(log.actionType || 'create').toLowerCase()}">${log.action || '—'}</span></td>
                    <td><span class="audit-entity">${log.entite || '—'}</span></td>
                    <td>${log.details || '—'}</td>
                    <td class="audit-ip">${log.ip || '—'}</td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement.</td></tr>';
        }
    }

    renderAudit();
});
