import { create } from 'zustand'
import type { Notification } from '../api/types'

interface FeedState {
  live: Notification[]
  connected: boolean
  push: (n: Notification) => void
  setConnected: (connected: boolean) => void
}

/** Events received over SSE during this visit, newest first. */
export const useFeed = create<FeedState>((set) => ({
  live: [],
  connected: false,
  push: (n) =>
    set((state) =>
      state.live.some((x) => x.id === n.id) ? state : { live: [n, ...state.live].slice(0, 100) },
    ),
  setConnected: (connected) => set({ connected }),
}))
