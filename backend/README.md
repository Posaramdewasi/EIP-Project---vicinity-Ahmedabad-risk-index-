Backend: Express API.

Install and run locally:

```powershell
cd backend
npm install
npm start
```

APIs:
- GET /api/risk — returns simulated GeoJSON
- GET /api/aqi?lat=...&lon=... — returns simulated AQI unless AQI_API_KEY set
 - GET /api/aqi?lat=...&lon=... — returns simulated AQI unless `OGD_API_KEY` (or `AQI_API_KEY`) is set.
	When `OGD_API_KEY` is provided the backend will query Data.gov.in's resource API and return the nearest station's AQI/pollutant readings.
	If the returned station record does not contain a direct AQI value but includes pollutant concentrations (PM2.5 and/or PM10), the backend will compute an estimated AQI using standard US-EPA breakpoints and return `computed_aqi` and `main_pollutant` in the response.
- POST /api/report — accepts JSON { lat, lon, type, note }
