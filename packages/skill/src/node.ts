// Node-only helpers that read the skill's files from disk (the keeper uses these to serve /skill.md and /llms.txt).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type TemplateVars, fillPrompt } from "./render";

const dir = fileURLToPath(new URL("..", import.meta.url));

export const PROMPT_NAMES = ["open", "draw", "repay", "vouch"] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];

export function readSkillTemplate(): string {
  return readFileSync(`${dir}SKILL.md`, "utf8");
}

export function readLlmsTemplate(): string {
  return readFileSync(`${dir}llms.txt.tmpl`, "utf8");
}

export function renderPrompt(name: PromptName, vars: TemplateVars): string {
  return fillPrompt(readFileSync(`${dir}prompts/${name}.md`, "utf8"), vars).trim();
}
