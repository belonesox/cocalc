/*
Dropdown on frame title bar for running that Jupyter notebook or terminal on a compute server.
*/

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { delay } from "awaiting";
import { avatar_fontcolor } from "@cocalc/frontend/account/avatar/font-color";
import SelectServer, { PROJECT_COLOR } from "./select-server";
import { useTypedRedux } from "@cocalc/frontend/app-framework";

interface Props {
  project_id: string;
  path: string;
  frame_id: string;
  style?: CSSProperties;
  actions?;
  type: "terminal" | "jupyter_cell_notebook";
}

export default function SelectComputeServerForFile({
  project_id,
  path,
  frame_id,
  actions,
  style,
  type,
}: Props) {
  const getPath = (path) => {
    if (actions != null && type == "terminal") {
      return actions.terminals.get(frame_id)?.term_path;
    }
    return path;
  };
  const [confirmSwitch, setConfirmSwitch] = useState<boolean>(false);
  const [idNum, setIdNum] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const computeServers =
    useTypedRedux({ project_id }, "compute_servers")?.toJS() ?? [];
  const computeServerAssociations = useMemo(() => {
    return webapp_client.project_client.computeServers(project_id);
  }, [project_id]);
  const [value, setValue] = useState<number | undefined>(undefined);

  const okButtonRef = useRef();
  useEffect(() => {
    if (confirmSwitch && okButtonRef.current) {
      // @ts-ignore
      setTimeout(() => okButtonRef.current.focus(), 1);
    }
  }, [confirmSwitch]);

  useEffect(() => {
    const handleChange = async () => {
      try {
        let p = getPath(path);
        if (p == null) {
          // have to wait for terminal state to be initialized, which
          // happens in next render loop:
          await delay(1);
          p = getPath(path);
          if (p == null) {
            // still nothing -- that's weird
            return;
          }
        }
        const id = await computeServerAssociations.getServerIdForPath(p);
        if (type == "jupyter_cell_notebook" && actions != null) {
          actions.jupyter_actions.setState({ requestedComputeServerId: id });
          if (
            actions.jupyter_actions.store?.get("kernel_error") &&
            id != actions.jupyter_actions.getComputeServerId()
          ) {
            // show a warning about the kernel being killed isn't useful and
            // is just redundant when actively switching.
            actions.jupyter_actions.setState({ kernel_error: "" });
          }
        } else if (type == "terminal") {
          const terminalRequestedComputeServerIds =
            actions.store.get("terminalRequestedComputeServerIds")?.toJS() ??
            {};
          terminalRequestedComputeServerIds[p] = id;
          actions.setState({ terminalRequestedComputeServerIds });
        }
        setValue(id == null ? undefined : id);
      } catch (err) {
        console.warn(err);
      }
    };
    computeServerAssociations.on("change", handleChange);
    (async () => {
      try {
        setLoading(true);
        await handleChange();
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      computeServerAssociations.removeListener("change", handleChange);
    };
  }, [project_id, path, type]);

  return (
    <>
      <SelectServer
        disabled={loading}
        project_id={project_id}
        style={style}
        value={value}
        setValue={(value) => {
          setIdNum(value ?? 0);
          setConfirmSwitch(true);
        }}
      />
      <Modal
        keyboard
        title={
          idNum == 0 ? (
            <>Run in this Project?</>
          ) : (
            <>Run on the compute server "{computeServers[idNum]?.title}"?</>
          )
        }
        open={confirmSwitch}
        onCancel={() => setConfirmSwitch(false)}
        okText={
          idNum == 0
            ? "Run in Project"
            : `Run on ${computeServers[idNum]?.title}`
        }
        okButtonProps={{
          // @ts-ignore
          ref: okButtonRef,
          style: {
            background: computeServers[idNum]?.color ?? PROJECT_COLOR,
            color: avatar_fontcolor(
              computeServers[idNum]?.color ?? PROJECT_COLOR,
            ),
          },
        }}
        onOk={() => {
          setConfirmSwitch(false);
          if (idNum) {
            setValue(idNum);
            computeServerAssociations.connectComputeServerToPath({
              id: idNum,
              path: getPath(path),
            });
          } else {
            setValue(undefined);
            computeServerAssociations.disconnectComputeServer({
              path: getPath(path),
            });
          }
        }}
      >
        {idNum == 0 ? (
          <div>
            Do you want to run this in the project? Variables and other state
            will be lost.
          </div>
        ) : (
          <div>
            Do you want to run this on the compute server "
            {computeServers[idNum]?.title}"? Variables and other state will be
            lost.
          </div>
        )}
      </Modal>
    </>
  );
}
