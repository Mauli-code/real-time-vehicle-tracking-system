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

// --- Start the Server ---
// Begin listening for incoming requests on port 3000.
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
