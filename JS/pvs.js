import { db } from './firebase.js';
import { logAudit } from './audit-log.js';
import { collection, deleteDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    const tbody = document.getElementById('pvs-table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('pv-search');
    const statusFilter = document.getElementById('pv-status-filter');
    const refreshButton = document.getElementById('refresh-pvs');
    const statElements = {
        total: document.querySelector('[data-pv-stat="total"]'),
        today: document.querySelector('[data-pv-stat="today"]'),
        amount: document.querySelector('[data-pv-stat="amount"]'),
        agents: document.querySelector('[data-pv-stat="agents"]')
    };
    let pvs = [];
    let vehiclesByMatricule = new Map();

    function normalizeMatricule(value) {
        return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    }

    function getDateValue(pv) {
        return pv.dateInfraction || pv.dateCreation || '';
    }

    function getDateKey(value) {
        if (!value) return '';
        if (typeof value === 'string') return value.slice(0, 10);
        if (value.toDate) return value.toDate().toISOString().slice(0, 10);
        return '';
    }

    function formatDate(value) {
        const dateKey = getDateKey(value);
        if (!dateKey) return '—';
        const date = new Date(`${dateKey}T00:00:00`);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
    }

    function formatAmount(value) {
        const amount = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
        return Number.isFinite(amount)
            ? `${new Intl.NumberFormat('fr-FR').format(amount)} FC`
            : '—';
    }

    function getVehicleName(pv) {
        if (pv.vehicule || pv.marqueModele) return pv.vehicule || pv.marqueModele;
        const vehicle = vehiclesByMatricule.get(normalizeMatricule(pv.matricule));
        return vehicle ? [vehicle.marque, vehicle.modele].filter(Boolean).join(' ') || '—' : '—';
    }

    function getPvNumber(pv) {
        if (pv.numeroPv || pv.numero) return pv.numeroPv || pv.numero;
        const dateKey = getDateKey(pv.dateCreation) || 'PV';
        const year = dateKey.slice(0, 4);
        return `PV-${year}-${String(pv.id || '').slice(0, 6).toUpperCase() || '—'}`;
    }

    function createCell(value, strong = false) {
        const cell = document.createElement('td');
        if (strong) {
            const text = document.createElement('strong');
            text.textContent = value;
            cell.appendChild(text);
        } else {
            cell.textContent = value;
        }
        return cell;
    }

    function showDetails(pv) {
        const dialog = document.createElement('dialog');
        dialog.className = 'user-dialog';
        const header = document.createElement('div');
        header.className = 'user-dialog-header';
        const title = document.createElement('h2');
        title.textContent = `Procès-verbal ${getPvNumber(pv)}`;
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'user-dialog-close';
        close.setAttribute('aria-label', 'Fermer');
        close.textContent = '×';
        close.addEventListener('click', () => dialog.close());
        header.append(title, close);

        const details = document.createElement('dl');
        details.className = 'user-details';
        const fields = [
            ['Date du PV', formatDate(getDateValue(pv))],
            ['Matricule', pv.matricule || '—'],
            ['Véhicule', getVehicleName(pv)],
            ['Motif', pv.motif || '—'],
            ['Montant', formatAmount(pv.montant)],
            ['Agent', pv.agent || '—'],
            ['Zone', pv.zone || '—'],
            ['Observations', pv.observations || '—'],
            ['Statut', pv.statut || 'verbalisé']
        ];
        fields.forEach(([label, value]) => {
            const item = document.createElement('div');
            const term = document.createElement('dt');
            term.textContent = label;
            const description = document.createElement('dd');
            description.textContent = String(value);
            item.append(term, description);
            details.appendChild(item);
        });
        dialog.append(header, details);
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        document.body.appendChild(dialog);
        dialog.showModal();
    }

    function updateStats() {
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todayPvs = pvs.filter((pv) => getDateKey(getDateValue(pv)) === todayKey);
        const totalAmount = pvs.reduce((sum, pv) => {
            const amount = Number(String(pv.montant ?? '').replace(/[^\d.-]/g, ''));
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);
        const agents = new Set(pvs.map((pv) => String(pv.agent || '').trim()).filter(Boolean));

        if (statElements.total) statElements.total.textContent = String(pvs.length);
        if (statElements.today) statElements.today.textContent = String(todayPvs.length);
        if (statElements.amount) statElements.amount.textContent = formatAmount(totalAmount);
        if (statElements.agents) statElements.agents.textContent = String(agents.size);
    }

    function renderRows() {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const status = statusFilter?.value || '';
        const filteredPvs = pvs.filter((pv) => {
            const searchable = [
                pv.matricule,
                getPvNumber(pv),
                getVehicleName(pv),
                pv.motif,
                pv.agent,
                pv.zone
            ].join(' ').toLowerCase();
            return (!query || searchable.includes(query)) && (!status || String(pv.statut || 'verbalise').toLowerCase() === status);
        });

        tbody.replaceChildren();
        if (!filteredPvs.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 8;
            cell.className = 'table-empty';
            cell.textContent = pvs.length ? 'Aucun PV ne correspond à la recherche.' : 'Aucun PV enregistré.';
            return;
        }

        filteredPvs.forEach((pv) => {
            const row = document.createElement('tr');
            row.append(
                createCell(formatDate(getDateValue(pv))),
                createCell(getPvNumber(pv)),
                createCell(pv.matricule || '—', true),
                createCell(getVehicleName(pv)),
                createCell(pv.motif || '—'),
                createCell(formatAmount(pv.montant)),
                createCell(pv.agent || '—')
            );

            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-cell';
            const detailsButton = document.createElement('button');
            detailsButton.type = 'button';
            detailsButton.className = 'btn-secondary';
            detailsButton.textContent = 'Voir';
            detailsButton.addEventListener('click', () => showDetails(pv));
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'btn-action btn-delete';
            deleteButton.title = 'Supprimer le procès-verbal';
            deleteButton.setAttribute('aria-label', `Supprimer le PV ${getPvNumber(pv)}`);
            deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>';
            deleteButton.addEventListener('click', async () => {
                if (!window.confirm(`Supprimer définitivement le PV ${getPvNumber(pv)} ?`)) return;
                deleteButton.disabled = true;
                try {
                    await deleteDoc(doc(db, 'pvs', pv.id));
                    await logAudit({
                        actionType: 'delete',
                        action: 'Suppression',
                        entite: 'Procès-verbal',
                        details: `${getPvNumber(pv)} — ${pv.matricule || '—'}`
                    });
                    pvs = pvs.filter((entry) => entry.id !== pv.id);
                    updateStats();
                    renderRows();
                } catch (error) {
                    console.error('Impossible de supprimer le procès-verbal.', error);
                    window.alert('La suppression du PV a échoué. Vérifiez vos droits et réessayez.');
                    deleteButton.disabled = false;
                }
            });
            actionsCell.append(detailsButton, deleteButton);
            row.appendChild(actionsCell);
            tbody.appendChild(row);
        });
    }

    async function renderPvs() {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #94a3b8;">Chargement...</td></tr>';
        try {
            const [pvSnapshot, vehicleSnapshot] = await Promise.all([
                getDocs(collection(db, 'pvs')),
                getDocs(collection(db, 'vehicles')).catch(() => null)
            ]);
            pvs = pvSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
            vehiclesByMatricule = new Map((vehicleSnapshot?.docs || []).map((snapshot) => {
                const vehicle = snapshot.data();
                return [normalizeMatricule(vehicle.matricule), vehicle];
            }));
            updateStats();
            renderRows();
        } catch (error) {
            console.error('Erreur lors du chargement des procès-verbaux.', error);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #fca5a5;">Erreur de chargement des procès-verbaux.</td></tr>';
        }
    }

    searchInput?.addEventListener('input', renderRows);
    statusFilter?.addEventListener('change', renderRows);
    refreshButton?.addEventListener('click', renderPvs);
    renderPvs();
});