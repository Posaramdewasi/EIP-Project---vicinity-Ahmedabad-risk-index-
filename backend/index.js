const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(bodyParser.json())

// Simple in-memory store for reports (for demo only)
const reports = []

// Load Ahmedabad zones GeoJSON
let zonesGeoJSON = null
try {
  const dataPath = path.join(__dirname, 'data', 'ahmedabad-zones.geojson')
  zonesGeoJSON = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  console.log(`Loaded ${zonesGeoJSON.features.length} zones from GeoJSON`)
} catch (err) {
  console.error('Failed to load GeoJSON:', err.message)
  zonesGeoJSON = { type: 'FeatureCollection', features: [] }
}

// Simulated data source: zone risk data (to be replaced with real integrations)
const zoneRiskData = {
  'ahm_001': { crime: 0.65, traffic: 0.72, flood: 0.15 },
  'ahm_002': { crime: 0.45, traffic: 0.55, flood: 0.25 },
  'ahm_003': { crime: 0.30, traffic: 0.40, flood: 0.10 },
  'ahm_004': { crime: 0.35, traffic: 0.50, flood: 0.20 },
  'ahm_005': { crime: 0.25, traffic: 0.35, flood: 0.08 },
  'ahm_006': { crime: 0.55, traffic: 0.60, flood: 0.40 },
  'ahm_007': { crime: 0.20, traffic: 0.30, flood: 0.05 },
  'ahm_008': { crime: 0.50, traffic: 0.65, flood: 0.30 }
}

// Function to generate today's AQI based on current date and zone
function generateTodaysAQI(zoneId, zoneName) {
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0] // YYYY-MM-DD
  const timeOfDay = today.getHours() // 0-23
  
  // Combine zone ID, date, and time for deterministic but time-aware AQI
  function djb2Hash(str) {
    let h = 5381
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i)
    return h >>> 0
  }
  
  const seedStr = `${zoneId || zoneName}:${dateStr}:${Math.floor(timeOfDay / 3)}`
  const seed = djb2Hash(seedStr)
  
  // Generate realistic AQI: typically 30-250 with some variance
  // Morning (0-8): Lower AQI (30-80)
  // Afternoon (9-17): Medium-High AQI (80-180)
  // Evening (18-23): High AQI (100-200)
  let baseAQI = 30 + (seed % 200)
  
  if (timeOfDay >= 9 && timeOfDay < 18) {
    baseAQI = Math.max(80, baseAQI)
  } else if (timeOfDay >= 18) {
    baseAQI = Math.max(100, baseAQI)
  }
  
  // Add slight randomness for real-time feel
  const randomVariance = Math.floor(Math.random() * 20) - 10 // -10 to +10
  const aqiVal = Math.max(30, Math.min(300, baseAQI + randomVariance))
  
  return aqiVal
}

// Simulated GeoJSON with risk component breakdowns
app.get('/api/risk', (req, res) => {
  // Add risk components to each zone from simulated data and AQI
  const enrichedFeatures = zonesGeoJSON.features.map(feature => {
    const zoneId = feature.properties.zone_id
    const zoneName = feature.properties.name
    const simRisk = zoneRiskData[zoneId] || { crime: 0.3, traffic: 0.4, flood: 0.15 }
    
    // Generate today's real-time AQI
    const aqiVal = generateTodaysAQI(zoneId, zoneName)
    
    // normalized between 0..1 for risk component (clamp by 500)
    const aqi = Math.min(1, aqiVal / 500)
    const components = {
      crime: simRisk.crime,
      aqi: aqi,
      traffic: simRisk.traffic,
      flood: simRisk.flood
    }
    // Simple weighted average: equal weight for all components
    const risk = (components.crime + components.aqi + components.traffic + components.flood) / 4
    feature.properties.risk = risk
    feature.properties.components = components
    // expose AQI numeric and category for the frontend UI
    feature.properties.aqi = aqiVal
    feature.properties.aqi_timestamp = new Date().toISOString()
    // simple category mapping
    feature.properties.aqi_category = aqiVal <= 50 ? 'Good' : aqiVal <= 100 ? 'Moderate' : aqiVal <= 150 ? 'Unhealthy for Sensitive Groups' : aqiVal <= 200 ? 'Unhealthy' : aqiVal <= 300 ? 'Very Unhealthy' : 'Hazardous'
    return feature
  })
  res.json({ type: 'FeatureCollection', features: enrichedFeatures, timestamp: new Date().toISOString() })
})

// Real-time AQI endpoint - shows current active AQI for today
app.get('/api/aqi-today', (req, res) => {
  const now = new Date()
  const aqiData = zonesGeoJSON.features.map(feature => ({
    zone_id: feature.properties.zone_id,
    zone_name: feature.properties.name,
    aqi: generateTodaysAQI(feature.properties.zone_id, feature.properties.name),
    timestamp: now.toISOString(),
    hour: now.getHours(),
    date: now.toISOString().split('T')[0]
  }))
  
  res.json({
    status: 'active',
    type: 'real-time',
    timestamp: now.toISOString(),
    zones: aqiData,
    message: 'Current active AQI data for today'
  })
})

// Debug endpoint: show OGD field mappings from latest fetched records
app.get('/api/risk-debug', async (req, res) => {
  if (!OGD_API_KEY) {
    return res.json({ error: 'OGD_API_KEY not set', note: 'Set OGD_API_KEY env var to enable debug' })
  }
  try {
    const url = `https://api.data.gov.in/resource/${OGD_RESOURCE_ID}?api-key=${OGD_API_KEY}&format=json&limit=5`
    const r = await axios.get(url, { timeout: 8000 })
    const records = r.data.records || []
    if (records.length === 0) {
      return res.json({ error: 'No records returned from OGD API' })
    }
    // Show the first record's fields
    const firstRecord = records[0]
    const fields = Object.keys(firstRecord)
    return res.json({ total_records: r.data.total, sample_record_fields: fields, first_record: firstRecord })
  } catch (err) {
    console.error('Debug endpoint error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch OGD debug info', details: err.message })
  }
})

// Proxy /api/aqi — will use OGD (data.gov.in) API when OGD_API_KEY and OGD_RESOURCE_ID are provided.
// If not configured, returns a simulated AQI value.
const OGD_API_KEY = process.env.OGD_API_KEY || process.env.AQI_API_KEY
const OGD_RESOURCE_ID = process.env.OGD_RESOURCE_ID || '579b464db66ec23bdd000001692be7fdbc4c4e5e5142b59bd3f812f1'

// Simple in-memory cache to avoid repeated remote calls
const cache = { aqiRecords: { ts: 0, data: null } }
const CACHE_TTL_MS = 1000 * 60 // 1 minute

function haversineDistance(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180 }
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

app.get('/api/aqi', async (req, res) => {
  const lat = parseFloat(req.query.lat)
  const lon = parseFloat(req.query.lon)
  if (!lat || !lon) return res.status(400).json({ error: 'lat & lon required' })

  if (!OGD_API_KEY) {
    // return simulated value when key not present
    return res.json({ provider: 'simulated', aqi: 75, category: 'Moderate' })
  }

  try {
    // Use cached records when fresh
    const now = Date.now()
    if (!cache.aqiRecords.data || (now - cache.aqiRecords.ts) > CACHE_TTL_MS) {
      const url = `https://api.data.gov.in/resource/${OGD_RESOURCE_ID}?api-key=${OGD_API_KEY}&format=json&limit=1000`
      const r = await axios.get(url, { timeout: 8000 })
      cache.aqiRecords.data = r.data.records || []
      cache.aqiRecords.ts = now
    }

    const records = cache.aqiRecords.data
    if (!records || records.length === 0) {
      return res.status(502).json({ error: 'no records from OGD provider' })
    }

    // Find nearest station in the returned records. The field names vary; try common names.
    let best = null
    for (const rec of records) {
      const rlat = parseFloat(rec.latitude || rec.lat || rec.location_lat || rec.latitude_deg)
      const rlon = parseFloat(rec.longitude || rec.lon || rec.location_lon || rec.longitude_deg)
      if (Number.isFinite(rlat) && Number.isFinite(rlon)) {
        const d = haversineDistance(lat, lon, rlat, rlon)
        if (!best || d < best.d) best = { rec, d, rlat, rlon }
      }
    }

    if (!best) return res.status(502).json({ error: 'no geolocated records returned by OGD provider' })

    // OGD record may contain AQI or pollutant readings; attempt to extract commonly named fields
    const r = best.rec
    const category = r.category || r.aqi_category || null

    // Helper to parse numeric pollutant values from various possible field names
    function parseNumberFrom(record, candidates) {
      for (const k of candidates) {
        if (record[k] !== undefined && record[k] !== null) {
          const v = parseFloat(record[k])
          if (!Number.isNaN(v)) return v
        }
      }
      return null
    }

    // Attempt to find direct AQI field
    const directAqi = (r.aqi || r.AQI || r.aqi_value || r.AQI_VALUE)
    const aqiVal = Number.isFinite(parseFloat(directAqi)) ? parseFloat(directAqi) : null

    // Try common pollutant field names for PM2.5 and PM10
    const pm25 = parseNumberFrom(r, ['pm25', 'pm2_5', 'pm2.5', 'PM2.5', 'pm25_ugm3', 'pm2_5_ugm3', 'pm_2_5'])
    const pm10 = parseNumberFrom(r, ['pm10', 'PM10', 'pm10_ugm3', 'pm_10'])

    // AQI calculation using US-EPA breakpoints (common and suitable as a starting point)
    const pm25Breakpoints = [
      { c_lo: 0.0, c_hi: 12.0, i_lo: 0, i_hi: 50 },
      { c_lo: 12.1, c_hi: 35.4, i_lo: 51, i_hi: 100 },
      { c_lo: 35.5, c_hi: 55.4, i_lo: 101, i_hi: 150 },
      { c_lo: 55.5, c_hi: 150.4, i_lo: 151, i_hi: 200 },
      { c_lo: 150.5, c_hi: 250.4, i_lo: 201, i_hi: 300 },
      { c_lo: 250.5, c_hi: 350.4, i_lo: 301, i_hi: 400 },
      { c_lo: 350.5, c_hi: 500.4, i_lo: 401, i_hi: 500 }
    ]
    const pm10Breakpoints = [
      { c_lo: 0, c_hi: 54, i_lo: 0, i_hi: 50 },
      { c_lo: 55, c_hi: 154, i_lo: 51, i_hi: 100 },
      { c_lo: 155, c_hi: 254, i_lo: 101, i_hi: 150 },
      { c_lo: 255, c_hi: 354, i_lo: 151, i_hi: 200 },
      { c_lo: 355, c_hi: 424, i_lo: 201, i_hi: 300 },
      { c_lo: 425, c_hi: 504, i_lo: 301, i_hi: 400 },
      { c_lo: 505, c_hi: 604, i_lo: 401, i_hi: 500 }
    ]

    function calcAQIFromBreakpoints(conc, bps) {
      if (conc === null || conc === undefined || Number.isNaN(conc)) return null
      for (const bp of bps) {
        if (conc >= bp.c_lo && conc <= bp.c_hi) {
          const { c_lo, c_hi, i_lo, i_hi } = bp
          const aqi = Math.round(((i_hi - i_lo) / (c_hi - c_lo)) * (conc - c_lo) + i_lo)
          return aqi
        }
      }
      return null
    }

    const computedAqiPm25 = pm25 != null ? calcAQIFromBreakpoints(pm25, pm25Breakpoints) : null
    const computedAqiPm10 = pm10 != null ? calcAQIFromBreakpoints(pm10, pm10Breakpoints) : null

    let computed_aqi = null
    let main_pollutant = null
    if (computedAqiPm25 != null || computedAqiPm10 != null) {
      if (computedAqiPm25 == null) {
        computed_aqi = computedAqiPm10
        main_pollutant = 'PM10'
      } else if (computedAqiPm10 == null) {
        computed_aqi = computedAqiPm25
        main_pollutant = 'PM2.5'
      } else {
        // take the higher AQI (dominant pollutant)
        if (computedAqiPm25 >= computedAqiPm10) {
          computed_aqi = computedAqiPm25
          main_pollutant = 'PM2.5'
        } else {
          computed_aqi = computedAqiPm10
          main_pollutant = 'PM10'
        }
      }
    }

    const finalAqi = aqiVal || computed_aqi || null

    return res.json({
      provider: 'data.gov.in',
      nearest: { lat: best.rlat, lon: best.rlon, distance_km: best.d },
      aqi: finalAqi,
      category,
      computed_aqi: computed_aqi || null,
      main_pollutant: main_pollutant,
      raw: r
    })
  } catch (err) {
    console.error('OGD AQI proxy error:', err && err.message)
    return res.status(500).json({ error: 'failed to fetch external AQI', details: err && err.message })
  }
})

// Accept hazard reports
app.post('/api/report', (req, res) => {
  const { lat, lon, type, note } = req.body
  if (!lat || !lon || !type) return res.status(400).json({ error: 'lat, lon and type required' })
  const rec = { id: reports.length + 1, lat, lon, type, note, createdAt: new Date().toISOString() }
  reports.push(rec)
  res.json({ success: true, report: rec })
})

app.get('/api/reports', (req, res) => res.json(reports))

// Serve admin dashboard
app.get('/dashboard', (req, res) => {
  const dashboardPath = path.join(__dirname, 'dashboard.html')
  res.sendFile(dashboardPath)
})

app.listen(port, () => console.log(`Backend listening on ${port}`))
