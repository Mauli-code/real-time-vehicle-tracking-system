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

// --- Start the Server ---
// Begin listening for incoming requests on port 3000.
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
