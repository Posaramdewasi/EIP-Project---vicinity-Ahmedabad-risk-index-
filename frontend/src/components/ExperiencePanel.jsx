import React, { useState, useMemo } from 'react'

const LEVELS = [
  {
    key: 'beginner',
    label: 'Novice Explorer',
    icon: '🌱',
    color: '#10B981',
    accentColor: '#059669',
    desc: 'Just starting your journey into the domain.',
    skills: ['Fundamentals', 'Documentation', 'Community'],
    achievements: ['First Step', 'Quick Learner'],
    nextGoals: ['Complete 5 tutorials', 'Build first project', 'Join community']
  },
  {
    key: 'intermediate',
    label: 'Proficient Builder',
    icon: '⚡',
    color: '#F59E0B',
    accentColor: '#D97706',
    desc: 'Comfortable with most patterns and workflows.',
    skills: ['Architecture', 'Best Practices', 'Testing'],
    achievements: ['Project Complete', 'Peer Reviewer'],
    nextGoals: ['Optimize performance', 'Contribute to OSS', 'Mentor beginners']
  },
  {
    key: 'advanced',
    label: 'Master Architect',
    icon: '🚀',
    color: '#EF4444',
    accentColor: '#DC2626',
    desc: 'Expert-level knowledge and optimization skills.',
    skills: ['System Design', 'Advanced Patterns', 'Leadership'],
    achievements: ['Architecture Lead', 'Industry Expert'],
    nextGoals: ['Drive innovation', 'Publish research', 'Shape ecosystem']
  }
]

function SkillBadge({ skill, color }) {
  return (
    <div className="skill-badge" style={{ borderColor: color }}>
      <span style={{ color }}>{skill}</span>
    </div>
  )
}

function LevelCard({ level, isActive, onClick }) {
  return (
    <button
      className={`level-card-advanced ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={isActive ? {
        background: `linear-gradient(135deg, ${level.color}15 0%, ${level.accentColor}10 100%)`,
        borderColor: level.color,
        boxShadow: `0 8px 20px ${level.color}25`
      } : {}}
    >
      <div className="card-icon">{level.icon}</div>
      <div className="card-content">
        <div className="card-title">{level.label}</div>
        <div className="card-desc">{level.desc}</div>
      </div>
      {isActive && <div className="card-indicator" style={{ background: level.color }} />}
    </button>
  )
}

export default function ExperiencePanel() {
  const [level, setLevel] = useState('intermediate')
  const [progress, setProgress] = useState(65)
  const [hoveredSkill, setHoveredSkill] = useState(null)

  const current = LEVELS.find(l => l.key === level)

  return (
    <div className="experience-panel-advanced">
      {/* Header with current level */}
      <div className="exp-header">
        <div className="exp-title-group">
          <span className="exp-icon">{current.icon}</span>
          <div>
            <h2>Your Experience Path</h2>
            <p className="exp-subtitle">{current.label}</p>
          </div>
        </div>
        <div className="exp-badge" style={{ background: `linear-gradient(135deg, ${current.color}, ${current.accentColor})` }}>
          {Math.round(progress)}%
        </div>
      </div>

      {/* Level selector cards */}
      <div className="levels-grid">
        {LEVELS.map(l => (
          <LevelCard
            key={l.key}
            level={l}
            isActive={l.key === level}
            onClick={() => setLevel(l.key)}
          />
        ))}
      </div>

      {/* Progress visualization */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Progression</span>
          <span className="progress-value">{Math.round(progress)}% Complete</span>
        </div>
        <div className="progress-bar-advanced">
          <div
            className="progress-fill-advanced"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${current.color}, ${current.accentColor})`
            }}
          />
        </div>
        <div className="progress-labels">
          <span>Novice</span>
          <span>Expert</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={e => setProgress(Number(e.target.value))}
          className="progress-slider"
          style={{
            background: `linear-gradient(90deg, ${current.color} 0%, ${current.accentColor} 100%)`
          }}
        />
      </div>

      {/* Skills showcase */}
      <div className="skills-section">
        <h3>Core Competencies</h3>
        <div className="skills-grid">
          {current.skills.map((skill, idx) => (
            <SkillBadge
              key={idx}
              skill={skill}
              color={current.color}
            />
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="achievements-section">
        <h3>Achievements</h3>
        <div className="achievements-list">
          {current.achievements.map((ach, idx) => (
            <div key={idx} className="achievement-item">
              <span className="ach-icon">🏆</span>
              <span className="ach-text">{ach}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next goals */}
      <div className="goals-section">
        <h3>Recommended Next Steps</h3>
        <ul className="goals-list">
          {current.nextGoals.map((goal, idx) => (
            <li key={idx} className="goal-item">
              <span className="goal-marker" style={{ background: current.color }} />
              <span>{goal}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
