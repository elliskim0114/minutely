import { useStore } from '../store'

export default function NotifModal() {
  const { closeNotif, notifSettings, toggleNotif } = useStore()

  const rows: { key: keyof typeof notifSettings; label: string; sub: string }[] = [
    { key: 'blocks', label: 'block reminders', sub: '5 min before each block' },
    { key: 'morning', label: 'morning brief', sub: '8:00 AM daily' },
    { key: 'eod', label: 'end of day wrap-up', sub: '9:00 PM daily' },
    { key: 'energy', label: 'energy check-in', sub: '7:00 AM daily' },
  ]

  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default'

  return (
    <div className="mb on" id="notif-m" onClick={e => { if (e.target === e.currentTarget) closeNotif() }}>
      <div className="mbox">
        <div className="mhdr">
          <span className="mttl">notifications</span>
          <button className="mx" onClick={closeNotif}>×</button>
        </div>

        {perm === 'default' && (
          <div className="notif-perm">
            <button
              className="notif-perm-btn"
              onClick={() => Notification.requestPermission()}
            >
              enable browser notifications
            </button>
          </div>
        )}

        {perm === 'denied' && (
          <div className="notif-perm-denied">
            browser notifications are blocked — enable them in your browser settings to receive alerts.
          </div>
        )}

        {rows.map(({ key, label, sub }) => (
          <div key={key} className="notif-row">
            <div>
              <div className="notif-lbl">{label}</div>
              <div className="notif-sub">{sub}</div>
            </div>
            <button
              className={`tog${notifSettings[key] ? ' on' : ''}`}
              onClick={() => toggleNotif(key)}
            />
          </div>
        ))}

        <div className="notif-note">
          morning brief and end of day notifications require the app to be open.
        </div>
      </div>
    </div>
  )
}
