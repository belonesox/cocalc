import { Button, Input, InputNumber, Popover, Space } from "antd";
import { throttle } from "lodash";
import React, { useState } from "react";

import { useLanguageModelSetting } from "@cocalc/frontend/account/useLanguageModelSetting";
import { alert_message } from "@cocalc/frontend/alerts";
import { useFrameContext } from "@cocalc/frontend/app-framework";
import { Paragraph } from "@cocalc/frontend/components";
import AIAvatar from "@cocalc/frontend/components/ai-avatar";
import { Icon } from "@cocalc/frontend/components/icon";
import { NotebookFrameActions } from "@cocalc/frontend/frame-editors/jupyter-editor/cell-notebook/actions";
import LLMSelector, {
  modelToName,
} from "@cocalc/frontend/frame-editors/llm/llm-selector";
import { splitCells } from "@cocalc/frontend/jupyter/llm/split-cells";
import { useProjectContext } from "@cocalc/frontend/project/context";
import { LLMEvent } from "@cocalc/frontend/project/history/types";
import track from "@cocalc/frontend/user-tracking";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import {
  LanguageModel,
  getLLMServiceStatusCheckMD,
  model2vendor,
} from "@cocalc/util/db-schema/llm-utils";
import { plural } from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";
import { JupyterActions } from "../browser-actions";
import { RawPrompt } from "../llm/raw-prompt";
import { Position } from "./types";
import { insertCell } from "./util";

interface AIGenerateCodeCellProps {
  actions: JupyterActions;
  children: React.ReactNode;
  frameActions: React.MutableRefObject<NotebookFrameActions | undefined>;
  id: string;
  setShowAICellGen: (show: Position) => void;
  showAICellGen: Position;
}

export function AIGenerateCodeCell({
  actions,
  children,
  frameActions,
  id,
  setShowAICellGen,
  showAICellGen,
}: AIGenerateCodeCellProps) {
  const { actions: project_actions } = useProjectContext();
  const { project_id, path } = useFrameContext();

  const [querying, setQuerying] = useState<boolean>(false);
  const [model, setModel] = useLanguageModelSetting(project_id);
  const [prompt, setPrompt] = useState<string>("");
  const [includePreviousCells, setIncludePreviousCells] = useState<number>(1);

  function getPrevCodeContents(): string {
    if (includePreviousCells === 0 || showAICellGen == null) return "";
    return getPreviousNonemptyCodeCellContents(
      frameActions.current,
      id,
      showAICellGen,
      includePreviousCells,
    );
  }

  function doQuery(prevCodeContents: string) {
    setQuerying(true);
    if (showAICellGen == null) return;
    queryLanguageModel({
      frameActions,
      actions,
      id,
      position: showAICellGen,
      model,
      project_id,
      path,
      prompt,
      whenStarting: () => {
        setShowAICellGen(null);
        setQuerying(false);
      },
      prevCodeContents,
      includePreviousCells,
    });

    // we also log this
    const event: LLMEvent = {
      event: "llm",
      usage: "jupyter-generate-cell",
      model,
      path,
    };
    project_actions?.log(event);
  }

  // called, when actually displayed
  function renderContent() {
    const prevCodeContents = getPrevCodeContents();

    const { input } = getInput({
      frameActions,
      prompt,
      actions,
      position: showAICellGen,
      model,
      prevCodeContents,
    });

    return (
      <div style={{ width: "500px", maxWidth: "90vw" }}>
        <>
          <Paragraph>Describe what the new cell should do.</Paragraph>
          <Paragraph>
            <Input.TextArea
              allowClear
              autoFocus
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
              }}
              placeholder="Describe the new cell..."
              onPressEnter={(e) => {
                if (!e.shiftKey) return;
                doQuery(prevCodeContents);
              }}
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </Paragraph>
          <Paragraph>
            <Space>
              Context: include previous{" "}
              <InputNumber
                min={0}
                max={10}
                size={"small"}
                value={includePreviousCells}
                onChange={(value) => setIncludePreviousCells(value ?? 1)}
              />{" "}
              {plural(includePreviousCells, "code cell.", "code cells.")}
            </Space>
          </Paragraph>
          <Paragraph>
            The following prompt will be sent to {modelToName(model)}:
          </Paragraph>
          <RawPrompt input={input} />
          <Paragraph style={{ textAlign: "center", marginTop: "30px" }}>
            <Space size="large">
              <Button onClick={() => setShowAICellGen(null)}>Cancel</Button>
              <Button
                type="primary"
                onClick={() => doQuery(prevCodeContents)}
                disabled={!prompt.trim()}
                loading={querying}
              >
                <Icon name={"paper-plane"} /> Generate Using{" "}
                {modelToName(model)} (shift+enter)
              </Button>
            </Space>
          </Paragraph>
        </>
      </div>
    );
  }

  return (
    <Popover
      placement="bottom"
      title={() => (
        <div style={{ fontSize: "18px" }}>
          <AIAvatar size={22} /> Generate code cell using{" "}
          <LLMSelector
            project_id={project_id}
            model={model}
            setModel={setModel}
          />
          <Button
            onClick={() => setShowAICellGen(null)}
            type="text"
            style={{ float: "right", color: COLORS.GRAY_M }}
          >
            <Icon name="times" />
          </Button>
        </div>
      )}
      open={showAICellGen != null}
      content={renderContent}
      trigger={[]}
      destroyTooltipOnHide
    >
      {children}
    </Popover>
  );
}

interface QueryLanguageModelProps {
  actions: JupyterActions;
  frameActions: React.MutableRefObject<NotebookFrameActions | undefined>;
  id: string;
  model: LanguageModel;
  path: string;
  position: NonNullable<Position>;
  project_id: string;
  prompt: string;
  whenDone?: () => void;
  whenStarting?: () => void;
  prevCodeContents: string;
  includePreviousCells: number;
}

async function queryLanguageModel({
  actions,
  frameActions,
  id,
  model,
  path,
  position,
  project_id,
  prompt,
  whenDone,
  whenStarting,
  prevCodeContents,
  includePreviousCells,
}: QueryLanguageModelProps) {
  if (!prompt.trim()) return;

  const { input, system } = getInput({
    actions,
    frameActions,
    model,
    position,
    prompt,
    prevCodeContents,
  });
  if (!input) {
    return;
  }

  try {
    const fa = frameActions.current;
    if (fa == null) {
      throw Error("frame actions must be defined");
    }
    const tag = `generate-jupyter-cell:prev-${includePreviousCells}`;
    track("chatgpt", { project_id, path, tag, type: "generate", model });

    // This is here to make it clear this was generated by a language model.
    // It could also be a comment in the code cell but for that we would need to know how the
    // comment character is in the language.
    const noteCellId = insertCell({
      frameActions,
      actions,
      id,
      position,
      type: "markdown",
      content: `The code below was generated by ${modelToName(
        model,
      )} using this prompt:\n\n> ${prompt}\n\n `,
    });

    if (!noteCellId) {
      throw new Error("unable to insert cell");
    }

    // this is the first cell
    const firstCellId = insertCell({
      frameActions,
      actions,
      type: "markdown",
      content: ":robot: Generating…",
      id: noteCellId,
      position: "below",
    });
    if (firstCellId == null) {
      throw new Error("unable to insert cells");
    }
    fa.set_mode("escape"); // while tokens come in ...
    fa.set_md_cell_not_editing(noteCellId);
    fa.set_md_cell_not_editing(firstCellId);

    let curCellId = firstCellId;
    let curCellPos = 0;
    let numCells = 1;

    const stream = await webapp_client.openai_client.queryStream({
      input,
      project_id,
      path,
      system,
      tag,
      model,
    });

    const updateCells = throttle(
      function (answer) {
        const cells = splitCells(answer);
        if (cells.length === 0) return;

        // we always have to update the last cell, even if there are more cells ahead
        fa.set_cell_input(curCellId, cells[curCellPos].source.join(""));
        actions.set_cell_type(curCellId, cells[curCellPos].cell_type);

        if (cells.length > numCells) {
          for (let i = numCells; i < cells.length; i++) {
            const nextCellId = insertCell({
              frameActions,
              actions,
              id: curCellId,
              position: "below",
              type: cells[i].cell_type,
              content: cells[i].source.join(""),
            });
            // this shouldn't happen
            if (nextCellId == null) continue;
            curCellId = nextCellId;
            curCellPos = i; // for the next update, above before the if/for loop
            numCells += 1;
          }
        }
      },
      750,
      { leading: true, trailing: true },
    );

    let answer = "";
    let first = true;

    stream.on("token", (text) => {
      // console.log("token", { text });
      if (text != null) {
        answer += text;
        updateCells(answer);
        if (first) {
          whenStarting?.();
          first = false;
        }
      } else {
        // reply emits undefined text *once* when done, so done at this point.
        // fa.switch_code_cell_to_edit(firstCellId);
        whenDone?.();
        // ensure that starting is called, even if there is no reply whatsoever
        if (first) {
          whenStarting?.();
        }
      }
    });

    stream.on("error", (err) => {
      // console.log("ERROR", err);
      fa.set_cell_input(
        firstCellId,
        `# Error generating code cell\n\n\`\`\`\n${err}\n\`\`\`\n\n${getLLMServiceStatusCheckMD(
          model2vendor(model),
        )}.`,
      );
      actions.set_cell_type(firstCellId, "markdown");
      fa.set_md_cell_not_editing(firstCellId);
      fa.set_mode("escape");
    });

    stream.emit("start");
  } catch (err) {
    alert_message({
      type: "error",
      title: "Problem generating code cell",
      message: `${err}`,
    });
  }
}

interface GetInputProps {
  actions: JupyterActions;
  frameActions: React.MutableRefObject<NotebookFrameActions | undefined>;
  model: LanguageModel;
  position: Position;
  prompt: string;
  prevCodeContents: string;
}

function getInput({
  actions,
  frameActions,
  prompt,
  prevCodeContents,
}: GetInputProps): {
  input: string;
  system: string;
} {
  if (!prompt?.trim()) {
    return { input: "", system: "" };
  }
  if (frameActions.current == null) {
    console.warn(
      "Unable to create cell due to frameActions not being defined.",
    );
    return { input: "", system: "" };
  }
  const kernel_info = actions.store.get("kernel_info");
  const lang = kernel_info?.get("language") ?? "python";
  const kernel_name = kernel_info?.get("display_name") ?? "Python 3";
  const prevCode = prevCodeContents
    ? `\n\nThe previous code is:\n\n\`\`\`${lang}\n${prevCodeContents}\n\`\`\``
    : "";

  return {
    input: `Create a new code cell for a Jupyter Notebook.\n\nKernel: "${kernel_name}".\n\nProgramming language: "${lang}".\n\The entire code cell must be in a single code block. Enclose this block in triple backticks. Do not say what the output will be. Add comments as code comments. ${prevCode}\n\nThe new cell should do the following:\n\n${prompt}`,
    system: `Return a single code block in the language "${lang}". Be brief.`,
  };
}

function getPreviousNonemptyCodeCellContents(
  actions: NotebookFrameActions | undefined,
  id: string,
  position,
  cells: number,
): string {
  if (actions == null) return "";
  let delta = position === "below" ? 0 : -1;
  const codeCells: string[] = [];
  while (true) {
    const prevId = actions.getPreviousCodeCellID(id, delta);
    if (!prevId) break;
    const code = actions.get_cell_input(prevId)?.trim();
    if (code) {
      codeCells.unshift(code);
      cells -= 1;
      if (cells <= 0) {
        break;
      }
    }
    delta -= 1;
  }
  return codeCells.join("\n\n");
}
