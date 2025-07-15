// tool-helpers/history.js

// Internal array to store application history/actions
const applicationHistory = [];

/**
 * Records an action in the application's history.
 * @param {string} type - The type of action (e.g., "Area Measurement", "Distance Measurement", "View Change").
 * @param {string} description - A detailed, human-readable description of the action.
 * @param {any} [data] - Optional, any relevant data associated with the action (e.g., coordinates, calculated value).
 */
export function recordAction(type, description, data = null) {
    const timestamp = new Date().toLocaleString();
    const action = {
        timestamp,
        type,
        description,
        data
    };
    applicationHistory.push(action);
    console.log("History Recorded:", action);

    // You could also add logic here to:
    // - Limit the history array size (e.g., keep only the last 100 actions)
    // - Save history to local storage
    // - Dispatch a custom event for a UI component to update
}

/**
 * Retrieves the entire application history.
 * @returns {Array<Object>} A copy of the recorded actions.
 */
export function getHistory() {
    return [...applicationHistory]; // Return a shallow copy to prevent external modification
}

/**
 * Clears all recorded actions from the history.
 */
export function clearHistory() {
    applicationHistory.length = 0; // Clears the array
    console.log("History cleared.");
}