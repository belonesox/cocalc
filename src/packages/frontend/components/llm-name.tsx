import { useTypedRedux } from "@cocalc/frontend/app-framework";
import { modelToName } from "@cocalc/frontend/frame-editors/llm/llm-selector";
import {
  LanguageModel,
  fromOllamaModel,
  isLanguageModel,
  isOllamaLLM,
} from "@cocalc/util/db-schema/llm-utils";
import { LanguageModelVendorAvatar } from "./language-model-icon";

export function LLMModelName(
  props: Readonly<{ model: LanguageModel; size?: number }>,
) {
  const { model, size } = props;

  const ollama = useTypedRedux("customize", "ollama");

  function renderTitle() {
    if (isLanguageModel(model)) {
      return modelToName(model);
    }

    if (isOllamaLLM(model)) {
      const om = ollama?.get(fromOllamaModel(model));
      if (om) {
        return om.get("display") ?? `Ollama ${model}`;
      }
    }
    return model;
  }

  return (
    <>
      <LanguageModelVendorAvatar
        model={model}
        size={size}
        style={{ marginRight: 0 }}
      />{" "}
      {renderTitle()}
    </>
  );
}
