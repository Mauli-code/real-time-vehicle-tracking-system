// script.js
// This file runs in the browser.
//
// When the user clicks "Check Server Health", it sends a request
// to our Express backend at /api/health and shows the response on the page.

// Grab references to the HTML elements we need
const checkBtn = document.getElementById('checkBtn');
const statusResult = document.getElementById('statusResult');

// Listen for a click on the button
checkBtn.addEventListener('click', async () => {

  // Show a temporary "Checking..." message while we wait
  statusResult.textContent = 'Checking...';
  statusResult.style.color = '#888';

  try {
    // Send a GET request to the /api/health route on our Express server.
    // Because this page is served by Express itself, we can use a relative URL.
    const response = await fetch('/api/health');

    // Parse the JSON response body into a JavaScript object
    const data = await response.json();

    // Check the value of "status" in the response
    if (data.status === 'ok') {
      statusResult.textContent = '✅ Server is running! Status: ' + data.status;
      statusResult.style.color = 'green';
    } else {
      statusResult.textContent = '⚠️ Unexpected response: ' + JSON.stringify(data);
      statusResult.style.color = 'orange';
    }

  } catch (error) {
    // This block runs if the server is unreachable (e.g. not started yet)
    statusResult.textContent = '❌ Could not reach the server. Make sure it is running.';
    statusResult.style.color = 'red';
  }
});

// ─────────────────────────────────────────────────────────
//  Bus List  (added in Commit 3)
//  Fetches all buses from /api/buses and displays them as
//  cards on the page. Runs automatically when the page loads.
// ─────────────────────────────────────────────────────────

// Get the container div where bus cards will be placed
const busContainer = document.getElementById('busContainer');

// allBuses holds the full list fetched from the API.
// It is declared here (outside loadBuses) so the search
// function added in Commit 4 can also read it.
let allBuses = [];

// buildBusCard(bus)
// Takes one bus object and returns an HTML string for a card.
// We build the HTML as a string and use innerHTML to insert it.
// This avoids creating many separate DOM elements manually.
function buildBusCard(bus) {
  // Decide which CSS class and label to use for the availability badge
  const badgeClass = bus.available ? 'available' : 'unavailable';
  const badgeText  = bus.available ? '✅ Available' : '❌ Not Available';

  // Return the full HTML block for one bus card
  return `
    <div class="bus-card">

      <div class="bus-card-header">
        <span class="bus-number">${bus.busNumber}</span>
        <span class="status-badge ${badgeClass}">${badgeText}</span>
      </div>

      <div class="bus-route">
        ${bus.source}
        <span class="arrow">→</span>
        ${bus.destination}
      </div>

      <div class="bus-details">

        <div class="detail-item">
          <span class="label">Route</span>
          <span class="value">${bus.routeName}</span>
        </div>

        <div class="detail-item">
          <span class="label">Bus ID</span>
          <span class="value">${bus.id}</span>
        </div>

        <div class="detail-item">
          <span class="label">Fuel Type</span>
          <span class="value">${bus.fuelType}</span>
        </div>

        <div class="detail-item">
          <span class="label">Emission</span>
          <span class="value">${bus.emissionStandard}</span>
        </div>

      </div>

      <!-- View Route button — passes the bus ID to showRoute() when clicked -->
      <button class="btn-view-route" onclick="showRoute('${bus.id}')">
        🗺 View Route
      </button>

      <!-- View Location button — passes the bus ID to showLocation() when clicked -->
      <button class="btn-view-location" onclick="showLocation('${bus.id}')">
        📍 View Location
      </button>

    </div>
  `;
}

// renderBuses(list)
// Takes an array of bus objects and injects their cards into #busContainer.
// Both loadBuses() and filterBuses() call this function to show cards,
// so we write the rendering logic once here instead of repeating it.
function renderBuses(list) {
  if (list.length === 0) {
    busContainer.innerHTML = '<p class="empty-msg">No buses found.</p>';
    return;
  }

  const allCardsHTML = list.map(buildBusCard).join('');
  busContainer.innerHTML = '<div class="bus-grid">' + allCardsHTML + '</div>';
}

// loadBuses()
// Calls GET /api/buses, stores the result in allBuses,
// then renders all cards on the page.
async function loadBuses() {
  try {
    // Send a GET request to our Express API
    const response = await fetch('/api/buses');

    // If the server responded but with an error status (e.g. 500),
    // throw an error so we fall into the catch block below
    if (!response.ok) {
      throw new Error('Server returned status ' + response.status);
    }

    // Convert the response body from JSON text to a JavaScript array
    // and save it in allBuses so the search function can use it too
    allBuses = await response.json();

    // Check if the array is empty
    if (allBuses.length === 0) {
      busContainer.innerHTML = '<p class="empty-msg">No buses available at the moment.</p>';
      return;
    }

    // Show all buses when the page first loads
    renderBuses(allBuses);

    // Fill the source and destination dropdowns with values from the loaded data
    populateDropdowns();

  } catch (error) {
    // Show a friendly error message if the fetch failed completely
    busContainer.innerHTML =
      '<p class="error-msg">❌ Could not load bus data. Make sure the server is running.</p>';
  }
}

// Call loadBuses() immediately when the page loads.
// No button click needed — the buses appear as soon as the page opens.
loadBuses();

// ─────────────────────────────────────────────────────────
//  Bus Search  (added in Commit 4, unified in Commit 5)
//  Filters the already-loaded allBuses array as the user
//  types. No extra API call is made — filtering happens
//  entirely in the browser using array.filter().
// ─────────────────────────────────────────────────────────

const searchInput = document.getElementById('searchInput');

// Listen for every keystroke in the search input.
// 'input' fires each time the value changes — when typing, pasting, or deleting.
// This makes the search feel instant, with no button to click.
searchInput.addEventListener('input', applyFilters);

// ─────────────────────────────────────────────────────────
//  Dropdown Filters  (added in Commit 5)
//  Two <select> dropdowns let the user filter by source
//  and/or destination. They work together with the search
//  box — all three controls are read at the same time
//  inside applyFilters().
// ─────────────────────────────────────────────────────────

const sourceFilter      = document.getElementById('sourceFilter');
const destinationFilter = document.getElementById('destinationFilter');
const resetBtn          = document.getElementById('resetBtn');

// populateDropdowns()
// Reads the allBuses array and fills the two <select> elements
// with one <option> per unique source / destination value.
// Called once after loadBuses() finishes fetching the data.
function populateDropdowns() {

  // Collect every unique source value from allBuses.
  // We use an array and only push a value if it is not already in the array.
  const sources = [];
  allBuses.forEach(function (bus) {
    if (!sources.includes(bus.source)) {
      sources.push(bus.source);
    }
  });

  // Collect every unique destination value the same way
  const destinations = [];
  allBuses.forEach(function (bus) {
    if (!destinations.includes(bus.destination)) {
      destinations.push(bus.destination);
    }
  });

  // Add one <option> element to the source dropdown for each unique source.
  // The "All Sources" option is already in the HTML, so we only add the rest.
  sources.forEach(function (source) {
    const option = document.createElement('option'); // create a new <option> tag
    option.value = source;                           // the value sent when selected
    option.textContent = source;                     // the text the user sees
    sourceFilter.appendChild(option);               // add it to the <select>
  });

  // Do the same for destinations
  destinations.forEach(function (destination) {
    const option = document.createElement('option');
    option.value = destination;
    option.textContent = destination;
    destinationFilter.appendChild(option);
  });
}

// applyFilters()
// Reads the search box, source dropdown, and destination dropdown
// all at once, then filters allBuses to find buses that match
// every active filter simultaneously.
//
// This replaces the old filterBuses() from Commit 4 — same idea,
// but now it checks three controls instead of one.
function applyFilters() {
  const query       = searchInput.value.trim().toLowerCase(); // text search
  const srcValue    = sourceFilter.value;                     // selected source ("" means All)
  const destValue   = destinationFilter.value;                // selected destination

  const results = allBuses.filter(function (bus) {

    // --- Search box check ---
    // If the query is not empty, the bus must match in at least one field.
    // If the query is empty, this check is skipped (always true).
    let matchesSearch = true;
    if (query !== '') {
      matchesSearch =
        bus.busNumber.toLowerCase().includes(query)   ||
        bus.source.toLowerCase().includes(query)      ||
        bus.destination.toLowerCase().includes(query);
    }

    // --- Source dropdown check ---
    // If a source is selected, the bus's source must equal it exactly.
    // If "All Sources" is selected, srcValue is "" so this is always true.
    let matchesSource = true;
    if (srcValue !== '') {
      matchesSource = (bus.source === srcValue);
    }

    // --- Destination dropdown check ---
    // Same logic as source.
    let matchesDestination = true;
    if (destValue !== '') {
      matchesDestination = (bus.destination === destValue);
    }

    // Keep this bus only if ALL three checks passed
    return matchesSearch && matchesSource && matchesDestination;
  });

  renderBuses(results);
}

// Wire the dropdowns to applyFilters so the list updates the moment
// the user picks a different option.
sourceFilter.addEventListener('change', applyFilters);
destinationFilter.addEventListener('change', applyFilters);

// resetFilters()
// Clears the search box and resets both dropdowns to their default
// "All" option, then shows every bus.
function resetFilters() {
  searchInput.value       = '';  // clear the text input
  sourceFilter.value      = '';  // reset to "All Sources"
  destinationFilter.value = '';  // reset to "All Destinations"
  renderBuses(allBuses);         // show all buses
}

resetBtn.addEventListener('click', resetFilters);

// ─────────────────────────────────────────────────────────
//  Route Details Panel  (added in Commit 9)
//
//  showRoute(busId)  — called when "View Route" is clicked.
//    Fetches GET /api/buses/:id/route and renders the stop list.
//
//  closeRoute()      — called when "Close" is clicked.
//    Hides the panel.
// ─────────────────────────────────────────────────────────

// Get references to the three panel elements
const routePanel        = document.getElementById('routePanel');
const routePanelTitle   = document.getElementById('routePanelTitle');
const routePanelContent = document.getElementById('routePanelContent');
const closeRouteBtn     = document.getElementById('closeRouteBtn');

// closeRoute()
// Hides the route panel by adding the "hidden" CSS class back.
function closeRoute() {
  routePanel.classList.add('hidden');
  routePanelContent.innerHTML = ''; // clear old content
}

// Wire the Close button
closeRouteBtn.addEventListener('click', closeRoute);

// showRoute(busId)
// Fetches the route for the given bus ID and displays it in the panel.
// This is an async function so we can use await inside it.
async function showRoute(busId) {

  // 1. Show the panel immediately with a loading message
  routePanelTitle.textContent = 'Route Details';
  routePanelContent.innerHTML = '<p class="route-loading">Loading route...</p>';
  routePanel.classList.remove('hidden'); // make the panel visible

  // 2. Scroll the panel into view so the user sees it without scrolling manually
  routePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    // 3. Fetch the route from our Express API
    //    The URL uses the busId passed in — e.g. /api/buses/BUS001/route
    const response = await fetch('/api/buses/' + busId + '/route');

    // 4. If the server returns an error status (e.g. 404), handle it
    if (!response.ok) {
      routePanelContent.innerHTML =
        '<p class="route-error">❌ No route found for this bus.</p>';
      return;
    }

    // 5. Parse the JSON response into a JavaScript object
    const route = await response.json();

    // 6. Update the panel title with the route name
    routePanelTitle.textContent = '🗺 ' + route.routeName;

    // 7. Build the route summary line: Source → Destination + demo badge
    const summaryHTML =
      '<div class="route-summary">' +
        route.source +
        '<span class="arrow"> → </span>' +
        route.destination +
        '<span class="demo-badge">Demo Data</span>' +
      '</div>';

    // 8. Build the ordered stop list
    //    route.stops is an array of stop objects in travel order.
    //    We loop through them with forEach and build an <li> for each one.
    let stopsHTML = '<ul class="stop-list">';

    route.stops.forEach(function (stop, index) {
      // index starts at 0, so we add 1 to get a human-readable stop number
      stopsHTML +=
        '<li class="stop-item">' +
          '<span class="stop-number">' + (index + 1) + '</span>' +
          '<span class="stop-name">' + stop.name + '</span>' +
          '<span class="stop-city">' + stop.city + '</span>' +
        '</li>';
    });

    stopsHTML += '</ul>';

    // 9. Inject the summary and stop list into the panel
    routePanelContent.innerHTML = summaryHTML + stopsHTML;

  } catch (error) {
    // This block runs if the fetch itself failed (server not running, network error)
    routePanelContent.innerHTML =
      '<p class="route-error">❌ Could not load route. Make sure the server is running.</p>';
  }
}

// ─────────────────────────────────────────────────────────
//  Location Panel  (added in Commit 12, enhanced in Commit 16)
//
//  showLocation(busId)       — called when "View Location" is clicked.
//  refreshLocationDisplay()  — called by the auto-refresh timer.
//  startLocationRefresh()    — starts the 10-second refresh timer.
//  stopLocationRefresh()     — cancels the timer.
//  closeLocation()           — stops the timer and hides the panel.
// ─────────────────────────────────────────────────────────

// Get references to the location panel elements
const locationPanel        = document.getElementById('locationPanel');
const locationPanelTitle   = document.getElementById('locationPanelTitle');
const locationPanelContent = document.getElementById('locationPanelContent');
const closeLocationBtn     = document.getElementById('closeLocationBtn');

// currentBusId stores which bus is currently being tracked.
// When the user clicks "View Location" on a different bus,
// we update this variable and the refresh timer uses the new ID.
let currentBusId = null;

// locationRefreshTimer holds the ID returned by setInterval().
// null means no timer is running.
let locationRefreshTimer = null;

// LOCATION_REFRESH_INTERVAL — how often to fetch updated coordinates (ms).
const LOCATION_REFRESH_INTERVAL = 10000; // 10 seconds

// stopLocationRefresh()
// Cancels the refresh timer.
// Called when the user closes the panel or selects a different bus.
function stopLocationRefresh() {
  if (locationRefreshTimer !== null) {
    clearInterval(locationRefreshTimer);
    locationRefreshTimer = null;
  }
}

// startLocationRefresh()
// Starts a repeating timer that calls refreshLocationDisplay() every
// LOCATION_REFRESH_INTERVAL milliseconds.
//
// Before starting, it always cancels any existing timer first.
// This prevents two timers running simultaneously if the user
// quickly clicks "View Location" on two different buses.
function startLocationRefresh() {
  stopLocationRefresh(); // cancel any old timer first

  locationRefreshTimer = setInterval(function () {
    refreshLocationDisplay();
  }, LOCATION_REFRESH_INTERVAL);
}

// closeLocation()
// Stops the refresh timer and hides the location panel.
function closeLocation() {
  stopLocationRefresh();
  currentBusId = null;
  locationPanel.classList.add('hidden');
  locationPanelContent.innerHTML = '';
}

// Wire the Close button
closeLocationBtn.addEventListener('click', closeLocation);

// formatDateTime(isoString)
// Converts an ISO date-time string like "2026-11-23T08:30:00Z"
// into a readable format like "23 Nov 2026, 08:30:00".
function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// updateTrackingStatus(message, cssClass)
// Updates the small status badge inside the location panel.
// cssClass is one of: 'status-active', 'status-updating', 'status-error', 'status-stopped'
function updateTrackingStatus(message, cssClass) {
  const statusEl = document.getElementById('trackingStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className   = 'tracking-status ' + cssClass;
}

// buildLocationGridHTML(loc)
// Builds the two-column detail grid HTML for a location object.
// Uses fixed element IDs (loc-lat, loc-lon, etc.) so refreshLocationDisplay()
// can update individual fields without rebuilding the whole panel.
function buildLocationGridHTML(loc) {
  const readableTime = formatDateTime(loc.lastUpdated);

  return (
    '<div class="location-grid">' +

      '<div class="location-item">' +
        '<span class="loc-label">Bus Number</span>' +
        '<span class="loc-value" id="loc-busNumber">' + loc.busNumber + '</span>' +
      '</div>' +

      '<div class="location-item">' +
        '<span class="loc-label">Bus ID</span>' +
        '<span class="loc-value" id="loc-busId">' + loc.busId + '</span>' +
      '</div>' +

      '<div class="location-item">' +
        '<span class="loc-label">Latitude</span>' +
        '<span class="loc-value" id="loc-lat">' + loc.latitude + '°</span>' +
      '</div>' +

      '<div class="location-item">' +
        '<span class="loc-label">Longitude</span>' +
        '<span class="loc-value" id="loc-lon">' + loc.longitude + '°</span>' +
      '</div>' +

      '<div class="location-item">' +
        '<span class="loc-label">Speed</span>' +
        '<span class="loc-value" id="loc-speed">' + loc.speed + ' km/h</span>' +
      '</div>' +

      '<div class="location-item">' +
        '<span class="loc-label">Last Updated</span>' +
        '<span class="loc-value" id="loc-updated">' + readableTime + '</span>' +
      '</div>' +

    '</div>'
  );
}

// updateMapFrame(loc)
// Updates the existing map iframe src only if the coordinates have changed.
// This avoids reloading the map tile on every refresh when the bus is stationary.
function updateMapFrame(loc) {
  const iframe = document.querySelector('.map-frame');
  if (!iframe) return; // map not visible — nothing to update

  const boxSize = 0.05;
  const minLon  = (loc.longitude - boxSize).toFixed(5);
  const minLat  = (loc.latitude  - boxSize).toFixed(5);
  const maxLon  = (loc.longitude + boxSize).toFixed(5);
  const maxLat  = (loc.latitude  + boxSize).toFixed(5);

  const newSrc =
    'https://www.openstreetmap.org/export/embed.html' +
    '?bbox='   + minLon + ',' + minLat + ',' + maxLon + ',' + maxLat +
    '&layer=mapnik' +
    '&marker=' + loc.latitude + ',' + loc.longitude;

  // Only update src if the URL actually changed — prevents unnecessary map reloads
  if (iframe.src !== newSrc) {
    iframe.src = newSrc;

    // Also update the "Open in OSM" link if it exists
    const osmLink = document.querySelector('.map-osm-link');
    if (osmLink) {
      osmLink.href =
        'https://www.openstreetmap.org/?mlat=' + loc.latitude +
        '&mlon=' + loc.longitude +
        '#map=13/' + loc.latitude + '/' + loc.longitude;
    }
  }
}

// refreshLocationDisplay()
// Called automatically every LOCATION_REFRESH_INTERVAL ms by the timer.
// Fetches the latest location for currentBusId and updates only the
// individual value elements in the panel — no full rebuild, no map flicker.
// Also refreshes the ETA section (added in Commit 18).
async function refreshLocationDisplay() {
  if (!currentBusId) return; // safety check — no bus selected

  // Guard against a stale timer firing after the user selected a new bus.
  // We capture the busId at the start of this call and check it hasn't
  // changed before we apply the update.
  const busIdAtStart = currentBusId;

  updateTrackingStatus('Updating location...', 'status-updating');

  try {
    const response = await fetch('/api/buses/' + busIdAtStart + '/location');

    // If the bus ID changed while we were waiting for the response, discard it
    if (currentBusId !== busIdAtStart) return;

    if (!response.ok) {
      updateTrackingStatus('Unable to refresh location', 'status-error');
      return; // keep showing the last successful data
    }

    const loc = await response.json();

    // Update only the individual value elements by their IDs
    const latEl     = document.getElementById('loc-lat');
    const lonEl     = document.getElementById('loc-lon');
    const speedEl   = document.getElementById('loc-speed');
    const updatedEl = document.getElementById('loc-updated');

    if (latEl)     latEl.textContent     = loc.latitude  + '°';
    if (lonEl)     lonEl.textContent     = loc.longitude + '°';
    if (speedEl)   speedEl.textContent   = loc.speed     + ' km/h';
    if (updatedEl) updatedEl.textContent = formatDateTime(loc.lastUpdated);

    // Update the map only if coordinates changed
    updateMapFrame(loc);

    updateTrackingStatus('🟢 Simulated tracking active — updates every 10s', 'status-active');

    // Also refresh the ETA section — reuse the same tick (no extra timer)
    refreshETADisplay(busIdAtStart);

  } catch (error) {
    if (currentBusId !== busIdAtStart) return;
    updateTrackingStatus('Unable to refresh location', 'status-error');
    // The last good data remains visible — we do not clear the panel
  }
}

// showLocation(busId)
// Called when "View Location" is clicked on a bus card.
// Builds the full panel on first open, then hands off to the refresh timer.
async function showLocation(busId) {

  // 1. If this bus is already being tracked, do nothing — panel is already open
  if (currentBusId === busId && !locationPanel.classList.contains('hidden')) {
    locationPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // 2. Stop any existing refresh timer (user selected a different bus)
  stopLocationRefresh();
  currentBusId = busId;

  // 3. Show the panel with a loading message
  locationPanelTitle.textContent = '📍 Simulated GPS Location';
  locationPanelContent.innerHTML = '<p class="location-loading">Loading location...</p>';
  locationPanel.classList.remove('hidden');
  locationPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    // 4. Fetch the initial location
    const response = await fetch('/api/buses/' + busId + '/location');

    // Guard: if the user clicked a different bus before this response arrived, discard
    if (currentBusId !== busId) return;

    if (response.status === 404) {
      locationPanelContent.innerHTML =
        '<p class="location-error">⚠️ No location data available for this bus.</p>';
      return;
    }

    if (!response.ok) {
      locationPanelContent.innerHTML =
        '<p class="location-error">❌ Could not load location data.</p>';
      return;
    }

    const loc = await response.json();

    // 5. Update the panel title
    locationPanelTitle.textContent = '📍 Simulated GPS — ' + loc.busNumber;

    // 6. Build the full panel: warning + status badge + grid + map
    const warningHTML =
      '<div class="simulated-warning">' +
        '⚠️ This is <strong>simulated demo data</strong>, not real GPS.' +
      '</div>';

    const statusHTML =
      '<p id="trackingStatus" class="tracking-status status-active">' +
        '🟢 Simulated tracking active — updates every 10s' +
      '</p>';

    locationPanelContent.innerHTML =
      warningHTML +
      statusHTML +
      buildLocationGridHTML(loc) +
      '<div id="etaSection"><p class="eta-loading">Loading arrival times...</p></div>' +
      buildMapHTML(loc);

    // 7. Start the automatic refresh timer
    startLocationRefresh();

    // 8. Fetch and display ETA immediately (do not wait for first timer tick)
    fetchAndDisplayETA(busId);

  } catch (error) {
    if (currentBusId !== busId) return;
    locationPanelContent.innerHTML =
      '<p class="location-error">❌ Could not reach the server. Make sure it is running.</p>';
  }
}

// ─────────────────────────────────────────────────────────
//  ETA Section  (added in Commit 18)
//
//  buildETAHTML(etaData)    — builds the ETA table HTML string.
//  fetchAndDisplayETA(id)   — fetches ETA from API and renders it.
//  refreshETADisplay(id)    — called by the refresh timer to update ETA.
// ─────────────────────────────────────────────────────────

// buildETAHTML(etaData)
// Takes the response object from GET /api/buses/:id/eta and returns
// an HTML string for the ETA section.
function buildETAHTML(etaData) {

  // Bus has arrived at its final destination
  if (etaData.status === 'arrived') {
    return (
      '<div class="eta-section">' +
        '<p class="eta-section-title">🕐 Estimated Arrival Times</p>' +
        '<p class="eta-arrived">✅ Bus has reached its final destination: ' + etaData.destination + '</p>' +
      '</div>'
    );
  }

  // Bus is stationary — show the table but with null ETA values
  // Bus is moving — show normal ETA table
  const upcomingStops = etaData.upcomingStops || [];

  if (upcomingStops.length === 0) {
    return (
      '<div class="eta-section">' +
        '<p class="eta-section-title">🕐 Estimated Arrival Times</p>' +
        '<p class="eta-stationary">No upcoming stops available.</p>' +
      '</div>'
    );
  }

  // Build the table rows — one per upcoming stop
  let rowsHTML = '';
  upcomingStops.forEach(function (stop, index) {
    // The first row gets the 'next-stop' CSS class for the blue highlight
    const rowClass = (index === 0) ? ' class="next-stop"' : '';

    // ETA display: show minutes or "Stationary" if null
    let etaDisplay;
    if (stop.etaMinutes === null) {
      etaDisplay = '<span class="eta-stationary">Stationary</span>';
    } else {
      etaDisplay = stop.etaMinutes + ' min';
    }

    rowsHTML +=
      '<tr' + rowClass + '>' +
        '<td>' + stop.stopName + '</td>' +
        '<td>' + stop.distanceKm + ' km</td>' +
        '<td>' + etaDisplay + '</td>' +
      '</tr>';
  });

  return (
    '<div class="eta-section">' +
      '<p class="eta-section-title">🕐 Estimated Arrival Times</p>' +
      '<p class="eta-disclaimer">' +
        'Estimated arrival times are based on simulated GPS location and speed. ' +
        'Actual arrival times may vary.' +
      '</p>' +
      '<table class="eta-table">' +
        '<thead>' +
          '<tr>' +
            '<th>Bus Stop</th>' +
            '<th>Distance</th>' +
            '<th>ETA</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rowsHTML + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

// fetchAndDisplayETA(busId)
// Calls GET /api/buses/:id/eta, builds the HTML, and injects it into
// the #etaSection element inside the location panel.
async function fetchAndDisplayETA(busId) {
  const etaSection = document.getElementById('etaSection');
  if (!etaSection) return; // panel was closed before this ran

  try {
    const response = await fetch('/api/buses/' + busId + '/eta');

    // Guard — discard if the user switched buses while waiting
    if (currentBusId !== busId) return;

    if (!response.ok) {
      etaSection.innerHTML = '<p class="eta-error">❌ Could not load arrival times.</p>';
      return;
    }

    const etaData = await response.json();

    // Guard again after the await
    if (currentBusId !== busId) return;

    etaSection.innerHTML = buildETAHTML(etaData);

  } catch (error) {
    if (currentBusId !== busId) return;
    // Keep whatever was shown before — just mark it stale
    const staleBadge = document.querySelector('.eta-stale-badge');
    if (!staleBadge && etaSection) {
      const title = etaSection.querySelector('.eta-section-title');
      if (title) {
        title.innerHTML += '<span class="eta-stale-badge">(last refresh failed)</span>';
      }
    }
  }
}

// refreshETADisplay(busId)
// Called from refreshLocationDisplay() on every timer tick.
// Re-fetches ETA and replaces the table content silently.
function refreshETADisplay(busId) {
  if (!busId) return;
  fetchAndDisplayETA(busId); // reuses the same fetch+render logic
}

// ─────────────────────────────────────────────────────────
//  Map Section  (added in Commit 13)
//
//  buildMapHTML(loc) — builds an OpenStreetMap iframe HTML string
//  for the given location object.
//  Called inside showLocation() and appended below the data grid.
// ─────────────────────────────────────────────────────────

// buildMapHTML(loc)
// Takes a location object with latitude and longitude fields.
// Returns an HTML string containing:
//   - a section label
//   - an internet notice
//   - an OpenStreetMap <iframe> centred on the coordinates
//   - an "Open in OpenStreetMap" link
//   - an attribution line
//
// The OpenStreetMap embed URL format is:
//   https://www.openstreetmap.org/export/embed.html
//     ?bbox=<lon-0.05>,<lat-0.05>,<lon+0.05>,<lat+0.05>
//     &layer=mapnik
//     &marker=<lat>,<lon>
//
// bbox defines the visible area (a small box around the point).
// marker places a pin at the exact coordinates.
function buildMapHTML(loc) {

  // Validate that latitude and longitude are real numbers before building the URL.
  // If they are missing or invalid, show a simple message instead.
  if (
    typeof loc.latitude  !== 'number' ||
    typeof loc.longitude !== 'number' ||
    isNaN(loc.latitude)  ||
    isNaN(loc.longitude)
  ) {
    return '<p class="location-error" style="margin-top:16px;">⚠️ Map not available — invalid coordinates.</p>';
  }

  const lat = loc.latitude;
  const lon = loc.longitude;

  // Define a small bounding box (±0.05 degrees) around the bus location.
  // This sets how much of the map is visible around the marker.
  const boxSize = 0.05;
  const minLon  = (lon - boxSize).toFixed(5);
  const minLat  = (lat - boxSize).toFixed(5);
  const maxLon  = (lon + boxSize).toFixed(5);
  const maxLat  = (lat + boxSize).toFixed(5);

  // Build the OpenStreetMap embed URL
  const embedUrl =
    'https://www.openstreetmap.org/export/embed.html' +
    '?bbox='    + minLon + ',' + minLat + ',' + maxLon + ',' + maxLat +
    '&layer=mapnik' +
    '&marker='  + lat + ',' + lon;

  // Build the direct link URL that opens OpenStreetMap in a new tab
  const osmUrl =
    'https://www.openstreetmap.org/?mlat=' + lat +
    '&mlon=' + lon +
    '#map=13/' + lat + '/' + lon;

  // Return the complete map section HTML string
  return (
    '<div class="map-section">' +

      '<div class="map-label">' +
        '<span class="map-label-text">📍 Simulated Bus Location on Map</span>' +
        '<a href="' + osmUrl + '" target="_blank" rel="noopener" class="map-osm-link">' +
          '↗ Open in OpenStreetMap' +
        '</a>' +
      '</div>' +

      '<p class="map-notice">ℹ️ Internet connection required to load the map.</p>' +

      '<iframe ' +
        'class="map-frame" ' +
        'src="'  + embedUrl + '" ' +
        'title="Simulated bus location map" ' +
        'loading="lazy" ' +
        'referrerpolicy="no-referrer">' +
      '</iframe>' +

      '<p class="map-attribution">' +
        'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' +
      '</p>' +

    '</div>'
  );
}
