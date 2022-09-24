// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './map.html';
import './cluster.html';
import {gravatarUrl, nickHash, nickAndName} from '/client/imports/nickEmail.js';
import {Loader} from "@googlemaps/js-api-loader";
import {MarkerClusterer} from "@googlemaps/markerclusterer";
import {MarkerWithLabel} from "@googlemaps/markerwithlabel";
import md5 from 'md5';
import {positionOrDefault, solarLongitude} from './geography.js';
import { MAPS_API_KEY } from '/client/imports/server_settings.js';

const loaded = new ReactiveVar(false);
(async function() {
  const loader = new Loader({
    apiKey: MAPS_API_KEY,
    version: 'weekly'
  });
  await loader.load();
  return loaded.set(true);
})();
  
Template.map.onCreated(function() {
  return this.map = new ReactiveVar(null);
});

const MAX_CIRCLES = 5;
const GRAVATAR_SIZE = 64;

class BlackboardRenderer {
  constructor() {
    this.markersAndViews = [];
  }
  render({markers, position}, stats) {
    let fullOffline, fullOnline;
    let marker, summaryOnline, summaryOffline;
    let numOnline = 0;
    let numOffline = 0;
    markers = markers.slice(0);
    markers.sort((a, b) => b.getOpacity() - a.getOpacity());  // Online first, then offline
    for (marker of markers) {
      if (marker.getOpacity() === 1.0) {
        numOnline++;
      } else {
        numOffline++;
      }
    }
    [fullOnline, fullOffline, summaryOnline, summaryOffline] = [0, 0, 0, 0];
    if ((numOnline + numOffline) <= MAX_CIRCLES) {
      [fullOnline, fullOffline] = [numOnline, numOffline];
    } else if (numOffline === 0) {
      [fullOnline, summaryOnline] = [4, numOnline - 4];
    } else if (numOnline === 0) {
      [fullOffline, summaryOffline] = [4, numOffline - 4];
    } else if (numOnline === 1) {
      [fullOnline, fullOffline, summaryOffline] = [1, 3, numOffline - 3];
    } else if (numOffline === 1) {
      [fullOnline, summaryOnline, fullOffline] = [3, numOnline - 3, 1];
    } else {
      [fullOnline, summaryOnline, summaryOffline] = [3, numOnline - 3, numOffline];
    }
    const pieces = (() => {
      const result = [];
      for (marker of markers) {
        let piece = null;
        if (((marker.getOpacity() === 1.0) && (fullOnline > 0) && fullOnline--) || ((marker.getOpacity() < 1.0) && (fullOffline > 0) && fullOffline--)) {
          piece = {gravatar: marker.getIcon(), title: marker.getTitle(), onlineness: (marker.getOpacity() === 1.0 ? 'online' : 'offline')};
        } else if ((marker.getOpacity() === 1.0) && (summaryOnline > 0)) {
          piece = {summary: summaryOnline, title: `${summaryOnline} more online`, onlineness: 'online'};
          summaryOnline = 0;
        } else if ((marker.getOpacity() < 1.0) && (summaryOffline > 0)) {
          piece = {summary: summaryOffline, title: `${summaryOffline} more offline`, onlineness: 'offline'};
          summaryOffline = 0;
        } else { continue; }
        result.push(piece);
      }
      return result;
    })();
    const element = document.createElement('div');
    // We render the pieces in reverse order so the last one is on top, so the title attributes trigger in the intuitive way.
    const view = Blaze.renderWithData(Template.map_gravatar_cluster, pieces.reverse(), element);
    marker = new MarkerWithLabel({position, icon: {url: 'https://maps.gstatic.com/mapfiles/transparent.png', size: new google.maps.Size(0, 0)}, labelContent: element, labelAnchor: new google.maps.Point(-32, -32)});
    this.markersAndViews.push({marker, view}); // So we can clean up the views after rendering.
    return marker;
  }
}
    
Template.map.onRendered(function() {
  this.autorun(() => {
    if (!loaded.get()) { return; }
    const map = new google.maps.Map(this.$('.bb-solver-map')[0], {
      center: {
        lat: 15,
        lng: -71.1
      },
      zoom: 3,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_CENTER
      }
    }
    );
    this.map.set(map);
    const renderer = new BlackboardRenderer;
    const clusterer = new MarkerClusterer({map, renderer});
    let oldMarkersAndViews = null;
    google.maps.event.addListener(clusterer, 'clusteringbegin', function() {
      oldMarkersAndViews = renderer.markersAndViews;
      return renderer.markersAndViews = [];
  });
    google.maps.event.addListener(clusterer, 'clusteringend', () => oldMarkersAndViews.map((markerAndView) =>
      (markerAndView.marker.getMap() != null) ?
        renderer.markersAndViews.push(markerAndView)
      :
        Blaze.remove(markerAndView.view)));
    const users = new Map(); // the associative kind
    let nodraw = true;
    Meteor.users.find({}, {fields: {nickname: 1, real_name: 1, gravatar_md5: 1, located_at: 1, online: 1}}).observeChanges({
      added(_id, fields) {
        return Tracker.nonreactive(function() {
          const user = new google.maps.Marker({
            position: positionOrDefault(fields.located_at, _id),
            icon: gravatarUrl({gravatar_md5: nickHash(_id), size: GRAVATAR_SIZE}),
            title: nickAndName(fields),
            opacity: fields.online ? 1.0 : 0.5
          });
          users.set(_id, user);
          return clusterer.addMarker(user, nodraw);
        });
      },
      changed(id, fields) {
        return Tracker.nonreactive(function() {
          const {gravatar_md5, located_at, real_name} = fields;
          const user = users.get(id);
          if ('located_at' in fields) {  // if set, even to undefined
            user.setPosition(positionOrDefault(located_at, id));
          }
          if ('gravatar_md5' in fields) {
            user.setIcon(gravatarUrl({gravatar_md5: nickHash(id), size: GRAVATAR_SIZE}));
          }
          if ('real_name' in fields || 'nickname' in fields) {
            // Other might not be set, so have to fetch whole user document
            user.setTitle(nickAndName(Meteor.users.findOne(id)));
          }
          if ('online' in fields) {
            user.setOpacity(fields.online ? 1.0 : 0.5);
          }
          clusterer.removeMarker(user);
          return clusterer.addMarker(user);
        });
      },
      removed(id) {
        clusterer.removeMarker(users.get(id));
        return users.delete(id);
      }
    });
    nodraw = false;
    return clusterer.render();
  });
  return this.autorun(() => {
    if (!Template.currentData().followTheSun) { return; }
    const map = this.map.get();
    if (map == null) { return; }
    map.setCenter({
      lat: 15,
      lng: solarLongitude(Session.get('currentTime'))
    });
    return map.setZoom(3);
  });
});
