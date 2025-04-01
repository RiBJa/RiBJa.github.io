// Firebase initialization
const firebaseConfig = {
  apiKey: "AIzaSyDXHXXfZUX-Q6a_UuVUH0KDSb2y5eRMAzs",
  authDomain: "test-app-f6c5d.firebaseapp.com",
  databaseURL: "https://test-app-f6c5d-default-rtdb.firebaseio.com",
  projectId: "test-app-f6c5d",
  storageBucket: "test-app-f6c5d.appspot.com",
  messagingSenderId: "490684288261",
  appId: "1:490684288261:web:a2ae54e967f8c4269efb6c",
  measurementId: "G-W9XK7P8YB8"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const thermostatRef = database.ref('thermostat');

// Thermostat configuration
/* @tweakable thermostat IP address */
const THERMOSTAT_IP = '192.168.4.29';
/* @tweakable min temperature in Fahrenheit */
const MIN_TEMP = 60;
/* @tweakable max temperature in Fahrenheit */
const MAX_TEMP = 90;
/* @tweakable poll interval in milliseconds */
const POLL_INTERVAL = 30000; // 30 seconds

// Elements
const currentTempEl = document.querySelector('.current-temp');
const humidityEl = document.querySelector('.room-humidity');
const targetTempEl = document.getElementById('target-temp');
const tempUpBtn = document.getElementById('temp-up');
const tempDownBtn = document.getElementById('temp-down');
const modeButtons = {
    off: document.getElementById('mode-off'),
    heat: document.getElementById('mode-heat'),
    cool: document.getElementById('mode-cool'),
    auto: document.getElementById('mode-auto')
};
const fanButtons = {
    auto: document.getElementById('fan-auto'),
    on: document.getElementById('fan-on')
};
const statusMessageEl = document.getElementById('status-message');
const lastUpdatedEl = document.getElementById('last-updated');

// State
let thermostatData = {
    currentTemp: 0,
    humidity: 0,
    targetTemp: 72,
    mode: 'off',  // 'off', 'heat', 'cool', 'auto'
    fan: 'auto',  // 'auto', 'on'
    lastUpdated: null
};

// Helper functions
function updateUI() {
    // Update temperature and humidity display
    currentTempEl.textContent = `${Math.round(thermostatData.currentTemp)}°`;
    humidityEl.textContent = `${thermostatData.humidity}% Humidity`;
    targetTempEl.textContent = `${thermostatData.targetTemp}°`;
    
    // Update mode buttons
    Object.keys(modeButtons).forEach(mode => {
        modeButtons[mode].classList.toggle('active', thermostatData.mode === mode);
    });
    
    // Update fan buttons
    Object.keys(fanButtons).forEach(fan => {
        fanButtons[fan].classList.toggle('active', thermostatData.fan === fan);
    });
    
    // Update status
    if (thermostatData.lastUpdated) {
        const formattedTime = new Date(thermostatData.lastUpdated).toLocaleTimeString();
        lastUpdatedEl.textContent = `Last updated: ${formattedTime}`;
    }
}

function updateStatus(message) {
    statusMessageEl.textContent = message;
}

async function fetchThermostatData() {
  try {
    updateStatus('Fetching thermostat data...');
    const response = await fetch('/.netlify/functions/getThermostatData');  // Serverless function endpoint
    if (!response.ok) throw new Error('Failed to fetch thermostat data');

    const data = await response.json();
    thermostatData = {
      currentTemp: data.spacetemp,
      humidity: data.hum,
      targetTemp: data.heattemp, // Use appropriate value based on mode
      mode: getModeFromCode(data.mode),
      fan: getFanFromCode(data.fan),
      lastUpdated: new Date().toISOString()
    };

    // Update Firebase
    thermostatRef.set(thermostatData);
    
    updateStatus('Connected');
    updateUI();
  } catch (error) {
    console.error('Error fetching thermostat data:', error);
    updateStatus('Connection error. Retrying...');
  }
}


function getModeFromCode(code) {
    // Venstar mode codes: 0=off, 1=heat, 2=cool, 3=auto
    const modes = ['off', 'heat', 'cool', 'auto'];
    return modes[code] || 'off';
}

function getFanFromCode(code) {
    // Venstar fan codes: 0=auto, 1=on
    return code === 1 ? 'on' : 'auto';
}

async function setThermostat(settings) {
    try {
        updateStatus('Updating thermostat...');
        
        const params = new URLSearchParams();
        
        if (settings.mode !== undefined) {
            // Convert mode string to Venstar code
            const modeCode = ['off', 'heat', 'cool', 'auto'].indexOf(settings.mode);
            if (modeCode !== -1) params.append('mode', modeCode);
        }
        
        if (settings.fan !== undefined) {
            // Convert fan string to Venstar code
            const fanCode = settings.fan === 'on' ? 1 : 0;
            params.append('fan', fanCode);
        }
        
        if (settings.targetTemp !== undefined) {
            // Set the appropriate temperature based on mode
            if (thermostatData.mode === 'heat' || 
                (settings.mode === 'heat' && thermostatData.mode !== 'heat')) {
                params.append('heattemp', settings.targetTemp);
            }
            
            if (thermostatData.mode === 'cool' || 
                (settings.mode === 'cool' && thermostatData.mode !== 'cool')) {
                params.append('cooltemp', settings.targetTemp);
            }
            
            if (thermostatData.mode === 'auto' || 
                (settings.mode === 'auto' && thermostatData.mode !== 'auto')) {
                params.append('heattemp', settings.targetTemp - 2);
                params.append('cooltemp', settings.targetTemp + 2);
            }
        }
        
        const response = await fetch(`http://${THERMOSTAT_IP}/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });
        
        if (!response.ok) throw new Error('Failed to update thermostat');
        
        // Update local state with the changes
        Object.assign(thermostatData, settings);
        thermostatData.lastUpdated = new Date().toISOString();
        
        // Update Firebase
        thermostatRef.update(settings);
        
        updateStatus('Settings updated');
        updateUI();
    } catch (error) {
        console.error('Error updating thermostat:', error);
        updateStatus('Update failed. Try again.');
    }
}

// Event Listeners
tempUpBtn.addEventListener('click', () => {
    if (thermostatData.targetTemp < MAX_TEMP) {
        setThermostat({ targetTemp: thermostatData.targetTemp + 1 });
    }
});

tempDownBtn.addEventListener('click', () => {
    if (thermostatData.targetTemp > MIN_TEMP) {
        setThermostat({ targetTemp: thermostatData.targetTemp - 1 });
    }
});

// Set up mode buttons
Object.keys(modeButtons).forEach(mode => {
    modeButtons[mode].addEventListener('click', () => {
        setThermostat({ mode });
    });
});

// Set up fan buttons
Object.keys(fanButtons).forEach(fan => {
    fanButtons[fan].addEventListener('click', () => {
        setThermostat({ fan });
    });
});

// Initialize & set up polling
function initApp() {
    // Listen for changes in Firebase
    thermostatRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Only update if data is from an external source (to avoid loops)
            if (data.lastUpdated !== thermostatData.lastUpdated) {
                thermostatData = data;
                updateUI();
            }
        }
    });
    
    // Initial fetch
    fetchThermostatData();
    
    // Set up polling
    setInterval(fetchThermostatData, POLL_INTERVAL);
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);
