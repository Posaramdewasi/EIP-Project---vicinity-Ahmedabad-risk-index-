import React, { useEffect, useState } from 'react'

export default function RiskPanel({ zone }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (zone) {
      setHistory([
        { date: 'Nov 10', risk: Math.max(0, zone.risk - 0.05) },
        { date: 'Nov 11', risk: Math.max(0, zone.risk - 0.02) },
        { date: 'Nov 12', risk: zone.risk }
      ])
    }
  }, [zone])

  const getRiskLevel = (r) => {
    if (r > 0.75) return 'Critical'
    if (r > 0.5) return 'High'
    if (r > 0.25) return 'Moderate'
    return 'Low'
  }

  const getRiskColor = (r) => {
    if (r > 0.75) return '#dc2626'
    if (r > 0.5) return '#f97316'
    if (r > 0.25) return '#eab308'
    return '#22c55e'
  }

  const getAqiColor = (aqi) => {
    if (aqi == null) return '#94a3b8'
    if (aqi <= 50) return '#16a34a' // green
    if (aqi <= 100) return '#f59e0b' // yellow
    if (aqi <= 150) return '#f97316' // orange
    if (aqi <= 200) return '#dc2626' // red
    if (aqi <= 300) return '#7c3aed' // purple
    return '#6b021d' // maroon
  }

  if (!zone) return (
    <div className="risk-panel-empty">
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <h3>No Zone Selected</h3>
        <p>Click on a zone to view comprehensive risk analysis</p>
      </div>
    </div>
  )

  return (
    <div className="risk-panel-advanced">
      <div className="zone-header-premium">
        <div className="zone-name-header">
          <h2 className="zone-name-animated">{zone.name}</h2>
          <span className="risk-level-badge" style={{ background: getRiskColor(zone.risk) }}>
            {getRiskLevel(zone.risk)}
          </span>
        </div>
        <div className="zone-meta">
          <div className="meta-badge">
            <span className="meta-icon">👥</span>
            <span className="meta-text">{zone.population?.toLocaleString() || 'N/A'}</span>
          </div>
          <div className="meta-badge">
            <span className="meta-icon">🌍</span>
            <span className="meta-text">Ahmedabad Zone</span>
          </div>
        </div>
      </div>

      <div className="score-showcase">
        <div className="score-ring-wrapper">
          <div className="score-ring" style={{ background: `conic-gradient(${getRiskColor(zone.risk)} ${zone.risk * 360}deg, #e2e8f0 0deg)` }} />
          <div className="score-inner">
            <span className="score-number">{Math.round(zone.risk * 100)}</span>
            <span className="score-unit">%</span>
          </div>
        </div>

        <div className="score-meta">
          <div className="meta-item">
            <span className="meta-label">Risk Level</span>
            <span className="meta-value">{getRiskLevel(zone.risk)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Status</span>
            <span className="meta-status pulse-active">🔴 Active</span>
          </div>
        </div>

        <div className="aqi-card">
          <div className="aqi-icon">🌬️</div>
          <div className="aqi-info">
            <div className="aqi-label">Air Quality</div>
            <div className="aqi-value" style={{ color: getAqiColor(zone.aqi) }}>{zone.aqi ?? '--'}</div>
            <div className="aqi-category" style={{ color: getAqiColor(zone.aqi) }}>{zone.aqi_category || 'Unknown'}</div>
          </div>
        </div>
      </div>

      <div className="components-showcase">
        <h3 className="section-title">Risk Assessment</h3>
        <div className="factors-container">
          {zone.components && Object.entries(zone.components).map(([key, value], idx) => (
            <div key={key} className="factor-card" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className="factor-header">
                <span className="factor-name">{key === 'aqi' ? 'Air Quality' : (key.charAt(0).toUpperCase() + key.slice(1))}</span>
                <span className="factor-percentage">{key === 'aqi' ? (zone.aqi ?? '--') : `${Math.round(value * 100)}%`}</span>
              </div>
              <div className="factor-bar-container">
                <div className="factor-bar-bg" />
                <div className="factor-bar-fill" style={{ width: `${(key === 'aqi' ? Math.min(1, (zone.aqi || 0)/500) : value) * 100}%`, backgroundColor: key === 'aqi' ? getAqiColor(zone.aqi) : getRiskColor(value) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="trend-showcase">
        <h3 className="section-title">3-Day Projection</h3>
        <div className="trend-visualization">
          {history.map((h, i) => (
            <div key={i} className="trend-point" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="trend-bar-container">
                <div className="trend-bar" style={{ height: `${Math.max(15, h.risk * 100)}px`, backgroundColor: getRiskColor(h.risk) }} />
              </div>
              <span className="trend-label">{h.date}</span>
              <span className="trend-percentage">{Math.round(h.risk * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="alert-banner">
        <span className="banner-icon">ℹ️</span>
        <div className="banner-content">
          <div className="banner-title">Data Sources</div>
          <div className="banner-text">AQI: Live OGD • Crime/Traffic/Flood: Analyzed Data</div>
        </div>
      </div>
    </div>
  )
}
