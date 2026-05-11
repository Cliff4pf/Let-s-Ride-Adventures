/**
 * utils.js
 * Shared utility functions for the frontend.
 */

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string|null|undefined} str - The string to escape.
 * @returns {string} The escaped string.
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
