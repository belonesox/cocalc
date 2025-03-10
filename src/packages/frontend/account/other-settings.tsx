/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { Card, InputNumber } from "antd";
import { Map } from "immutable";

import { Checkbox, Panel } from "@cocalc/frontend/antd-bootstrap";
import { Rendered, redux } from "@cocalc/frontend/app-framework";
import {
  A,
  Icon,
  LabeledRow,
  Loading,
  NumberInput,
  Paragraph,
  SelectorInput,
} from "@cocalc/frontend/components";
import AIAvatar from "@cocalc/frontend/components/ai-avatar";
import { IS_MOBILE, IS_TOUCH } from "@cocalc/frontend/feature";
import LLMSelector from "@cocalc/frontend/frame-editors/llm/llm-selector";
import { NewFilenameFamilies } from "@cocalc/frontend/project/utils";
import track from "@cocalc/frontend/user-tracking";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { DEFAULT_NEW_FILENAMES, NEW_FILENAMES } from "@cocalc/util/db-schema";
import {
  VBAR_EXPLANATION,
  VBAR_KEY,
  VBAR_OPTIONS,
  getValidVBAROption,
} from "../project/page/vbar";
import { CustomLLM } from "./custom-llm";
import { dark_mode_mins, get_dark_mode_config } from "./dark-mode";
import Tours from "./tours";
import { useLanguageModelSetting } from "./useLanguageModelSetting";

interface Props {
  other_settings: Map<string, any>;
  is_stripe_customer: boolean;
  kucalc: string;
}

export function OtherSettings(props: Readonly<Props>): JSX.Element {
  const [model, setModel] = useLanguageModelSetting();

  function on_change(name: string, value: any): void {
    redux.getActions("account").set_other_settings(name, value);
  }

  function toggle_global_banner(val: boolean): void {
    if (val) {
      // this must be "null", not "undefined" – otherwise the data isn't stored in the DB.
      on_change("show_global_info2", null);
    } else {
      on_change("show_global_info2", webapp_client.server_time());
    }
  }

  //   private render_first_steps(): Rendered {
  //     if (props.kucalc !== KUCALC_COCALC_COM) return;
  //     return (
  //       <Checkbox
  //         checked={!!props.other_settings.get("first_steps")}
  //         onChange={(e) => on_change("first_steps", e.target.checked)}
  //       >
  //         Offer the First Steps guide
  //       </Checkbox>
  //     );
  //   }

  function render_global_banner(): Rendered {
    return (
      <Checkbox
        checked={!props.other_settings.get("show_global_info2")}
        onChange={(e) => toggle_global_banner(e.target.checked)}
      >
        <strong>Show announcement banner</strong>: only shows up if there is a
        message
      </Checkbox>
    );
  }

  function render_time_ago_absolute(): Rendered {
    return (
      <Checkbox
        checked={!!props.other_settings.get("time_ago_absolute")}
        onChange={(e) => on_change("time_ago_absolute", e.target.checked)}
      >
        Display <strong>timestamps as absolute points in time</strong> instead
        of relative to the current time
      </Checkbox>
    );
  }

  function render_confirm(): Rendered {
    if (!IS_MOBILE) {
      return (
        <Checkbox
          checked={!!props.other_settings.get("confirm_close")}
          onChange={(e) => on_change("confirm_close", e.target.checked)}
        >
          <strong>Confirm Close:</strong> always ask for confirmation before
          closing the browser window
        </Checkbox>
      );
    }
  }

  function render_katex(): Rendered {
    return (
      <Checkbox
        checked={!!props.other_settings.get("katex")}
        onChange={(e) => on_change("katex", e.target.checked)}
      >
        <strong>KaTeX:</strong> attempt to render formulas with{" "}
        <A href={"https://katex.org/"}>KaTeX</A> (much faster, but missing
        context menu options)
      </Checkbox>
    );
  }

  function render_standby_timeout(): Rendered {
    if (IS_TOUCH) {
      return;
    }
    return (
      <LabeledRow label="Standby timeout">
        <NumberInput
          on_change={(n) => on_change("standby_timeout_m", n)}
          min={1}
          max={180}
          unit="minutes"
          number={props.other_settings.get("standby_timeout_m")}
        />
      </LabeledRow>
    );
  }

  function render_mask_files(): Rendered {
    return (
      <Checkbox
        checked={!!props.other_settings.get("mask_files")}
        onChange={(e) => on_change("mask_files", e.target.checked)}
      >
        <strong>Mask files:</strong> grey out files in the files viewer that you
        probably do not want to open
      </Checkbox>
    );
  }

  function render_hide_project_popovers(): Rendered {
    return (
      <Checkbox
        checked={!!props.other_settings.get("hide_project_popovers")}
        onChange={(e) => on_change("hide_project_popovers", e.target.checked)}
      >
        <strong>Hide Project Tab Popovers:</strong> do not show the popovers
        over the project tabs
      </Checkbox>
    );
  }

  function render_hide_file_popovers(): Rendered {
    return (
      <Checkbox
        checked={!!props.other_settings.get("hide_file_popovers")}
        onChange={(e) => on_change("hide_file_popovers", e.target.checked)}
      >
        <strong>Hide File Tab Popovers:</strong> do not show the popovers over
        file tabs
      </Checkbox>
    );
  }

  function render_hide_button_tooltips(): Rendered {
    return (
      <Checkbox
        checked={!!props.other_settings.get("hide_button_tooltips")}
        onChange={(e) => on_change("hide_button_tooltips", e.target.checked)}
      >
        <strong>Hide Button Tooltips:</strong> hides some button tooltips (this
        is only partial)
      </Checkbox>
    );
  }

  function render_default_file_sort(): Rendered {
    return (
      <LabeledRow label="Default file sort">
        <SelectorInput
          selected={props.other_settings.get("default_file_sort")}
          options={{ time: "Sort by time", name: "Sort by name" }}
          on_change={(value) => on_change("default_file_sort", value)}
        />
      </LabeledRow>
    );
  }

  function render_new_filenames(): Rendered {
    const selected =
      props.other_settings.get(NEW_FILENAMES) ?? DEFAULT_NEW_FILENAMES;
    return (
      <LabeledRow label="Generated filenames">
        <SelectorInput
          selected={selected}
          options={NewFilenameFamilies}
          on_change={(value) => on_change(NEW_FILENAMES, value)}
        />
      </LabeledRow>
    );
  }

  function render_page_size(): Rendered {
    return (
      <LabeledRow label="Number of files per page">
        <NumberInput
          on_change={(n) => on_change("page_size", n)}
          min={1}
          max={10000}
          number={props.other_settings.get("page_size")}
        />
      </LabeledRow>
    );
  }

  function render_no_free_warnings(): Rendered {
    let extra;
    if (!props.is_stripe_customer) {
      extra = <span>(only available to customers)</span>;
    } else {
      extra = <span>(thanks for being a customer)</span>;
    }
    return (
      <Checkbox
        disabled={!props.is_stripe_customer}
        checked={!!props.other_settings.get("no_free_warnings")}
        onChange={(e) => on_change("no_free_warnings", e.target.checked)}
      >
        Hide free warnings: do{" "}
        <b>
          <i>not</i>
        </b>{" "}
        show a warning banner when using a free trial project {extra}
      </Checkbox>
    );
  }

  function render_dark_mode(): Rendered {
    const checked = !!props.other_settings.get("dark_mode");
    const config = get_dark_mode_config(props.other_settings.toJS());
    const label_style = { width: "100px", display: "inline-block" } as const;
    return (
      <div>
        <Checkbox
          checked={checked}
          onChange={(e) => on_change("dark_mode", e.target.checked)}
          style={{
            color: "rgba(229, 224, 216)",
            backgroundColor: "rgb(36, 37, 37)",
            marginLeft: "-5px",
            padding: "5px",
            borderRadius: "3px",
          }}
        >
          Dark mode: reduce eye strain by showing a dark background (via{" "}
          <A
            style={{ color: "#e96c4d", fontWeight: 700 }}
            href="https://darkreader.org/"
          >
            DARK READER
          </A>
          )
        </Checkbox>
        {checked && (
          <Card size="small" title="Dark Mode Configuration">
            <span style={label_style}>Brightness</span>
            <InputNumber
              min={dark_mode_mins.brightness}
              max={100}
              value={config.brightness}
              onChange={(x) => on_change("dark_mode_brightness", x)}
            />
            <br />
            <span style={label_style}>Contrast</span>
            <InputNumber
              min={dark_mode_mins.contrast}
              max={100}
              value={config.contrast}
              onChange={(x) => on_change("dark_mode_contrast", x)}
            />
            <br />
            <span style={label_style}>Sepia</span>
            <InputNumber
              min={dark_mode_mins.sepia}
              max={100}
              value={config.sepia}
              onChange={(x) => on_change("dark_mode_sepia", x)}
            />
            <br />
            <span style={label_style}>Grayscale</span>
            <InputNumber
              min={dark_mode_mins.grayscale}
              max={100}
              value={config.grayscale}
              onChange={(x) => on_change("dark_mode_grayscale", x)}
            />
          </Card>
        )}
      </div>
    );
  }

  function render_antd(): Rendered {
    return (
      <>
        <Checkbox
          checked={props.other_settings.get("antd_rounded", true)}
          onChange={(e) => on_change("antd_rounded", e.target.checked)}
        >
          <b>Rounded Design</b>: use rounded corners for buttons, etc.
        </Checkbox>
        <Checkbox
          checked={props.other_settings.get("antd_animate", true)}
          onChange={(e) => on_change("antd_animate", e.target.checked)}
        >
          <b>Animations</b>: briefly animate some aspects, e.g. buttons
        </Checkbox>
        <Checkbox
          checked={props.other_settings.get("antd_brandcolors", false)}
          onChange={(e) => on_change("antd_brandcolors", e.target.checked)}
        >
          <b>Color Scheme</b>: use brand colors instead of default colors
        </Checkbox>
        <Checkbox
          checked={props.other_settings.get("antd_compact", false)}
          onChange={(e) => on_change("antd_compact", e.target.checked)}
        >
          <b>Compact Design</b>: use a more compact design
        </Checkbox>
      </>
    );
  }

  function render_vertical_fixed_bar_options(): Rendered {
    const selected = getValidVBAROption(props.other_settings.get(VBAR_KEY));
    return (
      <LabeledRow label="Vertical Project Bar">
        <div>
          <SelectorInput
            style={{ marginBottom: "10px" }}
            selected={selected}
            options={VBAR_OPTIONS}
            on_change={(value) => {
              on_change(VBAR_KEY, value);
              track("flyout", { aspect: "layout", how: "account", value });
            }}
          />
          <Paragraph
            type="secondary"
            ellipsis={{ expandable: true, symbol: "more" }}
          >
            {VBAR_EXPLANATION}
          </Paragraph>
        </div>
      </LabeledRow>
    );
  }

  function render_disable_all_llm(): Rendered {
    return (
      <Checkbox
        checked={!!props.other_settings.get("openai_disabled")}
        onChange={(e) => {
          on_change("openai_disabled", e.target.checked);
          redux.getStore("projects").clearOpenAICache();
        }}
      >
        <strong>Disable all AI integrations</strong>, e.g., code generation or
        explanation buttons in Jupyter, @chatgpt mentions, etc.
      </Checkbox>
    );
  }

  function render_language_model(): Rendered {
    return (
      <LabeledRow label={<>Default Language Model</>}>
        <LLMSelector model={model} setModel={setModel} />
      </LabeledRow>
    );
  }

  function render_custom_llm(): Rendered {
    // This is disabled for now, will be enabled in a future PR
    return;
    // @ts-ignore
    return <CustomLLM on_change={on_change} />;
  }

  if (props.other_settings == null) {
    return <Loading />;
  }
  return (
    <>
      {redux.getStore("customize").get("openai_enabled") ? (
        <Panel
          header={
            <>
              <AIAvatar size={22} /> AI Settings
            </>
          }
        >
          {render_disable_all_llm()}
          {render_language_model()}
          {render_custom_llm()}
        </Panel>
      ) : undefined}

      <Panel
        header={
          <>
            <Icon name="highlighter" /> Theme
          </>
        }
      >
        {render_dark_mode()}
        {render_antd()}
      </Panel>

      <Panel
        header={
          <>
            <Icon name="gear" /> Other
          </>
        }
      >
        {render_confirm()}
        {render_katex()}
        {render_time_ago_absolute()}
        {render_global_banner()}
        {render_mask_files()}
        {render_hide_project_popovers()}
        {render_hide_file_popovers()}
        {render_hide_button_tooltips()}
        {render_no_free_warnings()}
        <Checkbox
          checked={!!props.other_settings.get("disable_markdown_codebar")}
          onChange={(e) => {
            on_change("disable_markdown_codebar", e.target.checked);
          }}
        >
          <strong>Disable the markdown code bar</strong> in all markdown
          documents. Checking this hides the extra run, copy, and explain
          buttons in fenced code blocks.
        </Checkbox>
        {render_vertical_fixed_bar_options()}
        {render_new_filenames()}
        {render_default_file_sort()}
        {render_page_size()}
        {render_standby_timeout()}
        <div style={{ height: "10px" }} />
        <Tours />
      </Panel>
    </>
  );
}
