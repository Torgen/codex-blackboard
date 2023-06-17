import "./time_since.html"

Template.time_since.helpers({
  since: function() {
    return ((Session.get("currentTime") || Date.now()) - this.timestamp) / 1000;
  }
});
