const fetch = require('node-fetch');  // Required to make HTTP requests in serverless functions

exports.handler = async (event, context) => {
  try {
    // Fetch the thermostat data over HTTP (since it's on your local network)
    const response = await fetch('http://192.168.4.29/query/info');  // Your thermostat API endpoint
    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error fetching thermostat data' })
      };
    }

    const data = await response.json();

    // Process the thermostat data if needed
    const thermostatData = {
      currentTemp: data.spacetemp,
      humidity: data.hum,
      targetTemp: data.heattemp,
      mode: data.mode,
      fan: data.fan,
      lastUpdated: new Date().toISOString()
    };

    // Return the data over HTTPS to the front-end
    return {
      statusCode: 200,
      body: JSON.stringify(thermostatData)
    };
  } catch (error) {
    console.error('Error fetching thermostat data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error fetching thermostat data' })
    };
  }
};
