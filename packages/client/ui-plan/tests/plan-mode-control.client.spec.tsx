// @vitest-environment jsdom
/**
 * PlanChip over the `plan` projection: nothing renders while the capability
 * is absent; inactive sessions show the Plan entry and active sessions show
 * the Plan status. Both states execute the same /plan and /plan off command
 * face and remain visible through failures until the projection confirms the
 * switch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { PlanProjection } from '@deepseek-ai/dsh-plan-mode/client'
import { PlanChip, type PlanChipProps } from '../src/client/PlanModeControl.tsx'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

// The framework-injected t seat, stubbed over the zh dictionaries (the default locale).
const t: PlanChipProps['t'] = makeTranslate(zh, commonZh)

function setup(
  plan: PlanProjection | undefined,
  setPlanMode = vi.fn(() => Promise.resolve<string | null>(null)),
  locked = false,
) {
  const store = createSnapshotStore<{ value: PlanProjection | undefined }>({ value: plan })
  const useProjection = (_key: string, selector?: (v: unknown) => unknown) =>
    bindSnapshotSelector(store)(s => (selector ?? (v => v))(s.value))
  const props = { useProjection, locked, setPlanMode, t } as unknown as PlanChipProps
  const view = render(<PlanChip {...props} />)
  return { store, setPlanMode, view }
}

const activeChip = () => screen.getByRole('button', { name: 'plan mode 已开启，按下关闭' })
const inactiveChip = () => screen.getByRole('button', { name: 'plan mode 已关闭，按下开启' })

describe('PlanChip', () => {
  it('renders nothing for an absent capability', () => {
    const absent = setup(undefined)
    expect(absent.view.container.innerHTML).toBe('')
  })

  it('renders the Plan status for active and pending-entry targets', () => {
    setup({ active: true, pending: false })
    expect(activeChip().textContent).toBe('Plan')
    cleanup()
    setup({ active: false, pending: true })
    expect(activeChip().textContent).toBe('Plan')
  })

  it('renders the close mark only while plan mode is the effective target', () => {
    setup({ active: false, pending: false })
    expect(inactiveChip().textContent).toBe('Plan')
    expect(inactiveChip().querySelector('svg')).toBeNull()
    cleanup()
    setup({ active: true, pending: false })
    expect(activeChip().querySelector('svg')).not.toBeNull()
    cleanup()
    setup({ active: false, pending: true })
    expect(activeChip().querySelector('svg')).not.toBeNull()
  })

  it('renders an inactive Plan entry and enters plan mode on click', async () => {
    const setPlanMode = vi.fn(() => Promise.resolve<string | null>(null))
    const { store } = setup({ active: false, pending: false }, setPlanMode)
    fireEvent.click(inactiveChip())
    expect(setPlanMode).toHaveBeenCalledWith(true)
    await waitFor(() => {
      expect((inactiveChip() as HTMLButtonElement).disabled).toBe(true)
    })
    store.set({ value: { active: true, pending: false } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'plan mode 已开启，按下关闭' }).hasAttribute('disabled')).toBe(false)
    })
  })

  it('executes /plan off once and follows the projection down', async () => {
    let resolve!: (value: string | null) => void
    const setPlanMode = vi.fn(() => new Promise<string | null>((done) => { resolve = done }))
    const { store } = setup({ active: true, pending: false }, setPlanMode)
    fireEvent.click(activeChip())
    expect(setPlanMode).toHaveBeenCalledWith(false)
    fireEvent.click(activeChip())
    expect(setPlanMode).toHaveBeenCalledTimes(1)
    resolve(null)
    await waitFor(() => {
      expect((activeChip() as HTMLButtonElement).disabled).toBe(true)
    })
    store.set({ value: { active: true, pending: true } })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'plan mode 已开启，按下关闭' })).toBeNull()
    })
  })

  it('keeps the button disabled until the RPC settles even after projection confirms', async () => {
    let resolve!: (value: string | null) => void
    const setPlanMode = vi.fn(() => new Promise<string | null>((done) => { resolve = done }))
    const { store } = setup({ active: false, pending: false }, setPlanMode)
    fireEvent.click(inactiveChip())
    store.set({ value: { active: true, pending: false } })
    await waitFor(() => {
      expect((activeChip() as HTMLButtonElement).disabled).toBe(true)
    })
    expect(setPlanMode).toHaveBeenCalledTimes(1)
    resolve(null)
    await waitFor(() => {
      expect((activeChip() as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('does not issue a second toggle from a stale projection', async () => {
    let resolve!: (value: string | null) => void
    const setPlanMode = vi.fn(() => new Promise<string | null>((done) => { resolve = done }))
    const { store } = setup({ active: false, pending: false }, setPlanMode)
    fireEvent.click(inactiveChip())
    await waitFor(() => {
      expect((inactiveChip() as HTMLButtonElement).disabled).toBe(true)
    })
    fireEvent.click(inactiveChip())
    expect(setPlanMode).toHaveBeenCalledTimes(1)
    resolve(null)
    store.set({ value: { active: true, pending: false } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'plan mode 已开启，按下关闭' }).hasAttribute('disabled')).toBe(false)
    })
  })

  it('disables under the locked owner prop', () => {
    setup({ active: true, pending: false }, vi.fn(), true)
    expect((activeChip() as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    setup({ active: false, pending: false }, vi.fn(), true)
    expect((inactiveChip() as HTMLButtonElement).disabled).toBe(true)
  })

  it('surfaces admission and transport failures while staying visible', async () => {
    const setPlanMode = vi.fn()
      .mockResolvedValueOnce('host said no')
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce('socket closed')
    setup({ active: true, pending: false }, setPlanMode)
    fireEvent.click(activeChip())
    expect((await screen.findByText('退出 plan mode 失败')).getAttribute('title')).toBe('host said no')
    expect(activeChip()).toBeTruthy()

    fireEvent.click(activeChip())
    expect(await screen.findByTitle('network down')).toBeTruthy()

    fireEvent.click(activeChip())
    expect(await screen.findByTitle('socket closed')).toBeTruthy()
  })

  it('shows an enter-mode failure on the inactive control', async () => {
    const setPlanMode = vi.fn(() => Promise.resolve('host said no'))
    setup({ active: false, pending: false }, setPlanMode)
    fireEvent.click(inactiveChip())
    // Both directions render the same localized failure copy (the store's own
    // message rides the title attribute, asserted above).
    expect(await screen.findByText('退出 plan mode 失败')).toBeTruthy()
    expect(inactiveChip()).toBeTruthy()
  })

  it('ignores in-flight fulfillment and rejection after unmount', () => {
    let resolve!: (value: string | null) => void
    const successful = setup(
      { active: true, pending: false },
      vi.fn(() => new Promise<string | null>((done) => { resolve = done })),
    )
    fireEvent.click(activeChip())
    successful.view.unmount()
    expect(() => { resolve(null) }).not.toThrow()

    let reject!: (reason: unknown) => void
    const setPlanMode = vi.fn(() => new Promise<string | null>((_done, fail) => { reject = fail }))
    const { view } = setup({ active: true, pending: false }, setPlanMode)
    fireEvent.click(activeChip())
    view.unmount()
    expect(() => { reject(new Error('late')) }).not.toThrow()
  })
})
