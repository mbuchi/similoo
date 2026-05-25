import { initAuth } from './authManager.js';
import { setupAuthNav } from './authNav.js';

export { isAuthenticated, getCurrentUser, onAuthChange, login, logout, getAccessToken } from './authManager.js';

export async function setupAuth() {
    setupAuthNav();
    await initAuth();
}
