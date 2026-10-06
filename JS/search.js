document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('vehicle-search-form');
    const input = document.getElementById('vehicle-registration');
    if (!form || !input) return;

    const recentList = document.querySelector('.recent-list');
    document.querySelector('.demo-links')?.remove();
    const resultSections = [
        document.getElementById('result-conforme'),
        document.getElementById('result-non-conforme')
    ].filter(Boolean);

    function readStored(key, fallback) {
        const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
        return value;
    }

    function readVehicles() {
        const stored = readStored('kapitrans-vehicles', {});
        if (!stored || Array.isArray(stored) || typeof stored !== 'object') {
            throw new Error('Le registre des véhicules doit être un objet valide.');
        }
        return stored;
    }

    function documentStatus(expiration) {
        if (!expiration) return 'surveiller';
        const expiry = new Date(expiration + (expiration.length === 10 ? 'T23:59:59' : ''));
        if (Number.isNaN(expiry.getTime())) return 'surveiller';
        const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
        if (days < 0) return 'non-conforme';
        if (days < 30) return 'surveiller';
        return 'conforme';
    }

    function normalizeDocumentStatus(status) {
        if (status === 'expire' || status === 'non-conforme') return 'non-conforme';
        if (status === 'bientot' || status === 'surveiller') return 'surveiller';
        return 'conforme';
    }

    function getDocumentStatus(documentRecord) {
        const expiration = documentRecord.dateExpiration || documentRecord.expiration;
        if (expiration) return documentStatus(String(expiration));
        if (!documentRecord.statut) return 'surveiller';
        return normalizeDocumentStatus(documentRecord.statut);
    }

    function getVehicleDocuments(vehicle, matricule) {
        const documents = [];
        const labels = {
            carteGrise: 'Carte grise',
            assurance: 'Assurance',
            visiteTechnique: 'Visite technique'
        };

        Object.keys(labels).forEach(function (key) {
            const item = vehicle.documents && vehicle.documents[key];
            if (!item || (!item.numero && !item.expiration)) return;
            documents.push({
                nom: labels[key],
                expiration: item.expiration || '',
                statut: documentStatus(item.expiration)
            });
        });

        const registeredDocuments = readStored('kapitrans-documents', []);
        if (!Array.isArray(registeredDocuments)) {
            throw new Error('Le registre des documents doit être une liste valide.');
        }
        registeredDocuments
            .filter(function (doc) {
                return String(doc.matricule || '').trim().toUpperCase() === matricule;
            })
            .forEach(function (doc) {
                documents.push({
                    nom: doc.type || 'Document',
                    expiration: doc.dateExpiration || '',
                    statut: getDocumentStatus(doc)
                });
            });
        return documents;
    }

    function deriveStatus(vehicle, documents) {
        const statuses = documents.map(function (doc) { return doc.statut; });
        const savedStatus = normalizeDocumentStatus(vehicle.statut || 'conforme');
        statuses.push(savedStatus);
        if (statuses.includes('non-conforme')) return 'non-conforme';
        if (statuses.includes('surveiller')) return 'surveiller';
        return 'conforme';
    }

    function makeVehicle(matricule) {
        const stored = readVehicles();
        const key = Object.keys(stored).find(function (candidate) {
            return candidate.trim().toUpperCase() === matricule;
        });
        if (!key) return null;

        const source = stored[key];
        const documents = getVehicleDocuments(source, matricule);
        return {
            matricule: source.matricule || key,
            marque: [source.marque, source.modele].filter(Boolean).join(' ') || '—',
            categorie: source.categorie || '—',
            proprietaire: typeof source.proprietaire === 'string'
                ? source.proprietaire
                : source.proprietaire?.nom || '—',
            conducteur: source.conducteur || '—',
            zone: source.zone || source.ville || '—',
            statut: deriveStatus(source, documents),
            documents: documents
        };
    }

    function setText(selector, value, target) {
        const element = target.querySelector(selector);
        if (element) element.textContent = value;
    }

    function renderDocuments(target, documents) {
        const list = target.querySelector('.result-doc-list');
        if (!list) return;
        list.replaceChildren();

        if (documents.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'result-doc-empty';
            empty.textContent = 'Aucun document enregistré pour ce véhicule.';
            list.appendChild(empty);
            return;
        }

        documents.forEach(function (doc) {
            const row = document.createElement('div');
            row.className = 'result-doc-item';
            const name = document.createElement('span');
            name.className = 'result-doc-name';
            name.textContent = doc.nom;
            const expiry = document.createElement('span');
            expiry.className = 'result-doc-expiry';
            expiry.textContent = doc.expiration || '—';
            const badge = document.createElement('span');
            badge.className = `status-badge status-${doc.statut}`;
            badge.textContent = doc.statut === 'conforme' ? 'Valide' :
                doc.statut === 'surveiller' ? 'Expire bientôt' : 'Expiré';
            row.append(name, expiry, badge);
            list.appendChild(row);
        });
    }

    function renderVehicle(vehicle) {
        const isConforming = vehicle.statut === 'conforme';
        const target = document.getElementById(isConforming ? 'result-conforme' : 'result-non-conforme');
        if (!target) return;

        resultSections.forEach(function (section) {
            section.classList.remove('is-active');
        });
        target.classList.add('is-active');
        setText('.result-matricule', vehicle.matricule, target);
        setText('.result-vehicle-model', `${vehicle.marque} · ${vehicle.categorie}`, target);
        const infoValues = target.querySelectorAll('.result-info-value');
        if (infoValues[0]) infoValues[0].textContent = vehicle.proprietaire;
        if (infoValues[1]) infoValues[1].textContent = vehicle.conducteur;
        renderDocuments(target, vehicle.documents);

        const statusLabel = vehicle.statut === 'conforme' ? 'CONFORME' :
            vehicle.statut === 'surveiller' ? 'À SURVEILLER' : 'NON CONFORME';
        const badge = target.querySelector('.result-status-badge');
        if (badge) {
            badge.className = `result-status-badge result-status-${vehicle.statut}`;
            badge.textContent = statusLabel;
        }
        const header = target.querySelector('.result-header');
        if (header) header.className = `result-header result-header-${vehicle.statut}`;
        const alerts = target.querySelector('.result-alerts');
        if (alerts) {
            alerts.replaceChildren();
            vehicle.documents
                .filter(function (doc) { return doc.statut !== 'conforme'; })
                .forEach(function (doc) {
                    const alert = document.createElement('div');
                    alert.className = 'result-alert result-alert-red';
                    alert.textContent = `${doc.nom} : ${doc.statut === 'surveiller' ? 'expiration prochaine' : 'expiré'} (${doc.expiration || 'date inconnue'})`;
                    alerts.appendChild(alert);
                });
        }

        const message = target.querySelector('.result-message');
        if (message) {
            const strong = message.querySelector('strong');
            const paragraph = message.querySelector('p');
            if (strong) strong.textContent = vehicle.statut === 'conforme'
                ? 'Tous les documents sont valides.'
                : vehicle.statut === 'surveiller'
                    ? 'Un ou plusieurs documents nécessitent une vérification.'
                    : 'Un ou plusieurs documents ne sont plus valides.';
            if (paragraph) paragraph.textContent = vehicle.statut === 'conforme'
                ? 'Le véhicule peut circuler sans restriction.'
                : 'Vérifiez la situation avant d’autoriser la circulation.';
        }

        const verbalizeButton = target.querySelector('.btn-danger');
        if (verbalizeButton) {
            verbalizeButton.hidden = vehicle.statut !== 'non-conforme';
            verbalizeButton.onclick = function () {
                window.location.href = 'agent-verbalize.html?matricule=' + encodeURIComponent(vehicle.matricule);
            };
        }
        const reportButton = target.querySelector('[data-report-vehicle]');
        if (reportButton) {
            reportButton.disabled = false;
            reportButton.onclick = function () {
                try {
                    const alerts = readStored('kapitrans-alerts', []);
                    if (!Array.isArray(alerts)) throw new Error('Le registre des alertes doit être une liste valide.');
                    const currentUser = readStored('kapitrans-user', null);
                    const agentName = currentUser?.nom || currentUser?.name || currentUser?.email || 'Agent non identifié';
                    const reasons = vehicle.documents
                        .filter(function (doc) { return doc.statut !== 'conforme'; })
                        .map(function (doc) {
                            const status = doc.statut === 'surveiller' ? 'expiration prochaine' : 'expiré';
                            return `${doc.nom} : ${status} (${doc.expiration || 'date inconnue'})`;
                        });
                    const now = new Date();
                    alerts.push({
                        id: `signalement-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
                        type: 'controle',
                        gravite: vehicle.statut === 'non-conforme' ? 'critique' : 'moyenne',
                        titre: `Véhicule signalé : ${vehicle.matricule}`,
                        matricule: vehicle.matricule,
                        marque: vehicle.marque,
                        proprietaire: vehicle.proprietaire,
                        agent: agentName,
                        zone: vehicle.zone,
                        motif: reasons.join('; ') || 'Signalement transmis par l’agent.',
                        message: `Signalement transmis par ${agentName}. ${reasons.join('; ') || 'Vérification demandée.'}`,
                        date: now.toISOString()
                    });
                    localStorage.setItem('kapitrans-alerts', JSON.stringify(alerts));
                    reportButton.disabled = true;
                    showSearchNotification('Signalement envoyé à l’administration.', 'success');
                } catch (error) {
                    console.error('Impossible d’enregistrer le signalement.', error);
                    showSearchNotification('Le signalement n’a pas pu être enregistré. Réessayez.', 'error');
                }
            };
        }
        window.location.hash = target.id;
        if (window.kapitransHistory) {
            window.kapitransHistory.add(vehicle.matricule, vehicle.marque, vehicle.proprietaire, vehicle.zone, vehicle.statut);
        }
        renderRecentSearches();
        updateTodayStats();
    }

    function renderRecentSearches() {
        if (!recentList) return;
        const history = readStored('kapitrans-history', []);
        if (!Array.isArray(history)) throw new Error('L’historique doit être une liste valide.');
        const agentHistory = window.kapitransHistory.forCurrentAgent(history);
        recentList.replaceChildren();
        agentHistory.slice().reverse().slice(0, 5).forEach(function (entry) {
            const link = document.createElement('a');
            link.href = '#state-search';
            link.className = 'recent-item';
            const left = document.createElement('span');
            left.className = 'recent-item-left';
            const plate = document.createElement('span');
            plate.className = 'recent-matricule';
            plate.textContent = entry.matricule || '—';
            const time = document.createElement('span');
            time.className = 'recent-time';
            time.textContent = entry.date ? new Date(entry.date).toLocaleString('fr-FR') : '';
            left.append(plate, time);
            const badge = document.createElement('span');
            badge.className = `status-badge status-${normalizeDocumentStatus(entry.statut)}`;
            badge.textContent = entry.statut === 'conforme' ? 'Conforme' :
                entry.statut === 'surveiller' ? 'À surveiller' : 'Non conforme';
            link.append(left, badge);
            recentList.appendChild(link);
        });
    }

    function updateTodayStats() {
        const history = readStored('kapitrans-history', []);
        if (!Array.isArray(history)) throw new Error('L’historique doit être une liste valide.');
        const agentHistory = window.kapitransHistory.forCurrentAgent(history);
        const today = new Date().toDateString();
        const todaysEntries = agentHistory.filter(function (entry) {
            return entry.date && new Date(entry.date).toDateString() === today;
        });
        const stats = document.querySelectorAll('.agent-stat-value');
        const conforming = todaysEntries.filter(function (entry) { return entry.statut === 'conforme'; }).length;
        const signaled = todaysEntries.length - conforming;
        if (stats[0]) stats[0].textContent = String(todaysEntries.length);
        if (stats[1]) stats[1].textContent = String(conforming);
        if (stats[2]) stats[2].textContent = String(signaled);
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        const matricule = input.value.trim().toUpperCase();
        if (!matricule) {
            input.focus();
            return;
        }
        try {
            const vehicle = makeVehicle(matricule);
            if (!vehicle) {
                showSearchNotification('Véhicule non trouvé : ' + matricule);
                return;
            }
            renderVehicle(vehicle);
        } catch (error) {
            console.error('Impossible de charger le véhicule.', error);
            showSearchNotification('Impossible de lire les données du véhicule. Vérifiez le stockage local.');
        }
    });

    function showSearchNotification(message, type) {
        window.kapitransToast(message, type || 'error');
    }

    resultSections.forEach(function (section) {
        const docs = section.querySelector('.result-doc-list');
        if (docs) docs.replaceChildren();
        const alerts = section.querySelector('.result-alerts');
        if (alerts) alerts.replaceChildren();
        const infoValues = section.querySelectorAll('.result-info-value');
        infoValues.forEach(function (element) { element.textContent = '—'; });
        setText('.result-matricule', '—', section);
        setText('.result-vehicle-model', '—', section);
    });
    renderRecentSearches();
    updateTodayStats();
});
