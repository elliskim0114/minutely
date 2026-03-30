import { useStore } from '../store'

export default function Toast() {
  const { toast, toastVisible } = useStore()
  return (
    <div id="toast" className={toastVisible ? 'on' : ''}>
      {toast}
    </div>
  )
}
