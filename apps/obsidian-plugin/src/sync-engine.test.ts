import assert from "node:assert/strict"
import test from "node:test"
import { buildPluginSettings } from "./settings"

test("buildPluginSettings returns defaults for server sync", () => {
  assert.deepEqual(buildPluginSettings(), {
    serverUrl: "",
    email: "",
    token: "",
    autoSync: true,
  })
})
