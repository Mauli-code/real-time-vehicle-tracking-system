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

    </div>
  `;
}

// loadBuses()
// Calls GET /api/buses, reads the response, and renders the cards.
// It is an async function so we can use await inside it.
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
    const buses = await response.json();

    // Check if the array is empty
    if (buses.length === 0) {
      busContainer.innerHTML = '<p class="empty-msg">No buses available at the moment.</p>';
      return; // Stop here — nothing more to do
    }

    // Build one card string for every bus in the array using our helper function,
    // then join all the strings together into one big HTML string
    const allCardsHTML = buses.map(buildBusCard).join('');

    // Wrap the cards in a grid div and inject into the page
    busContainer.innerHTML = '<div class="bus-grid">' + allCardsHTML + '</div>';

  } catch (error) {
    // Show a friendly error message if the fetch failed completely
    busContainer.innerHTML =
      '<p class="error-msg">❌ Could not load bus data. Make sure the server is running.</p>';
  }
}

// Call loadBuses() immediately when the page loads.
// No button click needed — the buses appear as soon as the page opens.
loadBuses();
