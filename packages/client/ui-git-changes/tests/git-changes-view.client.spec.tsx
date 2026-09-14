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
  total: 0,
  truncated: false,
  branches: ['release-6.0.0', 'main'],
}

function statusResponse(): Response {
  return Response.json(STATUS)
}

function truncatedResponse(total: number): Response {
  return Response.json({
    ...STATUS,
    changes: [
      { path: 'a.txt', kind: 'modified', staged: false, unstaged: true },
      { path: 'b.txt', kind: 'untracked', staged: false, unstaged: true },
    ],
    total,
    truncated: true,
  })
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

  it('shows the untruncated total and a notice when the Host caps the list', async () => {
    const fetcher = vi.fn().mockImplementation(async (input: unknown) => String(input).includes('/diff')
      ? Response.json({ path: 'a.txt', base: null, unified: '', binary: false, truncated: false })
      : truncatedResponse(42))
    vi.stubGlobal('fetch', fetcher)

    render(<GitChangesView {...({ sessionId: 's1', t } as unknown as ComponentProps<typeof GitChangesView>)} />)

    await screen.findByText('改动过多，仅显示前 2 个文件（共 42 个）')
    expect(screen.getByText('42 个文件')).toBeTruthy()
  })
})
