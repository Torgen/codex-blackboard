import "./map.html";
import "./cluster.html";
import { gravatarUrl, nickHash, nickAndName } from "/lib/imports/nickEmail.js";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { MarkerWithLabel } from "@googlemaps/markerwithlabel";
import { positionOrDefault, solarLongitude } from "./geography.js";
import summarize_markers from "./summarize_markers.js";
import { MAPS_API_KEY } from "/lib/imports/server_settings.js";

const loaded = new ReactiveVar(false);
setOptions({
  apiKey: MAPS_API_KEY,
  version: "weekly",
});
importLibrary("maps").then(() => loaded.set(true));

Template.map.onCreated(function () {
  this.map = new ReactiveVar(null);
});

const GRAVATAR_SIZE = 64;

class BlackboardRenderer {
  constructor() {
    this.markersAndViews = [];
  }
  render({ markers, position }, _stats) {
    const pieces = summarize_markers(markers);
    const element = document.createElement("div");
    // We render the pieces in reverse order so the last one is on top, so the title attributes trigger in the intuitive way.
    const view = Blaze.renderWithData(
      Template.map_gravatar_cluster,
      pieces.reverse(),
      element
    );
    const marker = new MarkerWithLabel({
      position,
      icon: {
        url: "https://maps.gstatic.com/mapfiles/transparent.png",
        size: new google.maps.Size(0, 0),
      },
      labelContent: element,
      labelAnchor: new google.maps.Point(-32, -32),
    });
    this.markersAndViews.push({ marker, view }); // So we can clean up the views after rendering.
    return marker;
  }
}

Template.map.onRendered(function () {
  this.autorun(() => {
    if (!loaded.get()) {
      return;
    }
    const map = new google.maps.Map(this.$(".bb-solver-map")[0], {
      center: {
        lat: 15,
        lng: -71.1,
      },
      zoom: 3,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_CENTER,
      },
    });
    this.map.set(map);
    const renderer = new BlackboardRenderer();
    const clusterer = new MarkerClusterer({ map, renderer });
    let oldMarkersAndViews = null;
    google.maps.event.addListener(clusterer, "clusteringbegin", function () {
      oldMarkersAndViews = renderer.markersAndViews;
      renderer.markersAndViews = [];
    });
    google.maps.event.addListener(clusterer, "clusteringend", () =>
      oldMarkersAndViews.map((markerAndView) =>
        markerAndView.marker.getMap() != null
          ? renderer.markersAndViews.push(markerAndView)
          : Blaze.remove(markerAndView.view)
      )
    );
    const users = new Map(); // the associative kind
    let nodraw = true;
    Meteor.users
      .find(
        {},
        {
          fields: {
            nickname: 1,
            real_name: 1,
            gravatar_md5: 1,
            located_at: 1,
            online: 1,
          },
        }
      )
      .observeChanges({
        added(_id, fields) {
          Tracker.nonreactive(function () {
            const user = new google.maps.Marker({
              position: positionOrDefault(fields.located_at, _id),
              icon: gravatarUrl({
                gravatar_md5: nickHash(_id),
                size: GRAVATAR_SIZE,
              }),
              title: nickAndName(fields),
              opacity: fields.online ? 1.0 : 0.5,
            });
            users.set(_id, user);
            clusterer.addMarker(user, nodraw);
          });
        },
        changed(id, fields) {
          Tracker.nonreactive(function () {
            const { gravatar_md5, located_at, real_name } = fields;
            const user = users.get(id);
            if ("located_at" in fields) {
              // if set, even to undefined
              user.setPosition(positionOrDefault(located_at, id));
            }
            if ("gravatar_md5" in fields) {
              user.setIcon(
                gravatarUrl({ gravatar_md5: nickHash(id), size: GRAVATAR_SIZE })
              );
            }
            if ("real_name" in fields || "nickname" in fields) {
              // Other might not be set, so have to fetch whole user document
              user.setTitle(nickAndName(Meteor.users.findOne(id)));
            }
            if ("online" in fields) {
              user.setOpacity(fields.online ? 1.0 : 0.5);
            }
            clusterer.removeMarker(user);
            clusterer.addMarker(user);
          });
        },
        removed(id) {
          clusterer.removeMarker(users.get(id));
          users.delete(id);
        },
      });
    nodraw = false;
    clusterer.render();
  });
  this.autorun(() => {
    if (!Template.currentData().followTheSun) {
      return;
    }
    const map = this.map.get();
    if (map == null) {
      return;
    }
    map.setCenter({
      lat: 15,
      lng: solarLongitude(Session.get("currentTime")),
    });
    map.setZoom(3);
  });
});
