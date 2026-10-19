import { db } from './firebase.js';
import { collection, deleteDoc, doc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const searchInput = document.querySelector('.search-input');
    const filters = document.querySelectorAll('.filter-select');
    const filterStatus = filters[0];
    const counters = document.querySelectorAll('.users-stats-grid .stat-number');
    let cessions = [];

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
    }

    function getStatusBadge(statut) {
        const statusMap = {
            validee: ['status-active', 'Validée'],
            attente: ['status-inactive', 'En attente'],
            refusee: ['status-inactive', 'Refusée']
        };
        const [className, label] = statusMap[statut] || ['', statut || '—'];
        const badge = document.createElement('span');
        badge.className = `status-badge ${className}`;
        badge.textContent = label;
        return badge;
    }

    function updateCounters() {
        const values = [
            cessions.length,
            cessions.filter((item) => item.statut === 'validee').length,
            cessions.filter((item) => item.statut === 'attente').length,
            cessions.filter((item) => item.statut === 'refusee').length
        ];
        counters.forEach((counter, index) => {
            counter.textContent = String(values[index] || 0);
        });
    }

    function addActionButton(container, item, action, label, className, svg) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn-action ${className}`;
        button.dataset.action = action;
        button.dataset.cessionId = item.id;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
        container.appendChild(button);
    }

    function createCessionRow(item) {
        const row = document.createElement('tr');
        row.dataset.cessionId = item.id;
        const values = [
            item.matricule || '—',
            item.nouveauProprietaire || '—',
            formatDate(item.dateCession),
            item.telephone || item.nouveauTelephone || '—'
        ];
        values.forEach((value, index) => {
            const cell = document.createElement('td');
            if (index === 0) {
                const strong = document.createElement('strong');
                strong.textContent = value;
                cell.appendChild(strong);
            } else {
                cell.textContent = value;
            }
            row.appendChild(cell);
        });

        const statusCell = document.createElement('td');
        statusCell.appendChild(getStatusBadge(item.statut));
        row.appendChild(statusCell);

        const actions = document.createElement('td');
        actions.className = 'actions-cell';
        addActionButton(actions, item, 'view', 'Voir', 'btn-view',
            '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>');
        addActionButton(actions, item, 'edit', 'Modifier', 'btn-edit',
            '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>');
        addActionButton(actions, item, 'delete', 'Supprimer', 'btn-delete',
            '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>');
        row.appendChild(actions);
        return row;
    }

    function renderDetails(item) {
        const fields = [
            { label: 'Matricule', value: item.matricule },
            { label: 'Nouveau propriétaire', value: item.nouveauProprietaire },
            { label: 'Téléphone', value: item.nouveauTelephone || item.telephone },
            { label: 'Date de cession', value: formatDate(item.dateCession) },
            { label: 'Statut', value: item.statut }
        ];
        window.kapitransRecordDialog('Détails de la cession', fields);
    }

    function editCession(item) {
        window.kapitransRecordDialog('Modifier la cession', [
            { name: 'matricule', label: 'Matricule', value: item.matricule, required: true },
            { name: 'nouveauProprietaire', label: 'Nouveau propriétaire', value: item.nouveauProprietaire, required: true },
            { name: 'nouveauTelephone', label: 'Téléphone', value: item.nouveauTelephone || item.telephone, required: true },
            { name: 'dateCession', label: 'Date de cession', value: item.dateCession, type: 'date', required: true },
            { name: 'statut', label: 'Statut', value: item.statut, required: true, options: [
                { value: 'attente', label: 'En attente' },
                { value: 'validee', label: 'Validée' },
                { value: 'refusee', label: 'Refusée' }
            ] }
        ], async function (values) {
            await updateDoc(doc(db, 'cessions', item.id), {
                matricule: values.matricule.trim().toUpperCase(),
                nouveauProprietaire: values.nouveauProprietaire.trim(),
                nouveauTelephone: values.nouveauTelephone.trim(),
                dateCession: values.dateCession,
                statut: values.statut
            });
            await renderCessions();
        });
    }

    async function renderCessions() {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement...</td></tr>';
        try {
            const querySnapshot = await getDocs(collection(db, 'cessions'));
            cessions = querySnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
            updateCounters();
            tbody.replaceChildren();

            if (!cessions.length) {
                const row = tbody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 7;
                cell.style.cssText = 'text-align: center; padding: 2rem; color: #94a3b8;';
                cell.textContent = 'Aucune cession enregistrée.';
                return;
            }

            cessions.forEach((item) => tbody.appendChild(createCessionRow(item)));
        } catch (error) {
            console.error('Erreur Firebase lors du chargement des cessions :', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement.</td></tr>';
        }
    }

    tbody.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const item = cessions.find((entry) => entry.id === button.dataset.cessionId);
        if (!item) return;

        if (button.dataset.action === 'view') {
            renderDetails(item);
        } else if (button.dataset.action === 'edit') {
            editCession(item);
        } else if (button.dataset.action === 'delete') {
            if (!window.confirm(`Supprimer la cession du véhicule ${item.matricule || ''} ?`)) return;
            button.disabled = true;
            try {
                await deleteDoc(doc(db, 'cessions', item.id));
                await renderCessions();
            } catch (error) {
                console.error('Impossible de supprimer la cession.', error);
                window.alert('La suppression a échoué. Vérifiez vos droits et réessayez.');
                button.disabled = false;
            }
        }
    });

    searchInput?.addEventListener('input', function () {
        const search = (searchInput.value || '').trim().toLowerCase();
        tbody.querySelectorAll('tr[data-cession-id]').forEach((row) => {
            const item = cessions.find((entry) => entry.id === row.dataset.cessionId);
            if (!item) return;
            const searchable = [item.matricule, item.nouveauProprietaire].join(' ').toLowerCase();
            row.hidden = !!search && !searchable.includes(search);
        });
    });

    filterStatus?.addEventListener('change', function () {
        const selected = filterStatus.value;
        tbody.querySelectorAll('tr[data-cession-id]').forEach((row) => {
            const item = cessions.find((entry) => entry.id === row.dataset.cessionId);
            if (!item) return;
            row.hidden = !!selected && item.statut !== selected;
        });
    });

    renderCessions();
});
