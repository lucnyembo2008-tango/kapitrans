(function () {
    const storageKey = 'kapitrans-theme';

    function getSavedTheme() {
        return localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark';
    }

    function applyTheme(theme) {
        const selectedTheme = theme === 'light' ? 'light' : 'dark';
        document.documentElement.classList.toggle('theme-light', selectedTheme === 'light');
        document.documentElement.classList.toggle('theme-dark', selectedTheme === 'dark');

        if (document.body) {
            document.body.classList.toggle('theme-light', selectedTheme === 'light');
            document.body.classList.toggle('theme-dark', selectedTheme === 'dark');
        }

        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            const isActive = button.dataset.themeToggle === selectedTheme;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    applyTheme(getSavedTheme());

    document.addEventListener('DOMContentLoaded', function () {
        if (document.body.classList.contains('admin-body')) {
            const adminInfo = document.querySelector('.main-header .admin-info');
            if (adminInfo && !adminInfo.querySelector('.theme-switcher')) {
                const themeSwitcher = document.createElement('div');
                themeSwitcher.className = 'theme-switcher';
                themeSwitcher.setAttribute('role', 'group');
                themeSwitcher.setAttribute('aria-label', 'Sélecteur de thème');
                themeSwitcher.innerHTML =
                    '<button type="button" class="theme-toggle" data-theme-toggle="light" aria-label="Mode clair" aria-pressed="false">' +
                        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l-1.41 1.41M17.66 6.34l1.41-1.41"/></svg>' +
                    '</button>' +
                    '<button type="button" class="theme-toggle" data-theme-toggle="dark" aria-label="Mode sombre" aria-pressed="false">' +
                        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 0 1 11.2 3a7.5 7.5 0 1 0 9.8 9.8Z"/></svg>' +
                    '</button>';
                adminInfo.prepend(themeSwitcher);
            }
        }

        applyTheme(getSavedTheme());
    });

    document.addEventListener('click', function (event) {
        if (!(event.target instanceof Element)) return;

        const button = event.target.closest('[data-theme-toggle]');
        if (!button) return;

        const selectedTheme = button.dataset.themeToggle === 'light' ? 'light' : 'dark';
        localStorage.setItem(storageKey, selectedTheme);
        applyTheme(selectedTheme);
    });

    window.addEventListener('storage', function (event) {
        if (event.key === storageKey) {
            applyTheme(getSavedTheme());
        }
    });
})();
