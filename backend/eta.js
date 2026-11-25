// eta.js
// Calculates estimated arrival time (ETA) for a bus to reach its upcoming stops.
//
// IMPORTANT:
// - Distance is calculated using the Haversine formula — a straight-line
//   approximation between GPS coordinates. It is NOT actual road distance.
// - ETA does NOT include real traffic conditions, road curves, or stops.
// - All results are approximate simulated estimates for demo purposes only.

'use strict';

const fs   = require('fs');
const path = require('path');

// ── File paths ────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, 'data');
const busesPath     = path.join(DATA_DIR, 'buses.json');
const stopsPath     = path.join(DATA_DIR, 'stops.json');
const routesPath    = path.join(DATA_DIR, 'routes.json');
const locationsPath = path.join(DATA_DIR, 'locations.json');

// ── Load helpers ──────────────────────────────────────────
function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn('eta.js: Could not read ' + filePath + ' — ' + err.message);
    return [];
  }
}

// ── calculateDistance(lat1, lon1, lat2, lon2) ─────────────
// Returns the straight-line distance in kilometres between two
// GPS coordinates using the Haversine formula.
//
// The Haversine formula works out the distance on the surface of
// a sphere (the Earth) between two points given their latitudes
// and longitudes. It is more accurate than a simple flat-map
// calculation because it accounts for the Earth's curvature.
//
// Steps:
// 1. Convert degrees to radians (Math.PI / 180).
//    GPS coordinates are in degrees; trigonometry needs radians.
// 2. Calculate the differences in latitude and longitude.
// 3. Apply the Haversine formula:
//    a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
//    c = 2 × atan2(√a, √(1−a))
//    distance = R × c     where R = 6371 km (Earth's radius)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R      = 6371;                    // Earth's radius in kilometres
  const toRad  = Math.PI / 180;           // conversion factor: degrees → radians

  const dLat   = (lat2 - lat1) * toRad;  // difference in latitude  (radians)
  const dLon   = (lon2 - lon1) * toRad;  // difference in longitude (radians)

  const lat1Rad = lat1 * toRad;           // lat1 in radians
  const lat2Rad = lat2 * toRad;           // lat2 in radians

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad)  * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in kilometres
}

// ── calculateETA(busId) ───────────────────────────────────
// Returns an ETA object for the given bus ID, or an error object.
//
// ETA formula:
//   time (minutes) = (distance in km / speed in km/h) × 60
//
// Example: a bus 20 km away travelling at 40 km/h
//   = (20 / 40) × 60 = 30 minutes
//
// Steps:
// 1. Load all data fresh from disk (so we always use latest coordinates).
// 2. Find the bus, its location, and its assigned route.
// 3. Build the ordered list of stops for that route.
// 4. Find which stops are still "upcoming" — stops that come after
//    the bus's current position on the route.
// 5. Calculate the remaining distance and ETA to each upcoming stop.
// 6. Return the full result as a plain object.
function calculateETA(busId) {

  // Load fresh data every time so ETA reflects the latest simulation state
  const buses     = loadJSON(busesPath);
  const stops     = loadJSON(stopsPath);
  const routes    = loadJSON(routesPath);
  const locations = loadJSON(locationsPath);

  // --- Find the bus ---
  const bus = buses.find(function (b) { return b.id === busId; });
  if (!bus) {
    return { error: 'Bus not found', busId: busId };
  }

  // --- Find the bus's current location ---
  const loc = locations.find(function (l) { return l.busId === busId; });
  if (!loc) {
    return { error: 'Location data not available for this bus', busId: busId };
  }

  // --- Validate coordinates ---
  if (
    typeof loc.latitude  !== 'number' || isNaN(loc.latitude)  ||
    typeof loc.longitude !== 'number' || isNaN(loc.longitude)
  ) {
    return { error: 'Invalid location coordinates', busId: busId };
  }

  // --- Find the assigned route ---
  if (!bus.routeId) {
    return { error: 'No route assigned to this bus', busId: busId };
  }
  const route = routes.find(function (r) { return r.id === bus.routeId; });
  if (!route) {
    return { error: 'Route not found', busId: busId };
  }

  // --- Build ordered stop objects for this route ---
  const routeStops = route.stopIds.map(function (stopId) {
    return stops.find(function (s) { return s.id === stopId; });
  });

  // Safety check — make sure every stop resolved
  if (routeStops.some(function (s) { return !s; })) {
    return { error: 'One or more route stops not found', busId: busId };
  }

  // --- Determine the final destination stop ---
  const finalStop = routeStops[routeStops.length - 1];

  // --- Check if the bus has already reached its final destination ---
  // We consider the bus "arrived" if it is within 0.01 degrees of the
  // final stop — the same threshold used in simulation.js (STEP = 0.01).
  const distToFinal = calculateDistance(
    loc.latitude, loc.longitude,
    finalStop.latitude, finalStop.longitude
  );

  // 0.01 degrees ≈ 1.1 km — the same snap threshold as simulation.js
  const ARRIVAL_THRESHOLD_KM = 1.2;

  if (distToFinal < ARRIVAL_THRESHOLD_KM) {
    return {
      busId:       busId,
      busNumber:   bus.busNumber,
      status:      'arrived',
      message:     'Bus has reached its final destination: ' + finalStop.city,
      destination: finalStop.city,
      simulated:   true,
      lastUpdated: loc.lastUpdated
    };
  }

  // --- Find upcoming stops ---
  // We walk through the stops in order. For each stop, we calculate
  // the distance from the bus's current position. We skip stops that
  // the bus has already passed — a stop is considered "passed" if it
  // is behind the bus on the route AND closer to the route's origin
  // than the bus's current position.
  //
  // Simple method: find the stop the bus is CURRENTLY closest to that
  // it has NOT yet reached. The bus is "heading toward" the first stop
  // that is ahead of it in route order.
  //
  // We define "current progress index" as the last stop that is closest
  // to the bus without being the final stop, then all stops after that
  // are "upcoming".

  // Calculate each stop's distance from the bus's current position
  const stopDistances = routeStops.map(function (stop, index) {
    const dist = calculateDistance(
      loc.latitude, loc.longitude,
      stop.latitude, stop.longitude
    );
    return { stop: stop, index: index, distance: dist };
  });

  // Find the closest stop — this tells us roughly where the bus is
  let closestIdx = 0;
  let closestDist = stopDistances[0].distance;
  for (let i = 1; i < stopDistances.length; i++) {
    if (stopDistances[i].distance < closestDist) {
      closestDist = stopDistances[i].distance;
      closestIdx  = i;
    }
  }

  // If the closest stop is the final stop, the bus is nearly there
  // but hasn't snapped yet — still show ETA to it.
  // All stops from (closestIdx) onward are "upcoming".
  // If the bus is very close to a stop (< threshold), we consider
  // it already there and start from the NEXT stop.
  let upcomingStartIdx;
  if (closestDist < ARRIVAL_THRESHOLD_KM) {
    // Bus is at this stop — upcoming starts from the next one
    upcomingStartIdx = closestIdx + 1;
  } else {
    // Bus is between stops — upcoming starts from the closest ahead
    upcomingStartIdx = closestIdx;
  }

  // All stops from upcomingStartIdx to the end of the route
  const upcomingStops = routeStops.slice(upcomingStartIdx);

  if (upcomingStops.length === 0) {
    return {
      busId:       busId,
      busNumber:   bus.busNumber,
      status:      'arrived',
      message:     'Bus has reached its final destination: ' + finalStop.city,
      destination: finalStop.city,
      simulated:   true,
      lastUpdated: loc.lastUpdated
    };
  }

  // --- Calculate cumulative distance and ETA to each upcoming stop ---
  // We calculate the distance from the bus's current position to the
  // first upcoming stop, then from stop to stop for the rest.
  //
  // Example route: Bus → Stop A → Stop B → Stop C (final)
  //   dist_to_A = distance(bus, A)
  //   dist_to_B = dist_to_A + distance(A, B)
  //   dist_to_C = dist_to_B + distance(B, C)

  const speed = loc.speed; // km/h

  let cumulativeDistKm = calculateDistance(
    loc.latitude, loc.longitude,
    upcomingStops[0].latitude,
    upcomingStops[0].longitude
  );

  const etaList = [];

  upcomingStops.forEach(function (stop, i) {
    if (i > 0) {
      // Add the leg distance from the previous stop to this one
      const prevStop = upcomingStops[i - 1];
      cumulativeDistKm += calculateDistance(
        prevStop.latitude, prevStop.longitude,
        stop.latitude,     stop.longitude
      );
    }

    const distKm   = Math.round(cumulativeDistKm * 10) / 10; // 1 decimal place
    let   etaMins  = null;

    if (speed > 0) {
      // ETA = (distance / speed) × 60
      etaMins = Math.round((cumulativeDistKm / speed) * 60);
    }

    etaList.push({
      stopId:         stop.id,
      stopName:       stop.name,
      city:           stop.city,
      distanceKm:     distKm,
      etaMinutes:     etaMins, // null if bus is stationary
      etaNote:        etaMins !== null
        ? 'Approx. ' + etaMins + ' min (simulated estimate, not actual road time)'
        : 'Bus is stationary — ETA unavailable'
    });
  });

  // --- Determine overall status ---
  let status;
  if (speed === 0) {
    status = 'stationary';
  } else {
    status = 'moving';
  }

  return {
    busId:          busId,
    busNumber:      bus.busNumber,
    routeId:        route.id,
    routeName:      route.routeName,
    currentLat:     loc.latitude,
    currentLon:     loc.longitude,
    currentSpeed:   speed,
    status:         status,
    upcomingStops:  etaList,
    nextStop:       etaList[0] || null,
    simulated:      true,
    lastUpdated:    loc.lastUpdated,
    disclaimer:     'Distances are straight-line approximations. ETA does not include traffic or road conditions.'
  };
}

// ── Exports ───────────────────────────────────────────────
module.exports = {
  calculateDistance: calculateDistance,
  calculateETA:      calculateETA
};
