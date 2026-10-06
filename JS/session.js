document.addEventListener('DOMContentLoaded', function () {
    let session = null;
    try {
        session = JSON.parse(localStorage.getItem('kapitrans-user') || 'null');
    } catch (error) {
        console.error('Impossible de lire la session utilisateur.', error);
    }

    const name = session?.nom || 'Utilisateur';
    const role = session?.role || '';
    document.querySelectorAll('.admin-name').forEach(function (element) {
        element.textContent = name;
    });
    document.querySelectorAll('.admin-badge').forEach(function (element) {
        element.textContent = role === 'AGENT' ? 'Agent' : role || 'Compte';
    });
});
