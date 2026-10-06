// ============================================================
// NOTIFICATIONS — KAPITRANS
// ============================================================
// Ce fichier crée le bouton de notification dans le header.
// Il affiche un panneau avec les dernières alertes.
// ============================================================

window.kapitransIcon = function (name) {
    const drawings = {
        view: [
            { tag: 'path', attrs: { d: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z' } },
            { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } }
        ],
        edit: [
            { tag: 'path', attrs: { d: 'M12 20h9' } },
            { tag: 'path', attrs: { d: 'M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z' } }
        ],
        delete: [
            { tag: 'path', attrs: { d: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14' } },
            { tag: 'path', attrs: { d: 'M10 11v6M14 11v6' } }
        ],
        map: [
            { tag: 'path', attrs: { d: 'm3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Zm6-2v14m6-12v14' } }
        ],
        search: [
            { tag: 'circle', attrs: { cx: '11', cy: '11', r: '6' } },
            { tag: 'path', attrs: { d: 'm16 16 4 4' } }
        ],
        car: [
            { tag: 'path', attrs: { d: 'M5 15.5 7 7h10l2 8.5M6.5 15.5h11M9 19h6M8 11h8M10 7V4.5h4V7' } }
        ],
        zoom: [
            { tag: 'circle', attrs: { cx: '10.5', cy: '10.5', r: '6.5' } },
            { tag: 'path', attrs: { d: 'm15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6' } }
        ],
        location: [
            { tag: 'path', attrs: { d: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z' } },
            { tag: 'circle', attrs: { cx: '12', cy: '10', r: '2.5' } }
        ],
        globe: [
            { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9' } },
            { tag: 'path', attrs: { d: 'M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18' } }
        ],
        success: [
            { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9' } },
            { tag: 'path', attrs: { d: 'm8 12 2.5 2.5L16 9' } }
        ],
        error: [
            { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9' } },
            { tag: 'path', attrs: { d: 'M12 8v5M12 16h.01' } }
        ],
        warning: [
            { tag: 'path', attrs: { d: 'M12 3 22 20H2L12 3Z' } },
            { tag: 'path', attrs: { d: 'M12 9v5M12 17h.01' } }
        ]
    };

    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.classList.add('kapitrans-svg-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    (drawings[name] || drawings.error).forEach(function (shape) {
        const element = document.createElementNS(svgNamespace, shape.tag);
        Object.entries(shape.attrs).forEach(function ([attribute, value]) {
            element.setAttribute(attribute, value);
        });
        svg.appendChild(element);
    });

    return svg;
};

window.kapitransRecordDialog = function (title, fields, onSave) {
    const currentDialog = document.querySelector('.kapitrans-record-dialog');
    if (currentDialog) currentDialog.close();

    const dialog = document.createElement('dialog');
    dialog.className = 'kapitrans-record-dialog';

    const header = document.createElement('div');
    header.className = 'record-dialog-header';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'record-dialog-close';
    closeButton.textContent = 'Fermer';
    closeButton.addEventListener('click', function () {
        dialog.close();
    });
    header.append(heading, closeButton);
    dialog.appendChild(header);

    if (typeof onSave === 'function') {
        const form = document.createElement('form');
        form.className = 'record-dialog-form';

        fields.forEach(function (field) {
            const label = document.createElement('label');
            label.textContent = field.label;
            let control;

            if (field.options) {
                control = document.createElement('select');
                field.options.forEach(function (optionData) {
                    const option = document.createElement('option');
                    option.value = optionData.value;
                    option.textContent = optionData.label;
                    control.appendChild(option);
                });
            } else if (field.type === 'textarea') {
                control = document.createElement('textarea');
            } else {
                control = document.createElement('input');
                control.type = field.type || 'text';
                if (field.step) control.step = field.step;
            }

            control.name = field.name;
            control.value = field.value == null ? '' : String(field.value);
            control.required = Boolean(field.required);
            label.appendChild(control);
            form.appendChild(label);
        });

        const actions = document.createElement('div');
        actions.className = 'record-dialog-actions';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'btn-secondary';
        cancelButton.textContent = 'Annuler';
        cancelButton.addEventListener('click', function () {
            dialog.close();
        });
        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.className = 'btn-primary';
        saveButton.textContent = 'Enregistrer';
        actions.append(cancelButton, saveButton);
        form.appendChild(actions);

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            saveButton.disabled = true;
            try {
                const result = await onSave(Object.fromEntries(new FormData(form).entries()));
                if (result !== false) dialog.close();
            } catch (error) {
                console.error('Impossible d’enregistrer les modifications.', error);
                window.kapitransToast('Impossible d’enregistrer les modifications.', 'error');
            } finally {
                if (dialog.open) saveButton.disabled = false;
            }
        });

        dialog.appendChild(form);
    } else {
        const details = document.createElement('dl');
        details.className = 'record-dialog-details';
        fields.forEach(function (field) {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const value = document.createElement('dd');
            term.textContent = field.label;
            value.textContent = field.value == null || field.value === '' ? '—' : String(field.value);
            row.append(term, value);
            details.appendChild(row);
        });
        dialog.appendChild(details);
    }

    dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', function () {
        dialog.remove();
    }, { once: true });

    document.body.appendChild(dialog);
    dialog.showModal();
    return dialog;
};

window.kapitransToast = function (message, type, iconName) {
    document.querySelector('.kapitrans-toast')?.remove();
    const toastType = ['success', 'error', 'warning'].includes(type) ? type : 'info';
    const toast = document.createElement('div');
    toast.className = `kapitrans-toast kapitrans-toast-${toastType}`;
    toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', toastType === 'error' ? 'assertive' : 'polite');
    const icon = window.kapitransIcon(iconName || (toastType === 'success' ? 'success' : toastType === 'error' ? 'error' : 'warning'));
    const text = document.createElement('span');
    text.textContent = message;
    toast.append(icon, text);
    document.body.appendChild(toast);
    window.setTimeout(function () { toast.classList.add('show'); }, 10);
    window.setTimeout(function () {
        toast.classList.remove('show');
        window.setTimeout(function () { toast.remove(); }, 250);
    }, 3200);
    return toast;
};

document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // 1. VÉRIFIER QUE L'UTILISATEUR EST CONNECTÉ
    // ============================================================

    const user = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');

    // Si pas connecté, on ne fait rien
    if (!user) return;

    // ============================================================
    // 2. RÉCUPÉRER LE CONTENEUR ADMIN
    // ============================================================

    const adminInfo = document.querySelector('.admin-info');
    const notificationHost = adminInfo || document.querySelector('.panel-topbar');
    if (!notificationHost) return;

    // ============================================================
    // 3. CRÉER LE BOUTON DE NOTIFICATION
    // ============================================================

    const notifBtn = document.createElement('button');
    notifBtn.id = 'notification-btn';
    notifBtn.className = 'btn-notification';
    notifBtn.type = 'button';
    notifBtn.setAttribute('aria-label', 'Notifications');
    notifBtn.setAttribute('aria-controls', 'notification-panel');
    notifBtn.setAttribute('aria-expanded', 'false');
    notifBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
        <span class="notification-badge" id="notification-count">0</span>
    `;

    // L'insérer AVANT le premier élément
    if (adminInfo) {
        adminInfo.insertBefore(notifBtn, adminInfo.firstChild);
    } else {
        const backLink = notificationHost.querySelector('.back-link');
        notificationHost.insertBefore(notifBtn, backLink);
    }

    // ============================================================
    // 4. CRÉER LE PANNEAU DE NOTIFICATIONS
    // ============================================================

    const notifPanel = document.createElement('div');
    notifPanel.id = 'notification-panel';
    notifPanel.className = 'notification-panel';
    notifPanel.setAttribute('role', 'dialog');
    notifPanel.setAttribute('aria-label', 'Notifications');
    notifPanel.setAttribute('aria-hidden', 'true');
    notifPanel.innerHTML = `
        <div class="notification-panel-header">
            <h3><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>Notifications</h3>
            <button id="notification-close" class="notification-close" type="button" aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        </div>

        <div class="notification-list"></div>

        <div class="notification-panel-footer">
            <a href="admin-alerts.html" class="notification-view-all">
                Voir toutes les alertes →
            </a>
        </div>
    `;

    // L'ajouter au body
    document.body.appendChild(notifPanel);
    const notificationList = notifPanel.querySelector('.notification-list');
    const notificationCount = notifBtn.querySelector('.notification-badge');
    try {
        const alerts = JSON.parse(localStorage.getItem('kapitrans-alerts') || '[]');
        const documents = JSON.parse(localStorage.getItem('kapitrans-documents') || '[]');
        const cessions = JSON.parse(localStorage.getItem('kapitrans-cessions') || '[]');
        const states = JSON.parse(localStorage.getItem('kapitrans-alert-states') || '{}');
        if (!Array.isArray(alerts) || !Array.isArray(documents) || !Array.isArray(cessions) ||
            !states || Array.isArray(states) || typeof states !== 'object') {
            throw new Error('Le stockage des alertes est invalide.');
        }
        const allAlerts = alerts.map(function (alert, index) {
            const id = alert.id || alert.pvId || `${alert.matricule || 'alerte'}-${alert.date || index}`;
            return { ...alert, id: id };
        });
        documents.forEach(function (documentRecord) {
            if (!documentRecord.dateExpiration) return;
            const expiry = new Date(`${documentRecord.dateExpiration}T23:59:59`);
            if (Number.isNaN(expiry.getTime()) || (expiry.getTime() - Date.now()) / 86400000 >= 30) return;
            allAlerts.push({
                id: `document-${documentRecord.matricule || ''}-${documentRecord.numero || documentRecord.type || ''}-${documentRecord.dateExpiration}`,
                matricule: documentRecord.matricule,
                gravite: (expiry.getTime() - Date.now()) < 0 ? 'critique' : 'moyenne',
                message: `${documentRecord.type || 'Document'} à régulariser (${documentRecord.dateExpiration}).`,
                date: documentRecord.dateCreation || documentRecord.dateExpiration
            });
        });
        cessions.forEach(function (cession) {
            if (!['attente', 'en-attente', 'en attente'].includes(String(cession.statut || '').toLowerCase())) return;
            allAlerts.push({
                id: `cession-${cession.matricule || ''}-${cession.dateCession || cession.date || ''}`,
                matricule: cession.matricule,
                gravite: 'moyenne',
                message: 'Cession en attente de validation.',
                date: cession.dateCreation || cession.dateCession || cession.date
            });
        });
        const activeAlerts = allAlerts.filter(function (alert) {
            return states[alert.id] !== 'resolue' && states[alert.id] !== 'ignoree';
        });
        notificationCount.textContent = String(activeAlerts.length);
        activeAlerts.slice().reverse().slice(0, 5).forEach(function (alert) {
            const item = document.createElement('a');
            item.href = 'admin-alerts.html';
            item.className = `notification-item ${
                alert.gravite === 'critique' ? 'notification-critical' :
                    alert.gravite === 'moyenne' ? 'notification-warning' : 'notification-info'
            }`;
            const icon = document.createElement('div');
            icon.className = 'notification-icon';
            icon.appendChild(window.kapitransIcon(alert.gravite === 'critique' ? 'error' : 'warning'));
            const content = document.createElement('div');
            content.className = 'notification-content';
            const title = document.createElement('strong');
            title.textContent = alert.titre || (alert.matricule ? `Véhicule signalé : ${alert.matricule}` : 'Alerte');
            const description = document.createElement('p');
            description.textContent = alert.message || 'Aucun détail fourni.';
            const time = document.createElement('span');
            time.className = 'notification-time';
            time.textContent = alert.date ? new Date(alert.date).toLocaleString('fr-FR') : '';
            content.append(title, description, time);
            item.append(icon, content);
            notificationList.appendChild(item);
        });
        if (activeAlerts.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'notification-empty';
            empty.textContent = 'Aucune nouvelle notification.';
            notificationList.appendChild(empty);
        }
    } catch (error) {
        console.error('Impossible de charger les notifications.', error);
        notificationCount.textContent = '!';
        notificationList.textContent = 'Impossible de lire les notifications enregistrées.';
    }

    // ============================================================
    // 5. GÉRER LES CLICS
    // ============================================================

    // Ouvrir/Fermer le panneau
    function setPanelOpen(isOpen) {
        notifPanel.classList.toggle('open', isOpen);
        notifBtn.setAttribute('aria-expanded', String(isOpen));
        notifPanel.setAttribute('aria-hidden', String(!isOpen));
    }

    notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setPanelOpen(!notifPanel.classList.contains('open'));
    });

    // Fermer avec le bouton ✕
    const closeBtn = document.getElementById('notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            setPanelOpen(false);
        });
    }

    // Fermer en cliquant ailleurs
    document.addEventListener('click', function (e) {
        if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
            setPanelOpen(false);
        }
    });

});