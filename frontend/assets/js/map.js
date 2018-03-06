class Map {
  constructor() {
    this.map = undefined;
    this.marker = undefined;

    this.ready = false;

    this.config = {
      zoom: undefined,
      center: undefined,
      mode: undefined
    }
  }

  mapLoaded() {
    this.ready = true;
    this.initMap();
  }

  configureMap(config) {
    this.config = config;
    this.initMap();
  }

  initMap () {
    if (! (this.ready && this.config.mode)) {
      return;
    }

    if (this.map) {
      return;
    }

    this.map = new google.maps.Map(document.getElementById('map'), {
      zoom: this.config.zoom,
      center: this.config.center,
      fullscreenControl: false,
      streetViewControl: false

    });

    if (this.config.mode == 'user') {
      let self = this;
      google.maps.event.addListener(this.map, 'click', function (event) {
        self.placeMarker(event.latLng);
      });
    }
    else if (this.config.mode == 'admin') {
      this.drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: true,
        drawingControlOptions: {
          drawingModes: ['circle'],
          position: google.maps.ControlPosition.TOP_CENTER
        },
        circleOptions: {
          fillColor: '#444444',
          fillOpacity: .3,
          strokeWeight: 1,
          clickable: false,
          editable: false,
          zIndex: 1
        }
      });

      google.maps.event.addListener(this.drawingManager, 'circlecomplete', (circle) => {
        let radius = circle.getRadius();
        let center = circle.getCenter();

        this.circle = {
          center: {lat: center.lat(), lng: center.lng()},
          radius: radius //meters
        };

        this.drawingManager.setOptions({
          drawingMode: null,
          drawingControl: false
        });
      });
    }
  }

  setMapLocation(latlng, zoom) {
    this.map.panTo(latlng);
    this.map.setZoom(zoom);
  }

  getMarkerPosition() {
    if (this.marker) {
      let pos = this.marker.getPosition();
      return { lat: pos.lat(), lng: pos.lng() };
    }

    return undefined;
  }

  getMapCenter() {
    return this.map.getCenter().toJSON();
  }

  getMapZoom() {
    return this.map.getZoom();
  }

  placeMarker(latlng) {
    if (this.marker) {
      this.marker.setPosition(latlng);
    }
    else {
      this.marker = new google.maps.Marker({
        position: latlng,
        map: this.map
      });
    }
  }

  enableDrawing() {
    this.drawingManager.setMap(this.map);
  }

}

var map = new Map();
