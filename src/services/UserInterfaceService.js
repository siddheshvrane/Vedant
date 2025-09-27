// src/services/UserInterfaceService.js
// Enhanced with specific methods for screen recording integration
import { Subject, BehaviorSubject } from 'rxjs';

/**
 * UserInterfaceService: Manages global UI state, such as sidebar visibility and active features.
 * Enhanced with specific support for screen recording sidebar management.
 */
class UserInterfaceServiceClass {
    constructor() {
        this.openSidebarPanel$ = new Subject();
        this.closeSidebar$ = new Subject();
        this.activateFeature$ = new Subject();
        
        this.isSidebarOpen$ = new BehaviorSubject(false); 
        this.projectLogoReady$ = new Subject();
        this.sidebarWidthUpdated$ = new BehaviorSubject('0px');
        
        // Track current active feature for restoration purposes
        this.currentActiveFeature$ = new BehaviorSubject(null);
    }

    openInitialMenu() {
        console.log('UserInterfaceService: Opening initial menu');
        this.openSidebarPanel$.next();
        this.isSidebarOpen$.next(true);
    }

    closeAll() {
        console.log('UserInterfaceService: Closing all UI elements');
        this.closeSidebar$.next();
        this.isSidebarOpen$.next(false);
        this.sidebarWidthUpdated$.next('0px');
        this.currentActiveFeature$.next(null);
    }

    handleMenuItemClick(item) {
        console.log('UserInterfaceService: Menu item clicked:', item);
        this.activateFeature$.next(item);
        this.currentActiveFeature$.next(item);
        
        // Ensure sidebar is open when activating a feature
        if (!this.isSidebarOpen$.value) {
            this.isSidebarOpen$.next(true);
        }
    }

    handleCloseSubMenu() {
        console.log('UserInterfaceService: Closing submenu');
        this.activateFeature$.next(null);
        this.currentActiveFeature$.next(null);
    }

    notifyProjectLogoReady() {
        this.projectLogoReady$.next();
    }

    toggleSidebar(isOpen) {
        console.log('UserInterfaceService: Toggling sidebar:', isOpen);
        this.isSidebarOpen$.next(isOpen);
        if (!isOpen) {
            this.sidebarWidthUpdated$.next('0px');
            this.currentActiveFeature$.next(null);
        }
    }

    updateSidebarWidth(width) {
        console.log('UserInterfaceService: Updating sidebar width:', width);
        this.sidebarWidthUpdated$.next(width);
    }
    
    setSidebarOpen(isOpen) {
        console.log('UserInterfaceService: Setting sidebar open state:', isOpen);
        this.isSidebarOpen$.next(isOpen);
        if (!isOpen) {
            this.currentActiveFeature$.next(null);
        }
    }

    /**
     * Specific method for opening Basic Tools with Measurement History
     * Used by ScreenRecordingService after recording completion
     */
    openBasicToolsWithHistory() {
        console.log('UserInterfaceService: Opening Basic Tools with Measurement History');
        
        // Ensure sidebar is open
        this.setSidebarOpen(true);
        
        // Activate Basic Tools feature
        this.handleMenuItemClick('Basic Tools');
        
        console.log('UserInterfaceService: Basic Tools with Measurement History activated');
    }

    /**
     * Get current UI state for restoration purposes
     */
    getCurrentUIState() {
        return {
            isSidebarOpen: this.isSidebarOpen$.value,
            currentActiveFeature: this.currentActiveFeature$.value,
            sidebarWidth: this.sidebarWidthUpdated$.value
        };
    }

    /**
     * Restore UI state from saved state object
     */
    restoreUIState(savedState) {
        if (!savedState) {
            console.warn('UserInterfaceService: No saved state to restore');
            return;
        }

        console.log('UserInterfaceService: Restoring UI state:', savedState);

        // Restore sidebar open state
        if (savedState.isSidebarOpen) {
            this.setSidebarOpen(true);
        }

        // Restore sidebar width
        if (savedState.sidebarWidth && savedState.sidebarWidth !== '0px') {
            this.updateSidebarWidth(savedState.sidebarWidth);
        }

        // Restore active feature
        if (savedState.currentActiveFeature) {
            this.handleMenuItemClick(savedState.currentActiveFeature);
        }

        console.log('UserInterfaceService: UI state restored successfully');
    }

    /**
     * Specifically designed for screen recording workflow
     * Closes sidebar and returns state for later restoration
     */
    prepareForScreenRecording() {
        const currentState = this.getCurrentUIState();
        console.log('UserInterfaceService: Preparing for screen recording, saving state:', currentState);
        
        // Close sidebar for recording
        this.closeAll();
        
        return currentState;
    }

    /**
     * Restore UI after screen recording with Basic Tools focus
     * If sidebar was open before, restore it with Basic Tools
     */
    restoreAfterScreenRecording(savedState) {
        console.log('UserInterfaceService: Restoring after screen recording with Basic Tools focus');
        
        if (savedState && savedState.isSidebarOpen) {
            // Open sidebar with Basic Tools instead of previous feature
            this.openBasicToolsWithHistory();
            
            // Restore sidebar width if it was set
            if (savedState.sidebarWidth && savedState.sidebarWidth !== '0px') {
                this.updateSidebarWidth(savedState.sidebarWidth);
            }
        } else {
            console.log('UserInterfaceService: Sidebar was closed before recording, keeping it closed');
        }
    }

    /**
     * Get available features/menu items
     */
    getAvailableFeatures() {
        return [
            'Basic Tools',
            'Advanced Tools', 
            'Analysis Tools',
            'Settings',
            'Help'
        ];
    }

    /**
     * Check if a specific feature is currently active
     */
    isFeatureActive(featureName) {
        return this.currentActiveFeature$.value === featureName;
    }

    /**
     * Emergency reset - closes everything and resets to initial state
     */
    emergencyReset() {
        console.log('UserInterfaceService: Emergency reset - closing all UI elements');
        this.closeAll();
        this.currentActiveFeature$.next(null);
        this.sidebarWidthUpdated$.next('0px');
    }
}

export const UserInterfaceService = new UserInterfaceServiceClass();