// src/services/MenuItemService.js
import { Subject } from 'rxjs';
import MenuItem from '../datamodels/MenuItem.js';

/**
 * MenuItemService: Manages the retrieval and distribution of menu items.
 */
class MenuItemServiceClass {
    menuItemsLoaded$ = new Subject();

    retrieveAll() {
        const items = [
            new MenuItem('addData', 'Add Data', 'far fa-plus', 'AddDataSidebar', '350px'),
            new MenuItem('layerManager', 'Layer Manager', 'fas fa-layer-group', 'LayerManagerSidebar', '450px'), 
            new MenuItem('visualization', 'Visualization', 'far fa-eye', 'VisualizationSidebar', '350px'),
            new MenuItem('tools', 'Tools', 'fas fa-tools', 'BasicToolsSidebar', '350px'), 
            new MenuItem('plugins', 'Plugins', 'fas fa-plug', 'PluginManagerSidebar', '350px'),
        ];
        this.menuItemsLoaded$.next(items);
    }
}
export const MenuItemService = new MenuItemServiceClass();