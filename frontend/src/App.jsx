import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import RiskPanel from './components/RiskPanel'

const center = [23.0225, 72.5714] // Ahmedabad

function styleByRisk(risk, isHovered = false) {
  const colors = {
    critical: '#dc2626',
    high: '#f97316',
    moderate: '#eab308',
    low: '#22c55e'
  }
  
  const color = risk > 0.75 ? colors.critical : risk > 0.5 ? colors.high : risk > 0.25 ? colors.moderate : colors.low
  
  return {
    fillColor: color,
    weight: isHovered ? 3.5 : 2.5,
    opacity: isHovered ? 1 : 0.95,
    color: '#ffffff',
    fillOpacity: isHovered ? 0.95 : 0.8,
    dashArray: isHovered ? '5,5' : 'none'
  }
}

export default function App() {
  const [zones, setZones] = useState(null)
  const [selected, setSelected] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [validationReport, setValidationReport] = useState(null)
  const [hoveredZone, setHoveredZone] = useState(null)

  useEffect(() => {
    // load sample GeoJSON and risk data (simulated)
    axios.get('/api/risk').then(res => {
      setTimeout(() => {
        setZones(res.data)
        setLoading(false)
      }, 500)
    }).catch(err=>{
      console.error(err)
      setLoading(false)
    })
  }, [])

  // Simple fingerprint/hash for data integrity (djb2 over JSON string)
  function computeFingerprint(obj) {
    try {
      const s = JSON.stringify(obj)
      let hash = 5381
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i)
        hash = hash & 0xFFFFFFFF
      }
      return `0x${(hash >>> 0).toString(16)}`
    } catch (e) { return 'n/a' }
  }

  // Validate zones data and produce a concise report
  function validateZones() {
    if (!zones || !zones.features) {
      setValidationReport({ ok: false, message: 'No GeoJSON zones loaded', details: [] })
      return
    }
    const details = []
    const features = zones.features || []
    let countMissingProps = 0
    let countBadRisk = 0
    let countMissingGeom = 0
    let countBadPopulation = 0
    let risks = []

    features.forEach((f, idx) => {
      const p = f.properties || {}
      if (!p.name) { countMissingProps++; details.push({ idx, issue: 'missing name' }) }
      if (typeof p.risk !== 'number') { countBadRisk++; details.push({ idx, issue: 'risk missing or not numeric', value: p.risk }) }
      else if (p.risk < 0 || p.risk > 1) { countBadRisk++; details.push({ idx, issue: 'risk out of bounds', value: p.risk }) }
      else risks.push(p.risk)
      if (!f.geometry) { countMissingGeom++; details.push({ idx, issue: 'missing geometry' }) }
      if (p.population != null && (typeof p.population !== 'number' || p.population < 0)) { countBadPopulation++; details.push({ idx, issue: 'bad population', value: p.population }) }
    })

    const min = risks.length ? Math.min(...risks) : null
    const max = risks.length ? Math.max(...risks) : null
    const avg = risks.length ? (risks.reduce((a,b)=>a+b,0)/risks.length) : null

    const fingerprint = computeFingerprint(zones)

    const ok = (countMissingProps === 0 && countBadRisk === 0 && countMissingGeom === 0 && countBadPopulation === 0)

    setValidationReport({
      ok,
      summary: {
        totalZones: features.length,
        missingProps: countMissingProps,
        badRisk: countBadRisk,
        missingGeom: countMissingGeom,
        badPopulation: countBadPopulation,
        minRisk: min,
        maxRisk: max,
        avgRisk: avg,
        fingerprint
      },
      details
    })
  }

  // map refs for direct leaflet access and pulse layer management
  const mapRef = useRef(null)
  const pulseLayerRef = useRef(null)
  const selectedMarkerRef = useRef(null)
  const [legendOpen, setLegendOpen] = useState(true)
  const [clickHistory, setClickHistory] = useState([])

  function createRipple(clientX, clientY) {
    const container = document.querySelector('.map')
    if (!container) return
    const r = document.createElement('div')
    r.className = 'map-ripple'
    r.style.left = `${clientX}px`
    r.style.top = `${clientY}px`
    container.appendChild(r)
    r.addEventListener('animationend', () => r.remove())
  }

  function onEachFeature(feature, layer) {
    const risk = feature.properties.risk
    const riskPercent = Math.round(risk * 100)
    const riskLevel = risk > 0.75 ? 'CRITICAL' : risk > 0.5 ? 'HIGH' : risk > 0.25 ? 'MODERATE' : 'LOW'

    layer.on({
      mouseover: (e) => {
        e.target.setStyle(styleByRisk(risk, true))
        e.target.openTooltip()
        setHoveredZone(feature.properties.name)
        const path = e.target.getElement()
        if (path) path.classList.add('zone-hover')
      },
      mouseout: (e) => {
        e.target.setStyle(styleByRisk(risk, false))
        setHoveredZone(null)
        const path = e.target.getElement()
        if (path) path.classList.remove('zone-hover')
      },
      click: (e) => {
        setSelected(feature.properties)
        // fly to the clicked zone nicely
        if (mapRef.current) {
          try {
            const bounds = e.target.getBounds()
            mapRef.current.flyToBounds(bounds, { padding: [80, 80], duration: 0.8 })
            // add pulse circle at center (remove previous)
            if (pulseLayerRef.current) {
              try { mapRef.current.removeLayer(pulseLayerRef.current) } catch (__) {}
              pulseLayerRef.current = null
            }
            const centerLatLng = bounds.getCenter()
            const pulse = L.circle(centerLatLng, { radius: 250, className: 'pulse-zone' })
            pulseLayerRef.current = pulse.addTo(mapRef.current)
            // auto-remove pulse after 3s
            setTimeout(() => {
              if (pulseLayerRef.current && mapRef.current) {
                try { mapRef.current.removeLayer(pulseLayerRef.current) } catch (__) {}
                pulseLayerRef.current = null
              }
            }, 3000)

            // add an animated selected marker (divIcon)
            if (selectedMarkerRef.current) {
              try { mapRef.current.removeLayer(selectedMarkerRef.current) } catch (__) {}
              selectedMarkerRef.current = null
            }
            const markerHtml = `<div class="selected-marker"><div class=\"marker-anim\"></div></div>`
            const marker = L.marker(centerLatLng, {
              icon: L.divIcon({ className: '', html: markerHtml, iconSize: [28, 28] }),
              interactive: false
            })
            selectedMarkerRef.current = marker.addTo(mapRef.current)
            // make selected marker persistent until next selection (no auto-remove)
            // record click in history (most recent first, limit 6)
            try {
              const entry = { name: feature.properties.name, latlng: e.latlng, time: new Date().toISOString() }
              setClickHistory(prev => [entry, ...prev].slice(0, 6))
            } catch (__) {}
          } catch (err) {
            console.warn('flyToBounds failed', err)
          }
        }
        // create a visual ripple at click point
        const containerPoint = mapRef.current ? mapRef.current.latLngToContainerPoint(e.latlng) : null
        if (containerPoint) {
          const cx = Math.round(containerPoint.x)
          const cy = Math.round(containerPoint.y)
          createRipple(cx, cy)
        }
      }
    })

    layer.setStyle(styleByRisk(risk))
    layer.bindTooltip(
      `<div class="map-tooltip"><strong>${feature.properties.name}</strong><br/>Risk: ${riskPercent}%<br/>Level: ${riskLevel}</div>`,
      { className: 'custom-tooltip' }
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-glow" />
        <div className="header-gradient" />
        <div className="header-content">
          <div className="header-left">
            <div className="header-logo">
              <span className="logo-inner">🗺️</span>
              <div className="logo-pulse" />
            </div>
            <div className="header-text">
              <h1 className="glitch" data-text="Vicinity">Vicinity</h1>
              <p className="header-subtitle">Ahmedabad Risk Intelligence System</p>
            </div>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-label">Zones Monitored</span>
              <span className="stat-value counter">{zones?.features?.length || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Current Selection</span>
              <span className={`stat-pulse ${selected ? 'active' : ''}`}>{selected ? '◆' : '◇'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Data Quality</span>
              <button className="validate-btn" onClick={validateZones}>Validate</button>
            </div>
          </div>
        </div>
      </header>
      <div className="container">
        <div className="map-wrapper">
          <div className="map">
            <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} whenCreated={(map) => { mapRef.current = map }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {zones && <GeoJSON data={zones} onEachFeature={onEachFeature} />}
            </MapContainer>
            <div className={`map-legend ${legendOpen ? 'open' : 'collapsed'}`} aria-hidden>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                <div className="legend-title">Risk Legend</div>
                <button className="legend-toggle" onClick={() => setLegendOpen(!legendOpen)} aria-label="Toggle legend">{legendOpen ? '▾' : '▸'}</button>
              </div>
              <div className="legend-items" style={{display: legendOpen ? 'flex' : 'none'}}>
                <div className="legend-item"><span className="swatch swatch-critical"/> Critical</div>
                <div className="legend-item"><span className="swatch swatch-high"/> High</div>
                <div className="legend-item"><span className="swatch swatch-moderate"/> Moderate</div>
                <div className="legend-item"><span className="swatch swatch-low"/> Low</div>
              </div>
            </div>
          </div>
          {loading && <div className="loading-overlay"><div className="spinner" /></div>}
        </div>
        <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>✕</button>
          <div className="panel-header">
            <h2 className="panel-title">Risk Analysis</h2>
            <div className="header-accent" />
          </div>
          <RiskPanel zone={selected} />
        </aside>
        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
      
      {/* Click history HUD */}
      <div className="click-history" aria-live="polite">
        <div className="history-header">Recent Clicks</div>
        {clickHistory.length === 0 && <div className="history-empty">No recent clicks</div>}
        <div className="history-list">
          {clickHistory.map((h, idx) => (
            <div key={idx} className="history-item">
              <div className="history-meta">
                <div className="history-name">{h.name}</div>
                <div className="history-time">{new Date(h.time).toLocaleTimeString()}</div>
              </div>
              <div className="history-actions">
                <button onClick={() => {
                  if (mapRef.current) mapRef.current.flyTo([h.latlng.lat, h.latlng.lng], 14, { duration: 0.8 })
                }} title="Center on click">Go</button>
                <button onClick={() => {
                  setClickHistory(prev => prev.filter((_, i) => i !== idx))
                }} title="Remove">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Modal */}
      {validationReport && (
        <div className="validation-modal" role="dialog" aria-modal="true">
          <div className="validation-card">
            <div className="validation-header">
              <h3>Data Validation Report</h3>
              <button className="close-btn" onClick={() => setValidationReport(null)}>✕</button>
            </div>
            <div className="validation-body">
              <div className={`validation-badge ${validationReport.ok ? 'ok' : 'warn'}`}>{validationReport.ok ? 'OK' : 'ISSUES'}</div>
              <div className="validation-summary">
                <div><strong>Total zones:</strong> {validationReport.summary.totalZones}</div>
                <div><strong>Missing props:</strong> {validationReport.summary.missingProps}</div>
                <div><strong>Risk errors:</strong> {validationReport.summary.badRisk}</div>
                <div><strong>Missing geometry:</strong> {validationReport.summary.missingGeom}</div>
                <div><strong>Population errors:</strong> {validationReport.summary.badPopulation}</div>
                <div><strong>Risk (min/max/avg):</strong> {validationReport.summary.minRisk ?? 'n/a'} / {validationReport.summary.maxRisk ?? 'n/a'} / {validationReport.summary.avgRisk ? validationReport.summary.avgRisk.toFixed(3) : 'n/a'}</div>
                <div><strong>Fingerprint:</strong> <code>{validationReport.summary.fingerprint}</code></div>
              </div>
              <div className="validation-details">
                <h4>Details</h4>
                {validationReport.details.length === 0 && <div className="detail-empty">No detailed issues found.</div>}
                <ul>
                  {validationReport.details.map((d, i) => (
                    <li key={i}><strong>Feature #{d.idx}:</strong> {d.issue} {d.value !== undefined ? `(${String(d.value)})` : ''}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
