/*
Show the last latex build log, i.e., output from last time we ran the LaTeX build process.
*/

import { ButtonGroup, Button } from "react-bootstrap";
import { is_different } from "../generic/misc";
import {
  React,
  rclass,
  rtypes,
  Fragment,
  Rendered,
  Component
} from "../generic/react";

import { BuildLogs } from "./actions";

const { Icon, Loading } = require("smc-webapp/r_misc");

interface BuildSpec {
  label: string;
  icon: string;
  tip: string;
}

const BUILD_SPECS = {
  recompile: {
    label: "Recompile",
    icon: "retweet",
    tip: "Recompile the document, running LaTeX, BibTex, Sage, etc."
  },

  latex: {
    label: "LaTeX",
    icon: "cc-icon-tex-file",
    tip: "Run the LaTeX build command"
  },

  bibtex: {
    label: "BibTeX",
    icon: "file-code-o",
    tip: "Process bibliography using Bibtex"
  },

  sagetex: {
    label: "SageTex",
    icon: "cc-icon-sagemath-bold",
    tip: "Run SageTex, if necessary"
  },

  clean: {
    label: "Clean",
    icon: "trash",
    tip: "Delete all autogenerated auxiliary files"
  }
};

interface Props {
  id: string;
  actions: any;
  editor_state: Map<string, any>;
  is_fullscreen: boolean;
  project_id: string;
  path: string;
  reload: number;
  font_size: number;

  // reduxProps:
  status: string;
  build_logs: BuildLogs;
}

class Build extends Component<Props, {}> {
  static reduxProps({ name }) {
    return {
      [name]: {
        build_logs: rtypes.immutable.Map,
        status: rtypes.string
      }
    };
  }

  shouldComponentUpdate(props): boolean {
    return is_different(this.props, props, [
      "build_logs",
      "status",
      "font_size"
    ]);
  }

  render_log(stage): Rendered {
    if (this.props.build_logs == null) return;
    let x = this.props.build_logs.get(stage);
    if (!x) return;
    const value: string | undefined = x.get("stdout") + x.get("stderr");
    if (!value) {
      return;
    }
    let time: number | undefined = x.get("time");
    let time_str: string = "";
    if (time) {
      time_str = `(${(time / 1000).toFixed(1)} seconds)`;
    }
    return (
      <Fragment>
        <h5>
          {BUILD_SPECS[stage].label} Output {time_str}
        </h5>
        <textarea
          readOnly={true}
          style={{
            color: "#666",
            background: "#f8f8f0",
            display: "block",
            width: "100%",
            padding: "10px",
            flex: 1
          }}
          value={value}
        />
      </Fragment>
    );
  }

  render_clean(): Rendered {
    const value =
      this.props.build_logs != null
        ? this.props.build_logs.getIn(["clean", "output"])
        : undefined;
    if (!value) {
      return;
    }
    return (
      <Fragment>
        <h4>Clean Auxiliary Files</h4>
        <textarea
          readOnly={true}
          style={{
            color: "#666",
            background: "#f8f8f0",
            display: "block",
            width: "100%",
            padding: "10px",
            flex: 1
          }}
          value={value}
        />
      </Fragment>
    );
  }

  render_status(): Rendered {
    if (this.props.status) {
      return (
        <div style={{ margin: "15px" }}>
          <Loading
            text={this.props.status}
            style={{
              fontSize: "18pt",
              textAlign: "center",
              marginTop: "15px",
              color: "#666"
            }}
          />
        </div>
      );
    }
  }

  render_build_action_button(action: string, spec: BuildSpec): Rendered {
    return (
      <Button
        key={spec.label}
        title={spec.tip}
        onClick={() => this.props.actions.build_action(action)}
        disabled={!!this.props.status}
      >
        <Icon name={spec.icon} /> {spec.label}
      </Button>
    );
  }

  render_buttons() {
    let action: string;
    return (
      <ButtonGroup>
        {(() => {
          const result: Rendered[] = [];
          for (action in BUILD_SPECS) {
            const spec: BuildSpec = BUILD_SPECS[action];
            result.push(this.render_build_action_button(action, spec));
          }
          return result;
        })()}
      </ButtonGroup>
    );
  }

  render() {
    return (
      <div
        className={"smc-vfill"}
        style={{
          overflowY: "scroll",
          padding: "5px 15px",
          fontSize: "11pt"
        }}
      >
        {this.render_buttons()}
        {this.render_status()}
        {this.render_log("latex")}
        {this.render_log("sagetex")}
        {this.render_log("bibtex")}
        {this.render_clean()}
      </div>
    );
  }
}

const Build0 = rclass(Build);
export { Build0 as Build };
