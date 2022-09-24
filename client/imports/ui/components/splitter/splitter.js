/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './splitter.html';
import { reactiveLocalStorage } from '/client/imports/storage.coffee';

class Dimension {
  constructor(targetClass, posProperty, sizeProperty, startProperty, splitterProperty, limitVar) {
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
    if ((size == null)) {
      size = 300;
    }
    this.size.set(size);
    return +size;
  }
  handleEvent(event, template) {
    event.preventDefault(); // don't highlight text, etc.
    const pane = $(event.currentTarget).closest(this.targetClass);
    this.dragging.set(true);
    const initialPos = event[this.posProperty];
    const initialSize = event.currentTarget.offsetParent[this.sizeProperty] - event.currentTarget[this.startProperty] - event.currentTarget[this.sizeProperty];
    const mouseMove = mmevt => {
      const newSize = initialSize - (mmevt[this.posProperty] - initialPos);
      return this.set(newSize);
    };
    var mouseUp = muevt => {
      pane.removeClass('active');
      $(document).unbind('mousemove', mouseMove).unbind('mouseup', mouseUp);
      reactiveLocalStorage.setItem(`splitter.h${heightRange()}.${this.splitterProperty}`, this.size.get());
      return this.dragging.set(false);
    };
    pane.addClass('active');
    return $(document).bind('mousemove', mouseMove).bind('mouseup', mouseUp);
  }
}

const windowHeight = new ReactiveVar(window.innerHeight - 46);
window.addEventListener('resize', () => windowHeight.set(window.innerHeight - 46));
var heightRange = function() {
  const wh = windowHeight.get() + 46;
  return wh - (wh % 300);
};

const Splitter = {
  vsize: new Dimension('.bb-right-content', 'pageY', 'offsetHeight', 'offsetTop', 'vsize', windowHeight),
  hsize: new Dimension('.bb-splitter', 'pageX', 'offsetWidth', 'offsetLeft','hsize'),
  handleEvent(event, template) {
    if (!Meteor.isProduction) { console.log(event.currentTarget); }
    if ($(event.currentTarget).closest('.bb-right-content').length) {
      return this.vsize.handleEvent(event, template);
    } else {
      return this.hsize.handleEvent(event, template);
    }
  }
};

export var vsize = () => Splitter.vsize.get();
export var hsize = () => Splitter.hsize.get();

['hsize', 'vsize'].forEach(dim => Tracker.autorun(function() {
  const x = Splitter[dim];
  if (x.dragging.get()) { return; }
  console.log(`about to set ${dim}`);
  const val = reactiveLocalStorage.getItem(`splitter.h${heightRange()}.${dim}`);
  if (val == null) { return; }
  return x.set(val);
}));

Template.horizontal_splitter.helpers({
  hsize() { return Splitter.hsize.get(); }});

Template.horizontal_splitter.events({
  'mousedown .bb-splitter-handle'(e,t) { return Splitter.handleEvent(e,t); }});

Template.horizontal_splitter.onCreated(() => $('html').addClass('fullHeight'));

Template.horizontal_splitter.onRendered(() => $('html').addClass('fullHeight'));

Template.horizontal_splitter.onDestroyed(() => $('html').removeClass('fullHeight'));

Template.vertical_splitter.helpers({
  vsize() { return Splitter.vsize.get(); },
  vsizePlusHandle() { return +Splitter.vsize.get() + 6; }
});
