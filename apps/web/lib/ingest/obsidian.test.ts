import assert from "node:assert/strict"
import test from "node:test"
import { buildObsidianSourceKey, buildObsidianUrl } from "./obsidian"

test("buildObsidianSourceKey normalizes vault path separators", () => {
  assert.equal(
    buildObsidianSourceKey("Vault", "Projects\\RAG\\Plan.md"),
    "obsidian:Vault:Projects/RAG/Plan.md"
  )
})

test("buildObsidianUrl creates a valid obsidian deep link", () => {
  assert.equal(
    buildObsidianUrl("Vault", "Projects/RAG/Plan.md"),
    "obsidian://open?vault=Vault&file=Projects%2FRAG%2FPlan.md"
  )
})
