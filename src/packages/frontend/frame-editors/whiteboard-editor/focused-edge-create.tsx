/*
Supporting component for creating an edge.

*/

import { Tooltip } from "antd";
import { Icon } from "@cocalc/frontend/components/icon";
import { Element } from "./types";
import { CSSProperties } from "react";
import { MAX_ELEMENTS, DEFAULT_WIDTH, DEFAULT_HEIGHT } from "./math";
import {
  SELECTED_BORDER_COLOR,
  SELECTED_PADDING,
  SELECTED_BORDER_WIDTH,
} from "./elements/style";
import { useFrameContext } from "./hooks";
import { getParams } from "./tools/tool-panel";

const BORDER = SELECTED_PADDING + SELECTED_BORDER_WIDTH;
const SIZE = SELECTED_BORDER_WIDTH * 4;
const OFFSET = -SIZE / 2;

export type Position = "top" | "bottom" | "left" | "right";

interface Props {
  position: Position;
  canvasScale: number;
  element: Element;
}

export default function EdgeCreate({ position, canvasScale, element }: Props) {
  const { actions, desc, id } = useFrameContext();
  const style = {
    pointerEvents: "all", // because we turn off pointer events for containing div
    position: "absolute",
    color: SELECTED_BORDER_COLOR,
    fontSize: `${SIZE}px`,
    zIndex: MAX_ELEMENTS + 15,
    transform: `scale(${1 / canvasScale})`,
    cursor: "pointer",
  } as CSSProperties;
  const h = element.h ?? DEFAULT_HEIGHT;
  const w = element.w ?? DEFAULT_WIDTH;
  if (position == "top") {
    style.top = `${-SIZE / 2 - BORDER / 2}px`;
    style.left = `${w / 2 + OFFSET}px`;
  } else if (position == "bottom") {
    style.bottom = 0;
    style.left = `${w / 2 + OFFSET}px`;
  } else if (position == "left") {
    style.top = `${h / 2 + OFFSET}px`;
    style.left = `${-SIZE / 2 - BORDER / 2}px`;
  } else if (position == "right") {
    style.top = `${h / 2 + OFFSET}px`;
    style.right = 0;
  }

  return (
    <Tooltip
      title={`Click to create adjacent ${element.type}; shift+click to create edge`}
      mouseEnterDelay={1}
      mouseLeaveDelay={0}
    >
      <Icon
        className="nodrag"
        style={style}
        name="circle"
        onClick={(e) => {
          if (e?.shiftKey) {
            // switch to edge creation tool
            actions.setSelectedTool(id, "edge");
            // set element just clicked on as start of edge
            actions.setEdgeCreateStart(id, element.id, position);
          } else {
            const newId = actions.createAdjacentElement(
              element.id,
              position,
              false
            );
            if (newId) {
              actions.createEdge(
                element.id,
                newId,
                getParams("edge", desc.get("edgeId"))
              );
            }
          }
        }}
      />
    </Tooltip>
  );
}
