// src/services/PopupService.js
import { BehaviorSubject } from 'rxjs';

/**
 * PopupService: Manages the display and data for the application-wide popup.
 */
class PopupServiceClass {
    isVisible$ = new BehaviorSubject(false);
    parameters$ = new BehaviorSubject({
        layerName: '',
        srs: '',
        extent: ''
    });

    /**
     * Shows the popup with given parameters.
     * @param {object} params - Object containing layerName, srs, extent.
     */
    show(params) {
        this.parameters$.next(params);
        this.isVisible$.next(true);
    }

    /**
     * Hides the popup.
     */
    hide() {
        this.isVisible$.next(false);
        this.parameters$.next({
            layerName: '',
            srs: '',
            extent: ''
        });
    }
}
export const PopupService = new PopupServiceClass();