// @vitest-environment jsdom
/** Workspace footer refresh and late-response isolation. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { GitChangesStats } from '../src/client/GitChangesStats.tsx'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '../src/client/locales.ts'

type Props = ComponentProps<typeof GitChangesStats>
const t: Props['t'] = makeTranslate(zh, commonZh)
const status = { repo: true, root: '/fixture', branch: 'main', detached: false, branches: ['main'], changes: [
  { path: 'a.txt', kind: 'modified', staged: true, unstaged: true, additions: 4, deletions: 2 },
  { path: 'b.txt', kind: 'untracked', staged: false, unstaged: true, additions: 3, deletions: 0 },
  { path: 'c.bin', kind: 'modified', staged: false, unstaged: true },
] }
function props(sessionId = 's1', running = false): Props {
  const useSession = (select: (value: { running: boolean }) => unknown) => select({ running })
  return { sessionId, t, selectView: () => {}, useSession } as unknown as Props
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('GitChangesStats', () => {
  it('shows uncommitted totals, refreshes on completion and focus, and hides clean repositories', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json(status))
    vi.stubGlobal('fetch', fetcher)
    const selectView = vi.fn()
    const view = render(<GitChangesStats {...props('s1', true)} selectView={selectView} />)
    await screen.findByText('3 个文件已更改')
    fireEvent.click(screen.getByRole('button', { name: /3 个文件已更改/ }))
    expect(selectView).toHaveBeenCalledWith('changes')
    expect(screen.getByText('+7')).toBeTruthy()
    expect(screen.getByText('−2')).toBeTruthy()
    expect(String(fetcher.mock.calls[0]![0])).not.toContain('base=')
    expect(view.container.textContent).toMatchInlineSnapshot('"3 个文件已更改+7−2"')
    view.rerender(<GitChangesStats {...props()} />)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    fetcher.mockImplementation(async () => Response.json({ ...status, changes: [] }))
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(view.container.textContent).toBe(''))
  })
  it('isolates session switches and ignores an aborted late response', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
      .mockImplementation(async () => Response.json({ repo: false, message: '' }))
    vi.stubGlobal('fetch', fetcher)
    const view = render(<GitChangesStats {...props()} />)
    const signal = (fetcher.mock.calls[0]![1] as RequestInit).signal!
    view.rerender(<GitChangesStats {...props('s2')} />)
    expect(signal.aborted).toBe(true)
    finish(Response.json(status))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(view.container.textContent).toBe('')
  })
  it('clears stale totals after a failed refresh and aborts on unmount', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json(status))
    vi.stubGlobal('fetch', fetcher)
    const view = render(<GitChangesStats {...props()} />)
    await screen.findByText('3 个文件已更改')
    fetcher.mockImplementation(async () => new Response('', { status: 503 }))
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(view.container.textContent).toBe(''))
    const signal = (fetcher.mock.calls[1]![1] as RequestInit).signal!
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
})
