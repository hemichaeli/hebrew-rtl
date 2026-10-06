/** The prompt box's draft as last typed, mirrored above the box. */
export type Draft = string

declare module 'claude-code' {
  interface PluginState {
    'hebrew-rtl': { draft: Draft }
  }
}
