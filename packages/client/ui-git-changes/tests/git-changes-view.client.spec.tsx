// @vitest-environment jsdom
/**
 * The Changes view's comparison-base control: it is a DSH Menu trigger (not a
 * native <select>), the shared menu lists the working tree plus branches, and
 * picking a branch re-queries the status route with that base.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { GitChangesView } from '../src/client/GitChangesView.tsx'
import { zh } from '../src/client/locales.ts'

const t: ComponentProps<typeof GitChangesView>['t'] = (key, params) => {
  const template = (zh as Record<string, string>)[key] ?? key
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match)
}

const STATUS = {
  repo: true,
  root: '/repo',
  branch: 'feature',
  detached: false,
  changes: [],
  branches: ['release-6.0.0', 'main'],
}

function statusResponse(): Response {
  return Response.json(STATUS)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('GitChangesView comparison base', () => {
  it('selects the base from the shared DSH menu instead of a native select', async () => {
    const fetcher = vi.fn().mockResolvedValue(statusResponse())
    vi.stubGlobal('fetch', fetcher)

    render(<GitChangesView {...({ sessionId: 's1', t } as unknown as ComponentProps<typeof GitChangesView>)} />)

    const trigger = await screen.findByRole('button', { name: /对比/ })
    expect(document.querySelector('select')).toBeNull()
    expect(trigger.textContent).toContain('工作区（未提交）')

    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'release-6.0.0' }))

    await waitFor(() => {
      expect(trigger.textContent).toContain('release-6.0.0')
      expect(fetcher.mock.calls.some(([url]) => String(url).includes('base=release-6.0.0'))).toBe(true)
    })
  })
})
