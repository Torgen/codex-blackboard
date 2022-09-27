class StorageWrapper {
  constructor(storage) {
    this.storage = storage;
    this.dependencies = {};
  }

  invalidate(key) {
    this.dependencies[key]?.changed();
  }

  depend(key) {
    let dep = this.dependencies[key];
    if (dep == null) {
      dep = this.dependencies[key] = new Tracker.Dependency();
    }
    dep.depend();
  }

  setItem(key, value) {
    this.storage.setItem(key, value);
    this.invalidate(key);
  }

  removeItem(key) {
    this.storage.removeItem(key);
    this.invalidate(key);
  }

  getItem(key) {
    this.depend(key);
    return this.storage.getItem(key);
  }
}

export var reactiveLocalStorage = new StorageWrapper(window.localStorage);

export var reactiveSessionStorage = new StorageWrapper(window.sessionStorage);

addEventListener("storage", function (event) {
  let wrapper = null;
  if (event.storageArea === window.localStorage) {
    wrapper = reactiveLocalStorage;
  } else if (event.storageArea === window.sessionStorage) {
    wrapper = reactiveSessionStorage;
  } else {
    throw new Error("unknown storage area");
  }
  wrapper.invalidate(event.key);
});
