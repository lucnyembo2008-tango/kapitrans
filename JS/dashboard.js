import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    function animateCounter(counter, target) {
        if (!counter) return;

        const duration = 1200;
        const start = performance.now();
        const prefix = counter.dataset.prefix || '';
        const suffix = counter.dataset.suffix || '';

        function update(currentTime) {
            const progress = Math.min((currentTime - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(target * eased);
            counter.textContent = `${prefix}${new Intl.NumberFormat('fr-FR').format(currentValue)}${suffix}`;
            if (progress < 1) requestAnimationFrame(update);
        }

        counter.textContent = `${prefix}0${suffix}`;
        requestAnimationFrame(update);
    }

    function getString(value) {
        return (value === undefined || value === null) ? '' : String(value).trim();
    }

    function isResolvedAlert(status) {
        const normalized = getString(status).toLowerCase();
        return ['resolu', 'résolu', 'resolved', 'traite', 'traité', 'traitee', 'traitee', 'ferme', 'fermé', 'closed', 'close', 'ignore', 'ignoree'].includes(normalized);
    }

    function getVehicleStatus(vehicle) {
        return getString(vehicle?.statut).toLowerCase();
    }

    function updateDonutChart(vehicles) {
        const donut = document.querySelector('.donut-chart');
        const centerValue = document.querySelector('.donut-center strong');
        const centerLabel = document.querySelector('.donut-center span');
        const legendValues = document.querySelectorAll('.legend-list strong');

        const conformes = vehicles.filter((vehicle) => getVehicleStatus(vehicle) === 'conforme').length;
        const surveiller = vehicles.filter((vehicle) => getVehicleStatus(vehicle) === 'surveiller').length;
        const nonConformes = vehicles.filter((vehicle) => getVehicleStatus(vehicle) === 'non-conforme').length;
        const total = vehicles.length;

        if (centerValue) centerValue.textContent = String(total);
        if (centerLabel) centerLabel.textContent = total > 1 ? 'véhicules' : 'véhicule';

        if (legendValues.length >= 3) {
            legendValues[0].textContent = String(conformes);
            legendValues[1].textContent = String(surveiller);
            legendValues[2].textContent = String(nonConformes);
        }

        if (donut) {
            donut.classList.toggle('is-empty', total === 0);
            if (total === 0) {
                donut.style.setProperty('--vehicle-nonconforming', '0%');
                donut.style.setProperty('--vehicle-watch', '0%');
                return;
            }

            const nonConformingPercent = (nonConformes / total) * 100;
            const watchPercent = (surveiller / total) * 100;
            donut.style.setProperty('--vehicle-nonconforming', `${nonConformingPercent}%`);
            donut.style.setProperty('--vehicle-watch', `${watchPercent}%`);
        }
    }

    function drawActivityChart(history) {
        const line = document.querySelector('.register-chart-line');
        const fill = document.querySelector('.register-chart-fill');
        const labels = document.querySelector('.chart-labels');
        if (!line || !fill) return;

        const days = 7;
        const counts = Array.from({ length: days }, (_, index) => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - (days - 1 - index));
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return { key, label: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), value: 0 };
        });

        history.forEach((entry) => {
            const rawDate = entry.date || entry.dateCreation || entry.createdAt;
            if (!rawDate) return;
            const date = new Date(rawDate);
            if (Number.isNaN(date.getTime())) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const matchedDay = counts.find((day) => day.key === key);
            if (matchedDay) matchedDay.value += 1;
        });

        const maxValue = Math.max(...counts.map((day) => day.value), 1);
        const width = 600;
        const height = 240;
        const padding = 18;
        const step = counts.length > 1 ? (width - padding * 2) / (counts.length - 1) : 0;

        const points = counts.map((day, index) => {
            const x = padding + index * step;
            const y = height - padding - (day.value / maxValue) * (height - padding * 2);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        const area = `${points} L ${padding + step * (counts.length - 1)} ${height - padding} L ${padding} ${height - padding} Z`;
        line.setAttribute('d', points);
        fill.setAttribute('d', area);

        if (labels) {
            labels.innerHTML = counts.map((day) => `<span>${day.label}</span>`).join('');
        }
    }

    try {
        const [vehiclesSnap, usersSnap, alertsSnap, historySnap] = await Promise.all([
            getDocs(collection(db, 'vehicles')),
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'alerts')),
            getDocs(collection(db, 'history'))
        ]);

        const vehicles = vehiclesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const users = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const alerts = alertsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const history = historySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const totalVehicles = vehicles.length;
        const activeAgents = users.filter((user) => getString(user.role).toUpperCase() === 'AGENT').length;
        const uniqueRoles = new Set(users
            .map((user) => getString(user.role).toUpperCase())
            .filter(Boolean));
        const activeAlerts = alerts.filter((alert) => !isResolvedAlert(alert.statut)).length;

        const counters = document.querySelectorAll('.stat-number');
        const valuesByDataStat = {
            vehicles: totalVehicles,
            agents: activeAgents,
            roles: uniqueRoles.size,
            alerts: activeAlerts
        };

        counters.forEach((counter) => {
            const target = valuesByDataStat[counter.dataset.stat] ?? 0;
            animateCounter(counter, target);
        });

        updateDonutChart(vehicles);
        drawActivityChart(history);
    } catch (error) {
        console.error('Erreur Dashboard Firebase :', error);
        document.querySelectorAll('.stat-number').forEach((counter) => {
            animateCounter(counter, 0);
        });
        updateDonutChart([]);
    }
});
