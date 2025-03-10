import { redux } from "@cocalc/frontend/app-framework";
import { getHelp } from "@cocalc/frontend/frame-editors/llm/help-me-fix";
import { getValidLanguageModelName } from "@cocalc/util/db-schema/llm-utils";
import { MARKERS } from "@cocalc/util/sagews";
import { SETTINGS_LANGUAGE_MODEL_KEY } from "../account/useLanguageModelSetting";

export function isEnabled(project_id: string): boolean {
  return redux
    .getStore("projects")
    .hasLanguageModelEnabled(project_id, "help-me-fix");
}
export function helpMeFix({
  codemirror,
  stderr,
  uuid,
  project_id,
  path,
}): void {
  const val = codemirror.getValue();
  const i = val.indexOf(uuid);
  if (i == -1) return;
  const j = val.lastIndexOf(MARKERS.cell, i);
  const k = val.lastIndexOf(MARKERS.output, i);
  const input = val.slice(j + 1, k).trim();
  // use the currently set language model from the account store
  // https://github.com/sagemathinc/cocalc/pull/7278
  const other_settings = redux.getStore("account").get("other_settings");

  const projectsStore = redux.getStore("projects");
  const enabled = projectsStore.whichLLMareEnabled();
  const ollama = redux.getStore("customize").get("ollama")?.toJS() ?? {};
  const selectableLLMs =
    redux.getStore("customize").get("selectable_llms")?.toJS() ?? [];

  const model = getValidLanguageModelName(
    other_settings?.get(SETTINGS_LANGUAGE_MODEL_KEY),
    enabled,
    Object.keys(ollama),
    selectableLLMs,
  );
  getHelp({
    project_id,
    path,
    tag: "sagews",
    error: stderr,
    input,
    task: "ran a cell in a Sage Worksheet",
    language: "sage",
    extraFileInfo: "SageMath Worksheet",
    redux,
    prioritizeLastInput: true,
    model,
  });
}
