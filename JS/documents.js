import { db } from './firebase.js';
import { logAudit } from './audit-log.js';
import { collection, deleteDoc, doc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const searchInput = document.querySelector('.search-input');
    const filters = document.querySelectorAll('.filter-select');
    const filterType = filters[0];
    const filterStatus = filters[1];
    const counters = document.querySelectorAll('.users-stats-grid .stat-number');
    let documents = [];

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        return dateStr;
    }

    function formatType(type) {
        const types = {
            'carte-grise': 'Carte grise',
            assurance: 'Assurance',
            'visite-technique': 'Visite technique',
            'certificat-controle-technique': 'Certificat de contrôle technique',
            'attestation-assurance': "Attestation d'assurance",
            'autorisation-transport': 'Autorisation de transport',
            permis: 'Permis',
            vignette: 'Vignette'
        };
        return types[type] || type || '—';
    }

    function getStatusBadge(statut) {
        const statuses = {
            valide: ['status-active', 'Valide'],
            bientot: ['status-inactive', 'Expire bientôt'],
            expire: ['status-inactive', 'Expiré']
        };
        const [className, label] = statuses[statut] || ['', statut || '—'];
        const badge = document.createElement('span');
        badge.className = `status-badge ${className}`;
        badge.textContent = label;
        return badge;
    }

    function updateCounters() {
        const values = [
            documents.length,
            documents.filter((item) => item.statut === 'valide').length,
            documents.filter((item) => item.statut === 'bientot').length,
            documents.filter((item) => item.statut === 'expire').length
        ];
        counters.forEach((counter, index) => {
            counter.textContent = String(values[index] || 0);
        });
    }

    function filterDocuments() {
        const search = (searchInput?.value || '').trim().toLowerCase();
        const type = filterType?.value || '';
        const status = filterStatus?.value || '';

        tbody.querySelectorAll('tr[data-document-id]').forEach((row) => {
            const item = documents.find((documentRecord) => documentRecord.id === row.dataset.documentId);
            if (!item) return;
            const matchesSearch = !search ||
                String(item.matricule || '').toLowerCase().includes(search) ||
                String(item.numero || '').toLowerCase().includes(search);
            const matchesType = !type || item.type === type;
            const matchesStatus = !status || item.statut === status;
            row.hidden = !(matchesSearch && matchesType && matchesStatus);
        });
    }

    function addActionButton(container, item, action, label, className, svg) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn-action ${className}`;
        button.dataset.action = action;
        button.dataset.documentId = item.id;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
        container.appendChild(button);
    }

    function createDocumentRow(item) {
        const row = document.createElement('tr');
        row.dataset.documentId = item.id;
        const values = [
            item.matricule || '—',
            formatType(item.type),
            item.numero || '—',
            formatDate(item.dateEmission),
            formatDate(item.dateExpiration)
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
        if (item.pieceJointe?.url) {
            addActionButton(actions, item, 'attachment', 'Ouvrir la pièce jointe', 'btn-view',
                '<path d="M14 3h7v7M10 14 21 3"/><path d="M18 13v7H4V6h7"/>');
        }
        addActionButton(actions, item, 'edit', 'Modifier', 'btn-edit',
            '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>');
        addActionButton(actions, item, 'delete', 'Supprimer', 'btn-delete',
            '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>');
        row.appendChild(actions);
        return row;
    }

    function renderDetails(item) {
        const fields = [
            { label: 'Véhicule', value: item.matricule },
            { label: 'Marque / modèle', value: [item.marque, item.modele].filter(Boolean).join(' ') },
            { label: 'Propriétaire', value: item.proprietaire },
            { label: 'Type', value: formatType(item.type) },
            { label: 'Organisme émetteur', value: item.organisme },
            { label: 'Numéro', value: item.numero },
            { label: 'Date d’émission', value: formatDate(item.dateEmission) },
            { label: 'Date d’expiration', value: formatDate(item.dateExpiration) },
            { label: 'Pièce jointe', value: item.pieceJointe?.nom || 'Aucun fichier joint' },
            { label: 'Statut', value: item.statut }
        ];
        window.kapitransRecordDialog('Détails du document', fields);
    }

    function editDocument(item) {
        window.kapitransRecordDialog('Modifier le document', [
            {
                name: 'type',
                label: 'Type de document',
                value: item.type,
                required: true,
                options: [
                    { value: 'carte-grise', label: 'Carte grise' },
                    { value: 'assurance', label: 'Assurance' },
                    { value: 'visite-technique', label: 'Visite technique' },
                    { value: 'certificat-controle-technique', label: 'Certificat de contrôle technique' },
                    { value: 'attestation-assurance', label: "Attestation d'assurance" },
                    { value: 'autorisation-transport', label: 'Autorisation de transport' },
                    { value: 'permis', label: 'Permis de conduire' },
                    { value: 'vignette', label: 'Vignette' }
                ]
            },
            { name: 'organisme', label: 'Organisme émetteur', value: item.organisme },
            { name: 'numero', label: 'Numéro du document', value: item.numero, required: true },
            { name: 'dateEmission', label: 'Date d’émission', value: item.dateEmission, type: 'date', required: true },
            { name: 'dateExpiration', label: 'Date d’expiration', value: item.dateExpiration, type: 'date', required: Boolean(item.dateExpiration) }
        ], async function (values) {
            const expiration = values.dateExpiration ? new Date(`${values.dateExpiration}T23:59:59`) : null;
            const daysRemaining = expiration ? Math.ceil((expiration.getTime() - Date.now()) / 86400000) : Infinity;
            const statut = daysRemaining < 0 ? 'expire' : daysRemaining < 30 ? 'bientot' : 'valide';
            await updateDoc(doc(db, 'documents', item.id), {
                type: values.type,
                organisme: values.organisme.trim(),
                numero: values.numero.trim(),
                dateEmission: values.dateEmission,
                dateExpiration: values.dateExpiration,
                statut
            });
            await logAudit({
                actionType: 'update',
                action: 'Modification',
                entite: 'Document',
                details: `${values.type} ${values.numero.trim()} — véhicule ${item.matricule || '—'}`
            });
            await renderDocuments();
        });
    }

    async function renderDocuments() {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement...</td></tr>';
        try {
            const querySnapshot = await getDocs(collection(db, 'documents'));
            documents = querySnapshot.docs.map((documentSnapshot) => ({
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            }));
            updateCounters();
            tbody.replaceChildren();

            if (documents.length === 0) {
                const row = tbody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 7;
                cell.style.cssText = 'text-align: center; padding: 2rem; color: #94a3b8;';
                cell.textContent = 'Aucun document enregistré.';
                return;
            }

            documents.forEach((item) => tbody.appendChild(createDocumentRow(item)));
            filterDocuments();
        } catch (error) {
            console.error('Erreur Firebase lors du chargement des documents :', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement.</td></tr>';
        }
    }

    tbody.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const item = documents.find((documentRecord) => documentRecord.id === button.dataset.documentId);
        if (!item) return;

        if (button.dataset.action === 'view') {
            renderDetails(item);
        } else if (button.dataset.action === 'attachment' && item.pieceJointe?.url) {
            window.open(item.pieceJointe.url, '_blank', 'noopener,noreferrer');
        } else if (button.dataset.action === 'edit') {
            editDocument(item);
        } else if (button.dataset.action === 'delete') {
            if (!window.confirm(`Supprimer le document ${item.numero || ''} du véhicule ${item.matricule || ''} ?`)) return;
            button.disabled = true;
            try {
                await deleteDoc(doc(db, 'documents', item.id));
                await logAudit({
                    actionType: 'delete',
                    action: 'Suppression',
                    entite: 'Document',
                    details: `${item.type || 'Document'} ${item.numero || ''} — véhicule ${item.matricule || '—'}`
                });
                await renderDocuments();
            } catch (error) {
                console.error('Impossible de supprimer le document.', error);
                window.alert('La suppression a échoué. Vérifiez vos droits et réessayez.');
                button.disabled = false;
            }
        }
    });

    searchInput?.addEventListener('input', filterDocuments);
    filterType?.addEventListener('change', filterDocuments);
    filterStatus?.addEventListener('change', filterDocuments);
    renderDocuments();
});
