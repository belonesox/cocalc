/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

// help users selecting a kernel
import * as antd from "antd";
import { Button, Checkbox, Descriptions, Radio, Typography } from "antd";
import { List, Map as ImmutableMap, OrderedMap } from "immutable";

import {
  CSS,
  React,
  Rendered,
  useRedux,
  useTypedRedux,
} from "@cocalc/frontend//app-framework";
import {
  Icon,
  isIconName,
  Loading,
  Paragraph,
  Text,
} from "@cocalc/frontend/components";
import { SiteName } from "@cocalc/frontend/customize";
import * as misc from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";
import { Col, Row } from "../antd-bootstrap";
import { JupyterActions } from "./browser-actions";
import { Kernel as KernelType } from "./util";

const MAIN_STYLE: CSS = {
  padding: "20px 10px",
  overflowY: "auto",
  overflowX: "hidden",
} as const;

const SELECTION_STYLE: CSS = {
  marginTop: "2em",
} as const;

const ALL_LANGS_LABEL_STYLE: CSS = {
  fontWeight: "bold",
  color: COLORS.GRAY_D,
} as const;

interface KernelSelectorProps {
  actions: JupyterActions;
}

export const KernelSelector: React.FC<KernelSelectorProps> = React.memo(
  (props: KernelSelectorProps) => {
    const { actions } = props;
    const editor_settings = useTypedRedux("account", "editor_settings");

    const redux_kernel: undefined | string = useRedux([actions.name, "kernel"]);
    const no_kernel = redux_kernel === "";
    // undefined and empty string are both treated as "null" aka "no kernel"
    const kernel = !redux_kernel ? null : redux_kernel;
    const default_kernel: undefined | string = useRedux([
      actions.name,
      "default_kernel",
    ]);
    const closestKernel: undefined | KernelType = useRedux([
      actions.name,
      "closestKernel",
    ]);
    const kernel_info: undefined | ImmutableMap<any, any> = useRedux([
      actions.name,
      "kernel_info",
    ]);
    const kernel_selection: undefined | ImmutableMap<string, any> = useRedux([
      actions.name,
      "kernel_selection",
    ]);
    const kernels_by_name:
      | undefined
      | OrderedMap<string, ImmutableMap<string, string>> = useRedux([
      actions.name,
      "kernels_by_name",
    ]);
    const kernels_by_language: undefined | OrderedMap<string, List<string>> =
      useRedux([actions.name, "kernels_by_language"]);

    function kernel_name(name: string): string | undefined {
      return kernel_attr(name, "display_name");
    }

    function kernel_attr(name: string, attr: string): string | undefined {
      if (kernels_by_name == null) return undefined;
      const k = kernels_by_name.get(name);
      if (k == null) return undefined;
      return k.get(attr, name);
    }

    function render_suggested_link(cocalc) {
      if (cocalc == null) return;
      const url: string | undefined = cocalc.get("url");
      const descr: string | undefined = cocalc.get("description", "");
      if (url != null) {
        return (
          <a href={url} target={"_blank"} rel={"noopener"}>
            {descr}
          </a>
        );
      } else {
        return descr;
      }
    }

    function render_kernel_button(
      name: string,
      show_icon: boolean = true
    ): Rendered {
      const lang = kernel_attr(name, "language");
      let icon: Rendered | undefined = undefined;
      if (lang != null && show_icon) {
        if (isIconName(lang)) {
          icon = <Icon name={lang} />;
        } else if (lang.startsWith("bash")) {
          icon = <Icon name={"terminal"} />;
        }
        // TODO do other languages have icons?
      }
      return (
        <Radio.Button
          key={`kernel-${lang}-${name}`}
          onClick={() => actions.select_kernel(name)}
          style={{ marginBottom: "5px" }}
        >
          {icon} {kernel_name(name) || name}
        </Radio.Button>
      );
    }

    function render_suggested() {
      if (kernel_selection == null || kernels_by_name == null) return;

      const entries: Rendered[] = [];
      const kbn = kernels_by_name;

      kernel_selection
        .sort((a, b) => {
          // try to find the display name, otherwise fallback to kernel ID
          const name_a = kernel_name(a) || a;
          const name_b = kernel_name(b) || b;
          return name_a.localeCompare(name_b);
        })
        .map((name, lang) => {
          const cocalc: ImmutableMap<string, any> = kbn.getIn(
            [name, "metadata", "cocalc"],
            null
          );
          if (cocalc == null) return;
          const prio: number = cocalc.get("priority", 0);

          // drop those below 10, priority is too low
          if (prio < 10) return;

          const label = render_kernel_button(name);

          entries.push(
            <Descriptions.Item key={lang} label={label}>
              <div>{render_suggested_link(cocalc)}</div>
            </Descriptions.Item>
          );
        });

      if (entries.length == 0) return;

      return (
        <Descriptions
          title="Suggested kernels"
          bordered
          column={1}
          style={SELECTION_STYLE}
        >
          {entries}
        </Descriptions>
      );
    }

    function render_custom(): Rendered {
      if (kernels_by_language?.size == 0) return;
      return (
        <Descriptions bordered column={1} style={SELECTION_STYLE}>
          <Descriptions.Item label={"Custom kernels"}>
            <a onClick={() => actions.custom_jupyter_kernel_docs()}>
              How to create a custom kernel...
            </a>
          </Descriptions.Item>
        </Descriptions>
      );
    }

    function render_no_kernels(): Rendered[] {
      return [
        <Descriptions.Item key="no_kernels" label={<Icon name="ban" />}>
          <Radio.Group buttonStyle={"solid"} defaultValue={null}>
            <Paragraph>
              There are no kernels available. <SiteName /> searches the standard
              paths of Jupyter{" "}
              <antd.Popover
                trigger={["click", "hover"]}
                content={
                  <>
                    i.e. essentially <Text code>jupyter kernelspec list</Text>{" "}
                    going through{" "}
                    <Text code>jupyter --paths --json | jq .data</Text>
                  </>
                }
              >
                <Icon
                  style={{ color: COLORS.GRAY, cursor: "pointer" }}
                  name="question-circle"
                />
              </antd.Popover>{" "}
              for kernels. You can also define{" "}
              <a onClick={() => actions.custom_jupyter_kernel_docs()}>
                a custom kernel
              </a>
              .
            </Paragraph>
          </Radio.Group>
        </Descriptions.Item>,
      ];
    }

    function render_all_langs(): Rendered[] | undefined {
      if (kernels_by_language == null) return render_no_kernels();

      const all: Rendered[] = [];
      kernels_by_language.forEach((names, lang) => {
        const kernels = names.map((name) => render_kernel_button(name, false));

        const label = (
          <span style={ALL_LANGS_LABEL_STYLE}>{misc.capitalize(lang)}</span>
        );

        all.push(
          <Descriptions.Item key={lang} label={label}>
            <Radio.Group buttonStyle={"solid"} defaultValue={null}>
              {kernels}
            </Radio.Group>
          </Descriptions.Item>
        );
        return true;
      });

      if (all.length == 0) return render_no_kernels();

      return all;
    }

    function render_all() {
      const all = render_all_langs();

      return (
        <Descriptions
          title="All kernels by language"
          bordered
          column={1}
          style={SELECTION_STYLE}
        >
          {all}
        </Descriptions>
      );
    }

    function render_last() {
      const name = default_kernel;
      if (name == null) return;
      if (kernels_by_name == null) return;
      // also don't render "last", if we do not know that kernel!
      if (!kernels_by_name.has(name)) return;
      if (editor_settings == null) return <Loading />;
      const ask_jupyter_kernel =
        editor_settings.get("ask_jupyter_kernel") ?? true;

      return (
        <Descriptions bordered column={1} style={SELECTION_STYLE}>
          <Descriptions.Item label={"Quick select"}>
            <div>
              Your most recently selected kernel is {render_kernel_button(name)}
              .
            </div>
          </Descriptions.Item>
          <Descriptions.Item label={"Make default"}>
            <Checkbox
              checked={!ask_jupyter_kernel}
              onChange={(e) => dont_ask_again_click(e.target.checked)}
            >
              Do not ask again. Instead, default to your most recent selection.
            </Checkbox>
            <div>
              <Typography.Text type="secondary">
                You can always change the kernel by clicking on the kernel
                selector at the top right.
              </Typography.Text>
            </div>
          </Descriptions.Item>
        </Descriptions>
      );
    }

    function dont_ask_again_click(checked: boolean) {
      actions.kernel_dont_ask_again(checked);
    }

    function render_top() {
      if (kernel == null || kernel_info == null) {
        let msg: Rendered;
        // kernel, but no info means it is not known
        if (kernel != null && kernel_info == null) {
          msg = (
            <>
              Your notebook kernel <code>"{kernel}"</code> does not exist on{" "}
              <SiteName />.
            </>
          );
        } else {
          msg = <>This notebook has no kernel.</>;
        }
        return (
          <Row style={{ marginLeft: 0, marginRight: 0 }}>
            <Paragraph>
              <Text strong>{msg}</Text> A working kernel is required in order to
              evaluate the code in the notebook. Please select one for the
              programming language you want to work with. Otherwise{" "}
              <Button
                size="small"
                type={no_kernel ? "primary" : "default"}
                onClick={() => actions.select_kernel("")}
              >
                continue without a kernel
              </Button>
              .
            </Paragraph>
          </Row>
        );
      } else {
        const name = kernel_name(kernel);
        const current =
          name != null ? `The currently selected kernel is "${name}".` : "";

        return (
          <Row style={{ marginLeft: 0, marginRight: 0 }}>
            <Paragraph>
              <Text strong>Select a new kernel.</Text> {current}
            </Paragraph>
          </Row>
        );
      }
    }

    function render_unknown() {
      if (kernel_info != null || closestKernel == null) return;
      const closestKernelName = closestKernel.get("name");
      if (closestKernelName == null) return;

      return (
        <Descriptions
          bordered
          column={1}
          style={{ backgroundColor: COLORS.ATND_BG_RED_M }}
        >
          <Descriptions.Item label={"Unknown Kernel"}>
            A similar kernel might be {render_kernel_button(closestKernelName)}.
          </Descriptions.Item>
        </Descriptions>
      );
    }

    function render_footer(): Rendered {
      return (
        <Row style={{ color: COLORS.GRAY, paddingBottom: "2em" }}>
          <Paragraph>
            <Text strong>Note:</Text> You can always change the selected kernel
            later in the Kernel menu or by clicking on the kernel information at
            the top right.
          </Paragraph>
        </Row>
      );
    }

    function render_close_button(): Rendered | undefined {
      if (kernel == null || kernel_info == null) return;
      return (
        <Button
          style={{ float: "right" }}
          onClick={() => actions.hide_select_kernel()}
        >
          Close
        </Button>
      );
    }

    function render_body(): Rendered {
      if (kernels_by_name == null || kernel_selection == null) {
        return (
          <Row>
            <Loading />
          </Row>
        );
      } else {
        return (
          <>
            {render_top()}
            {render_unknown()}
            {render_last()}
            {render_suggested()}
            {render_all()}
            {render_custom()}
            <hr />
            {render_footer()}
          </>
        );
      }
    }

    function render_head(): Rendered {
      return (
        <antd.Row justify="space-between">
          <antd.Col flex={1}>
            <h3>Select a Kernel</h3>
          </antd.Col>
          <antd.Col flex={"auto"}>{render_close_button()}</antd.Col>
        </antd.Row>
      );
    }

    function checkObvious(): boolean {
      const name = closestKernel?.get("name");
      if (!name) return false;
      if (kernel != "sagemath") return false;
      // just do it -- this happens when automatically converting
      // a sage worksheet to jupyter via the "Jupyter" button.
      setTimeout(() => actions.select_kernel(name), 0);
      return true;
    }

    if (checkObvious()) {
      // avoid flicker displaying big error.
      return null;
    }
    return (
      <div style={MAIN_STYLE} className={"smc-vfill"}>
        <Col md={12} mdOffset={0} lg={8} lgOffset={2}>
          {render_head()}
          {render_body()}
        </Col>
      </div>
    );
  }
);
