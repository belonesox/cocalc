/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { appBasePath } from "./customize";

export default function editURL(id: string, path: string): string {
  return encodeURI(
    `${appBasePath}/app?anonymous=true&launch=share/${id}/${path}`
  );
}
