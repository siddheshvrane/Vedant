export class Sidebar {
  constructor(initialWidth = '250px') {
    this.isOpen = false;
    this.currentSidebarWidth = initialWidth;
  }

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  setWidth(width) {
    this.currentSidebarWidth = width;
  }
}