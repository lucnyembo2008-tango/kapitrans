// ============================================================
// DOCUMENTS — KAPITRANS
// ============================================================
// Ce fichier affiche la liste des documents.
// Tous les documents sont chargés depuis localStorage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE TABLEAU
    // ============================================================

    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    tbody.replaceChildren();

    // ============================================================
    // 3. RÉCUPÉRER LES DOCUMENTS CRÉÉS
    // ============================================================

    function readStoredValue(key, fallback) {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    }

    function getAllDocuments() {
        const storedDocuments = readStoredValue('kapitrans-documents', []);
        if (!Array.isArray(storedDocuments)) throw new Error('Le registre des documents doit contenir une liste.');
        return storedDocuments.map(function (documentRecord, index) {
            return {
                matricule: documentRecord.matricule,
                type: formatType(documentRecord.type),
                numero: documentRecord.numero,
                emission: formatDate(documentRecord.dateEmission),
                expiration: formatDate(documentRecord.dateExpiration),
                statut: documentRecord.statut,
                _key: String(index),
                _source: 'stored'
            };
        });
    }

    // ============================================================
    // 4. FORMATER LE TYPE
    // ============================================================

    function formatType(type) {
        const types = {
            'carte-grise': 'Carte grise',
            'assurance': 'Assurance',
            'visite-technique': 'Visite technique',
            'permis': 'Permis',
            'vignette': 'Vignette'
        };
        return types[type] || type;
    }

    // ============================================================
    // 5. FORMATER LA DATE
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
    // 6. BADGE DE STATUT
    // ============================================================

    function getStatusBadge(statut) {
        if (statut === 'valide') {
            return '<span class="status-badge status-active">Valide</span>';
        }
        if (statut === 'bientot') {
            return '<span class="status-badge status-inactive">Expire bientôt</span>';
        }
        if (statut === 'expire') {
            return '<span class="status-badge status-inactive">Expiré</span>';
        }
        return '<span class="status-badge">' + escapeHtml(statut || '—') + '</span>';
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
        });
    }

    // ============================================================
    // 7. AFFICHER LES DOCUMENTS
    // ============================================================

    function renderDocuments() {
        const allDocuments = getAllDocuments();
        tbody.innerHTML = '';
        const counts = [
            allDocuments.length,
            allDocuments.filter(documentRecord => documentRecord.statut === 'valide').length,
            allDocuments.filter(documentRecord => documentRecord.statut === 'bientot').length,
            allDocuments.filter(documentRecord => documentRecord.statut === 'expire').length
        ];
        document.querySelectorAll('.users-stats-grid .stat-number').forEach(function (element, index) {
            element.textContent = String(counts[index] || 0);
        });
        if (allDocuments.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.textContent = 'Aucun document enregistré.';
            return;
        }

        allDocuments.forEach(function (d) {
            const tr = document.createElement('tr');
            tr.dataset.documentKey = d._key;
            tr.dataset.source = d._source;

            tr.innerHTML = `
                <td><strong>${escapeHtml(d.matricule)}</strong></td>
                <td>${escapeHtml(d.type)}</td>
                <td>${escapeHtml(d.numero)}</td>
                <td>${escapeHtml(d.emission)}</td>
                <td>${escapeHtml(d.expiration)}</td>
                <td>${getStatusBadge(d.statut)}</td>
                <td class="actions-cell">
                    <button class="btn-action btn-view" type="button" title="Voir" aria-label="Voir">${window.kapitransIcon('view').outerHTML}</button>
                    <button class="btn-action btn-edit" type="button" title="Modifier" aria-label="Modifier">${window.kapitransIcon('edit').outerHTML}</button>
                    <button class="btn-action btn-delete" type="button" title="Supprimer" aria-label="Supprimer">${window.kapitransIcon('delete').outerHTML}</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    // ============================================================
    // 8. RECHERCHE ET FILTRES
    // ============================================================

    const searchInput = document.querySelector('.search-input');
    const filterType = document.querySelectorAll('.filter-select')[0];
    const filterStatut = document.querySelectorAll('.filter-select')[1];

    function filterDocuments() {
        const search = (searchInput?.value || '').toLowerCase().trim();
        const type = filterType?.value || '';
        const statut = filterStatut?.value || '';

        const rows = tbody.querySelectorAll('tr');

        rows.forEach(function (row) {
            const cells = row.querySelectorAll('td');
            const matricule = (cells[0]?.textContent || '').toLowerCase();
            const typeText = (cells[1]?.textContent || '').toLowerCase();
            const numero = (cells[2]?.textContent || '').toLowerCase();
            const statutText = (cells[5]?.textContent || '').toLowerCase();

            const matchSearch = !search ||
                matricule.includes(search) ||
                numero.includes(search);

            const matchType = !type || typeText.includes(type.toLowerCase());
            const matchStatut = !statut || statutText.includes(statut.toLowerCase());

            if (matchSearch && matchType && matchStatut) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterDocuments);
    }
    if (filterType) {
        filterType.addEventListener('change', filterDocuments);
    }
    if (filterStatut) {
        filterStatut.addEventListener('change', filterDocuments);
    }

    tbody.addEventListener('click', function (event) {
        const button = event.target.closest('.btn-action');
        if (!button) return;

        const row = button.closest('tr');
        const documentRecord = getAllDocuments().find(item => item._key === row?.dataset.documentKey && item._source === row?.dataset.source);
        if (!documentRecord) return;

        if (button.classList.contains('btn-view')) {
            window.kapitransRecordDialog('Détails du document', [
                { label: 'Véhicule', value: documentRecord.matricule },
                { label: 'Type', value: documentRecord.type },
                { label: 'Numéro', value: documentRecord.numero },
                { label: 'Date d’émission', value: documentRecord.emission },
                { label: 'Date d’expiration', value: documentRecord.expiration },
                { label: 'Statut', value: documentRecord.statut }
            ]);
            return;
        }

        if (button.classList.contains('btn-edit')) {
            window.kapitransRecordDialog('Modifier le document', [
                { name: 'type', label: 'Type', value: documentRecord.type, required: true },
                { name: 'numero', label: 'Numéro', value: documentRecord.numero, required: true },
                { name: 'emission', label: 'Date d’émission', value: documentRecord.emission },
                { name: 'expiration', label: 'Date d’expiration', value: documentRecord.expiration },
                {
                    name: 'statut', label: 'Statut', value: documentRecord.statut, options: [
                        { value: 'valide', label: 'Valide' },
                        { value: 'bientot', label: 'Expire bientôt' },
                        { value: 'expire', label: 'Expiré' }
                    ]
                }
            ], function (values) {
                if (documentRecord._source === 'stored') {
                    const stored = readStoredValue('kapitrans-documents', []);
                    const record = stored[Number(documentRecord._key)];
                    if (!record) return false;
                    record.type = values.type.trim();
                    record.numero = values.numero.trim();
                    record.dateEmission = values.emission.trim();
                    record.dateExpiration = values.expiration.trim();
                    record.statut = values.statut;
                    localStorage.setItem('kapitrans-documents', JSON.stringify(stored));
                } else {
                    const overrides = readStoredValue('kapitrans-document-overrides', {});
                    overrides[documentRecord._key] = {
                        type: values.type.trim(),
                        numero: values.numero.trim(),
                        emission: values.emission.trim(),
                        expiration: values.expiration.trim(),
                        statut: values.statut
                    };
                    localStorage.setItem('kapitrans-document-overrides', JSON.stringify(overrides));
                }
                renderDocuments();
                filterDocuments();
            });
            return;
        }

        if (button.classList.contains('btn-delete')) {
            if (!window.confirm(`Supprimer le document ${documentRecord.numero} ?`)) return;

            if (documentRecord._source === 'stored') {
                const stored = readStoredValue('kapitrans-documents', []);
                stored.splice(Number(documentRecord._key), 1);
                localStorage.setItem('kapitrans-documents', JSON.stringify(stored));
            } else {
                const hidden = readStoredValue('kapitrans-document-hidden', []);
                if (!hidden.includes(documentRecord._key)) hidden.push(documentRecord._key);
                localStorage.setItem('kapitrans-document-hidden', JSON.stringify(hidden));
            }

            renderDocuments();
            filterDocuments();
        }
    });

    // ============================================================
    // 9. INITIALISATION
    // ============================================================

    renderDocuments();

});