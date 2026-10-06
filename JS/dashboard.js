document.addEventListener('DOMContentLoaded', function () {
    const formatNumber = new Intl.NumberFormat('fr-FR');

    function readStorage(key, fallback) {
        const raw = localStorage.getItem(key);
        const value = JSON.parse(raw === null ? JSON.stringify(fallback) : raw);
        if (Array.isArray(fallback) && !Array.isArray(value)) {
            throw new Error(`${key} doit contenir une liste.`);
        }
        if (!Array.isArray(fallback) && (!value || Array.isArray(value) || typeof value !== 'object')) {
            throw new Error(`${key} doit contenir un objet.`);
        }
        return value;
    }

    function animateCounter(counter, target) {
        const prefix = counter.dataset.prefix || '';
        const suffix = counter.dataset.suffix || '';
        const duration = 1200;
        const start = performance.now();

        function update(currentTime) {
            const progress = Math.min((currentTime - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = `${prefix}${formatNumber.format(Math.round(target * eased))}${suffix}`;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function updateActivityChart(records) {
        const line = document.querySelector('.register-chart-line');
        const fill = document.querySelector('.register-chart-fill');
        const labels = document.querySelector('.chart-labels');
        const periodSelect = document.getElementById('register-activity-period');
        const chart = document.querySelector('.register-chart');
        if (!line || !fill || !labels || !periodSelect || !chart) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const period = periodSelect.value;
        let buckets;

        if (period === 'month') {
            const start = new Date(today);
            start.setDate(start.getDate() - 29);
            buckets = Array.from({ length: 5 }, function (_, index) {
                const from = new Date(start);
                from.setDate(start.getDate() + index * 6);
                const to = new Date(from);
                to.setDate(from.getDate() + 6);
                return {
                    from: from,
                    to: to,
                    label: `${from.getDate()}–${new Date(to.getTime() - 1).toLocaleDateString('fr-FR', { month: 'short' })}`
                };
            });
        } else if (period === 'year') {
            const firstMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
            buckets = Array.from({ length: 12 }, function (_, index) {
                const from = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
                const to = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index + 1, 1);
                return {
                    from: from,
                    to: to,
                    label: from.toLocaleDateString('fr-FR', { month: 'short' })
                };
            });
        } else {
            const firstDay = new Date(today);
            firstDay.setDate(firstDay.getDate() - 6);
            buckets = Array.from({ length: 7 }, function (_, index) {
                const from = new Date(firstDay);
                from.setDate(firstDay.getDate() + index);
                const to = new Date(from);
                to.setDate(from.getDate() + 1);
                return {
                    from: from,
                    to: to,
                    label: from.toLocaleDateString('fr-FR', { weekday: 'short' })
                };
            });
        }

        const counts = buckets.map(function (bucket) {
            return records.reduce(function (total, record) {
                const rawDate = record.dateCreation || record.date || record.createdAt;
                const date = rawDate ? new Date(rawDate) : null;
                return total + (date && !Number.isNaN(date.getTime()) &&
                    date >= bucket.from && date < bucket.to ? 1 : 0);
            }, 0);
        });
        const max = Math.max(...counts, 1);
        const points = counts.map(function (count, index) {
            const x = index * 600 / (counts.length - 1);
            const y = count ? 220 - (count / max) * 190 : 220;
            return `${Math.round(x)} ${Math.round(y)}`;
        });
        const path = points.map(function (point, index) { return `${index ? 'L' : 'M'}${point}`; }).join(' ');
        line.setAttribute('d', path);
        fill.setAttribute('d', `${path} L600 240 L0 240 Z`);
        const total = counts.reduce(function (sum, count) { return sum + count; }, 0);
        chart.setAttribute('aria-label',
            `Activité du registre sur ${periodSelect.selectedOptions[0].textContent.toLowerCase()} : ${total} enregistrements`);
        labels.replaceChildren();
        buckets.forEach(function (bucket, index) {
            const label = document.createElement('span');
            label.textContent = bucket.label;
            label.title = `${bucket.label} : ${counts[index]} activité${counts[index] > 1 ? 's' : ''}`;
            labels.appendChild(label);
        });
    }

    function updateStats(animate) {
        try {
            const users = readStorage('kapitrans-users', {});
            const vehicles = readStorage('kapitrans-vehicles', {});
            const documents = readStorage('kapitrans-documents', []);
            const cessions = readStorage('kapitrans-cessions', []);
            const alerts = readStorage('kapitrans-alerts', []);
            const history = readStorage('kapitrans-history', []);
            const pvs = readStorage('kapitrans-pvs', []);
            const alertStates = readStorage('kapitrans-alert-states', {});
            const userStatuses = readStorage('kapitrans-user-statuses', {});
            const userOverrides = readStorage('kapitrans-user-overrides', {});
            const userEntries = Object.entries(users).map(function ([email, user]) {
                const override = userOverrides[email] || {};
                return {
                    ...user,
                    ...override,
                    statut: userStatuses[email] || override.statut || user.statut || 'Actif'
                };
            });
            const vehicleEntries = Object.values(vehicles);
            const activeAgents = userEntries.filter(function (user) {
                return user.role === 'AGENT' && String(user.statut).toLowerCase() !== 'inactif';
            }).length;
            const roleCount = new Set(['ADMIN'].concat(userEntries.map(function (user) { return user.role; }).filter(Boolean))).size;
            const allAlerts = alerts.map(function (alert, index) {
                const id = alert.id || alert.pvId || `${alert.matricule || 'alerte'}-${alert.date || index}`;
                return { id: id, gravite: alert.gravite };
            });
            const generatedAlerts = [];
            documents.forEach(function (documentRecord) {
                if (!documentRecord.dateExpiration) return;
                const expiration = new Date(`${documentRecord.dateExpiration}T23:59:59`);
                if (Number.isNaN(expiration.getTime()) || (expiration.getTime() - Date.now()) / 86400000 >= 30) return;
                generatedAlerts.push({
                    id: `document-${documentRecord.matricule || ''}-${documentRecord.numero || documentRecord.type || ''}-${documentRecord.dateExpiration}`
                });
            });
            cessions.forEach(function (cession) {
                if (['attente', 'en-attente', 'en attente'].includes(String(cession.statut || '').toLowerCase())) {
                    generatedAlerts.push({ id: `cession-${cession.matricule || ''}-${cession.dateCession || cession.date || ''}` });
                }
            });
            const activeAlerts = [].concat(allAlerts, generatedAlerts).filter(function (alert) {
                return alertStates[alert.id] !== 'resolue' && alertStates[alert.id] !== 'ignoree';
            }).length;

            const values = {
                vehicles: vehicleEntries.length,
                agents: activeAgents,
                roles: roleCount,
                alerts: activeAlerts
            };
            document.querySelectorAll('.count-up[data-stat]').forEach(function (counter) {
                const target = values[counter.dataset.stat] || 0;
                counter.dataset.target = String(target);
                if (animate) animateCounter(counter, target);
                else counter.textContent = formatNumber.format(target);
            });

            const statusCounts = {
                conforme: 0,
                surveiller: 0,
                'non-conforme': 0
            };
            vehicleEntries.forEach(function (vehicle) {
                const matricule = String(vehicle.matricule || '').toUpperCase();
                const relatedStatuses = documents
                    .filter(function (documentRecord) {
                        return String(documentRecord.matricule || '').toUpperCase() === matricule;
                    })
                    .map(getDocumentStatus);
                const embeddedStatuses = Object.values(vehicle.documents || {})
                    .filter(documentRecord => documentRecord && (documentRecord.numero || documentRecord.expiration || documentRecord.dateExpiration))
                    .map(getDocumentStatus);
                const statuses = [vehicle.statut || 'conforme', ...relatedStatuses, ...embeddedStatuses];
                const status = statuses.includes('non-conforme') ? 'non-conforme' :
                    statuses.includes('surveiller') ? 'surveiller' : 'conforme';
                statusCounts[status] += 1;
            });
            const totalVehicles = vehicleEntries.length;
            const watchPercent = totalVehicles ? statusCounts.surveiller / totalVehicles * 100 : 0;
            const nonconformingPercent = totalVehicles ? statusCounts['non-conforme'] / totalVehicles * 100 : 0;
            const donut = document.querySelector('.donut-chart');
            if (donut) {
                donut.style.setProperty('--vehicle-watch', `${watchPercent}%`);
                donut.style.setProperty('--vehicle-nonconforming', `${nonconformingPercent}%`);
                donut.classList.toggle('is-empty', totalVehicles === 0);
                donut.setAttribute('aria-label',
                    `Répartition des véhicules : ${statusCounts.conforme} conformes, ${statusCounts.surveiller} à surveiller et ${statusCounts['non-conforme']} non conformes`);
                const center = donut.querySelector('.donut-center strong');
                if (center) center.textContent = formatNumber.format(totalVehicles);
            }

            const legendValues = document.querySelectorAll('.legend-list strong');
            if (legendValues[0]) legendValues[0].textContent = formatNumber.format(statusCounts.conforme);
            if (legendValues[1]) legendValues[1].textContent = formatNumber.format(statusCounts.surveiller);
            if (legendValues[2]) legendValues[2].textContent = formatNumber.format(statusCounts['non-conforme']);

            updateActivityChart([].concat(userEntries, vehicleEntries, documents, cessions, alerts, history, pvs));
        } catch (error) {
            console.error('Impossible de mettre à jour les statistiques du tableau de bord.', error);
        }
    }

    function getDocumentStatus(documentRecord) {
        const expiration = documentRecord.dateExpiration || documentRecord.expiration;
        if (expiration) {
            const date = String(expiration);
            const expiry = new Date(date + (date.length === 10 ? 'T23:59:59' : ''));
            if (!Number.isNaN(expiry.getTime())) {
                const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
                return days < 0 ? 'non-conforme' : days < 30 ? 'surveiller' : 'conforme';
            }
        }
        if (documentRecord.statut === 'expire') return 'non-conforme';
        if (documentRecord.statut === 'bientot') return 'surveiller';
        if (documentRecord.statut === 'non-conforme' || documentRecord.statut === 'surveiller') return documentRecord.statut;
        return documentRecord.statut === 'valide' || documentRecord.statut === 'conforme' ? 'conforme' : 'surveiller';
    }

    updateStats(true);
    const activityPeriod = document.getElementById('register-activity-period');
    if (activityPeriod) {
        activityPeriod.addEventListener('change', function () {
            updateStats(false);
        });
    }
    window.addEventListener('storage', function (event) {
        if (!event.key || event.key.startsWith('kapitrans-')) updateStats(false);
    });
    window.setInterval(function () { updateStats(false); }, 30000);
});
