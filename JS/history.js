import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('fr-FR');
    }

    function getStatusBadge(statut) {
        const statusMap = {
            conforme: ['status-conforme', 'Conforme'],
            surveiller: ['status-surveiller', 'À surveiller'],
            'non-conforme': ['status-non-conforme', 'Non conforme']
        };
        const [className, label] = statusMap[statut] || ['status-conforme', 'Conforme'];
        const badge = document.createElement('span');
        badge.className = `status-badge ${className}`;
        badge.textContent = label;
        return badge;
    }

    function createActionButton(label, action, item) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-action btn-view';
        button.dataset.action = action;
        button.dataset.historyId = item.id;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
        return button;
    }

    async function renderHistory() {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement...</td></tr>';

        try {
            const querySnapshot = await getDocs(collection(db, 'history'));
            tbody.replaceChildren();

            if (querySnapshot.empty) {
                const row = tbody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 7;
                cell.style.cssText = 'text-align: center; padding: 2rem; color: #94a3b8;';
                cell.textContent = 'Aucune vérification enregistrée.';
                return;
            }

            querySnapshot.docs.forEach((snapshot) => {
                const item = { id: snapshot.id, ...snapshot.data() };
                const row = document.createElement('tr');
                row.dataset.historyId = item.id;

                const columns = [
                    ['audit-date', formatDate(item.date)],
                    ['matricule', item.matricule || '—'],
                    ['marque', item.marque || '—'],
                    ['proprietaire', item.proprietaire || '—'],
                    ['zone', item.zone || '—']
                ];

                columns.forEach(([className, text]) => {
                    const cell = document.createElement('td');
                    if (className === 'matricule') {
                        const strong = document.createElement('strong');
                        strong.className = 'matricule';
                        strong.textContent = text;
                        cell.appendChild(strong);
                    } else if (className === 'audit-date') {
                        cell.className = className;
                        cell.textContent = text;
                    } else {
                        cell.textContent = text;
                    }
                    row.appendChild(cell);
                });

                const statusCell = document.createElement('td');
                statusCell.appendChild(getStatusBadge(item.statut));
                row.appendChild(statusCell);

                const actionsCell = document.createElement('td');
                actionsCell.className = 'actions-cell';
                actionsCell.appendChild(createActionButton('Voir', 'view', item));
                row.appendChild(actionsCell);
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Erreur Firebase lors du chargement de l’historique :', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement.</td></tr>';
        }
    }

    tbody.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const row = button.closest('tr[data-history-id]');
        if (!row) return;
        const historyId = row.dataset.historyId;
        const historyRows = Array.from(tbody.querySelectorAll('tr[data-history-id]'));
        const item = historyRows.length ? await getDocs(collection(db, 'history')).then((snapshot) => snapshot.docs.find((doc) => doc.id === historyId)) : null;
        if (!item) return;
        const record = { id: item.id, ...item.data() };
        const fields = [
            { label: 'Date', value: formatDate(record.date) },
            { label: 'Matricule', value: record.matricule },
            { label: 'Marque', value: record.marque },
            { label: 'Propriétaire', value: record.proprietaire },
            { label: 'Zone', value: record.zone },
            { label: 'Statut', value: record.statut }
        ];
        window.kapitransRecordDialog('Détails de la vérification', fields);
    });

    renderHistory();
});
