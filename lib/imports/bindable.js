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
    this.value = value;
  }

  get() {
    const val = super.get();
    if (val != null) {
      return val;
    }
    return this.value;
  }
}
