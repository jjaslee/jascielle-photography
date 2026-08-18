import { createContext, useContext, useMemo, useState } from 'react'

const defaultValue = {
  progress: 0,
  apertureClose: 0,
  /** false while iris covers the viewport; true after black hold releases Work. */
  irisReleased: false,
  setHandoff: () => {},
}

const SalienceHandoffContext = createContext(defaultValue)

export function SalienceHandoffProvider({ children }) {
  const [handoff, setHandoff] = useState({
    progress: 0,
    apertureClose: 0,
    irisReleased: false,
  })
  const value = useMemo(
    () => ({ ...handoff, setHandoff }),
    [handoff],
  )
  return (
    <SalienceHandoffContext.Provider value={value}>
      {children}
    </SalienceHandoffContext.Provider>
  )
}

export function useSalienceHandoff() {
  return useContext(SalienceHandoffContext)
}
