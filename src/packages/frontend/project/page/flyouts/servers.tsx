/*
 *  This file is part of CoCalc: Copyright © 2023 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { Divider, Space } from "antd";

import { Icon, Paragraph, Title } from "@cocalc/frontend/components";
import {
  ComputeServerDocs,
  ComputeServers,
  computeServersEnabled,
} from "@cocalc/frontend/compute";
import { ServerLink } from "@cocalc/frontend/project/named-server-panel";
import { FIX_BORDER } from "@cocalc/frontend/project/page/common";
import { SagewsControl } from "@cocalc/frontend/project/settings/sagews-control";
import { NAMED_SERVER_NAMES } from "@cocalc/util/types/servers";
import { FLYOUT_PADDING } from "./consts";

export function ServersFlyout({ project_id, wrap }) {
  const servers = NAMED_SERVER_NAMES.map((name) => (
    <ServerLink key={name} name={name} project_id={project_id} />
  )).filter((s) => s != null);

  function renderEmbeddedServers() {
    return (
      <div style={{ padding: FLYOUT_PADDING }}>
        <Title level={5}>
          <Icon name="server" /> Notebook and Code Editing Servers
        </Title>
        <Paragraph>
          When launched, these servers run inside this project. They should open
          up in a new browser tab, and get access all files in this project.
        </Paragraph>
        <Space direction="vertical">
          {servers}
          {servers.length === 0 && (
            <Paragraph>
              No available server has been detected in this project environment.
            </Paragraph>
          )}
        </Space>
      </div>
    );
  }

  function renderSageServerControl() {
    return (
      <div
        style={{
          padding: "20px 5px 5px 5px",
          marginTop: "20px",
          borderTop: FIX_BORDER,
        }}
      >
        <Title level={5}>
          <Icon name="sagemath" /> Sage Worksheet Server
        </Title>
        <SagewsControl key="worksheet" project_id={project_id} mode="flyout" />
      </div>
    );
  }

  function renderComputeServers() {
    if (!computeServersEnabled()) return;

    return (
      <>
        <div style={{ padding: FLYOUT_PADDING }}>
          <Title level={5}>
            <ComputeServerDocs style={{ float: "right" }} />
            <Icon name="servers" /> Compute Servers
          </Title>
          <ComputeServers project_id={project_id} />
        </div>
        <Divider />
      </>
    );
  }

  return wrap(
    <>
      {renderComputeServers()}
      {renderEmbeddedServers()}
      {renderSageServerControl()}
    </>,
  );
}
