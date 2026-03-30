import { useState } from 'react'
import { useStore } from '../store'

export default function GCalModal({ onClose }: { onClose: () => void }) {
  const { gcalClientId, setGcalClientId, syncGcal, disconnectGcal, gcalDone } = useStore()
  const [clientId, setClientId] = useState(gcalClientId)
  const [showSetup, setShowSetup] = useState(!gcalClientId)

  const handleConnect = async () => {
    if (clientId.trim()) {
      setGcalClientId(clientId.trim())
    }
    onClose()
    await syncGcal()
  }

  return (
    <div className="mb on" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mbox">
        <div className="mhdr">
          <span className="mttl">google calendar</span>
          <button className="mx" onClick={onClose}>×</button>
        </div>

        {gcalDone ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>
              ✓ Connected — your Google Calendar events appear as blocks.
            </div>
            <button className="msave mact-btn" style={{ width: '100%' }} onClick={() => { syncGcal(); onClose() }}>
              sync now
            </button>
            <button className="mcanc mact-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { disconnectGcal(); onClose() }}>
              disconnect
            </button>
          </div>
        ) : (
          <>
            {showSetup ? (
              <div className="gcal-setup">
                <div className="gcal-step">
                  <span className="gcal-step-n">1</span>
                  <div>Go to <strong>console.cloud.google.com</strong> → New Project</div>
                </div>
                <div className="gcal-step">
                  <span className="gcal-step-n">2</span>
                  <div>Enable <strong>Google Calendar API</strong></div>
                </div>
                <div className="gcal-step">
                  <span className="gcal-step-n">3</span>
                  <div>Create <strong>OAuth 2.0 Web Client</strong> credentials. Add <code>{window.location.origin}</code> as authorized origin AND redirect URI</div>
                </div>
                <div className="gcal-step">
                  <span className="gcal-step-n">4</span>
                  <div>Paste your <strong>Client ID</strong> below</div>
                </div>
                <input
                  className="minp"
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  style={{ marginTop: 8 }}
                />
                <button className="mact-btn msave" style={{ width: '100%', marginTop: 10 }} onClick={handleConnect} disabled={!clientId.trim()}>
                  connect google calendar →
                </button>
              </div>
            ) : (
              <div>
                <button className="mact-btn msave" style={{ width: '100%' }} onClick={handleConnect}>
                  connect google calendar →
                </button>
                <button style={{ background: 'none', border: 'none', color: 'var(--ink4)', fontSize: 11, cursor: 'pointer', marginTop: 8, width: '100%' }} onClick={() => setShowSetup(true)}>
                  need help setting up?
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
