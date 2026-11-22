# Real-Time Vehicle Tracking System

A college project that tracks the live location of government buses
across Himachal Pradesh, displayed in a browser without any app install.

---

## Technologies Used

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Node.js, Express.js               |
| Frontend | HTML, CSS, Vanilla JavaScript     |

---

## Folder Structure

```
real-time-vehicle-tracking-system/
├── backend/
│   ├── server.js        # Express server — API routes and static file serving
│   ├── package.json     # Backend dependencies and npm scripts
│   └── node_modules/    # Installed packages (not committed to Git)
├── frontend/
│   ├── index.html       # Main webpage
│   ├── style.css        # Page styles
│   └── script.js        # Browser-side JavaScript
├── .gitignore           # Files and folders excluded from Git
└── README.md            # This file
```

---

## How to Run

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Start the server

```bash
# Standard mode
npm start

# Development mode — server restarts automatically when you save a file
npm run dev
```

### 3. Open in browser

```
http://localhost:3000
```

---

## API Routes

| Method | Route         | Description                        |
|--------|---------------|------------------------------------|
| GET    | `/api/health` | Returns `{ "status": "ok" }` to confirm the server is running |

---

## Project Progress

- [x] Day 1 — Backend and frontend folder structure, Express server, health API
