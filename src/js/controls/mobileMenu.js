// Mobile menu behaviour now lives in controls/sidebar.js — the navbar no
// longer hosts a collapsible control row, so the hamburger button toggles
// the off-canvas sidebar drawer instead of a `.navbar-controls` panel.
//
// This module is kept as a thin compatibility shim: `setupMobileMenu`
// delegates to the sidebar controller so any legacy import keeps working.
import { setupSidebar } from './sidebar.js';

export function setupMobileMenu() {
    setupSidebar();
}
