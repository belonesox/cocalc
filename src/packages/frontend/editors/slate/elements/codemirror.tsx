/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
TODO:
- syntax highlight in user's theme
- keyboard with user settings
*/

import React, {
  CSSProperties,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useFrameContext } from "@cocalc/frontend/frame-editors/frame-tree/frame-context";
import { Transforms } from "slate";
import { ReactEditor } from "../slate-react";
import { fromTextArea, Editor, commands } from "codemirror";
import { FOCUSED_COLOR } from "../util";
import { useFocused, useSelected, useSlate, useCollapsed } from "./hooks";
import {
  moveCursorToBeginningOfBlock,
  moveCursorUp,
  moveCursorDown,
} from "../control";
import { selectAll } from "../keyboard/select-all";
import infoToMode from "./code-block/info-to-mode";
import { isEqual } from "lodash";
import { file_associations } from "@cocalc/frontend/file-associations";

const STYLE = {
  width: "100%",
  overflow: "auto",
  overflowX: "hidden",
  border: "1px solid #dfdfdf",
  borderRadius: "3px",
  lineHeight: "1.21429em",
  marginBottom: "1em", // consistent with <p> tag.
} as CSSProperties;

interface Props {
  onChange?: (string) => void;
  info?: string;
  value: string;
  onShiftEnter?: () => void;
  onEscape?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  options?: { [option: string]: any };
  isInline?: boolean; // impacts how cursor moves out of codemirror.
  style?: CSSProperties;
}

export const SlateCodeMirror: React.FC<Props> = React.memo(
  ({
    info,
    value,
    onChange,
    onShiftEnter,
    onEscape,
    onBlur,
    onFocus,
    options,
    isInline,
    style,
  }) => {
    const focused = useFocused();
    const selected = useSelected();
    const editor = useSlate();
    const collapsed = useCollapsed();
    const { actions } = useFrameContext();
    const { id } = useFrameContext();

    const cmRef = useRef<Editor | undefined>(undefined);
    const [isFocused, setIsFocused] = useState<boolean>(!!options?.autofocus);
    const textareaRef = useRef<any>(null);

    const setCSS = useCallback(
      (css) => {
        if (cmRef.current == null) return;
        $(cmRef.current.getWrapperElement()).css(css);
      },
      [cmRef]
    );

    const focusEditor = useCallback(() => {
      const cm = cmRef.current;
      if (cm == null) return;
      if (collapsed) {
        // collapsed = single cursor, rather than a selection range.
        // Put the cursor at the top or bottom,
        // depending on where it was recently outside of here in the slate document.
        const last = editor.lastSelection?.focus?.path;
        const path = editor.selection?.focus?.path;
        if (last != null && path != null) {
          let cur: undefined | { line: number; ch: number } = undefined;
          if (isEqual(last, path)) {
            // no-op, e.g., already in there
          } else if (isLessThan(last, path)) {
            // from above
            cur = { line: 0, ch: 0 };
          } else {
            // from below
            cur = {
              line: cm.lastLine(),
              ch: isInline ? cm.getLine(cm.lastLine()).length : 0,
            };
          }
          if (cur) {
            cm.setCursor(cur);
          }
        }

        // focus the CodeMirror editor
        // It is critical to blur the Slate editor
        // itself after focusing codemirror, since otherwise we
        // get stuck in an infinite
        // loop since slate is confused about whether or not it is
        // blurring or getting focused, since codemirror is a contenteditable
        // inside of the slate DOM tree.  Hence this blur:
        cm.refresh();
        cm.focus();
        ReactEditor.blur(editor);

        // set the CSS to indicate this
        setCSS({
          backgroundColor: options?.theme != null ? "" : "#fafafa",
          color: "",
        });
      } else {
        setCSS({
          backgroundColor: "#1990ff",
          color: "white",
        });
      }
    }, [collapsed, options?.theme]);

    useEffect(() => {
      if (focused && selected) {
        focusEditor();
      } else {
        setCSS({
          backgroundColor: options?.theme != null ? "" : "#fafafa",
          color: "",
        });
      }
    }, [selected, focused, options?.theme]);

    // If the info line changes update the mode.
    useEffect(() => {
      const cm = cmRef.current;
      if (cm == null) return;
      cm.setOption("mode", infoToMode(info));
      const indentUnit = file_associations[info ?? ""]?.opts.indent_unit ?? 4;
      cm.setOption("indentUnit", indentUnit);
    }, [info]);

    useEffect(() => {
      const node: HTMLTextAreaElement = textareaRef.current;
      if (node == null) return;
      if (options == null) options = {};

      // The two lines below MUST match with the useEffect above that reacts to changing info.
      options.mode = options.mode ?? infoToMode(info);
      options.indentUnit =
        options.indentUnit ??
        file_associations[info ?? ""]?.opts.indent_unit ??
        4;

      // NOTE: Using the inputStyle of "contenteditable" is challenging
      // because we have to take care that copy doesn't end up being handled
      // by slate and being wrong.  In contrast, textarea does work fine for
      // copy.  However, textarea does NOT work when any CSS transforms
      // are involved, and we use such transforms extensively in the whiteboard.

      options.inputStyle = "contenteditable"; // can't change because of whiteboard usage!

      if (options.extraKeys == null) {
        options.extraKeys = {};
      }

      options.extraKeys["Shift-Enter"] = () => {
        Transforms.move(editor, { distance: 1, unit: "line" });
        ReactEditor.focus(editor);
        onShiftEnter?.();
      };

      if (onEscape != null) {
        options.extraKeys["Esc"] = onEscape;
      }

      options.extraKeys["Tab"] = (cm) => {
        const spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
        cm.replaceSelection(spaces);
      };

      // We make it so doing select all when not everything is
      // selected selects everything in this local Codemirror.
      // Doing it *again* then selects the entire external slate editor.
      options.extraKeys["Cmd-A"] = options.extraKeys["Ctrl-A"] = (cm) => {
        if (cm.getSelection() != cm.getValue()) {
          // not everything is selected (or editor is empty), so
          // select everything.
          commands.selectAll(cm);
        } else {
          // everything selected, so now select all editor content.
          // NOTE that this only makes sense if we change focus
          // to the enclosing select editor, thus loosing the
          // cm editor focus, which is a bit weird.
          ReactEditor.focus(editor);
          selectAll(editor);
        }
      };

      cursorHandlers(options, editor, isInline);

      const cm = (cmRef.current = fromTextArea(node, options));

      cm.on("change", (_, _changeObj) => {
        if (onChange != null) {
          onChange(cm.getValue());
        }
      });

      if (onBlur != null) {
        cm.on("blur", onBlur);
      }

      if (onFocus != null) {
        cm.on("focus", onFocus);
      }

      cm.on("blur", () => {
        setIsFocused(false);
      });

      cm.on("focus", () => {
        setIsFocused(true);
      });

      cm.on("copy", (_, event) => {
        // We tell slate to ignore this event.
        // I couldn't find any way to get codemirror to allow the copy to happen,
        // but at the same time to not let the event propogate.  It seems like
        // codemirror also would ignore the event, which isn't useful.
        // @ts-ignore
        event.slateIgnore = true;
      });

      (cm as any).undo = () => {
        actions.undo(id);
      };
      (cm as any).redo = () => {
        actions.redo(id);
      };
      // This enables other functionality (e.g., save).
      (cm as any).cocalc_actions = actions;

      // Make it so editor height matches text.
      const css: any = {
        height: "auto",
        padding: "5px",
      };
      if (options.theme == null) {
        css.backgroundColor = "#f7f7f7";
      }
      setCSS(css);
      cm.refresh();

      return () => {
        if (cmRef.current == null) return;
        $(cmRef.current.getWrapperElement()).remove();
        cmRef.current = undefined;
      };
    }, []);

    useEffect(() => {
      cmRef.current?.setValueNoJump(value);
    }, [value]);

    return (
      <span
        contentEditable={false}
        style={{
          ...STYLE,
          ...{
            border: `2px solid ${isFocused ? FOCUSED_COLOR : "#cfcfcf"}`,
          },
          ...style,
        }}
        className="smc-vfill"
      >
        <textarea ref={textareaRef} defaultValue={value}></textarea>
      </span>
    );
  }
);

function cursorHandlers(options, editor, isInline: boolean | undefined): void {
  const exitDown = (cm) => {
    const cur = cm.getCursor();
    const n = cm.lastLine();
    const cur_line = cur?.line;
    const cur_ch = cur?.ch;
    const line = cm.getLine(n);
    const line_length = line?.length;
    if (cur_line === n && cur_ch === line_length) {
      //Transforms.move(editor, { distance: 1, unit: "line" });
      moveCursorDown(editor, true);
      ReactEditor.focus(editor);
      return true;
    } else {
      return false;
    }
  };

  options.extraKeys["Up"] = (cm) => {
    const cur = cm.getCursor();
    if (cur?.line === cm.firstLine() && cur?.ch == 0) {
      // Transforms.move(editor, { distance: 1, unit: "line", reverse: true });
      moveCursorUp(editor, true);
      if (!isInline) {
        moveCursorToBeginningOfBlock(editor);
      }
      ReactEditor.focus(editor);
    } else {
      commands.goLineUp(cm);
    }
  };

  options.extraKeys["Left"] = (cm) => {
    const cur = cm.getCursor();
    if (cur?.line === cm.firstLine() && cur?.ch == 0) {
      Transforms.move(editor, { distance: 1, unit: "line", reverse: true });
      ReactEditor.focus(editor);
    } else {
      commands.goCharLeft(cm);
    }
  };

  options.extraKeys["Right"] = (cm) => {
    if (!exitDown(cm)) {
      commands.goCharRight(cm);
    }
  };

  options.extraKeys["Down"] = (cm) => {
    if (!exitDown(cm)) {
      commands.goLineDown(cm);
    }
  };
}

function isLessThan(p1: number[], p2: number[]): boolean {
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    if ((p1[i] ?? 0) < (p2[i] ?? 0)) {
      return true;
    }
  }
  return false;
}
