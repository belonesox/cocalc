/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
The kernel's logo display
*/

import { React } from "@cocalc/frontend/app-framework";

import { get_logo_url } from "./server-urls";

interface LogoProps {
  kernel: string | null;
  project_id: string;
  kernel_info_known: boolean;
}

const SIZE = "24px"; // this matches the rest of the status bar.

export const Logo: React.FC<LogoProps> = React.memo((props: LogoProps) => {
  const { kernel, project_id, kernel_info_known } = props;
  const [logo_failed, set_logo_failed] = React.useState<string | undefined>(
    undefined
  );

  if (logo_failed === kernel || kernel == null) {
    return <img style={{ width: "0px", height: SIZE }} />;
  } else {
    const src = get_logo_url(project_id, kernel);
    return (
      <img
        src={src}
        style={{ width: SIZE, height: SIZE }}
        onError={() => {
          if (kernel_info_known) set_logo_failed(kernel);
        }}
      />
    );
  }
});
