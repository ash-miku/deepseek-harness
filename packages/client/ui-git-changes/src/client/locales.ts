/** \`changes\` namespace dictionaries for the Git changes view. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'changes'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'view.changes': '变更',
  'label.base': '对比',
  'base.working': '工作区（未提交）',
  'branch.detached': '分离 HEAD',
  'counts.files': '{count} 个文件',
  'stats.files': '{count} 个文件已更改',
  'stats.label': '未提交改动：{count} 个文件已更改，新增 {added} 行，删除 {removed} 行',
  'refresh': '刷新',
  'mode.inline': '行内',
  'mode.split': '两侧',
  'loading': '加载中…',
  'error': '加载失败，请重试',
  'empty.clean': '工作区没有未提交的改动',
  'empty.nonRepo': '当前工作区不是 Git 仓库',
  'empty.noSelection': '选择左侧文件查看差异',
  'empty.noDiff': '该文件没有文本差异',
  'binary': '二进制文件，无法显示差异',
  'truncated': '差异过大，已截断显示',
  'kind.added': '新增',
  'kind.modified': '修改',
  'kind.deleted': '删除',
  'kind.renamed': '重命名',
  'kind.copied': '复制',
  'kind.typechange': '类型变更',
  'kind.unmerged': '冲突',
  'kind.untracked': '未跟踪',
  'flag.staged': '已暂存',
  'flag.unstaged': '未暂存',
  'summary.totals': '+{added} −{removed}',
}

/** English dictionary. */
export const en = {
  'view.changes': 'Changes',
  'label.base': 'Compare',
  'base.working': 'Working tree (uncommitted)',
  'branch.detached': 'Detached HEAD',
  'counts.files': '{count} files',
  'stats.files': '{count} files changed',
  'stats.label': 'Uncommitted changes: {count} files changed, {added} lines added, {removed} lines deleted',
  'refresh': 'Refresh',
  'mode.inline': 'Inline',
  'mode.split': 'Split',
  'loading': 'Loading…',
  'error': 'Failed to load, try again',
  'empty.clean': 'No uncommitted changes',
  'empty.nonRepo': 'This workspace is not a Git repository',
  'empty.noSelection': 'Select a file to see its diff',
  'empty.noDiff': 'No textual diff for this file',
  'binary': 'Binary file — no diff available',
  'truncated': 'Diff is large and was truncated',
  'kind.added': 'Added',
  'kind.modified': 'Modified',
  'kind.deleted': 'Deleted',
  'kind.renamed': 'Renamed',
  'kind.copied': 'Copied',
  'kind.typechange': 'Type changed',
  'kind.unmerged': 'Conflicted',
  'kind.untracked': 'Untracked',
  'flag.staged': 'Staged',
  'flag.unstaged': 'Unstaged',
  'summary.totals': '+{added} −{removed}',
}

/** Dictionary key vocabulary for this namespace. */
export type ChangesKey = keyof typeof zh
