import { useState } from 'react'

export function useFlash() {
  const [message, setMessageValue] = useState('')
  const [error, setErrorValue] = useState('')

  function setError(text) {
    setErrorValue(text)
    if (text) setMessageValue('')
  }

  function setMessage(text) {
    setMessageValue(text)
    if (text) setErrorValue('')
  }

  function setFlash(kind, text) {
    if (kind === 'error') {
      setError(text)
      return
    }

    setMessage(text)
  }

  return {
    error,
    message,
    setError,
    setMessage,
    setFlash,
  }
}
