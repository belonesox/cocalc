/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Components for rendering input and output prompts.

ATTENTION: Be careful about adding other buttons here, since this component is also used by the whiteboard,
which has different constraints!  See

src/packages/frontend/frame-editors/whiteboard-editor/elements/code/input-prompt.tsx
*/

import { Button, Space } from "antd";
import React from "react";

import { Icon } from "@cocalc/frontend/components/icon";
import { TimeAgo } from "@cocalc/frontend/components/time-ago";
import { Tip } from "@cocalc/frontend/components/tip";
import useNotebookFrameActions from "@cocalc/frontend/frame-editors/jupyter-editor/cell-notebook/hook";
import { capitalize } from "@cocalc/util/misc";
import { INPUT_STYLE, InputPromptProps } from "./base";

export const InputPrompt: React.FC<InputPromptProps> = (props) => {
  const frameActions = useNotebookFrameActions();
  let n;
  if (props.type !== "code") {
    return <div style={INPUT_STYLE} />;
  }
  const kernel = capitalize(props.kernel != null ? props.kernel : "");
  let tip: string | JSX.Element = "Enter code to be evaluated.";
  switch (props.state) {
    case "start":
      n = <Icon name="arrow-circle-o-left" style={{ color: "#faad14" }} />;
      tip = `Sending to be evaluated using ${kernel}.`;
      break;
    case "run":
      n = <Icon name="hand" style={{ color: "#ff4d4f" }} />;
      tip = `Waiting for another computation to finish first. Will evaluate using ${kernel}.`;
      break;
    case "busy":
      n = (
        <Icon
          name="plus-circle-filled"
          style={{
            color: "#0a830a",
            animation: "loadingCircle 3s infinite linear",
          }}
        />
      );
      if (props.start != null) {
        tip = (
          <span>
            Running since <TimeAgo date={new Date(props.start)} /> using{" "}
            {kernel}.
          </span>
        );
      } else {
        tip = `Running using ${kernel}.`;
      }
      break;
    default:
      // done (or never run)
      if (props.exec_count) {
        n = props.exec_count;
        if (props.end != null) {
          tip = (
            <span>
              Evaluated <TimeAgo date={new Date(props.end)} /> using {kernel}.
            </span>
          );
        } else if (kernel) {
          tip = `Last evaluated using ${kernel}.`;
        }
      } else {
        n = " ";
      }
  }

  function move_cell(delta): void {
    if (props.id == null) return;
    frameActions.current?.unselect_all_cells();
    frameActions.current?.select_cell(props.id);
    frameActions.current?.move_selected_cells(delta);
  }

  function cut_cell(): void {
    if (props.id == null) return;
    frameActions.current?.unselect_all_cells();
    frameActions.current?.select_cell(props.id);
    frameActions.current?.cut_selected_cells();
  }

  function run_cell(): void {
    if (props.id == null || props.actions == null || props.actions.is_closed())
      return;
    props.actions?.run_cell(props.id);
  }

  function stop_cell(): void {
    if (props.actions == null || props.actions.is_closed()) return;
    props.actions?.signal("SIGINT");
  }

  const title = (
    <div>
      {props.actions != null ? (
        <Space>
          <Button.Group>
            {!props.hideRun && (
              <Button size="small" onClick={run_cell}>
                <Icon name="step-forward" /> Run
              </Button>
            )}
            <Button size="small" onClick={stop_cell}>
              <Icon name="stop" /> Stop
            </Button>
          </Button.Group>
          <Button.Group>
            {!props.hideCut && (
              <Button size="small" onClick={cut_cell}>
                <Icon name="cut" /> Cut
              </Button>
            )}
            {!props.hideMove && (
              <Button size="small" onClick={() => move_cell(-1)}>
                <Icon name="arrow-up" /> Up
              </Button>
            )}
            {!props.hideMove && (
              <>
                <Button size="small" onClick={() => move_cell(1)}>
                  <Icon name="arrow-down" /> Down
                </Button>{" "}
              </>
            )}
          </Button.Group>
        </Space>
      ) : (
        "Code Cell"
      )}
    </div>
  );

  function renderPrompt() {
    return (
      <div
        style={{
          ...INPUT_STYLE,
          cursor: "pointer",
          marginTop: "8.5px",
          ...props.style,
        }}
      >
        <Tip title={title} tip={tip} placement="top">
          In [{n}]:
        </Tip>
      </div>
    );
  }

  if (props.dragHandle != null) {
    return (
      <div>
        <div style={{ float: "left" }}>{props.dragHandle}</div>
        {renderPrompt()}
      </div>
    );
  } else {
    return renderPrompt();
  }
};
