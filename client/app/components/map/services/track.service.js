import _ from 'lodash';

export default class TrackService {

  constructor(MapService, dashJS, $rootScope) {
    "ngInject";

    this.mapSrv = MapService;
    this.dashJSrv = dashJS;

    this._trackGroup = new L.FeatureGroup();
    this.marker = null;
    this.$rootScope = $rootScope;

    /*$rootScope.$on('dashjs:init', function (event, data) {
      console.debug(data);
    });*/

    $rootScope.$on('dashjs:close', (event, data) => {
      this.clearTrackGroup();
      this.mapSrv.clearMovingGroup();
    });
  }

  init() {
    this.map = this.mapSrv.map;
    this._trackGroup.addTo(this.map);

    this.dashJSrv.player.on(
      this.dashJSrv.dashjs.MediaPlayer.events['PLAYBACK_METADATA_LOADED'],
      this.metadataLoaded.bind(this)
    );
  }

  clearTrackGroup() {
    this._trackGroup.clearLayers();
  }

  metadataLoaded(e) {
    if (_.isEmpty(this.dashJSrv.view.textTracks)) return;

    this.clearTrackGroup();
    var textTrack = this.dashJSrv.view.textTracks[0],
      data,
      poly,
      cPoint,
      startPosition,
      path = [],
      self = this;

    textTrack.mode = 'hidden';
    _.each(textTrack.cues, (cue) => {
      data = JSON.parse(cue.text);
      poly = data.sensorTrace.coordinates[0];
      cPoint = this.getLatLngCenter(poly);
      if (!startPosition) {
        startPosition = [poly[0][1], poly[0][0]];
      }
      path.push(cPoint);
    });

    if (startPosition) {
      this.marker = L.marker(startPosition, {
        icon: L.icon({
          iconUrl: require('../assets/icon_dron.png'),
          iconSize: [32, 32],
        })
      }).addTo(this._trackGroup);

      this.map.panTo(startPosition);
    }
    // console.debug('path', JSON.stringify(path, null, 4));
    if (!_.isEmpty(path)) L.polyline(path, {color: 'red'}).addTo(this._trackGroup);

    textTrack.oncuechange = function () {
      let cue = this.activeCues[0],
        data,
        cPoint;

      if (_.isUndefined(cue)) return;

      data = JSON.parse(cue.text);
      cPoint= self.getLatLngCenter(data.sensorTrace.coordinates[0]);

      self.mapSrv.renderMovingGroup({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: data.sensorTrace
        }]
      });

      self.marker.setLatLng(cPoint);
      self.map.panTo(cPoint);
    };
  }

  rad2degr(rad) {
    return rad * 180 / Math.PI;
  }

  degr2rad(degr) {
    return degr * Math.PI / 180;
  }

  getLatLngCenter(latLngInDegr) {
    var LATIDX = 1;
    var LNGIDX = 0;
    var sumX = 0;
    var sumY = 0;
    var sumZ = 0;

    for (var i = 0; i < latLngInDegr.length; i++) {
      var lat = this.degr2rad(latLngInDegr[i][LATIDX]);
      var lng = this.degr2rad(latLngInDegr[i][LNGIDX]);
      // sum of cartesian coordinates
      sumX += Math.cos(lat) * Math.cos(lng);
      sumY += Math.cos(lat) * Math.sin(lng);
      sumZ += Math.sin(lat);
    }

    var avgX = sumX / latLngInDegr.length;
    var avgY = sumY / latLngInDegr.length;
    var avgZ = sumZ / latLngInDegr.length;

    // convert average x, y, z coordinate to latitude and longtitude
    var lng = Math.atan2(avgY, avgX);
    var hyp = Math.sqrt(avgX * avgX + avgY * avgY);
    var lat = Math.atan2(avgZ, hyp);

    return ([this.rad2degr(lat), this.rad2degr(lng)]);
  }
}
