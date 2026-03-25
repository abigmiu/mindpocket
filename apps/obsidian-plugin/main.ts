import { type App, Plugin, PluginSettingTab, Setting } from "obsidian"
import { buildPluginSettings, type MindPocketPluginSettings } from "./src/settings"

class MindPocketSyncSettingTab extends PluginSettingTab {
  private readonly plugin: MindPocketSyncPlugin

  constructor(app: App, plugin: MindPocketSyncPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display() {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl("h2", { text: "MindPocket Sync" })

    new Setting(containerEl)
      .setName("Server URL")
      .setDesc("The deployed MindPocket server URL.")
      .addText((text) =>
        text
          .setPlaceholder("https://mindpocket.example.com")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim()
            await this.plugin.savePluginSettings()
          })
      )
  }
}

export default class MindPocketSyncPlugin extends Plugin {
  settings: MindPocketPluginSettings = buildPluginSettings()
  private settingTab: MindPocketSyncSettingTab | null = null

  async onload() {
    this.settings = {
      ...buildPluginSettings(),
      ...(await this.loadData()),
    }

    this.addCommand({
      id: "mindpocket-open-sync-settings",
      name: "MindPocket: Open sync settings",
      callback: () => this.openSettingTab(),
    })

    this.settingTab = new MindPocketSyncSettingTab(this.app, this)
    this.addSettingTab(this.settingTab)
  }

  async savePluginSettings() {
    await this.saveData(this.settings)
  }

  private openSettingTab() {
    const appWithSettings = this.app as App & {
      setting?: {
        open: () => void
        openTabById?: (id: string) => void
      }
    }

    appWithSettings.setting?.open()
    appWithSettings.setting?.openTabById?.(this.manifest.id)
    this.settingTab?.display()
  }
}
