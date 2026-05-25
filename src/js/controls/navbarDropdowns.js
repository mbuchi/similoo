// Navbar dropdown controllers — Views + Settings.
//
// Both follow the same pattern: a trigger button toggles `.is-open` on
// its containing `.navbar-dropdown`, the menu element underneath is CSS-
// hidden until `.is-open` is set, click-outside closes, Escape closes,
// selecting an item closes (Views only — Settings stays open so the
// user can flip multiple toggles in one session).
//
// Replaces the old `setupSidebar()` controller that managed an icon-
// rail + expandable Setup panel (deprecated in v0.3.24 — those controls
// moved into the navbar dropdowns + a floating dock).

export function setupNavbarDropdowns() {
    const views = document.getElementById('viewsDropdown');
    const settings = document.getElementById('settingsDropdown');

    wireDropdown(views, {
        closeOnMenuClick: true,
        triggerSelector: '#viewsButton',
        menuSelector: '.perspective-options',
        // The .active class is kept for backward compat with .perspective-
        // dropdown.active CSS rules elsewhere; .is-open is the new
        // unified class shared with the Settings dropdown.
        openClasses: ['is-open', 'active'],
    });

    wireDropdown(settings, {
        closeOnMenuClick: false,
        triggerSelector: '#settingsButton',
        menuSelector: '.navbar-dropdown-menu',
        openClasses: ['is-open'],
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeDropdown(views, ['is-open', 'active']);
        closeDropdown(settings, ['is-open']);
    });

    document.addEventListener('click', (e) => {
        if (views && !e.target.closest('#viewsDropdown')) {
            closeDropdown(views, ['is-open', 'active']);
        }
        if (settings && !e.target.closest('#settingsDropdown')) {
            closeDropdown(settings, ['is-open']);
        }
    });
}

function wireDropdown(container, opts) {
    if (!container) return;
    const trigger = container.querySelector(opts.triggerSelector);
    const menu = container.querySelector(opts.menuSelector);
    if (!trigger || !menu) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = container.classList.contains('is-open');
        opts.openClasses.forEach((cls) => container.classList.toggle(cls, !wasOpen));
        trigger.setAttribute('aria-expanded', String(!wasOpen));
    });

    if (opts.closeOnMenuClick) {
        menu.addEventListener('click', () => {
            closeDropdown(container, opts.openClasses);
        });
    }
}

function closeDropdown(container, classes) {
    if (!container) return;
    classes.forEach((cls) => container.classList.remove(cls));
    const trigger = container.querySelector('[aria-expanded]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}
