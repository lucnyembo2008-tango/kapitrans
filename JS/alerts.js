import { db } from './firebase.js';
import { collection, deleteDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const container = document.querySelector('.alerts-container');
    if (!container) return;

    async function renderAlerts() {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: #94a3b8;">Chargement des alertes...</p>';
        
        try {
            const querySnapshot = await getDocs(collection(db, "alerts"));
            container.innerHTML = '';

            if (querySnapshot.empty) {
                container.innerHTML = '<p style="text-align:center; padding: 2rem; color: #94a3b8;">Aucune alerte pour le moment.</p>';
                return;
            }

            querySnapshot.forEach((docSnapshot) => {
                const a = docSnapshot.data();
                const card = document.createElement('div');
                let cardClass = 'alert-card-warning';
                let gravityClass = 'gravity-warning';
                let gravityLabel = 'MOYENNE';

                if (a.gravite === 'critique') {
                    cardClass = 'alert-card-critical';
                    gravityClass = 'gravity-critical';
                    gravityLabel = 'CRITIQUE';
                } else if (a.gravite === 'faible') {
                    cardClass = 'alert-card-info';
                    gravityClass = 'gravity-info';
                    gravityLabel = 'FAIBLE';
                }

                const dateStr = new Date(a.date).toLocaleString('fr-FR');
                const matricule = a.matricule || '—';
                const alertId = docSnapshot.id;

                card.className = `alert-card ${cardClass}`;
                card.innerHTML = `
                    <div class="alert-card-header">
                        <div class="alert-card-badges">
                            <span class="alert-gravity ${gravityClass}">${gravityLabel}</span>
                            <span class="alert-type">Alerte</span>
                        </div>
                        <span class="alert-date">${dateStr}</span>
                    </div>
                    <div class="alert-card-body">
                        <h3 class="alert-card-title">Véhicule signalé : ${matricule}</h3>
                        <p class="alert-card-message">${a.message}</p>
                        <div class="alert-card-details">
                            <div class="alert-detail"><span class="alert-detail-label">Agent</span><span class="alert-detail-value">${a.agent || '—'}</span></div>
                            <div class="alert-detail"><span class="alert-detail-label">Statut</span><span class="alert-detail-value">${a.statut}</span></div>
                        </div>
                        <div class="alert-card-actions" style="display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap;">
                            <button type="button" class="btn-secondary btn-alert-map" data-alert-id="${alertId}" data-matricule="${encodeURIComponent(matricule)}">Mapper</button>
                            <button type="button" class="btn-danger btn-alert-delete" data-alert-id="${alertId}" data-matricule="${matricule}">Supprimer</button>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });

        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="text-align:center; padding: 2rem; color: #fca5a5;">Erreur de chargement.</p>';
        }
    }

    container.addEventListener('click', async (event) => {
        const mapButton = event.target.closest('.btn-alert-map');
        if (mapButton) {
            const matricule = mapButton.dataset.matricule;
            if (matricule) {
                window.location.href = `admin-map.html?matricule=${matricule}`;
            }
            return;
        }

        const deleteButton = event.target.closest('.btn-alert-delete');
        if (!deleteButton) return;

        const alertId = deleteButton.dataset.alertId;
        const matricule = deleteButton.dataset.matricule || 'cette alerte';
        const confirmed = window.confirm(`Supprimer l'alerte du véhicule ${matricule} ?`);
        if (!confirmed || !alertId) return;

        try {
            await deleteDoc(doc(db, 'alerts', alertId));
            await renderAlerts();
        } catch (error) {
            console.error('Impossible de supprimer l’alerte.', error);
            window.alert('La suppression a échoué.');
        }
    });

    renderAlerts();
});
