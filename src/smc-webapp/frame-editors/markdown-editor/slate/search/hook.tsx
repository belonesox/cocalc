/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Support for global full text search of our slate.js document.
*/

import { Input } from "antd";
import * as React from "react";
const { useMemo, useRef, useState } = React;
import { Editor, Point, Range, Transforms } from "slate";
import {
  nextMatch,
  previousMatch,
  SearchControlButtons,
} from "./search-control";
import { ReactEditor } from "../slate-react";
import { IS_MACOS, IS_TOUCH } from "smc-webapp/feature";
import { createSearchDecorate } from "./decorate";
import { Replace } from "./replace";

const modKey = IS_MACOS ? "⌘" : "ctrl";
const keyboardMessage = `Find Next (${modKey}-G) and Prev (Shift-${modKey}-G).`;

const EXTRA_INFO_STYLE = {
  position: "absolute",
  marginTop: "2px",
  zIndex: 1,
  background: "white",
  width: "100%",
  color: "rgb(102,102,102)",
} as React.CSSProperties;

interface Options {
  editor: Editor;
}

export interface SearchHook {
  decorate: ([node, path]) => { anchor: Point; focus: Point; search: true }[];
  Search: JSX.Element;
  search: string;
  previous: () => void;
  next: () => void;
  focus: (search?: string) => void;
}

export const useSearch: (Options) => SearchHook = (options) => {
  const { editor } = options;
  const [search, setSearch] = useState<string>("");
  const inputRef = useRef<any>(null);

  const decorate = useMemo(() => {
    return createSearchDecorate(search);
  }, [search]);

  const Search = useMemo(
    () => (
      <div
        style={{
          border: 0,
          width: "100%",
          position: "relative",
        }}
      >
        <div style={{ display: "flex" }}>
          <Input
            ref={inputRef}
            allowClear={true}
            size="small"
            placeholder="Find..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: 0,
              flex: 1,
            }}
            onKeyDown={async (event) => {
              if (event.metaKey || event.ctrlKey) {
                if (event.key == "f") {
                  event.preventDefault();
                  return;
                }
                if (event.key == "g") {
                  event.preventDefault();
                  if (event.shiftKey) {
                    previousMatch(editor, decorate);
                  } else {
                    nextMatch(editor, decorate);
                  }
                  return;
                }
              }
              if (event.key == "Enter") {
                event.preventDefault();
                inputRef.current?.blur();
                await delay(100);
                const { selection } = editor;
                if (selection != null) {
                  const focus = Range.edges(selection)[0];
                  Transforms.setSelection(editor, { focus, anchor: focus });
                }
                nextMatch(editor, decorate);
              }
              if (event.key == "Escape") {
                event.preventDefault();
                setSearch("");
                inputRef.current?.blur();
                await delay(100);
                ReactEditor.focus(editor);
                return;
              }
            }}
          />
          {search.trim() && (
            <SearchControlButtons
              editor={editor}
              decorate={decorate}
              disabled={!search.trim()}
            />
          )}
        </div>
        {search.trim() && (
          <div style={EXTRA_INFO_STYLE}>
            <Replace />
            {!IS_TOUCH && (
              <div style={{ marginLeft: "7px" }}>{keyboardMessage}</div>
            )}
          </div>
        )}
      </div>
    ),
    [search, decorate]
  );

  return {
    decorate,
    Search,
    search,
    inputRef,
    focus: async (search) => {
      if (search?.trim()) {
        setSearch(search);
        await delay(0); // so that the "all" below selects this search.
      }
      inputRef.current?.focus({ cursor: "all" });
    },
    next: () => {
      nextMatch(editor, decorate);
    },
    previous: () => {
      previousMatch(editor, decorate);
    },
  };
};
