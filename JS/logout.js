// ============================================================
// LOGOUT — KAPITRANS
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    const logoutButtons = document.querySelectorAll('.btn-logout');

    logoutButtons.forEach(function (button) {
        button.addEventListener('click', function (e) {
            e.preventDefault();

            // Effacer l'utilisateur connecté
            localStorage.removeItem('kapitrans-user');

            // Rediriger vers login.html
            window.location.href = 'login.html';
        });
    });

});