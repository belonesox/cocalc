import { Button, Popconfirm, Tooltip } from "antd";
import { Element } from "../types";
import { Icon } from "@cocalc/frontend/components/icon";
import { BUTTON_STYLE } from "./edit-bar";
import { useFrameContext } from "../hooks";

interface Props {
  elements: Element[];
}

export default function LockButton({ elements }: Props) {
  const { actions } = useFrameContext();
  let locked = isLocked(elements);
  const click = () => {
    if (locked) {
      actions.unlockElements(elements);
    } else {
      actions.lockElements(elements);
    }
  };
  let btn = (
    <Button style={BUTTON_STYLE} onClick={!locked ? click : undefined}>
      <Icon name={`lock${!locked ? "-open" : ""}`} />
    </Button>
  );
  if (!locked) {
    // We only show the tooltip if NOT locked, since unlocking shows a Popconfirm
    // that is blocked by the tooltip when object is near bottom of the screen even
    // with placement='bottom'.
    btn = <Tooltip title={"Lock objects to prevent editing"}>{btn}</Tooltip>;
  }
  if (locked) {
    return (
      <Popconfirm
        title={"Unlock this?"}
        onConfirm={click}
        okText="Unlock"
        cancelText="Cancel"
      >
        {btn}
      </Popconfirm>
    );
  } else {
    return btn;
  }
}

// Return true if any of the elements are locked.
export function isLocked(elements: Element[]): boolean {
  for (const element of elements) {
    if (element.locked) {
      return true;
    }
  }
  return false;
}
