import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from '../Login.jsx'

function setup(onAuth = vi.fn()) {
  render(<Login onAuth={onAuth} />)
  const email = screen.getByLabelText(/email/i)
  const password = screen.getByLabelText(/password/i)
  const submit = screen.getAllByTestId('auth-submit').at(-1)
  return { email, password, submit, onAuth }
}

describe('Login/Register flows (register first, then login)', () => {
  it('Normal user: register then login succeeds', async () => {
    const ui = setup()

    // Switch to Register
    await userEvent.click(screen.getByRole('button', { name: /register/i }))

    await userEvent.type(ui.email, 'user@example.com')
    await userEvent.type(ui.password, 'Passw0rd!')

    await userEvent.click(ui.submit)

    // Expect success alert
    await screen.findByRole('alert')
    expect(screen.getByText(/register successful/i)).toBeInTheDocument()

    // Now go to Login
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }))
    await userEvent.clear(ui.email)
    await userEvent.clear(ui.password)
    await userEvent.type(ui.email, 'user@example.com')
    await userEvent.type(ui.password, 'Passw0rd!')
    await userEvent.click(ui.submit)

    await screen.findByRole('alert')
    expect(screen.getByText(/login successful/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(ui.onAuth).toHaveBeenCalled()
    })
  })

  it('Best user: strong creds, quick toggle does not break', async () => {
    const ui = setup()

    // Toggle a couple times
    await userEvent.click(screen.getAllByTestId('toggle-register').at(-1))
    await userEvent.click(screen.getAllByTestId('toggle-login').at(-1))
    await userEvent.click(screen.getAllByTestId('toggle-register').at(-1))

    await userEvent.type(ui.email, 'pro.user@example.com')
    await userEvent.type(ui.password, 'Sup3r$trong_P@ssw0rd2025')
    await userEvent.click(ui.submit)

    await screen.findByRole('alert')
    expect(screen.getByText(/register successful/i)).toBeInTheDocument()

    // Login
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }))
    await userEvent.clear(ui.email)
    await userEvent.clear(ui.password)
    await userEvent.type(ui.email, 'pro.user@example.com')
    await userEvent.type(ui.password, 'Sup3r$trong_P@ssw0rd2025')
    await userEvent.click(ui.submit)

    await screen.findByRole('alert')
    expect(screen.getByText(/login successful/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(ui.onAuth).toHaveBeenCalled()
    })
  })

  it('Worst user: invalid inputs and duplicate registration show errors, wrong creds denied', async () => {
    const ui = setup()

    // Try invalid registration
    await userEvent.click(screen.getByRole('button', { name: /register/i }))
    await userEvent.type(ui.email, 'bad-email')
    await userEvent.type(ui.password, '123')
    await userEvent.click(ui.submit)
    await screen.findByRole('alert')
    expect(screen.getByText(/invalid input/i)).toBeInTheDocument()

    // Register valid user once
    await userEvent.clear(ui.email)
    await userEvent.clear(ui.password)
    await userEvent.type(ui.email, 'worst@example.com')
    await userEvent.type(ui.password, 'GoodEnough1!')
    await userEvent.click(ui.submit)
    await screen.findByText(/register successful/i)

    // Attempt duplicate registration
    await userEvent.clear(ui.email)
    await userEvent.clear(ui.password)
    await userEvent.type(ui.email, 'worst@example.com')
    await userEvent.type(ui.password, 'GoodEnough1!')
    await userEvent.click(ui.submit)
    await screen.findByRole('alert')
    expect(screen.getByText(/user already exists/i)).toBeInTheDocument()

    // Try wrong creds login
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }))
    await userEvent.clear(ui.email)
    await userEvent.clear(ui.password)
    await userEvent.type(ui.email, 'nope@example.com')
    await userEvent.type(ui.password, 'whatever!')
    await userEvent.click(ui.submit)
    await screen.findByRole('alert')
    expect(screen.getByText(/bad credentials/i)).toBeInTheDocument()

    expect(ui.onAuth).not.toHaveBeenCalled()
  })
})
