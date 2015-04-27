$(document).ready(function () {

  // Time between screen refreshes.
  var INTERVAL = 500;

  // Marker / flight trajectory cache.
  var markerStore = {};
  var flightPathStore = {};

  var homeLatLong = new google.maps.LatLng(52.129006, 5.060932);
  var myOptions = {
    zoom: 8,
    center: homeLatLong,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

  // Create home icon.
  new google.maps.Marker({
    position: homeLatLong,
    icon: 'https://mt0.google.com/vt/icon/name=icons/spotlight/home_S_8x.png&scale=1.0',
    map: map
  });

  getFlightData();


  function getFlightData() {
    var filter_from = $("#from").val();
    var filter_to = $("#to").val();

    var request = $.ajax({
      url:  "/api/positions",
      type: "GET",
      dataType: "json",
      data: { from : filter_from, to: filter_to },
      cache: false
    });

    request.done(function(data) {
      processPositionData(data);
    });

    request.fail(function( jqXHR, textStatus, errorThrown ) {
      console.log('got error (textStatus): ', textStatus);
      console.log('got error (errorThrown): ', errorThrown);
      console.log('got error  (jqXHR): ', jqXHR);
      window.setTimeout(getFlightData, INTERVAL);
    });

  }

  function processPositionData(data) {
    $("#history-from").text(data.from);
    $("#history-to").text(data.to ? data.to + ' minutes ago' : 'now');

    $("#updated").text(data.updated);
    var flights = data.positions;

    var processedFlights = [];

    for (var i = 0, len = flights.length; i < len; i++) {
      (function(flightData) {
        var objectId = flightData.objectId;
        var objectType = flightData.objectType;
        var heading = flightData.heading;
        var positions = flightData.positions;
        processedFlights.push(objectId);

        // Build list of coordinates for flight path.
        var flightPlanCoordinates = [];
        for (var pos = 0, posLen = positions.length; pos < posLen; pos++) {
          var position = positions[pos];
          flightPlanCoordinates.push(new google.maps.LatLng(position.lat, position.lon));
        }


        if (objectType == 'SHIP') {
          pathColor = '#0000FF';
        } else {
          pathColor = '#FF0000';
        }

        // Draw flight path.
        var flightPath = new google.maps.Polyline({
          path: flightPlanCoordinates,
          geodesic: true,
          strokeColor: pathColor,
          strokeOpacity: 0.8,
          strokeWeight: 0.7
        });

        if (flightPathStore.hasOwnProperty(objectId)) {
          // Path already exists; remove old path to prevent drawing over the old line.
          flightPathStore[objectId].setMap(null);
        }

        flightPath.setMap(map);
        flightPathStore[objectId] = flightPath;

        var curPos = flightPlanCoordinates[flightPlanCoordinates.length - 1];
        var planeIcon = {
          path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
          scale: 1.0,
          opacity: 0.5,
          rotation: heading * 1.0,
          strokeColor: 'black',
          strokeWeight: 1
        };

        var marker = null;
        if (markerStore.hasOwnProperty(objectId)) {
          markerStore[objectId].setPosition(curPos);
          markerStore[objectId].setIcon(planeIcon);
        } else {
          marker = new google.maps.Marker({
            flight: objectId,
            position: curPos,
            title: objectId + ' - click to open',
            icon: planeIcon,
            map: map
         });

          google.maps.event.addDomListener(marker, 'click', function() {
            openObjectInfoWindow(marker.flight, objectType);
          });

          markerStore[objectId] = marker;
        }

      })(flights[i]);
    }

    // Clean data from flights that are present in the marker / path cache,
    // but not present in the data response.
    for (var key in markerStore) {
      if ($.inArray(key, processedFlights) < 0) {
        // Flight is in markerStore, but not in data response. Clean it.
        markerStore[key].setMap(null);
        google.maps.event.clearInstanceListeners(markerStore[key]);
        delete markerStore[key];
      }
    }

    for (var key in flightPathStore) {
      if ($.inArray(key, processedFlights) < 0) {
        // Flight is in flightPathStore, but not in data response. Clean it.
        flightPathStore[key].setMap(null);
        delete flightPathStore[key];
      }
    }

    // Eat, sleep, rave, repeat.
    window.setTimeout(getFlightData, INTERVAL);
  }

  function openObjectInfoWindow(objectId, objectType) {
    if (objectType == 'SHIP') {
      url = 'http://www.marinetraffic.com/en/ais/details/ships/' + objectId;
    } else {
      url = 'http://planefinder.net/flight/' + objectId;
    }
    window.open(url,'_blank');
  }

});
