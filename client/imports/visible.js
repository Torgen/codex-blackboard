
let isVisible;
const _visible = new ReactiveVar();

const onVisibilityChange = () => _visible.set(!(document.hidden || false));
document.addEventListener('visibilitychange', onVisibilityChange, false);
onVisibilityChange();
export default isVisible = () => _visible.get();
