import {
  Actions as WhiteboardActions,
  State as WhiteboardState,
} from "../whiteboard-editor/actions";
import type { FrameTree } from "../frame-tree/types";
import fixedElements from "./fixed-elements";
import { Map as ImmutableMap } from "immutable";
import type { ElementMap } from "../whiteboard-editor/types";

export interface State extends WhiteboardState {
  speakerNotes: ImmutableMap<string, ElementMap>;
}

export class Actions<State> extends WhiteboardActions {
  readonly mainFrameType = "slides";
  readonly fixedElements = fixedElements;

  _init2(): void {
    this.setState({});
    this._syncstring.on("change", this.updateSpeakerNotes.bind(this));
    super._init2();
  }

  _raw_default_frame_tree(): FrameTree {
    return {
      direction: "col",
      type: "node",
      first: { type: "pages" },
      second: {
        direction: "row",
        type: "node",
        first: { type: "slides" },
        second: {
          direction: "col",
          type: "node",
          first: { type: "speaker_notes" },
          second: { type: "table_of_contents" },
          pos: 0.8,
        },
        pos: 0.8,
      },
      pos: 0.15,
    };
  }

  private updateSpeakerNotes(keys) {
    const speakerNotes0 = this.store.get("speakerNotes");
    let speakerNotes = speakerNotes0 ?? ImmutableMap();
    for (const key of keys) {
      const id = key.get("id");
      if (!id) continue;
      const element = this._syncstring.get_one(key);
      if (element.get("type") != "speaker_notes") continue;
      const oldElement = speakerNotes0?.get(id);
      if (!element) {
        if (oldElement == null) continue;
        // there is a delete.
        speakerNotes = speakerNotes.delete(oldElement.get("page"));
      } else {
        speakerNotes = speakerNotes.set(element.get("page"), element);
      }
    }

    if (speakerNotes !== speakerNotes0) {
      this.setState({ speakerNotes });
    }
  }
}
