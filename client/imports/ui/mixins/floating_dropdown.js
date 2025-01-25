import { autoPlacement, autoUpdate, computePosition } from "@floating-ui/dom";

export default function floatingDropdown(template) {
  template.onRendered(function () {
    const buttonGroup = this.$(".btn-group").get(0);
    const dropdown = this.$(".dropdown-toggle").get(0);
    const menu = this.$(".dropdown-menu").get(0);
    const update = function () {
      computePosition(dropdown, menu, {
        strategy: "fixed",
        middleware: [
          autoPlacement({
            allowedPlacements: [
              "top-start",
              "top-end",
              "bottom-start",
              "bottom-end",
            ],
          }),
        ],
      }).then(({ x, y }) => {
        Object.assign(menu.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      });
    };
    const changed = (mutationList) => {
      for (const mutation of mutationList) {
        if (mutation.attributeName !== "class") {
          return;
        }
        if (buttonGroup.classList.contains("open")) {
          if (!this.popper) {
            this.popper = autoUpdate(dropdown, menu, update);
          }
        } else {
          if (this.popper) {
            this.popper();
            this.popper = null;
          }
        }
      }
    };
    this.observer = new MutationObserver(changed);
    this.observer.observe(buttonGroup, { attributes: true });
  });

  template.onDestroyed(function () {
    this.observer?.disconnect();
    this.popper?.();
  });
}
