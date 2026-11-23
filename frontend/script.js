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
