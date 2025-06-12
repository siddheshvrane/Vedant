import { Sidebar } from './Sidebar';

export class MenuSidebarManager extends Sidebar {
  constructor(menuItems = [], initialWidth = '250px') {
    super(initialWidth);
    this.menuItems = menuItems;
    this.activeSubMenu = null;
  }

  openInitialMenu() {
    this.open();
    this.activeSubMenu = null;
    this.setWidth('250px');
  }

  handleMenuItemClick(item) {
    if (item.component) {
      this.activeSubMenu = item.id;
      this.open(); // Ensure sidebar is open when a sub-menu is active
      this.setWidth(item.width || '250px');
    } else {
      console.log(`Clicked: ${item.label} (No sub-menu component defined)`);
    }
  }

  handleCloseSubMenu() {
    this.activeSubMenu = null;
    this.open(); // Revert to main menu view
    this.setWidth('250px');
  }

  closeAll() {
    this.close();
    this.activeSubMenu = null;
    this.setWidth('250px');
  }

  get activeSubMenuComponent() {
    const item = this.menuItems.find(item => item.id === this.activeSubMenu);
    return item ? item.component : null;
  }

  get currentViewIsOpen() {
    return this.isOpen || this.activeSubMenu !== null;
  }
}