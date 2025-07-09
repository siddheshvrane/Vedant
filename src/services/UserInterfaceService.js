// src/services/UserInterfaceService.js
import { Subject, BehaviorSubject } from 'rxjs';

/**
 * UserInterfaceService: Manages global UI state, such as sidebar visibility and active features.
 */
class UserInterfaceServiceClass {
    openSidebarPanel$ = new Subject();
    closeSidebar$ = new Subject();
    activateFeature$ = new Subject();
    
    isSidebarOpen$ = new BehaviorSubject(false); 
    projectLogoReady$ = new Subject();

    sidebarWidthUpdated$ = new BehaviorSubject('0px');

    openInitialMenu() {
        this.openSidebarPanel$.next();
        this.isSidebarOpen$.next(true);
    }

    closeAll() {
        this.closeSidebar$.next();
        this.isSidebarOpen$.next(false);
        this.sidebarWidthUpdated$.next('0px');
    }

    handleMenuItemClick(item) {
        this.activateFeature$.next(item);
    }

    handleCloseSubMenu() {
        this.activateFeature$.next(null);
    }

    notifyProjectLogoReady() {
        this.projectLogoReady$.next();
    }

    toggleSidebar(isOpen) {
        this.isSidebarOpen$.next(isOpen);
        if (!isOpen) {
            this.sidebarWidthUpdated$.next('0px');
        }
    }

    updateSidebarWidth(width) {
        this.sidebarWidthUpdated$.next(width);
    }
    setSidebarOpen(isOpen) {
        this.isSidebarOpen$.next(isOpen);
    }
}
export const UserInterfaceService = new UserInterfaceServiceClass();