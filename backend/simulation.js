// simulation.js
// Simulates bus movement along predefined routes.
//
// IMPORTANT: This is a simple demonstration only.
// - Coordinates are moved in straight lines between stop points.
// - This is NOT real road navigation or actual GPS tracking.
// - All movement data is simulated for college project purposes.
//
// How to use:
//   const sim = require('./simulation');
//   sim.moveBus('BUS001');   // move BUS001 one step toward its next stop
//   sim.runAllBuses();       // move all buses one step each

'use strict';

const fs   = require('fs');
const path = require('path');

// ── File paths ────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, 'data');
const busesPath     = path.join(DATA_DIR, 'buses.json');
const stopsPath     = path.join(DATA_DIR, 'stops.json');
const routesPath    = path.join(DATA_DIR, 'routes.json');
const locationsPath = path.join(DATA_DIR, 'locations.json');

// ── Load data ─────────────────────────────────────────────
// All four files are read once when this module is first loaded.
// If a file is missing or contains invalid JSON, the error is
// caught and an empty array is used so the server does not crash.
function loadJSON(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(text);
  } catch (err) {
    console.warn('simulation.js: Could not read ' + filePath + ' — ' + err.message);
    return [];
  }
}

let buses     = loadJSON(busesPath);
let stops     = loadJSON(stopsPath);
let routes    = loadJSON(routesPath);
let locations = loadJSON(locationsPath);

// ── Stop index tracker ────────────────────────────────────
// stopIndexMap keeps track of which stop each bus is currently
// heading toward. It is stored in memory (not in a file) so the
// file on disk only contains the resulting latitude and longitude.
//
// Key:   busId (string)
// Value: index into the route's stopIds array (number)
//        0 = heading toward the first stop (the source)
//        1 = heading toward the second stop, etc.
const stopIndexMap = {};

// ── Movement step ─────────────────────────────────────────
// STEP is how many degrees the bus moves per call to moveBus().
// 0.01 degrees ≈ 1.1 km. It is small enough to look smooth
// but large enough to reach the next stop in a few calls.
const STEP = 0.01;

// ── Helper: round to 5 decimal places ────────────────────
// Avoids very long floating-point numbers in the saved JSON.
function round5(n) {
  return Math.round(n * 100000) / 100000;
}

// ── Helper: save locations array back to locations.json ──
function saveLocations() {
  try {
    fs.writeFileSync(locationsPath, JSON.stringify(locations, null, 2), 'utf-8');
  } catch (err) {
    console.warn('simulation.js: Could not save locations.json — ' + err.message);
  }
}

// ── moveBus(busId) ────────────────────────────────────────
// Moves the bus with the given ID one step toward its next stop.
//
// Steps:
// 1. Find the bus in buses.json.
// 2. Find its assigned route in routes.json.
// 3. Build an ordered list of stop objects for that route.
// 4. Find the bus's current location in locations.json.
// 5. Determine which stop it is currently heading toward.
// 6. Move its coordinates one STEP closer to that stop.
// 7. If it has arrived at the stop, advance to the next stop.
// 8. If it has reached the final stop, set speed to 0.
// 9. Save the updated coordinates to locations.json.
//
// Returns an object describing what happened, or null on error.
function moveBus(busId) {

  // --- Step 1: Find the bus ---
  const bus = buses.find(function (b) { return b.id === busId; });
  if (!bus) {
    console.warn('simulation.js: Bus not found — ' + busId);
    return null;
  }

  // --- Step 2: Find its route ---
  if (!bus.routeId) {
    console.warn('simulation.js: ' + busId + ' has no routeId assigned');
    return null;
  }
  const route = routes.find(function (r) { return r.id === bus.routeId; });
  if (!route) {
    console.warn('simulation.js: Route not found for ' + busId + ' (routeId: ' + bus.routeId + ')');
    return null;
  }

  // --- Step 3: Build ordered stop objects ---
  // route.stopIds is an array of stop ID strings like ["STOP001", "STOP004"].
  // We map each ID to the full stop object from stops.json.
  const routeStops = route.stopIds.map(function (stopId) {
    return stops.find(function (s) { return s.id === stopId; });
  });

  // Safety check — make sure every stop was found
  const missingStop = routeStops.some(function (s) { return !s; });
  if (missingStop) {
    console.warn('simulation.js: One or more stops not found for route ' + route.id);
    return null;
  }

  if (routeStops.length < 2) {
    console.warn('simulation.js: Route ' + route.id + ' has fewer than 2 stops — cannot simulate');
    return null;
  }

  // --- Step 4: Find the current location record ---
  const locIndex = locations.findIndex(function (l) { return l.busId === busId; });
  if (locIndex === -1) {
    console.warn('simulation.js: No location record found for ' + busId);
    return null;
  }
  const loc = locations[locIndex]; // direct reference — changes here affect the array

  // --- Step 5: Determine current target stop index ---
  // If this bus has never been moved before, initialise its stopIndexMap entry to 1
  // (index 0 is the starting stop; the bus is already moving toward stop 1).
  if (stopIndexMap[busId] === undefined) {
    stopIndexMap[busId] = 1;
  }

  const targetIdx = stopIndexMap[busId];

  // If the bus has already reached the final stop, do nothing
  if (targetIdx >= routeStops.length) {
    console.log('simulation.js: ' + busId + ' has already reached its final destination.');
    return { busId: busId, status: 'at_destination', latitude: loc.latitude, longitude: loc.longitude };
  }

  const targetStop = routeStops[targetIdx];

  // --- Step 6: Move one step toward the target stop ---
  // Calculate the difference in latitude and longitude between
  // the current position and the target stop.
  const latDiff = targetStop.latitude  - loc.latitude;
  const lonDiff = targetStop.longitude - loc.longitude;

  // Calculate the straight-line distance (approximate, in degrees).
  // Math.sqrt(a² + b²) is the Pythagorean theorem.
  const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

  let newLat, newLon, arrived;

  if (distance <= STEP) {
    // The bus is close enough — snap it directly to the target stop
    newLat  = targetStop.latitude;
    newLon  = targetStop.longitude;
    arrived = true;
  } else {
    // Move STEP degrees in the direction of the target stop.
    // We normalise the direction by dividing by distance, then multiply by STEP.
    // This ensures the bus moves exactly STEP degrees regardless of direction.
    newLat  = round5(loc.latitude  + (latDiff / distance) * STEP);
    newLon  = round5(loc.longitude + (lonDiff / distance) * STEP);
    arrived = false;
  }

  // --- Step 7: Update the location record ---
  const prevLat = loc.latitude;
  const prevLon = loc.longitude;

  loc.latitude    = round5(newLat);
  loc.longitude   = round5(newLon);
  loc.lastUpdated = new Date().toISOString();
  loc.note        = 'SIMULATED DEMO DATA — not real GPS';

  // --- Step 8: Handle arrival ---
  if (arrived) {
    stopIndexMap[busId] = targetIdx + 1; // advance to the next stop

    const isLastStop = (targetIdx + 1 >= routeStops.length);
    if (isLastStop) {
      loc.speed = 0; // bus has reached its final destination
      console.log('simulation.js: ' + busId + ' reached final destination — ' + targetStop.city);
    } else {
      const nextStop = routeStops[targetIdx + 1];
      console.log('simulation.js: ' + busId + ' arrived at ' + targetStop.city + ', now heading to ' + nextStop.city);
    }
  }

  // --- Step 9: Save to file ---
  saveLocations();

  return {
    busId:      busId,
    status:     arrived ? 'arrived_at_stop' : 'moving',
    prevLat:    prevLat,
    prevLon:    prevLon,
    newLat:     loc.latitude,
    newLon:     loc.longitude,
    targetStop: targetStop.city,
    speed:      loc.speed
  };
}

// ── runAllBuses() ─────────────────────────────────────────
// Calls moveBus() once for every bus in buses.json.
// Returns an array of result objects.
function runAllBuses() {
  const results = [];
  buses.forEach(function (bus) {
    const result = moveBus(bus.id);
    if (result) {
      results.push(result);
    }
  });
  return results;
}

// ── reloadData() ──────────────────────────────────────────
// Re-reads all JSON files from disk.
// Useful after external changes to the data files.
function reloadData() {
  buses     = loadJSON(busesPath);
  stops     = loadJSON(stopsPath);
  routes    = loadJSON(routesPath);
  locations = loadJSON(locationsPath);
}

// ── Exports ───────────────────────────────────────────────
module.exports = {
  moveBus:    moveBus,
  runAllBuses: runAllBuses,
  reloadData: reloadData
};
