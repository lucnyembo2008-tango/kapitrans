// ============================================================
// HISTORY — KAPITRANS
// ============================================================
// Ce fichier gère l'historique des vérifications de l'agent.
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
	const tbody = document.querySelector('.data-table tbody');
	if (!tbody) return;
	tbody.replaceChildren();

	function getStoredHistory() {
		const history = JSON.parse(localStorage.getItem('kapitrans-history') || '[]');
		if (!Array.isArray(history)) throw new Error('L’historique doit contenir une liste.');
		return window.kapitransHistory.forCurrentAgent(history);
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		if (isNaN(date)) return dateStr;

		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');

		return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
	}

	function renderStoredHistory() {
		const history = getStoredHistory();
		const counts = {
			total: history.length,
			conforme: history.filter(function (item) { return item.statut === 'conforme'; }).length,
			surveiller: history.filter(function (item) { return item.statut === 'surveiller'; }).length,
			'non-conforme': history.filter(function (item) { return item.statut === 'non-conforme'; }).length
		};
		document.querySelectorAll('.stat-card .stat-number').forEach(function (element, index) {
			element.textContent = String([counts.total, counts.conforme, counts.surveiller, counts['non-conforme']][index] || 0);
		});
		if (history.length === 0) {
			const emptyRow = tbody.insertRow();
			emptyRow.className = 'empty-state-row';
			const emptyCell = emptyRow.insertCell();
			emptyCell.colSpan = 7;
			emptyCell.textContent = 'Aucune vérification enregistrée.';
			return;
		}

		history.forEach(function (h) {
			const tr = document.createElement('tr');
			const date = document.createElement('td');
			date.className = 'audit-date';
			date.textContent = formatDate(h.date);
			const plate = document.createElement('td');
			const plateLabel = document.createElement('strong');
			plateLabel.className = 'matricule';
			plateLabel.textContent = h.matricule || '—';
			plate.appendChild(plateLabel);
			const makeCell = function (value) {
				const cell = document.createElement('td');
				cell.textContent = value || '—';
				return cell;
			};
			const status = document.createElement('td');
			const badge = document.createElement('span');
			const statusClass = ['conforme', 'surveiller', 'non-conforme'].includes(h.statut) ? h.statut : '';
			badge.className = `status-badge${statusClass ? ` status-${statusClass}` : ''}`;
			badge.textContent = h.statut === 'conforme' ? 'Conforme' :
				h.statut === 'surveiller' ? 'À surveiller' :
				h.statut === 'non-conforme' ? 'Non conforme' : h.statut || '—';
			status.appendChild(badge);
			const actions = document.createElement('td');
			actions.className = 'actions-cell';
			const button = document.createElement('button');
			button.className = 'btn-action btn-view';
			button.title = 'Voir';
			button.type = 'button';
			button.setAttribute('aria-label', 'Voir');
			button.appendChild(window.kapitransIcon('view'));
			actions.appendChild(button);
			tr.append(date, plate, makeCell(h.marque), makeCell(h.proprietaire), makeCell(h.zone), status, actions);

			tbody.insertBefore(tr, tbody.firstChild);
		});
	}

	const searchInput = document.querySelector('.search-input');
	const filterStatut = document.querySelectorAll('.filter-select')[0];
	const filterDate = document.querySelectorAll('.filter-select')[1];

	function filterHistory() {
		const search = (searchInput?.value || '').toLowerCase().trim();
		const statut = filterStatut?.value || '';

		const rows = tbody.querySelectorAll('tr');

		rows.forEach(function (row) {
			if (row.classList.contains('empty-state-row')) return;
			const cells = row.querySelectorAll('td');
			const matricule = (cells[1]?.textContent || '').toLowerCase();
			const statutText = (cells[5]?.textContent || '').toLowerCase();

			const matchSearch = !search || matricule.includes(search);
			const matchStatut = !statut || statutText.includes(statut.toLowerCase());

			if (matchSearch && matchStatut) {
				row.style.display = '';
			} else {
				row.style.display = 'none';
			}
		});
	}

	if (searchInput) searchInput.addEventListener('input', filterHistory);
	if (filterStatut) filterStatut.addEventListener('change', filterHistory);
	if (filterDate) filterDate.addEventListener('change', filterHistory);

	tbody.addEventListener('click', function (event) {
		const button = event.target.closest('.btn-view');
		if (!button) return;

		const row = button.closest('tr');
		const headers = Array.from(document.querySelectorAll('.data-table thead th'));
		const cells = Array.from(row.querySelectorAll('td')).slice(0, -1);
		const fields = cells.map(function (cell, index) {
			return { label: headers[index]?.textContent.trim() || 'Détail', value: cell.textContent.trim() };
		});

		window.kapitransRecordDialog('Détails de la vérification', fields);
	});

	renderStoredHistory();

});

window.kapitransHistory = {
	forCurrentAgent: function (entries) {
		let email = '';
		try {
			email = String(JSON.parse(localStorage.getItem('kapitrans-user') || 'null')?.email || '').trim().toLowerCase();
		} catch (error) {
			console.error('Impossible de déterminer le compte agent connecté.', error);
		}
		if (!email) return [];
		return entries.filter(function (entry) {
			return String(entry.agentEmail || '').trim().toLowerCase() === email;
		});
	},

	add: function (matricule, marque, proprietaire, zone, statut) {
		const history = JSON.parse(localStorage.getItem('kapitrans-history') || '[]');
		let user = null;
		try {
			user = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
		} catch (error) {
			console.error('Impossible de lire le compte agent connecté.', error);
		}
		const agentEmail = String(user?.email || '').trim().toLowerCase();
		if (!agentEmail) return;

		history.push({
			matricule: matricule,
			marque: marque,
			proprietaire: proprietaire,
			zone: zone,
			statut: statut,
			agentEmail: agentEmail,
			agent: user?.nom || user?.name || agentEmail,
			date: new Date().toISOString()
		});

		localStorage.setItem('kapitrans-history', JSON.stringify(history));
	}

};
