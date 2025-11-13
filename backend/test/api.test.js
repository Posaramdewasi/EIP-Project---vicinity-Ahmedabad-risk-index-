// Simple test suite for backend logic (haversine, AQI calculation, risk aggregation)
// Run with: node --test test/api.test.js

const assert = require('assert')

// Haversine distance calculation
function haversineDistance(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180 }
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// AQI calculation from PM2.5
function calcAQIFromPM25(conc) {
  const breakpoints = [
    { c_lo: 0.0, c_hi: 12.0, i_lo: 0, i_hi: 50 },
    { c_lo: 12.1, c_hi: 35.4, i_lo: 51, i_hi: 100 },
    { c_lo: 35.5, c_hi: 55.4, i_lo: 101, i_hi: 150 },
    { c_lo: 55.5, c_hi: 150.4, i_lo: 151, i_hi: 200 },
    { c_lo: 150.5, c_hi: 250.4, i_lo: 201, i_hi: 300 },
    { c_lo: 250.5, c_hi: 350.4, i_lo: 301, i_hi: 400 },
    { c_lo: 350.5, c_hi: 500.4, i_lo: 401, i_hi: 500 }
  ]
  if (conc === null || conc === undefined || Number.isNaN(conc)) return null
  for (const bp of breakpoints) {
    if (conc >= bp.c_lo && conc <= bp.c_hi) {
      const { c_lo, c_hi, i_lo, i_hi } = bp
      const aqi = Math.round(((i_hi - i_lo) / (c_hi - c_lo)) * (conc - c_lo) + i_lo)
      return aqi
    }
  }
  return null
}

// Test suite
console.log('Running backend tests...\n')

// Test 1: Haversine distance
console.log('Test 1: Haversine Distance')
const dist1 = haversineDistance(23.0225, 72.5714, 23.0225, 72.5714)
assert.strictEqual(Math.round(dist1 * 100), 0, 'Distance to self should be ~0')
const dist2 = haversineDistance(23.0225, 72.5714, 23.05, 72.6)
assert(dist2 > 5 && dist2 < 10, `Distance should be ~6 km, got ${dist2}`)
console.log('✓ Haversine tests passed\n')

// Test 2: AQI calculation from PM2.5
console.log('Test 2: AQI Calculation from PM2.5')
const aqi1 = calcAQIFromPM25(10)
assert.strictEqual(aqi1, 41, `PM2.5=10 should yield AQI~41, got ${aqi1}`)
const aqi2 = calcAQIFromPM25(35)
assert.strictEqual(aqi2, 97, `PM2.5=35 should yield AQI~97, got ${aqi2}`)
const aqi3 = calcAQIFromPM25(100)
assert.strictEqual(aqi3, 179, `PM2.5=100 should yield AQI~179, got ${aqi3}`)
console.log('✓ AQI calculation tests passed\n')

// Test 3: Risk aggregation (simple average)
console.log('Test 3: Risk Aggregation')
const components = { crime: 0.5, aqi: 0.4, traffic: 0.6, flood: 0.2 }
const avgRisk = (components.crime + components.aqi + components.traffic + components.flood) / 4
assert.strictEqual(avgRisk, 0.425, `Simple average should be 0.425, got ${avgRisk}`)
console.log('✓ Risk aggregation test passed\n')

console.log('All tests passed! ✓')
