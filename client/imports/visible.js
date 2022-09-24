// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.

let isVisible;
const _visible = new ReactiveVar();

const onVisibilityChange = () => _visible.set(!(document.hidden || false));
document.addEventListener('visibilitychange', onVisibilityChange, false);
onVisibilityChange();
export default isVisible = () => _visible.get();
