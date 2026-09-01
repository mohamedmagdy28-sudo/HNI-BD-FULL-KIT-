/**
 * Base-aware public-asset URL. Literal absolute paths like "/brand/x.svg"
 * break the moment the app is served under a sub-path (GitHub Pages at
 * /HNI-BD-FULL-KIT-/) or a custom scheme (the planned desktop shell) —
 * Vite rebases index.html and imported assets, but NOT string literals in
 * JSX. Every public-dir reference from code goes through here.
 */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
