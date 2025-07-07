// src/datamodels/MenuItem.js

/**
 * Represents a menu item in the application's sidebar.
 */
class MenuItem {
    /**
     * @param {string} id - A unique identifier for the menu item.
     * @param {string} label - The display text for the menu item.
     * @param {string} icon - The Font Awesome class for the icon (e.g., 'fas fa-plus').
     * @param {string} component - The name of the Vue component associated with this menu item.
     * @param {string} width - The desired width of the sidebar when this menu item's component is active (e.g., '350px').
     */
    constructor(id, label, icon, component, width) {
        if (!id || !label || !icon || !component || !width) {
            console.error('MenuItem constructor received missing parameters:', { id, label, icon, component, width });
            throw new Error('MenuItem requires id, label, icon, component, and width.');
        }

        this.id = id;
        this.label = label;
        this.icon = icon;
        this.component = component;
        this.width = width;
    }

    // You can add more methods or getters here if the MenuItem needs behavior
    // e.g., isActive() { ... }
}

export default MenuItem;