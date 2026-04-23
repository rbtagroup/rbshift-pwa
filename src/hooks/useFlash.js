import { useState } from 'react'

export function useFlash() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function setFlash(kind, text) {
    if (kind === 'error') {
      setError(text)
      setMessage('')
      return
    }

    setMessage(text)
    setError('')
  }

  return {
    error,
    message,
    setError,
    setMessage,
    setFlash,
  }
}
