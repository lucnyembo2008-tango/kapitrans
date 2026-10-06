document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.querySelector('.menu-toggle');
    const layout = document.querySelector('.admin-layout');
    const sidebar = document.querySelector('#admin-sidebar');

    if (!toggle || !layout || !sidebar) return;

    const closeButton = document.createElement('button');
    closeButton.className = 'sidebar-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Fermer le menu');
    closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    sidebar.prepend(closeButton);

    const header = document.querySelector('.main-header');
    const accountName = header && header.querySelector('.admin-name');
    const accountRole = header && header.querySelector('.admin-badge');
    const logoutLink = header && header.querySelector('.btn-logout');
    const navigation = sidebar.querySelector('.sidebar-nav');

    if (accountName && accountRole && logoutLink && navigation) {
        const accountProfile = document.createElement('div');
        accountProfile.className = 'sidebar-profile';
        accountProfile.setAttribute('role', 'group');
        accountProfile.setAttribute('aria-label', 'Compte utilisateur');

        const accountAvatar = sidebar.querySelector('.sidebar-logo');
        if (accountAvatar) {
            const avatar = accountAvatar.cloneNode();
            avatar.className = 'sidebar-avatar';
            avatar.alt = '';
            avatar.setAttribute('aria-hidden', 'true');
            accountProfile.append(avatar);
        }

        const accountDetails = document.createElement('div');
        accountDetails.className = 'sidebar-profile-details';
        accountDetails.append(accountName, accountRole);
        accountProfile.append(accountDetails);
        navigation.before(accountProfile);

        const accountFooter = document.createElement('div');
        accountFooter.className = 'sidebar-account';
        accountFooter.setAttribute('role', 'group');
        accountFooter.setAttribute('aria-label', 'Actions du compte');

        logoutLink.insertAdjacentHTML(
            'afterbegin',
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>'
        );
        accountFooter.append(logoutLink);
        sidebar.append(accountFooter);
    }

    function setSidebarOpen(isOpen) {
        layout.classList.toggle('sidebar-open', isOpen);
        sidebar.inert = !isOpen;
        sidebar.setAttribute('aria-hidden', String(!isOpen));
        document.body.classList.toggle('sidebar-drawer-open', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    }

    setSidebarOpen(false);

    toggle.addEventListener('click', function () {
        setSidebarOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    closeButton.addEventListener('click', function () {
        setSidebarOpen(false);
        toggle.focus();
    });

    document.addEventListener('click', function (event) {
        if (
            toggle.getAttribute('aria-expanded') === 'true' &&
            !sidebar.contains(event.target) &&
            !toggle.contains(event.target)
        ) {
            setSidebarOpen(false);
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            setSidebarOpen(false);
            toggle.focus();
        }
    });
});
