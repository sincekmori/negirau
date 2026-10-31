/**
 * Run an async step and always call `release` afterwards, however it ended.
 * The busy-flag handlers call this instead of writing try/finally themselves:
 * React Compiler cannot compile a `finally` clause inside a component or hook
 * yet (oxlint reports it as react(todo)), and this helper is neither.
 */
export async function settle(run: () => Promise<void>, release: () => void): Promise<void> {
	try {
		await run();
	} finally {
		release();
	}
}
