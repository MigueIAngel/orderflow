import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { API_URL } from '../api/client'
import { keys } from '../api/hooks'
import type { Notification } from '../api/types'
import { useFeed } from '../store/feed'

/**
 * One EventSource for the whole app. Every saga event lands in the live feed and refreshes
 * the queries it affects, so pages update without polling.
 */
export function useEventStream() {
  const client = useQueryClient()
  const push = useFeed((s) => s.push)
  const setConnected = useFeed((s) => s.setConnected)

  useEffect(() => {
    const source = new EventSource(`${API_URL}/api/notifications/stream`)
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.addEventListener('notification', (message) => {
      const notification = JSON.parse((message as MessageEvent<string>).data) as Notification
      push(notification)
      void client.invalidateQueries({ queryKey: keys.orders })
      if (notification.type.startsWith('stock.')) {
        void client.invalidateQueries({ queryKey: keys.products })
      }
    })
    return () => source.close()
  }, [client, push, setConnected])
}
