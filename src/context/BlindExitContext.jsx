import { createContext, useCallback, useContext, useRef } from 'react'

/**
 * Provides a way for WorkRows to register a blind-close callback that any
 * navigation trigger on the site can invoke before routing away.
 */
const BlindExitContext = createContext(null)

export function BlindExitProvider({ children }) {
  // { trigger: (destination) => void } or null
  const handlerRef = useRef(null)

  const register = useCallback((fn) => {
    handlerRef.current = fn
    return () => {
      handlerRef.current = null
    }
  }, [])

  /** Returns true if the blind close was taken (navigation should be deferred). */
  const triggerBlindExit = useCallback((destination) => {
    if (!handlerRef.current) return false
    handlerRef.current(destination)
    return true
  }, [])

  return (
    <BlindExitContext.Provider value={{ register, triggerBlindExit }}>
      {children}
    </BlindExitContext.Provider>
  )
}

export function useBlindExit() {
  return useContext(BlindExitContext)
}
