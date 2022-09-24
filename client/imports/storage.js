// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
class StorageWrapper {
  constructor(storage) {
    this.storage = storage;
    this.dependencies = {};
  }

  invalidate(key) {
    return this.dependencies[key]?.changed();
  }

  depend(key) {
    let dep = this.dependencies[key];
    if (dep == null) { dep = (this.dependencies[key] = new Tracker.Dependency); }
    return dep.depend();
  }

  setItem(key, value) {
    this.storage.setItem(key, value);
    return this.invalidate(key);
  }

  removeItem(key) {
    this.storage.removeItem(key);
    return this.invalidate(key);
  }

  getItem(key) {
    this.depend(key);
    return this.storage.getItem(key);
  }
}

export var reactiveLocalStorage = new StorageWrapper(window.localStorage);

export var reactiveSessionStorage = new StorageWrapper(window.sessionStorage);

addEventListener('storage', function(event) {
  let wrapper = null;
  if (event.storageArea === window.localStorage) {
    wrapper = reactiveLocalStorage;
  } else if (event.storageArea === window.sessionStorage) {
    wrapper = reactiveSessionStorage;
  } else {
    throw new Error('unknown storage area');
  }
  return wrapper.invalidate(event.key);
});
