import { setupNavbarDropdowns } from './controls/navbarDropdowns.js';
import { setupNavbarSearch } from './controls/navbarSearch.js';
import { setupThemeToggle } from './controls/themeToggle.js';
import { setupSettingsMenu } from './controls/settingsMenu.js';
import { setupViewsButton } from './controls/viewsButton.js';
import { setupExportButton } from './controls/exportButton.js';
import { setupAroundButton } from './controls/aroundButton.js';
import { setupDayTourButton } from './controls/dayTourButton.js';
import { setupRecordButton } from './controls/recording.js';
import { setupScreenshotButton } from './screenshots/screenshotButton.js';
import { setupSavedImagesPanel } from './screenshots/savedImagesPanel.js';

export function setupControls(viewer) {
    setupNavbarDropdowns();
    setupThemeToggle();
    setupNavbarSearch(viewer);
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
    setupScreenshotButton(viewer);
    setupSavedImagesPanel();
}
