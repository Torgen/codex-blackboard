/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
export default class BindableEnvironmentVariable extends Meteor.EnvironmentVariable {
  bindSingleton(value) {
    if (this.value != null) {
      throw new Error("Can't rebind singleton");
    }
    if (DDP._CurrentMethodInvocation.get() != null) {
      throw new Error("Can't bind inside method");
    }
    if (DDP._CurrentPublicationInvocation.get() != null) {
      throw new Error("Can't bind inside publish");
    }
    return this.value = value;
  }

  get() {
    const val = super.get.get();
    if (val != null) {
      return val;
    }
    return this.value;
  }
}
