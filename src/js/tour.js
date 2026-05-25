import { t, onLocaleChange } from './i18n.js';

// The Shepherd tour is built once and replayed via the Help button. The
// underlying Shepherd.js step objects don't update in place when the user
// flips the language, so we subscribe to onLocaleChange and rebuild the
// tour from scratch — same id, same target, fresh translated text.

let currentTour = null;
let tourStartedOnce = false;

function initializeTour() {
    currentTour = buildTour();
    setupTourEvents();

    // When the locale changes, throw away the previous Shepherd tour and
    // rebuild it from scratch in the new language. If a tour is currently
    // running it gets cancelled first so we don't leave an orphaned step.
    onLocaleChange(() => {
        if (currentTour) {
            try {
                currentTour.complete();
            } catch {
                /* tour wasn't active */
            }
        }
        currentTour = buildTour();
    });

    return currentTour;
}

function buildTour() {
    const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
            classes: 'shadow-md',
            scrollTo: true,
            cancelIcon: {
                enabled: true
            }
        }
    });

    addTourSteps(tour);
    return tour;
}

function addTourSteps(tour) {
    const steps = [
        {
            id: 'welcome',
            title: t('tour.welcome_title'),
            text: t('tour.welcome_text'),
            buttons: [
                {
                    text: t('tour.skip'),
                    action: tour.complete
                },
                {
                    text: t('tour.next'),
                    action: tour.next
                }
            ]
        },
        {
            id: 'search',
            attachTo: {
                element: '#addressSearchInput',
                on: 'bottom'
            },
            title: t('tour.search_title'),
            text: t('tour.search_text'),
            buttons: getNavigationButtons(tour)
        },
        {
            id: 'views',
            attachTo: {
                element: '#viewsButton',
                on: 'right'
            },
            title: t('tour.views_title'),
            text: t('tour.views_text'),
            buttons: getNavigationButtons(tour)
        },
        {
            id: 'export',
            attachTo: {
                element: '#exportButton',
                on: 'right'
            },
            title: t('tour.export_title'),
            text: t('tour.export_text'),
            buttons: getNavigationButtons(tour)
        },
        {
            id: 'around',
            attachTo: {
                element: '#aroundButton',
                on: 'right'
            },
            title: t('tour.around_title'),
            text: t('tour.around_text'),
            buttons: getNavigationButtons(tour)
        },
        {
            id: 'settings',
            attachTo: {
                element: '#settingsButton',
                on: 'bottom'
            },
            title: t('tour.settings_title'),
            text: t('tour.settings_text'),
            buttons: getNavigationButtons(tour)
        },
        {
            id: 'navigation',
            title: t('tour.navigation_title'),
            text: t('tour.navigation_text'),
            buttons: getNavigationButtons(tour)
        },
    ];

    steps.forEach(step => tour.addStep(step));
}

function getNavigationButtons(tour) {
    return [
        {
            text: t('tour.back'),
            action: tour.back
        },
        {
            text: t('tour.next'),
            action: tour.next
        }
    ];
}

function setupTourEvents() {
    // Start tour immediately when the page loads (only on first run, ever).
    window.addEventListener('load', () => {
        const shouldStartTour = !localStorage.getItem('tourCompleted');
        if (shouldStartTour && currentTour && !tourStartedOnce) {
            tourStartedOnce = true;
            currentTour.start();
            localStorage.setItem('tourCompleted', 'true');
        }
    });

    // Help button — always uses the latest (post-locale-swap) tour.
    const tourButton = document.getElementById('tourButton');
    if (tourButton) {
        tourButton.addEventListener('click', () => {
            if (currentTour) currentTour.start();
        });
    }
}

export { initializeTour };
