// ============================================================
// CESSIONS — KAPITRANS
// ============================================================
// Ce fichier affiche la liste des cessions.
// Toutes les cessions sont chargées depuis localStorage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE TABLEAU
    // ============================================================

    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    tbody.replaceChildren();

    // ============================================================
    // 3. RÉCUPÉRER LES CESSIONS CRÉÉES
    // ============================================================

    function readStoredValue(key, fallback) {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    }

    function getAllCessions() {
        const statusOverrides = readStoredValue('kapitrans-cession-statuses', {});
        const storedCessions = readStoredValue('kapitrans-cessions', []);
        if (!Array.isArray(storedCessions)) throw new Error('Le registre des cessions doit contenir une liste.');
        return storedCessions.map(function (cession, index) {
            return {
                matricule: cession.matricule,
                ancienProprietaire: cession.ancienProprietaire?.nom || '—',
                nouveauProprietaire: `${cession.nouveauProprietaire?.nom || ''} ${cession.nouveauProprietaire?.prenom || ''}`.trim(),
                date: formatDate(cession.dateCession),
                prix: cession.prix ? formatPrice(cession.prix) + ' FC' : '—',
                statut: cession.statut || statusOverrides[cession.matricule] || 'attente',
                _key: String(index),
                _source: 'stored'
            };
        });
    }

    // ============================================================
    // 4. FORMATER LA DATE
    // ============================================================

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return parts[2] + '/' + parts[1] + '/' + parts[0];
        }
        return dateStr;
    }

    // ============================================================
    // 5. FORMATER LE PRIX
    // ============================================================

    function formatPrice(price) {
        const num = parseInt(price, 10);
        if (isNaN(num)) return price;
        return num.toLocaleString('fr-FR').replace(/,/g, ' ');
    }

    // ============================================================
    // 6. BADGE DE STATUT
    // ============================================================

    function getStatusBadge(statut) {
        if (statut === 'validee') {
            return '<span class="status-badge status-active">Validée</span>';
        }
        if (statut === 'attente') {
            return '<span class="status-badge status-inactive">En attente</span>';
        }
        if (statut === 'refusee') {
            return '<span class="status-badge status-inactive">Refusée</span>';
        }
        return '<span class="status-badge">' + escapeHtml(statut || '—') + '</span>';
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
        });
    }

    // ============================================================
    // 7. AFFICHER LES CESSIONS
    // ============================================================

    function renderCessions() {
        const allCessions = getAllCessions();
        tbody.innerHTML = '';
        const counts = [
            allCessions.length,
            allCessions.filter(cession => cession.statut === 'validee').length,
            allCessions.filter(cession => cession.statut === 'attente').length,
            allCessions.filter(cession => cession.statut === 'refusee').length
        ];
        document.querySelectorAll('.users-stats-grid .stat-number').forEach(function (element, index) {
            element.textContent = String(counts[index] || 0);
        });
        if (allCessions.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.textContent = 'Aucune cession enregistrée.';
            return;
        }

        allCessions.forEach(function (c) {
            const tr = document.createElement('tr');
            tr.dataset.cessionKey = c._key;
            tr.dataset.source = c._source;
            const actionButtons = c.statut === 'attente'
                ? `<button class="btn-action btn-approve" type="button" title="Valider" aria-label="Valider">${window.kapitransIcon('success').outerHTML}</button>
                    <button class="btn-action btn-reject" type="button" title="Refuser" aria-label="Refuser">${window.kapitransIcon('delete').outerHTML}</button>`
                : `<button class="btn-action btn-edit" type="button" title="Modifier" aria-label="Modifier">${window.kapitransIcon('edit').outerHTML}</button>`;

            tr.innerHTML = `
                <td><strong>${escapeHtml(c.matricule)}</strong></td>
                <td>${escapeHtml(c.ancienProprietaire)}</td>
                <td>${escapeHtml(c.nouveauProprietaire)}</td>
                <td>${escapeHtml(c.date)}</td>
                <td>${escapeHtml(c.prix)}</td>
                <td>${getStatusBadge(c.statut)}</td>
                <td class="actions-cell">
                    <button class="btn-action btn-view" type="button" title="Voir" aria-label="Voir">${window.kapitransIcon('view').outerHTML}</button>
                    ${actionButtons}
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    // ============================================================
    // 8. RECHERCHE ET FILTRES
    // ============================================================

    const searchInput = document.querySelector('.search-input');
    const filterStatut = document.querySelectorAll('.filter-select')[0];
    const filterDate = document.querySelectorAll('.filter-select')[1];

    function filterCessions() {
        const search = (searchInput?.value || '').toLowerCase().trim();
        const statut = filterStatut?.value || '';

        const rows = tbody.querySelectorAll('tr');

        rows.forEach(function (row) {
            const cells = row.querySelectorAll('td');
            const matricule = (cells[0]?.textContent || '').toLowerCase();
            const ancien = (cells[1]?.textContent || '').toLowerCase();
            const nouveau = (cells[2]?.textContent || '').toLowerCase();
            const statutText = (cells[5]?.textContent || '').toLowerCase();

            const matchSearch = !search ||
                matricule.includes(search) ||
                ancien.includes(search) ||
                nouveau.includes(search);

            const matchStatut = !statut || statutText.includes(statut.toLowerCase());

            if (matchSearch && matchStatut) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterCessions);
    }
    if (filterStatut) {
        filterStatut.addEventListener('change', filterCessions);
    }

    tbody.addEventListener('click', function (event) {
        const button = event.target.closest('.btn-action');
        if (!button) return;

        const row = button.closest('tr');
        const cession = getAllCessions().find(item => item._key === row?.dataset.cessionKey && item._source === row?.dataset.source);
        if (!cession) return;

        if (button.classList.contains('btn-view')) {
            window.kapitransRecordDialog('Détails de la cession', [
                { label: 'Véhicule', value: cession.matricule },
                { label: 'Ancien propriétaire', value: cession.ancienProprietaire },
                { label: 'Nouveau propriétaire', value: cession.nouveauProprietaire },
                { label: 'Date', value: cession.date },
                { label: 'Prix', value: cession.prix },
                { label: 'Statut', value: cession.statut }
            ]);
            return;
        }

        if (button.classList.contains('btn-approve') || button.classList.contains('btn-reject')) {
            const nextStatus = button.classList.contains('btn-approve') ? 'validee' : 'refusee';
            const label = nextStatus === 'validee' ? 'valider' : 'refuser';
            if (!window.confirm(`Confirmer la décision de ${label} la cession ${cession.matricule} ?`)) return;

            if (cession._source === 'stored') {
                const stored = readStoredValue('kapitrans-cessions', []);
                const record = stored[Number(cession._key)];
                if (!record) return;
                record.statut = nextStatus === 'validee' ? 'validee' : 'refusee';
                localStorage.setItem('kapitrans-cessions', JSON.stringify(stored));
            } else {
                const overrides = readStoredValue('kapitrans-cession-overrides', {});
                overrides[cession._key] = { ...overrides[cession._key], statut: nextStatus };
                localStorage.setItem('kapitrans-cession-overrides', JSON.stringify(overrides));
            }
            renderCessions();
            filterCessions();
            return;
        }

        if (button.classList.contains('btn-edit')) {
            window.kapitransRecordDialog('Modifier la cession', [
                { name: 'ancienProprietaire', label: 'Ancien propriétaire', value: cession.ancienProprietaire },
                { name: 'nouveauProprietaire', label: 'Nouveau propriétaire', value: cession.nouveauProprietaire },
                { name: 'date', label: 'Date', value: cession.date },
                { name: 'prix', label: 'Prix', value: cession.prix },
                {
                    name: 'statut', label: 'Statut', value: cession.statut, options: [
                        { value: 'attente', label: 'En attente' },
                        { value: 'validee', label: 'Validée' },
                        { value: 'refusee', label: 'Refusée' }
                    ]
                }
            ], function (values) {
                if (cession._source === 'stored') {
                    const stored = readStoredValue('kapitrans-cessions', []);
                    const record = stored[Number(cession._key)];
                    if (!record) return false;
                    record.ancienProprietaire = { ...record.ancienProprietaire, nom: values.ancienProprietaire.trim() };
                    const nameParts = values.nouveauProprietaire.trim().split(/\s+/);
                    record.nouveauProprietaire = {
                        ...record.nouveauProprietaire,
                        nom: nameParts.shift() || '',
                        prenom: nameParts.join(' ')
                    };
                    record.dateCession = values.date.trim();
                    record.prix = values.prix.trim().replace(/\s/g, '').replace(/FC$/i, '');
                    record.statut = values.statut;
                    localStorage.setItem('kapitrans-cessions', JSON.stringify(stored));
                } else {
                    const overrides = readStoredValue('kapitrans-cession-overrides', {});
                    overrides[cession._key] = {
                        ...overrides[cession._key],
                        ancienProprietaire: values.ancienProprietaire.trim(),
                        nouveauProprietaire: values.nouveauProprietaire.trim(),
                        date: values.date.trim(),
                        prix: values.prix.trim(),
                        statut: values.statut
                    };
                    localStorage.setItem('kapitrans-cession-overrides', JSON.stringify(overrides));
                }
                renderCessions();
                filterCessions();
            });
        }
    });

    // ============================================================
    // 9. INITIALISATION
    // ============================================================

    renderCessions();

});