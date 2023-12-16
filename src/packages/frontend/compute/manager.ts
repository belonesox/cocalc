/*
Client side compute servers manager

Used from a browser client frontend to manage what compute servers
are available and how they are used for a given project.

When doing dev from the browser console, do:

cc.client.project_client.computeServers('...project_id...')
*/

import { SYNCDB_PARAMS, decodeUUIDtoNum } from "@cocalc/util/compute/manager";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import debug from "debug";
import { once } from "@cocalc/util/async-utils";
import { EventEmitter } from "events";

const log = debug("cocalc:frontend:compute:manager");

export class ComputeServersManager extends EventEmitter {
  private sync_db;
  private project_id;

  constructor(project_id: string) {
    super();
    this.project_id = project_id;
    this.sync_db = webapp_client.sync_db({
      project_id,
      ...SYNCDB_PARAMS,
    });
    this.sync_db.on("change", () => {
      this.emit("change");
    });
    log("created", this.project_id);
  }

  close = () => {
    delete computeServerManagerCache[this.project_id];
    this.sync_db.close();
  };

  getComputeServers = () => {
    const servers = {};
    const cursors = this.sync_db.get_cursors().toJS();
    for (const client_id in cursors) {
      const server = cursors[client_id];
      servers[decodeUUIDtoNum(client_id)] = {
        time: server.time,
        ...server.locs[0],
      };
    }
    return servers;
  };

  // Call this if you want the compute server with given id to
  // connect and handle being the server for the given path.
  connectComputeServerToPath = ({ id, path }: { id: number; path: string }) => {
    if (id == 0) {
      this.disconnectComputeServer({ path });
      return;
    }
    assertSupportedPath(path);
    this.sync_db.set({ id, path, open: true });
    this.sync_db.commit();
  };

  // Call this if you want no compute servers to provide the backend server
  // for given path.
  disconnectComputeServer = ({ path }: { path: string }) => {
    assertSupportedPath(path);
    this.sync_db.delete({ path });
    this.sync_db.commit();
  };

  // For interactive debugging -- display in the console how things are configured.
  showStatus = () => {
    console.log(JSON.stringify(this.sync_db.get().toJS(), undefined, 2));
  };

  getServerIdForPath = async (path: string): Promise<number> => {
    const { sync_db } = this;
    if (sync_db.get_state() == "init") {
      await once(sync_db, "ready");
    }
    if (sync_db.get_state() != "ready") {
      throw Error("syncdb not ready");
    }
    return sync_db.get_one({ path })?.get("id") ?? 0;
  };
}

function assertSupportedPath(path: string) {
  if (path.endsWith(".sagews")) {
    throw Error(
      "Sage Worksheets cannot be run on a compute server -- use a Jupyter notebook instaed.",
    );
  }
  return true;
}

const computeServerManagerCache: {
  [project_id: string]: ComputeServersManager;
} = {};

export const computeServers = (project_id: string) => {
  if (computeServerManagerCache[project_id]) {
    return computeServerManagerCache[project_id];
  }
  const m = new ComputeServersManager(project_id);
  computeServerManagerCache[project_id] = m;
  return m;
};

export default computeServers;
