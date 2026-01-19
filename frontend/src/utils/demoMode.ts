/**
 * Demo Mode Utilities
 * 
 * Centralized utilities for managing demo mode state.
 * Demo mode provides a sandbox environment with sample encrypted data.
 */

const DEMO_MODE_KEY = 'is_demo_mode';

/**
 * Check if the application is currently in demo mode
 */
export const isDemoMode = (): boolean => {
    return localStorage.getItem(DEMO_MODE_KEY) === 'true';
};

/**
 * Enable demo mode
 */
export const setDemoMode = (enabled: boolean): void => {
    if (enabled) {
        localStorage.setItem(DEMO_MODE_KEY, 'true');
    } else {
        localStorage.removeItem(DEMO_MODE_KEY);
    }
};

/**
 * Clear demo mode (alias for setDemoMode(false))
 */
export const clearDemoMode = (): void => {
    localStorage.removeItem(DEMO_MODE_KEY);
};
