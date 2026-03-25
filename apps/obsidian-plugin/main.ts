import { Notice, Plugin, TFile } from "obsidian"
import { signInToMindPocket } from "./src/api-client"
import { buildPluginSettings, type MindPocketPluginSettings } from "./src/settings"
import { MindPocketSyncSettingTab } from "./src/settings-tab"
import { deleteMarkdownFile, syncEntireVault, syncMarkdownFile } from "./src/sync-engine"
import { createEmptySyncState, type MindPocketSyncState } from "./src/sync-state"

interface PersistedPluginState {
  settings?: Partial<MindPocketPluginSettings>
  syncState?: MindPocketSyncState
}

export default class MindPocketSyncPlugin extends Plugin {
  settings: MindPocketPluginSettings = buildPluginSettings()
  syncState: MindPocketSyncState = createEmptySyncState()
  private settingTab: MindPocketSyncSettingTab | null = null
  private readonly syncTimers = new Map<string, number>()

  async onload() {
    const persisted = ((await this.loadData()) as PersistedPluginState | null) ?? {}
    this.settings = {
      ...buildPluginSettings(),
      ...persisted.settings,
    }
    this.syncState = persisted.syncState ?? createEmptySyncState()

    this.addCommand({
      id: "mindpocket-open-sync-settings",
      name: "MindPocket: Open sync settings",
      callback: () => this.openSettingTab(),
    })
    this.addCommand({
      id: "mindpocket-sync-vault-now",
      name: "MindPocket: Sync vault now",
      callback: async () => this.syncVaultNow(),
    })

    this.settingTab = new MindPocketSyncSettingTab(this.app, this)
    this.addSettingTab(this.settingTab)

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) {
          this.scheduleFileSync(file)
        }
      })
    )
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.scheduleFileSync(file)
        }
      })
    )
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.syncDeletedFile(file.path).catch((error) => {
            new Notice(
              error instanceof Error ? error.message : "MindPocket note delete sync failed"
            )
          })
        }
      })
    )
  }

  async savePluginSettings() {
    await this.persistPluginState()
  }

  async signInWithPassword(password: string) {
    if (!this.settings.serverUrl.trim()) {
      throw new Error("MindPocket server URL is required")
    }
    if (!this.settings.email.trim()) {
      throw new Error("MindPocket email is required")
    }
    if (!password.trim()) {
      throw new Error("MindPocket password is required")
    }

    const result = await signInToMindPocket({
      serverUrl: this.settings.serverUrl,
      email: this.settings.email,
      password,
    })

    this.settings.token = result.token
    await this.persistPluginState()
  }

  async syncVaultNow() {
    this.syncState = await syncEntireVault(this.app, this.settings, this.syncState)
    await this.persistPluginState()
  }

  onunload() {
    for (const timer of Array.from(this.syncTimers.values())) {
      window.clearTimeout(timer)
    }
    this.syncTimers.clear()
  }

  private openSettingTab() {
    const appWithSettings = this.app as typeof this.app & {
      setting?: {
        open: () => void
        openTabById?: (id: string) => void
      }
    }

    appWithSettings.setting?.open()
    appWithSettings.setting?.openTabById?.(this.manifest.id)
    this.settingTab?.display()
  }

  private async persistPluginState() {
    await this.saveData({
      settings: this.settings,
      syncState: this.syncState,
    } satisfies PersistedPluginState)
  }

  private scheduleFileSync(file: TFile) {
    if (!(this.settings.autoSync && this.settings.serverUrl.trim() && this.settings.token.trim())) {
      return
    }

    const existingTimer = this.syncTimers.get(file.path)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }

    const timer = window.setTimeout(() => {
      this.syncSingleFile(file).catch((error) => {
        new Notice(error instanceof Error ? error.message : "MindPocket note sync failed")
      })
    }, 750)

    this.syncTimers.set(file.path, timer)
  }

  private async syncSingleFile(file: TFile) {
    try {
      this.syncState = await syncMarkdownFile(this.app, file, this.settings, this.syncState)
      await this.persistPluginState()
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "MindPocket note sync failed")
    } finally {
      this.syncTimers.delete(file.path)
    }
  }

  private async syncDeletedFile(filePath: string) {
    if (!(this.settings.autoSync && this.settings.serverUrl.trim() && this.settings.token.trim())) {
      return
    }

    try {
      this.syncState = await deleteMarkdownFile(
        this.app.vault.getName(),
        filePath,
        this.settings,
        this.syncState
      )
      await this.persistPluginState()
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "MindPocket note delete sync failed")
    }
  }
}
