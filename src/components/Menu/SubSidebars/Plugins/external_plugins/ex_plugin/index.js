import HelloWorldPopup from "./src/HelloWorldPopup.vue";

/** @type {import('@/types/plugin.types').Plugin} */
export default {
  name: "hello-world-plugin",
  title: "Hello World Plugin",
  subtitle: "A simple plugin that says Hello World.",
  pfpUrl:
    "https://static.vecteezy.com/system/resources/previews/014/919/788/original/retro-style-pop-up-window-vector.jpg",

  popupComponent: HelloWorldPopup,

  _context: null,

  enable({ PopupService }) {
    this._context = { PopupService };
    console.log("[Hello World Plugin] Enabled");
  },

  disable() {
    this.close();
    this._context = null;
    console.log("[Hello World Plugin] Disabled");
  },

  open() {
    if (!this._context) {
      console.warn("[Hello World Plugin] Not enabled yet.");
      return;
    }
    this._context.PopupService.show({
      isPlugin: true,
      pluginId: this.name,
      tabTitle: "Hello World",
      component: this.popupComponent,
      props: {
        onClose: () => this.close(),
      },
    });
    console.log("[Hello World Plugin] Opened popup");
  },

  close() {
    if (this._context?.PopupService) {
      this._context.PopupService.hide();
      console.log("[Hello World Plugin] Closed");
    }
  },
};
