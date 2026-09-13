/**
 * Git changes plugin, node half. Serves the workspace repository status and
 * per-file unified diffs to the browser Changes view over authenticated
 * Connection routes. The browser half ships via exports["./client"].
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerGitChanges } from './git-routes.ts'

/** Services required for Session workspace lookup and the authenticated route carrier. */
export const inject = ['connection', 'sessionController', 'sandboxPolicy']

/**
 * Host plugin body: register the Git changes routes.
 * @param ctx - Host context.
 */
export function apply(ctx: Context): void {
  registerGitChanges(ctx)
}
