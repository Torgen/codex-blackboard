
_visible = new ReactiveVar()

onVisibilityChange = -> _visible.set !(document.hidden or false)
document.addEventListener 'visibilitychange', onVisibilityChange, false
onVisibilityChange()
export default isVisible = -> _visible.get()
