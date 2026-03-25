export interface MindPocketPluginSettings {
  serverUrl: string
  email: string
  token: string
  autoSync: boolean
}

export function buildPluginSettings(): MindPocketPluginSettings {
  return {
    serverUrl: "",
    email: "",
    token: "",
    autoSync: true,
  }
}
