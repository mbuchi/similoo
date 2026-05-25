import { setupMobileMenu } from './mobileMenu.js';
import { setupSettingsMenu } from './settingsMenu.js';
import { setupViewsButton } from './viewsButton.js';
import { setupExportButton } from './exportButton.js';
import { setupAroundButton } from './aroundButton.js';
import { setupDayTourButton } from './dayTourButton.js';
import { setupRecordButton } from './recording.js';
import { setupBasemapSelector } from './basemapSelector.js';

export function setupControls(viewer) {
    setupMobileMenu();
    const settings = setupSettingsMenu(viewer);
    const state = {
        isFlying: false,
        currentRadius: 100,
        centerCartesian: null
    };

    setupViewsButton(viewer, state);
    setupExportButton(viewer);
    setupAroundButton(viewer, state, settings);
    setupDayTourButton(viewer, settings);
    setupRecordButton(viewer);
    setupBasemapSelector(viewer);
}