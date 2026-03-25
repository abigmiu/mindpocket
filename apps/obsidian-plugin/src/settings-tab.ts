import { type App, Notice, PluginSettingTab, Setting } from "obsidian"
import type MindPocketSyncPlugin from "../main"

export class MindPocketSyncSettingTab extends PluginSettingTab {
  private password = ""
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

    new Setting(containerEl)
      .setName("Email")
      .setDesc("Your MindPocket account email.")
      .addText((text) =>
        text.setValue(this.plugin.settings.email).onChange(async (value) => {
          this.plugin.settings.email = value.trim()
          await this.plugin.savePluginSettings()
        })
      )

    new Setting(containerEl)
      .setName("Password")
      .setDesc("Used only for the sign-in action.")
      .addText((text) =>
        text.setPlaceholder("Enter password").onChange((value) => {
          this.password = value
        })
      )

    new Setting(containerEl)
      .setName("Auto sync")
      .setDesc("Sync markdown note changes automatically.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value
          await this.plugin.savePluginSettings()
        })
      )

    new Setting(containerEl)
      .setName("Sign in")
      .setDesc(
        this.plugin.settings.token ? "Token saved locally." : "Sign in to fetch a bearer token."
      )
      .addButton((button) =>
        button.setButtonText("Sign in").onClick(async () => {
          try {
            await this.plugin.signInWithPassword(this.password)
            new Notice("MindPocket sign-in succeeded")
            this.display()
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "MindPocket sign-in failed")
          }
        })
      )

    new Setting(containerEl)
      .setName("Sync vault")
      .setDesc("Push changed markdown notes to MindPocket.")
      .addButton((button) =>
        button
          .setButtonText("Sync now")
          .setCta()
          .onClick(async () => {
            try {
              await this.plugin.syncVaultNow()
              new Notice("MindPocket vault sync completed")
            } catch (error) {
              new Notice(error instanceof Error ? error.message : "MindPocket vault sync failed")
            }
          })
      )
  }
}
