document.addEventListener('DOMContentLoaded', function () {
    const tbody = document.getElementById('pvs-table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('pv-search');
    const statusFilter = document.getElementById('pv-status-filter');
    const amountFormat = new Intl.NumberFormat('fr-FR');

    function readPvs() {
        const pvs = JSON.parse(localStorage.getItem('kapitrans-pvs') || '[]');
        if (!Array.isArray(pvs)) throw new Error('Le registre des PV doit contenir une liste.');
        return pvs.slice().sort(function (left, right) {
            return new Date(right.dateCreation || 0) - new Date(left.dateCreation || 0);
        });
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('fr-FR');
    }

    function formatAmount(value) {
        const amount = Number(value);
        return `${Number.isFinite(amount) ? amountFormat.format(amount) : '0'} FC`;
    }

    function appendCell(row, value) {
        const cell = document.createElement('td');
        cell.textContent = value == null || value === '' ? '—' : String(value);
        row.appendChild(cell);
        return cell;
    }

    function updateStats(pvs) {
        const today = new Date().toDateString();
        const todayCount = pvs.filter(function (pv) {
            return pv.dateCreation && new Date(pv.dateCreation).toDateString() === today;
        }).length;
        const amount = pvs.reduce(function (sum, pv) {
            const value = Number(pv.montant);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        const agents = new Set(pvs.map(function (pv) { return pv.agent; }).filter(Boolean));
        const values = [pvs.length, todayCount, `${amountFormat.format(amount)} FC`, agents.size];
        document.querySelectorAll('[data-pv-stat]').forEach(function (element) {
            const index = { total: 0, today: 1, amount: 2, agents: 3 }[element.dataset.pvStat];
            element.textContent = String(values[index]);
        });
    }

    function renderPvs() {
        const pvs = readPvs();
        updateStats(pvs);
        tbody.replaceChildren();
        const query = (searchInput.value || '').trim().toLocaleLowerCase('fr');
        const selectedStatus = statusFilter.value;
        const filtered = pvs.filter(function (pv) {
            const searchable = [pv.id, pv.matricule, pv.marque, pv.motif, pv.agent, pv.zone]
                .filter(Boolean).join(' ').toLocaleLowerCase('fr');
            return (!query || searchable.includes(query)) && (!selectedStatus || pv.statut === selectedStatus);
        });

        if (filtered.length === 0) {
            const row = tbody.insertRow();
            row.className = 'empty-state-row';
            const cell = row.insertCell();
            cell.colSpan = 8;
            cell.textContent = pvs.length ? 'Aucun PV ne correspond aux filtres.' : 'Aucun procès-verbal enregistré.';
            return;
        }

        filtered.forEach(function (pv) {
            const row = document.createElement('tr');
            appendCell(row, formatDate(pv.dateCreation));
            appendCell(row, pv.id);
            appendCell(row, pv.matricule);
            appendCell(row, pv.marque);
            appendCell(row, pv.motif);
            appendCell(row, formatAmount(pv.montant));
            appendCell(row, pv.agent);
            const actions = document.createElement('td');
            actions.className = 'actions-cell';
            const viewButton = document.createElement('button');
            viewButton.type = 'button';
            viewButton.className = 'btn-action btn-view';
            viewButton.title = 'Voir le PV';
            viewButton.setAttribute('aria-label', 'Voir le PV');
            viewButton.dataset.pvId = pv.id || '';
            viewButton.appendChild(window.kapitransIcon('view'));
            actions.appendChild(viewButton);
            row.appendChild(actions);
            tbody.appendChild(row);
        });
    }

    tbody.addEventListener('click', function (event) {
        const button = event.target.closest('[data-pv-id]');
        if (!button) return;
        const pv = readPvs().find(function (record) { return record.id === button.dataset.pvId; });
        if (!pv) return;
        window.kapitransRecordDialog('Détail du procès-verbal', [
            { label: 'Numéro du PV', value: pv.id },
            { label: 'Date de création', value: formatDate(pv.dateCreation) },
            { label: 'Date de l’infraction', value: pv.dateInfraction },
            { label: 'Matricule', value: pv.matricule },
            { label: 'Véhicule', value: pv.marque },
            { label: 'Propriétaire', value: pv.proprietaire },
            { label: 'Motif', value: pv.motif },
            { label: 'Montant', value: formatAmount(pv.montant) },
            { label: 'Zone', value: pv.zone },
            { label: 'Agent', value: pv.agent },
            { label: 'Statut', value: pv.statut },
            { label: 'Observations', value: pv.observations }
        ]);
    });

    searchInput.addEventListener('input', renderPvs);
    statusFilter.addEventListener('change', renderPvs);
    document.getElementById('refresh-pvs').addEventListener('click', renderPvs);

    try {
        renderPvs();
    } catch (error) {
        console.error('Impossible de charger les procès-verbaux.', error);
        tbody.replaceChildren();
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 8;
        cell.textContent = 'Impossible de lire les procès-verbaux enregistrés.';
    }
});
