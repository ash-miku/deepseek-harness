/** The browser half registers exactly one Changes Conversation View tab. */
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'

describe('changes client plugin', () => {
  it('registers the conversation view entry and its dictionaries', () => {
    const registrations: Array<{ options: Record<string, unknown>; component: unknown }> = []
    const locale = { register: vi.fn(), bind: vi.fn(() => (key: string) => key) }
    const slots = {
      inject: vi.fn((_name: string, register: () => void) => { register() }),
      register: vi.fn((options: Record<string, unknown>, component: unknown) => {
        registrations.push({ options, component })
      }),
    }
    const ctx = { locale, slots, effect: (fn: () => void) => { fn() } }
    apply(ctx as never)

    expect(inject).toEqual(['slots', 'locale'])
    expect(locale.register).toHaveBeenCalledTimes(1)
    expect(registrations).toHaveLength(2)
    const { options, component } = registrations[0]!
    expect(options).toMatchObject({ name: 'conversation.view', id: 'changes', order: 20, locale: 'changes' })
    expect((options.label as () => string)()).toBe('view.changes')
    expect(typeof component).toBe('function')
  })
})
