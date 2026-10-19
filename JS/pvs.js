import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    async function renderPvs() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement...</td></tr>';
        
        try {
            const querySnapshot = await getDocs(collection(db, "pvs"));
            tbody.innerHTML = '';

            if (querySnapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Aucun PV enregistré.</td></tr>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const pv = doc.data();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${pv.matricule || '—'}</strong></td>
                    <td>${pv.motif || '—'}</td>
                    <td>${pv.montant || '—'} FC</td>
                    <td>${pv.agent || '—'}</td>
                    <td>${new Date(pv.dateCreation).toLocaleDateString('fr-FR')}</td>
                    <td><span class="status-badge status-active">Verbalisé</span></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement.</td></tr>';
        }
    }

    renderPvs();
});
