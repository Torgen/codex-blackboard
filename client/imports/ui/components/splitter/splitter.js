import "./splitter.html";
import { reactiveLocalStorage } from "/client/imports/storage.js";

class Dimension {
  constructor(
    targetClass,
    posProperty,
    sizeProperty,
    startProperty,
    splitterProperty,
    limitVar
  ) {
    this.targetClass = targetClass;
    this.posProperty = posProperty;
    this.sizeProperty = sizeProperty;
    this.startProperty = startProperty;
    this.splitterProperty = splitterProperty;
    this.limitVar = limitVar;
    this.dragging = new ReactiveVar(false);
    this.size = new ReactiveVar(300);
  }
  get() {
    let limit = Math.max(this.size.get(), 0);
    if (this.limitVar != null) {
      limit = Math.min(limit, this.limitVar.get());
    }
    return limit;
  }
  set(size) {
    if (size == null) {
      size = 300;
    }
    this.size.set(size);
  }
  handleEvent(event, template) {
    event.preventDefault(); // don't highlight text, etc.
    if (this.dragging.get()) {
      return;
    } // If this is a second touch
    const pane = $(event.currentTarget).closest(this.targetClass);
    this.dragging.set(true);
    let posThing = event;
    if (event.originalEvent.changedTouches?.length == 1) {
      posThing = event.originalEvent.changedTouches.item(0);
    }
    const initialPos = posThing[this.posProperty];
    const initialSize =
      event.currentTarget.offsetParent[this.sizeProperty] -
      event.currentTarget[this.startProperty] -
      event.currentTarget[this.sizeProperty];
    const mouseMove = (mmevt) => {
      let posThing = mmevt;
      // TODO: if multiple touches, find one that started on the handle
      if (mmevt.originalEvent.changedTouches?.length == 1) {
        posThing = mmevt.originalEvent.changedTouches.item(0);
      }
      const newSize = initialSize - (posThing[this.posProperty] - initialPos);
      this.set(newSize);
    };
    var mouseUp = (muevt) => {
      pane.removeClass("active");
      $(document).off(".splitterDrag");
      reactiveLocalStorage.setItem(
        `splitter.h${heightRange()}.${this.splitterProperty}`,
        this.size.get()
      );
      this.dragging.set(false);
    };
    var touchEnd = (teevt) => {
      for (let touch of teevt.originalEvent.changedTouches) {
        if (touch.identifier === posThing.identifier) {
          mouseUp(teevt);
          return;
        }
      }
    };
    pane.addClass("active");
    $(document)
      .on("mousemove.splitterDrag", mouseMove)
      .on("mouseup.splitterDrag", mouseUp)
      .on("touchmove.splitterDrag", mouseMove)
      .on("touchend.splitterDrag", touchEnd);
  }
}

const windowHeight = new ReactiveVar(window.innerHeight - 46);
window.addEventListener("resize", () =>
  windowHeight.set(window.innerHeight - 46)
);
var heightRange = function () {
  const wh = windowHeight.get() + 46;
  return wh - (wh % 300);
};

const Splitter = {
  vsize: new Dimension(
    ".bb-right-content",
    "pageY",
    "offsetHeight",
    "offsetTop",
    "vsize",
    windowHeight
  ),
  hsize: new Dimension(
    ".bb-splitter",
    "pageX",
    "offsetWidth",
    "offsetLeft",
    "hsize"
  ),
  handleEvent(event, template) {
    if (!Meteor.isProduction) {
      console.log(event.currentTarget);
    }
    if ($(event.currentTarget).closest(".bb-right-content").length) {
      this.vsize.handleEvent(event, template);
    } else {
      this.hsize.handleEvent(event, template);
    }
  },
};

export var vsize = () => Splitter.vsize.get();
export var hsize = () => Splitter.hsize.get();

["hsize", "vsize"].forEach((dim) =>
  Tracker.autorun(function () {
    const x = Splitter[dim];
    if (x.dragging.get()) {
      return;
    }
    console.log(`about to set ${dim}`);
    const val = reactiveLocalStorage.getItem(
      `splitter.h${heightRange()}.${dim}`
    );
    if (val == null) {
      return;
    }
    x.set(val);
  })
);

Template.horizontal_splitter.helpers({
  hsize() {
    return Splitter.hsize.get();
  },
});

Template.horizontal_splitter.events({
  "mousedown/touchstart .bb-splitter-handle"(e, t) {
    return Splitter.handleEvent(e, t);
  },
});

Template.horizontal_splitter.onCreated(() => $("html").addClass("fullHeight"));

Template.horizontal_splitter.onRendered(() => $("html").addClass("fullHeight"));

Template.horizontal_splitter.onDestroyed(() =>
  $("html").removeClass("fullHeight")
);

Template.vertical_splitter.helpers({
  vsize() {
    return Splitter.vsize.get();
  },
  vsizePlusHandle() {
    return +Splitter.vsize.get() + 6;
  },
});
