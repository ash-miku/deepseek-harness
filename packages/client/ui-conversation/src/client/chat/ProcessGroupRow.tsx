/** Unified fold disclosure for a turn's thinking and tool-call process. */
import { useState, type ReactNode } from 'react'
import { DisclosureRow, IconThinkOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ProcessGroupRow.module.css'

export interface ProcessGroupRowProps {
  title: string
  summary: string
  collapseLabel: string
  children: ReactNode
}

/**
 * Render one compact process disclosure that can own several business rows.
 * The body stays unmounted while collapsed, so streamed process content does
 * not draw before the reader asks for it.
 */
export function ProcessGroupRow({ title, summary, collapseLabel, children }: ProcessGroupRowProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={css.foldSummary} data-fold-process="unified">
      <DisclosureRow
        rowClassName={css.foldRow}
        leadingClassName={css.foldLeading}
        titleClassName={css.foldTitle}
        chevronClassName={css.foldChevron}
        icon={<IconThinkOutline14 size={14} />}
        title={title}
        open={open}
        expandable
        expandOnRowClick
        onToggle={() => { setOpen(value => !value) }}
        collapsedContent={<span className={css.foldSummaryText}>{summary}</span>}
      >
        <div className={css.foldBody}>{children}</div>
        <button type="button" className={css.collapseFooter} onClick={() => { setOpen(false) }}>
          <span className={css.collapseRule} aria-hidden />
          <span className={css.collapseLabel}>{collapseLabel}</span>
          <span className={css.collapseRule} aria-hidden />
        </button>
      </DisclosureRow>
    </div>
  )
}
