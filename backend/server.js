// server.js
// This is the main backend file.
// It creates an Express web server, serves the frontend files,
// and provides API routes for the application.

const express = require('express'); // Load the Express library
const path = require('path');       // Built-in Node.js module for handling file paths
const fs = require('fs');           // Built-in Node.js module for reading files

const app = express(); // Create an Express application
const PORT = 3000;     // The port the server will listen on

// --- Load Bus Data ---
// Read buses.json once when the server starts and store it in memory.
// fs.readFileSync reads the file contents as a string.
// JSON.parse converts that string into a JavaScript array we can work with.
const busesFilePath = path.join(__dirname, 'data', 'buses.json');
const buses = JSON.parse(fs.readFileSync(busesFilePath, 'utf-8'));

// --- Load Bus Stops Data ---
// Same approach as buses — read stops.json once at startup and keep it in memory.
const stopsFilePath = path.join(__dirname, 'data', 'stops.json');
const stops = JSON.parse(fs.readFileSync(stopsFilePath, 'utf-8'));

// --- Load Routes Data ---
// Read routes.json once at startup.
// Each route has an ordered array of stopIds that link to stops.json.
const routesFilePath = path.join(__dirname, 'data', 'routes.json');
const routes = JSON.parse(fs.readFileSync(routesFilePath, 'utf-8'));

// --- Load & Validate GPS Location Data ---
// Read locations.json once at startup and store in memory.
const locationsFilePath = path.join(__dirname, 'data', 'locations.json');
const locations = JSON.parse(fs.readFileSync(locationsFilePath, 'utf-8'));

// --- Load Simulation Module ---
// simulation.js handles bus movement logic.
// It is a separate module loaded with require() — same as Express.
const simulation = require('./simulation');

// --- Load ETA Module ---
// eta.js calculates estimated arrival times from current location and route data.
const eta = require('./eta');

// validateLocations(locations, buses)
// Runs simple checks on the locations array when the server starts.
// If any record is invalid, a warning is printed to the console.
// The server still starts — invalid records are logged, not crashed on.
function validateLocations(locationList, busList) {
  const seenBusIds = []; // track bus IDs we have already seen (for duplicate check)

  locationList.forEach(function (loc, index) {
    const label = 'locations.json[' + index + '] (busId: ' + loc.busId + ')';

    // Check 1: busId must match an existing bus
    const busExists = busList.find(function (b) { return b.id === loc.busId; });
    if (!busExists) {
      console.warn('⚠ WARNING ' + label + ' — busId does not match any bus in buses.json');
    }

    // Check 2: latitude must be between -90 and 90
    if (typeof loc.latitude !== 'number' || loc.latitude < -90 || loc.latitude > 90) {
      console.warn('⚠ WARNING ' + label + ' — invalid latitude: ' + loc.latitude);
    }

    // Check 3: longitude must be between -180 and 180
    if (typeof loc.longitude !== 'number' || loc.longitude < -180 || loc.longitude > 180) {
      console.warn('⚠ WARNING ' + label + ' — invalid longitude: ' + loc.longitude);
    }

    // Check 4: speed must be a non-negative number
    if (typeof loc.speed !== 'number' || loc.speed < 0) {
      console.warn('⚠ WARNING ' + label + ' — invalid speed: ' + loc.speed);
    }

    // Check 5: no duplicate busId entries
    if (seenBusIds.includes(loc.busId)) {
      console.warn('⚠ WARNING ' + label + ' — duplicate busId found');
    } else {
      seenBusIds.push(loc.busId);
    }
  });

  console.log('✔ Location data validation complete (' + locationList.length + ' records checked)');
}

// Run validation immediately when the server starts
validateLocations(locations, buses);

// --- Middleware ---

// Serve all files inside the "frontend" folder as static files.
// When someone visits http://localhost:3000, Express looks inside
// ../frontend and sends back index.html automatically.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Allow Express to read JSON from incoming request bodies
app.use(express.json());

// --- API Routes ---

// GET /api/health
// A simple health check route.
// When called, it confirms the server is up and running.
// Returns: { "status": "ok" }
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/buses
// Returns the full list of all buses as a JSON array.
// Example response: [ { "id": "BUS001", ... }, { "id": "BUS002", ... }, ... ]
app.get('/api/buses', (req, res) => {
  res.json(buses);
});

// GET /api/buses/:id
// Returns a single bus whose id matches the value in the URL.
// :id is a route parameter — Express puts whatever the user types after
// /api/buses/ into req.params.id automatically.
//
// Example: GET /api/buses/BUS001  →  returns the bus with id "BUS001"
// Example: GET /api/buses/BUS999  →  returns 404 { "error": "Bus not found" }
app.get('/api/buses/:id', (req, res) => {
  const busId = req.params.id;                             // Read the id from the URL
  const bus = buses.find((b) => b.id === busId);           // Search the array for a match

  if (!bus) {
    // No bus matched — send a 404 (Not Found) status with an error message
    return res.status(404).json({ error: 'Bus not found' });
  }

  res.json(bus); // Bus found — send it back as JSON
});

// --- Bus Stops API Routes ---

// GET /api/stops
// Returns the full list of all bus stops as a JSON array.
// Example response: [ { "id": "STOP001", "name": "Shimla Bus Stand", ... }, ... ]
app.get('/api/stops', (req, res) => {
  res.json(stops);
});

// GET /api/stops/:id
// Returns a single bus stop whose id matches the value in the URL.
//
// Example: GET /api/stops/STOP001  →  returns Shimla Bus Stand
// Example: GET /api/stops/STOP999  →  returns 404 { "error": "Stop not found" }
app.get('/api/stops/:id', (req, res) => {
  const stopId = req.params.id;                            // Read the id from the URL
  const stop = stops.find((s) => s.id === stopId);         // Search the array for a match

  if (!stop) {
    // No stop matched — send a 404 (Not Found) status with an error message
    return res.status(404).json({ error: 'Stop not found' });
  }

  res.json(stop); // Stop found — send it back as JSON
});

// --- Routes API ---

// getStopsForRoute(route)
// A helper function used by both /api/routes/:id and /api/buses/:id/route.
// Takes a route object and returns the same route but with the full stop
// objects attached, in the order defined by route.stopIds.
//
// route.stopIds is an array like ["STOP001", "STOP004", "STOP006"].
// array.map() loops through each ID and uses array.find() to look up
// the matching stop object from the stops array.
// The result is a new array of full stop objects in travel order.
function getStopsForRoute(route) {
  const orderedStops = route.stopIds.map(function (stopId) {
    return stops.find(function (s) { return s.id === stopId; });
  });

  // Return the route with a new field "stops" containing the full stop details.
  // We use Object.assign to copy all existing route fields and add "stops".
  return Object.assign({}, route, { stops: orderedStops });
}

// GET /api/routes
// Returns all routes. Each route includes the full stop details in order.
app.get('/api/routes', (req, res) => {
  // Build the enriched version of every route and send the array
  const enrichedRoutes = routes.map(getStopsForRoute);
  res.json(enrichedRoutes);
});

// GET /api/routes/:id
// Returns one route by ID, with its ordered stop details included.
//
// Example: GET /api/routes/ROUTE001  →  Shimla-Manali route with 4 stops
// Example: GET /api/routes/ROUTE999  →  404 { "error": "Route not found" }
app.get('/api/routes/:id', (req, res) => {
  const routeId = req.params.id;
  const route = routes.find((r) => r.id === routeId);

  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }

  res.json(getStopsForRoute(route));
});

// GET /api/buses/:id/route
// Returns the route that belongs to a specific bus, with ordered stop details.
// This is a nested route — the bus ID comes first, then /route at the end.
//
// Example: GET /api/buses/BUS001/route  →  ROUTE001 with 4 stops
// Example: GET /api/buses/BUS999/route  →  404 { "error": "Bus not found" }
// Example: GET /api/buses/BUS001/route  →  404 if bus has no routeId linked
app.get('/api/buses/:id/route', (req, res) => {
  const busId = req.params.id;
  const bus = buses.find((b) => b.id === busId);

  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  // Check whether this bus has a routeId field
  if (!bus.routeId) {
    return res.status(404).json({ error: 'No route assigned to this bus' });
  }

  // Look up the route using the bus's routeId
  const route = routes.find((r) => r.id === bus.routeId);

  if (!route) {
    return res.status(404).json({ error: 'Route not found for this bus' });
  }

  res.json(getStopsForRoute(route));
});

// --- GPS Locations API ---

// buildLocationResponse(location, bus)
// A helper function used by both location endpoints.
// Takes a raw location record and its matching bus object, and returns
// a clean response object that includes busNumber and simulated: true.
//
// We use Object.assign() to copy all fields from the location record,
// then add the extra fields on top. The original location object is
// not modified.
function buildLocationResponse(location, bus) {
  return Object.assign({}, location, {
    busNumber: bus.busNumber,  // pull busNumber from the matching bus record
    simulated: true            // clearly flag this as simulated demo data
  });
}

// GET /api/locations
// Returns the simulated GPS location for every bus.
// Each result includes busId, busNumber, latitude, longitude,
// speed, lastUpdated, and simulated: true.
// Reads locations.json fresh each time so simulation updates are reflected.
app.get('/api/locations', (req, res) => {
  const freshLocations = JSON.parse(fs.readFileSync(locationsFilePath, 'utf-8'));

  const enrichedLocations = freshLocations.map(function (location) {
    const bus = buses.find(function (b) { return b.id === location.busId; });
    if (!bus) {
      return location;
    }
    return buildLocationResponse(location, bus);
  });

  res.json(enrichedLocations);
});

// GET /api/locations/:busId
// Returns the simulated GPS location for one specific bus.
// Reads locations.json fresh each time so simulation updates are reflected.
app.get('/api/locations/:busId', (req, res) => {
  const busId          = req.params.busId;
  const freshLocations = JSON.parse(fs.readFileSync(locationsFilePath, 'utf-8'));
  const location       = freshLocations.find((loc) => loc.busId === busId);

  if (!location) {
    return res.status(404).json({ error: 'Location not found for this bus' });
  }

  const bus = buses.find((b) => b.id === busId);
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  res.json(buildLocationResponse(location, bus));
});

// GET /api/buses/:id/location
// Returns the simulated GPS location of a specific bus.
// Reads locations.json fresh each time so simulation updates are reflected.
app.get('/api/buses/:id/location', (req, res) => {
  const busId = req.params.id;

  const bus = buses.find((b) => b.id === busId);
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  const freshLocations = JSON.parse(fs.readFileSync(locationsFilePath, 'utf-8'));
  const location       = freshLocations.find((loc) => loc.busId === busId);
  if (!location) {
    return res.status(404).json({ error: 'No location data found for this bus' });
  }

  res.json(buildLocationResponse(location, bus));
});

// --- ETA API ---

// GET /api/buses/:id/eta
// Returns estimated arrival times for a bus to reach its upcoming stops.
// Uses the bus's current simulated location and speed from locations.json.
//
// Example: GET /api/buses/BUS001/eta
app.get('/api/buses/:id/eta', (req, res) => {
  const busId = req.params.id;
  const result = eta.calculateETA(busId);

  // If the result contains an 'error' field, something went wrong
  if (result.error) {
    if (result.error === 'Bus not found') {
      return res.status(404).json(result);
    }
    return res.status(400).json(result);
  }

  res.json(result);
});

// --- Simulation API ---
// Moves a single bus one step along its route.
// Returns the movement result — previous and new coordinates.
//
// Example: POST /api/simulate/BUS001
// Use POST (not GET) because this action changes data on the server.
app.post('/api/simulate/:busId', (req, res) => {
  const busId = req.params.busId;

  // Call moveBus() from simulation.js
  const result = simulation.moveBus(busId);

  if (!result) {
    return res.status(404).json({ error: 'Could not simulate movement for bus: ' + busId });
  }

  // Reload the locations data so subsequent GET /api/locations calls
  // return the updated coordinates written by simulation.js
  simulation.reloadData();

  res.json(result);
});

// POST /api/simulate
// Moves ALL buses one step along their routes.
// Returns an array of movement results.
app.post('/api/simulate', (req, res) => {
  const results = simulation.runAllBuses();

  // Reload data so GET /api/locations reflects the new positions
  simulation.reloadData();

  res.json(results);
});

// --- Start the Server ---
// Begin listening for incoming requests on port 3000.
// Once the server is ready, we start the automatic location simulation.

// SIMULATION_INTERVAL controls how often bus positions are updated (in milliseconds).
// 10000 = 10 seconds. Easy to change for testing or demos.
const SIMULATION_INTERVAL = 10000;

// simulationTimer holds the ID returned by setInterval().
// We store it so we can stop the timer cleanly when the server shuts down.
// null means the timer is not running yet.
let simulationTimer = null;

// startSimulation()
// Starts a repeating timer that calls simulation.runAllBuses() every
// SIMULATION_INTERVAL milliseconds.
//
// setInterval(callback, delay) is a built-in Node.js function.
// It runs the callback function repeatedly, waiting 'delay' ms between each run.
// It returns a timer ID that we can pass to clearInterval() to stop it.
//
// We check simulationTimer !== null first to make sure we do not accidentally
// start two timers running at the same time (which would cause double updates).
function startSimulation() {
  if (simulationTimer !== null) {
    console.log('Simulation is already running. Not starting a second timer.');
    return;
  }

  simulationTimer = setInterval(function () {
    // Move every bus one step along its route
    const results = simulation.runAllBuses();

    // Print a short summary to the terminal so you can see it working
    const moving   = results.filter(function (r) { return r.status === 'moving'; }).length;
    const arrived  = results.filter(function (r) { return r.status === 'arrived_at_stop'; }).length;
    const finished = results.filter(function (r) { return r.status === 'at_destination'; }).length;

    console.log(
      '[Simulation] ' + new Date().toLocaleTimeString() +
      ' — moved: ' + moving +
      ', arrived at stop: ' + arrived +
      ', at destination: ' + finished
    );
  }, SIMULATION_INTERVAL);

  console.log('✔ Automatic bus simulation started (interval: ' + SIMULATION_INTERVAL / 1000 + 's)');
  console.log('  NOTE: All location updates are SIMULATED DEMO DATA — not real GPS.');
}

// stopSimulation()
// Stops the repeating timer by passing the timer ID to clearInterval().
// After this call, runAllBuses() will no longer be called automatically.
function stopSimulation() {
  if (simulationTimer !== null) {
    clearInterval(simulationTimer);
    simulationTimer = null;
    console.log('Simulation timer stopped.');
  }
}

// Start the Express server, then start the simulation inside the callback.
// The callback runs only once — after the server has successfully bound to PORT.
// Starting the simulation here ensures the server is ready before updates begin.
const server = app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  startSimulation();
});

// Handle graceful shutdown.
// SIGINT  is sent when you press Ctrl+C in the terminal.
// SIGTERM is sent by process managers (e.g. when deploying to a server).
// We stop the simulation timer and close the HTTP server cleanly before exiting.
function shutdown(signal) {
  console.log('\nReceived ' + signal + '. Shutting down...');
  stopSimulation();
  server.close(function () {
    console.log('HTTP server closed. Goodbye.');
    process.exit(0);
  });
}

process.on('SIGINT',  function () { shutdown('SIGINT');  });
process.on('SIGTERM', function () { shutdown('SIGTERM'); });
