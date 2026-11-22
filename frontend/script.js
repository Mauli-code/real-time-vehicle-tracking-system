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
