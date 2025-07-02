// src/services.js
import { Subject } from 'rxjs';

/**
 * MapService: Manages map view updates, graphic rendering, and globe redirection.
 */
class MapServiceClass {
    updateView$ = new Subject();
    redirectGlobe$ = new Subject();
    orientToNorth$ = new Subject();
    renderGraphic$ = new Subject();
    removeGraphic$ = new Subject();
    zoomToCoordinates$ = new Subject();
    displayLocationMarker$ = new Subject();

    updateView(updateData) {
        this.updateView$.next(updateData);
    }
    redirectGlobe(viewData) {
        this.redirectGlobe$.next(viewData);
    }
    orientToNorth() {
        this.orientToNorth$.next();
    }
    renderGraphic(graphic) {
        this.renderGraphic$.next(graphic);
    }
    removeGraphic(graphicIdentifier) {
        this.removeGraphic$.next(graphicIdentifier);
    }
    zoomToCoordinates(coordinates) {
        this.zoomToCoordinates$.next(coordinates);
    }
    displayLocationMarker(location) {
        this.displayLocationMarker$.next(location);
    }
}
export const MapService = new MapServiceClass();


/**
 * UserInterfaceService: Manages global UI state, such as sidebar visibility and active features.
 */
class UserInterfaceServiceClass {
    openSidebarPanel$ = new Subject();   // Emits when a main sidebar panel should open
    closeSidebar$ = new Subject();      // Emits when a main sidebar panel should close
    activateFeature$ = new Subject();   // Emits when a menu item is clicked to activate a feature/sub-menu
    handleCloseSubMenu$ = new Subject(); // Emits when a sub-menu requests to close (typically returning to main menu)

    // New: Observable to broadcast the global sidebar open/closed state
    isSidebarOpen$ = new Subject();

    openInitialMenu() {
        this.openSidebarPanel$.next(); // Notify Sidebar to open its main panel
        this.isSidebarOpen$.next(true); // Notify global state that sidebar is open
        console.log('UserInterfaceService: Opening initial menu.');
    }

    closeAll() {
        this.closeSidebar$.next(); // Notify Sidebar to close completely
        this.isSidebarOpen$.next(false); // Notify global state that sidebar is closed
        console.log('UserInterfaceService: Closing all panels and returning to globe.');
    }

    handleMenuItemClick(item) {
        // This is a generic handler that decides what to do when any menu item is clicked.
        // It might activate a sub-menu or trigger other UI/map actions.
        console.log('UserInterfaceService: Menu item clicked:', item);
        this.activateFeature$.next(item); // Notify active feature subscribers
    }

    handleCloseSubMenu() {
        this.openInitialMenu(); // When a sub-menu closes, typically return to the main menu.
                                // This keeps the sidebar open. If closing sub-menu should close the *entire* sidebar,
                                // change this to `this.closeAll()`.
        console.log('UserInterfaceService: Sub-menu closed, returning to main menu.');
    }
}
export const UserInterfaceService = new UserInterfaceServiceClass();


/**
 * MenuItemService: Manages the retrieval and distribution of menu items.
 */
class MenuItemServiceClass {
    menuItemsLoaded$ = new Subject(); // Emits the list of menu items once loaded

    retrieveAll() {
        // Simulate fetching menu items from a backend or defining them statically
        const items = [
            { id: 'addData', label: 'Add Data', icon: 'far fa-plus', component: 'AddDataSidebar', width: '350px' },
            { id: 'layerManager', label: 'Layer Manager', icon: 'fas fa-layer-group', component: 'LayerManagerSidebar', width: '350px' },
            { id: 'visualization', label: 'Visualization', icon: 'far fa-eye', component: 'VisualizationSidebar', width: '350px' },
            { id: 'tools', label: 'Tools', icon: 'fas fa-tools', component: 'ToolsSidebar', width: '350px' },
            { id: 'plugins', label: 'Plugins', icon: 'fas fa-plug', component: 'PluginManagerSidebar', width: '350px' },
        ];
        this.menuItemsLoaded$.next(items);
        console.log('MenuItemService: Menu items retrieved and loaded.');
    }
}
export const MenuItemService = new MenuItemServiceClass();