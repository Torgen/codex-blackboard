import "./splitter.html";
import { reactiveLocalStorage } from "/client/imports/storage.js";

const windowSizeDep = new Tracker.Dependency();
function defaultSize() {
  windowSizeDep.depend();
  return Math.min(300, window.innerWidth / 4);
}

class Dimension {
  constructor(
    targetClass,
    posProperty,
    sizeProperty,
    startProperty,
    splitterProperty,
    limitFn,
  ) {
    this.targetClass = targetClass;
    this.posProperty = posProperty;
    this.sizeProperty = sizeProperty;
    this.startProperty = startProperty;
    this.splitterProperty = splitterProperty;
    this.limitFn = limitFn;
    this.dragging = new ReactiveVar(false);
    this.size = new ReactiveVar(null);
  }
  get() {
    let limit = this.size.get();
    if (limit == null) {
      limit = defaultSize();
    }
    limit = Math.max(limit, 0);
    if (this.limitFn != null) {
      limit = Math.min(limit, this.limitFn());
    }
    return limit;
  }
  set(size) {
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
      const size = this.size.get();
      const property = `splitter.h${heightRange()}.${this.splitterProperty}`;
      if (size == null) {
        reactiveLocalStorage.removeItem(property);
      } else {
        reactiveLocalStorage.setItem(property, size);
      }
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

const pointerQuery = window.matchMedia("(pointer: coarse)");
const splitterSize = new ReactiveVar(pointerQuery.matches ? 12 : 6);
pointerQuery.addEventListener("change", function (event) {
  splitterSize.set(event.matches ? 12 : 6);
});

window.addEventListener("resize", function (event) {
  windowSizeDep.changed();
});
function heightLimit() {
  windowSizeDep.depend();
  return window.innerHeight - 40 - splitterSize.get();
}
var heightRange = function () {
  windowSizeDep.depend();
  const wh = window.innerHeight;
  return wh - (wh % 300);
};

const Splitter = {
  vsize: new Dimension(
    ".bb-right-content",
    "pageY",
    "offsetHeight",
    "offsetTop",
    "vsize",
    heightLimit,
  ),
  hsize: new Dimension(
    ".bb-splitter",
    "pageX",
    "offsetWidth",
    "offsetLeft",
    "hsize",
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
      `splitter.h${heightRange()}.${dim}`,
    );
    if (val == null) {
      return;
    }
    x.set(val);
  }),
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
  $("html").removeClass("fullHeight"),
);

Template.vertical_splitter.helpers({
  vsize() {
    return Splitter.vsize.get();
  },
  vsizePlusHandle() {
    return +Splitter.vsize.get() + splitterSize.get();
  },
});
