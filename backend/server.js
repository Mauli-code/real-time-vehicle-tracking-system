// server.js
// This is the main backend file.
// It creates an Express web server, serves the frontend files,
// and provides API routes for the application.

const express = require('express'); // Load the Express library
const path = require('path');       // Built-in Node.js module for handling file paths

const app = express(); // Create an Express application
const PORT = 3000;     // The port the server will listen on

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

// --- Start the Server ---
// Begin listening for incoming requests on port 3000.
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
