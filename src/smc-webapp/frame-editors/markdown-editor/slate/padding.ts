/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { Descendant } from "slate";

export function emptyParagraph() {
  // returns a new object each time.
  return {
    type: "paragraph",
    children: [{ text: "" }],
  } as Descendant;
}

export function isWhitespaceParagraph(node: Descendant | undefined): boolean {
  return (
    node != null &&
    node["type"] == "paragraph" &&
    node["children"]?.length == 1 &&
    node["children"][0]?.text?.trim() == ""
  );
}

export function ensureDocNonempty(doc: Descendant[]): void {
  if (doc.length == 0) {
    doc.push(emptyParagraph());
  }
}
