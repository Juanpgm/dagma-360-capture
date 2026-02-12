
import fetch from 'node-fetch';

const API_URL = 'https://web-production-2d737.up.railway.app';
const OLD_API_URL = 'https://gestorproyectoapi-production.up.railway.app';

async function checkUrl(url, label) {
  console.log(`\n--- Checking ${label} (${url}) ---`);
  try {
    const start = Date.now();
    const response = await fetch(url + '/init/parques', {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });
    const time = Date.now() - start;
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Time: ${time}ms`);
    
    if (response.ok) {
        const data = await response.json();
        const isArray = Array.isArray(data) || Array.isArray(data.data);
        console.log(`Response valid JSON: ${true}`);
        console.log(`Is Array/Data Array: ${isArray}`);
        if(isArray) console.log(`Count: ${Array.isArray(data) ? data.length : data.data.length}`);
    } else {
        const text = await response.text();
        console.log(`Error body: ${text.substring(0, 200)}`);
    }

    // Check OPTIONS for CORS
    const optionsParams = {
        method: 'OPTIONS',
        headers: {
            'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'
        }
    };
    const optionsResp = await fetch(url + '/grupo-operativo/reconocimiento', optionsParams);
    console.log(`OPTIONS Status: ${optionsResp.status}`);
    console.log(`Allow Header: ${optionsResp.headers.get('allow')}`);
    console.log(`Access-Control-Allow-Origin: ${optionsResp.headers.get('access-control-allow-origin')}`);
    
  } catch (error) {
    console.error(`Error checking ${label}:`, error.message);
    if(error.cause) console.error('Cause:', error.cause);
  }
}

async function run() {
    await checkUrl(API_URL, 'CURRENT API');
    await checkUrl(OLD_API_URL, 'OLD API (from PWA config)');
}

run();
