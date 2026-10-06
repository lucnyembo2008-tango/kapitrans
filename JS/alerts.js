document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('.alerts-container');
    if (!container) return;

    const searchInput = document.querySelector('.search-input');
    const filterGravity = document.querySelectorAll('.filter-select')[0];
    const filterType = document.querySelectorAll('.filter-select')[1];
    const filterStatus = document.querySelectorAll('.filter-select')[2];
    const typeLabels = {
        controle: 'Contrôle routier',
        document: 'Document expiré',
        cession: 'Cession en attente',
        maintenance: 'Maintenance'
    };

    function readList(key) {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(value)) throw new Error(`${key} doit contenir une liste.`);
        return value;
    }

    function readStates() {
        const value = JSON.parse(localStorage.getItem('kapitrans-alert-states') || '{}');
        if (!value || Array.isArray(value) || typeof value !== 'object') {
            throw new Error('Les statuts des alertes doivent contenir un objet.');
        }
        return value;
    }

    function collectAlerts() {
        const alerts = readList('kapitrans-alerts').map(function (alert, index) {
            return {
                ...alert,
                id: alert.id || alert.pvId || `${alert.matricule || 'alerte'}-${alert.date || index}`,
                type: alert.type || 'controle',
                gravite: alert.gravite || 'critique'
            };
        });

        readList('kapitrans-documents').forEach(function (doc) {
            if (!doc.dateExpiration) return;
            const expiry = new Date(`${doc.dateExpiration}T23:59:59`);
            if (Number.isNaN(expiry.getTime())) return;
            const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
            if (days >= 30) return;
            alerts.push({
                id: `document-${doc.matricule || ''}-${doc.numero || doc.type || ''}-${doc.dateExpiration}`,
                matricule: doc.matricule || '',
                type: 'document',
                gravite: days < 0 ? 'critique' : 'moyenne',
                message: `${doc.type || 'Document'} ${days < 0 ? 'expiré' : 'expire bientôt'} (${doc.dateExpiration}).`,
                date: doc.dateCreation || doc.dateExpiration,
                statut: doc.statut
            });
        });

        readList('kapitrans-cessions').forEach(function (cession) {
            if (!['attente', 'en-attente', 'en attente'].includes(String(cession.statut || '').toLowerCase())) return;
            const ownerName = function (owner) {
                if (typeof owner === 'string') return owner;
                return [owner?.nom, owner?.prenom].filter(Boolean).join(' ') || '—';
            };
            alerts.push({
                id: `cession-${cession.matricule || ''}-${cession.dateCession || cession.date || ''}`,
                matricule: cession.matricule || '',
                type: 'cession',
                gravite: 'moyenne',
                entityType: 'cession',
                message: `Cession en attente de validation. Cédant : ${ownerName(cession.ancienProprietaire)} ; cessionnaire : ${ownerName(cession.nouveauProprietaire)}.`,
                date: cession.dateCreation || cession.date,
                dateCession: cession.dateCession || cession.date || '',
                statut: cession.statut
            });
        });
        return alerts;
    }

    function makeDetail(label, value) {
        const detail = document.createElement('div');
        detail.className = 'alert-detail';
        const name = document.createElement('span');
        name.className = 'alert-detail-label';
        name.textContent = label;
        const text = document.createElement('span');
        text.className = 'alert-detail-value';
        text.textContent = value || '—';
        detail.append(name, text);
        return detail;
    }

    function makeButton(action, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn-action btn-${action}`;
        button.dataset.alertAction = action;
        button.setAttribute('aria-label', label);
        button.title = label;
        const iconName = action === 'view' ? 'view' : action === 'map' ? 'map' :
            action === 'approve' || action === 'edit' ? 'success' :
                action === 'reject' || action === 'delete' ? 'delete' : 'warning';
        button.appendChild(window.kapitransIcon(iconName));
        return button;
    }

    function formatDate(value) {
        if (!value) return 'Date inconnue';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('fr-FR');
    }

    function renderAlerts() {
        const alerts = collectAlerts();
        const states = readStates();
        container.replaceChildren();

        alerts.slice().reverse().forEach(function (alert) {
            const status = states[alert.id] || 'nouvelle';
            if (status === 'ignoree') return;
            const gravity = ['critique', 'critical'].includes(String(alert.gravite).toLowerCase())
                ? 'critical'
                : ['faible', 'low'].includes(String(alert.gravite).toLowerCase()) ? 'info' : 'warning';
            const card = document.createElement('article');
            card.className = `alert-card alert-card-${gravity}`;
            card.dataset.alertId = alert.id;
            card.dataset.alertStatus = status;
            card.dataset.alertType = alert.type;
            card.dataset.entityType = alert.entityType || '';
            card.dataset.dateCession = alert.dateCession || '';
            card.dataset.matricule = alert.matricule || '';

            const header = document.createElement('div');
            header.className = 'alert-card-header';
            const badges = document.createElement('div');
            badges.className = 'alert-card-badges';
            const gravityBadge = document.createElement('span');
            gravityBadge.className = `alert-gravity gravity-${gravity}`;
            gravityBadge.textContent = gravity === 'critical' ? 'CRITIQUE' : gravity === 'warning' ? 'MOYENNE' : 'FAIBLE';
            const typeBadge = document.createElement('span');
            typeBadge.className = 'alert-type';
            typeBadge.textContent = typeLabels[alert.type] || alert.type || 'Alerte';
            badges.append(gravityBadge, typeBadge);
            if (status === 'resolue') {
                const resolvedBadge = document.createElement('span');
                resolvedBadge.className = 'alert-state-badge';
                resolvedBadge.textContent = 'Résolue';
                badges.appendChild(resolvedBadge);
                card.classList.add('alert-card-resolved');
            }
            const date = document.createElement('span');
            date.className = 'alert-date';
            date.textContent = formatDate(alert.date || alert.dateCreation);
            header.append(badges, date);

            const body = document.createElement('div');
            body.className = 'alert-card-body';
            const title = document.createElement('h3');
            title.className = 'alert-card-title';
            title.textContent = alert.titre || (alert.entityType === 'cession'
                ? `Cession en attente : ${alert.matricule}`
                : alert.matricule ? `Véhicule signalé : ${alert.matricule}` : 'Alerte');
            const message = document.createElement('p');
            message.className = 'alert-card-message';
            message.textContent = alert.message || 'Aucun détail fourni.';
            const details = document.createElement('div');
            details.className = 'alert-card-details';
            if (alert.matricule) details.appendChild(makeDetail('Matricule', alert.matricule));
            if (alert.marque) details.appendChild(makeDetail('Véhicule', alert.marque));
            if (alert.proprietaire) details.appendChild(makeDetail('Propriétaire', alert.proprietaire));
            if (alert.agent) details.appendChild(makeDetail('Agent', alert.agent));
            if (alert.zone) details.appendChild(makeDetail('Zone', alert.zone));
            if (alert.motif) details.appendChild(makeDetail('Motif', alert.motif));
            body.append(title, message, details);

            const actions = document.createElement('div');
            actions.className = 'alert-card-actions';
            actions.appendChild(makeButton('view', 'Voir'));
            if (alert.matricule) actions.appendChild(makeButton('map', 'Localiser sur la carte'));
            if (alert.entityType === 'cession') {
                actions.append(makeButton('approve', 'Valider'), makeButton('reject', 'Refuser'));
            } else {
                actions.append(makeButton('edit', 'Marquer résolue'), makeButton('delete', 'Ignorer'));
            }
            if (status === 'resolue') {
                actions.querySelectorAll('button').forEach(function (button) {
                    button.disabled = !['view', 'map'].includes(button.dataset.alertAction);
                });
            }
            card.append(header, body, actions);
            container.appendChild(card);
        });

        if (!container.querySelector('.alert-card')) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'Aucune alerte enregistrée.';
            container.appendChild(empty);
        }
        updateCounts(alerts, states);
        filterAlerts();
    }

    function updateCounts(alerts, states) {
        const visible = alerts.filter(function (alert) { return states[alert.id] !== 'ignoree'; });
        const active = alerts.filter(function (alert) { return states[alert.id] !== 'resolue' && states[alert.id] !== 'ignoree'; });
        const counts = [
            visible.length,
            active.filter(function (alert) { return ['critique', 'critical'].includes(String(alert.gravite).toLowerCase()); }).length,
            active.filter(function (alert) { return !['critique', 'critical', 'faible', 'low'].includes(String(alert.gravite).toLowerCase()); }).length,
            visible.filter(function (alert) { return states[alert.id] === 'resolue'; }).length
        ];
        document.querySelectorAll('.stat-card .stat-number').forEach(function (element, index) {
            if (index < counts.length) element.textContent = String(counts[index]);
        });
    }

    function filterAlerts() {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const gravity = filterGravity?.value || '';
        const type = filterType?.value || '';
        const status = filterStatus?.value || '';
        container.querySelectorAll('.alert-card').forEach(function (card) {
            const gravityMatches = !gravity ||
                (gravity === 'critique' && card.classList.contains('alert-card-critical')) ||
                (gravity === 'moyenne' && card.classList.contains('alert-card-warning')) ||
                (gravity === 'faible' && card.classList.contains('alert-card-info'));
            const typeMatches = !type || card.dataset.alertType === type;
            const searchMatches = !query || card.textContent.toLowerCase().includes(query);
            const statusMatches = !status || card.dataset.alertStatus === status;
            card.hidden = !(gravityMatches && typeMatches && searchMatches && statusMatches);
        });
    }

    [searchInput, filterGravity, filterType, filterStatus].forEach(function (control) {
        if (control) control.addEventListener(control === searchInput ? 'input' : 'change', filterAlerts);
    });

    container.addEventListener('click', function (event) {
        const button = event.target.closest('[data-alert-action]');
        if (!button) return;
        const card = button.closest('.alert-card');
        const id = card.dataset.alertId;
        const states = readStates();
        if (button.dataset.alertAction === 'view') {
            const fields = [
                { label: 'Alerte', value: card.querySelector('.alert-card-title').textContent },
                { label: 'Type', value: card.querySelector('.alert-type').textContent },
                { label: 'Gravité', value: card.querySelector('.alert-gravity').textContent },
                { label: 'Détail', value: card.querySelector('.alert-card-message').textContent }
            ];
            window.kapitransRecordDialog('Détails de l’alerte', fields);
            return;
        }
        if (button.dataset.alertAction === 'map') {
            const matricule = card.dataset.matricule;
            if (matricule) window.location.href = 'admin-map.html?matricule=' + encodeURIComponent(matricule);
            return;
        }
        if (card.dataset.entityType === 'cession' && ['approve', 'reject'].includes(button.dataset.alertAction)) {
            const decision = button.dataset.alertAction === 'approve' ? 'validee' : 'refusee';
            if (!window.confirm(`Confirmer la décision de ${decision === 'validee' ? 'valider' : 'refuser'} la cession ?`)) return;
            const cessions = readList('kapitrans-cessions');
            const cession = cessions.find(function (entry) {
                return entry.matricule === card.dataset.matricule
                    && (entry.dateCession || entry.date || '') === card.dataset.dateCession;
            });
            if (!cession) {
                console.error('Cession liée à l’alerte introuvable.', id);
                return;
            }
            cession.statut = decision;
            localStorage.setItem('kapitrans-cessions', JSON.stringify(cessions));
            states[id] = 'resolue';
        } else if (button.dataset.alertAction === 'edit') states[id] = 'resolue';
        else states[id] = 'ignoree';
        localStorage.setItem('kapitrans-alert-states', JSON.stringify(states));
        renderAlerts();
    });

    try {
        renderAlerts();
    } catch (error) {
        console.error('Impossible de charger les alertes.', error);
        container.textContent = 'Impossible de charger les alertes depuis le stockage local.';
    }
});
