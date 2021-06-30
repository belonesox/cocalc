/* Create the TCP server that communicates with hubs */

import { createServer } from "net";
import { callback } from "awaiting";
import { getLogger } from "smc-project/logger";
import { hubPortFile } from "smc-project/data";
const { enable_mesg, unlock_socket } = require("smc-util-node/misc_node");

const winston = getLogger("hub-tcp-server");

interface Options {
  port: number | undefined;
  host: string;
  secretToken: string; // hub sends this right when it connects; if not, connection is dropped.
}

export default async function init({
  host,
  secretToken,
}: Options): Promise<void> {
  if (!secretToken || secretToken.length < 16) {
    // being extra careful since security
    throw Error("secret token must be defined and at least 16 characters");
    return;
  }

  winston.info("starting tcp server: project <--> hub...");

  const server = createServer(async (socket) => {
    winston.debug(`received new connection from ${socket.remoteAddress}`);
    socket.on("error", (err) =>
      winston.debug(`socket '${socket.remoteAddress}' error - ${err}`)
    );

    try {
      await callback(unlock_socket, socket, secretToken);
    } catch (err) {
      winston.error(
        "failed to unlock socket -- ignoring any future messages and closing connection"
      );
      socket.destroy("invalid secret token");
      return;
    }

    socket.id = uuid.v4();
    socket.heartbeat = new Date(); // obviously working now
    enable_mesg(socket);

    socket.on("mesg", (type, mesg) => {
      hub_client.active_socket(socket); // record that this socket is active now.
      if (type === "json") {
        // non-JSON types are handled elsewhere, e.g., for sending binary data.
        // I'm not sure that any other message types are actually used though.
        // winston.debug("received json mesg", mesg);
        handle_mesg(socket, mesg);
      }
    });
  });

  await callback(server.listen, host);
  const { port } = server.address();
  winston.info(`hub tcp_server listening ${host}:${port}`);
  await callback(writeFile, hubPortFile, `${port}`);
}
