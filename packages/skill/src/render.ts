// Pure template filling for SKILL.md, llms.txt and the prompts. No file system here, so the web app can import it.

export type TemplateVars = Record<string, string>;

function fill(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (key === "POOL_ADDRESS" && !v) return "not deployed yet";
    return v ?? `{{${key}}}`;
  });
}

export const renderSkill = fill;
export const renderLlms = fill;
export const fillPrompt = fill;
