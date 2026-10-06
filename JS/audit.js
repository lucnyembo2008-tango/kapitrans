// ============================================================
// AUDIT — KAPITRANS
// ============================================================
// Ce fichier gère le journal d'audit.
// Il affiche les entrées + permet la recherche et le filtrage.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. RÉCUPÉRER LE TABLEAU
    // ============================================================

    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    tbody.replaceChildren();

    // ============================================================
    // 2. RÉCUPÉRER LES LOGS CRÉÉS
    // ============================================================

    function getStoredLogs() {
        const logs = JSON.parse(localStorage.getItem('kapitrans-audit') || '[]');
        if (!Array.isArray(logs)) throw new Error('Le journal d’audit doit contenir une liste.');
        return logs;
    }

    // ============================================================
    // 3. AJOUTER LES LOGS AU TABLEAU
    // ============================================================

    function renderStoredLogs() {
        const logs = getStoredLogs();
        const today = new Date().toLocaleDateString('fr-FR');
        const counts = {
            total: logs.length,
            today: logs.filter(function (log) { return String(log.date || '').startsWith(today); }).length,
            modifications: logs.filter(function (log) {
                return String(log.actionType || '').toLowerCase() === 'update';
            }).length,
            deletions: logs.filter(function (log) {
                return String(log.actionType || '').toLowerCase() === 'delete';
            }).length
        };
        document.querySelectorAll('[data-audit-stat]').forEach(function (counter) {
            counter.textContent = String(counts[counter.dataset.auditStat] || 0);
        });
        if (logs.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 6;
            cell.textContent = 'Aucune action enregistrée.';
            return;
        }

        logs.forEach(function (log) {
            const tr = document.createElement('tr');

            const date = document.createElement('td');
            date.className = 'audit-date';
            date.textContent = log.date || '';
            const user = document.createElement('td');
            const userName = document.createElement('strong');
            userName.textContent = log.utilisateur || '';
            user.appendChild(userName);
            const action = document.createElement('td');
            const actionLabel = document.createElement('span');
            actionLabel.className = `audit-action action-${String(log.actionType || '').replace(/[^a-z0-9_-]/gi, '')}`;
            actionLabel.textContent = log.action || '';
            action.appendChild(actionLabel);
            const entity = document.createElement('td');
            const entityLabel = document.createElement('span');
            entityLabel.className = 'audit-entity';
            entityLabel.textContent = log.entite || '';
            entity.appendChild(entityLabel);
            const details = document.createElement('td');
            details.textContent = log.details || '';
            const ip = document.createElement('td');
            ip.className = 'audit-ip';
            ip.textContent = log.ip || '—';
            tr.append(date, user, action, entity, details, ip);

            tbody.insertBefore(tr, tbody.firstChild);
        });
    }

    // ============================================================
    // 4. RECHERCHE ET FILTRES
    // ============================================================

    const searchInput = document.querySelector('.search-input');
    const filterUser = document.querySelectorAll('.filter-select')[0];
    const filterAction = document.querySelectorAll('.filter-select')[1];
    const filterEntity = document.querySelectorAll('.filter-select')[2];
    if (filterUser) {
        const logs = getStoredLogs();
        filterUser.querySelectorAll('option:not(:first-child)').forEach(option => option.remove());
        Array.from(new Set(logs.map(log => log.utilisateur).filter(Boolean))).forEach(function (userName) {
            const option = document.createElement('option');
            option.value = userName;
            option.textContent = userName;
            filterUser.appendChild(option);
        });
    }

    function filterAudit() {
        const search = (searchInput?.value || '').toLowerCase().trim();
        const user = filterUser?.value || '';
        const action = filterAction?.value || '';
        const entity = filterEntity?.value || '';

        const rows = tbody.querySelectorAll('tr');

        rows.forEach(function (row) {
            const cells = row.querySelectorAll('td');
            const date = (cells[0]?.textContent || '').toLowerCase();
            const userText = (cells[1]?.textContent || '').toLowerCase();
            const actionText = (cells[2]?.textContent || '').toLowerCase();
            const entityText = (cells[3]?.textContent || '').toLowerCase();
            const details = (cells[4]?.textContent || '').toLowerCase();

            const matchSearch = !search ||
                date.includes(search) ||
                userText.includes(search) ||
                actionText.includes(search) ||
                details.includes(search);

            const matchUser = !user || userText.includes(user.toLowerCase());
            const matchAction = !action || actionText.includes(action.toLowerCase());
            const matchEntity = !entity || entityText.includes(entity.toLowerCase());

            if (matchSearch && matchUser && matchAction && matchEntity) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterAudit);
    }
    if (filterUser) {
        filterUser.addEventListener('change', filterAudit);
    }
    if (filterAction) {
        filterAction.addEventListener('change', filterAudit);
    }
    if (filterEntity) {
        filterEntity.addEventListener('change', filterAudit);
    }

    // ============================================================
    // 5. INITIALISATION
    // ============================================================

    renderStoredLogs();

});

// ============================================================
// 6. FONCTION GLOBALE POUR AJOUTER UN LOG
// ============================================================

window.kapitransAudit = {

    add: function (utilisateur, action, actionType, entite, details, ip) {
        const logs = JSON.parse(localStorage.getItem('kapitrans-audit') || '[]');
        if (!Array.isArray(logs)) throw new Error('Le journal d’audit doit contenir une liste.');

        const now = new Date();
        const date = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');

        logs.push({
            date: date,
            utilisateur: utilisateur || 'Utilisateur',
            action: action,
            actionType: actionType,
            entite: entite,
            details: details,
            ip: ip || '—'
        });

        localStorage.setItem('kapitrans-audit', JSON.stringify(logs));
    }

};