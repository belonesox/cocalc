/*
 *  This file is part of CoCalc: Copyright © 2023 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import type {
  Region as HyperstackRegion,
  VirtualMachine as HyperstackVirtualMachine,
} from "@cocalc/util/compute/cloud/hyperstack/api-types";
import { COLORS } from "@cocalc/util/theme";
import { ID, NOTES } from "./crm";
import { SCHEMA as schema } from "./index";
import { Table } from "./types";
export {
  CLOUDS_BY_NAME,
  GOOGLE_CLOUD_DEFAULTS,
  ON_PREM_DEFAULTS,
} from "@cocalc/util/compute/cloud/clouds";

// These are just fallbacks in case something is wrong with the image configuration.
export const STANDARD_DISK_SIZE = 20;
export const CUDA_DISK_SIZE = 60;

// Compute Server Images -- typings.  See packages/server/compute/images.ts for
// how the actual data is populated.

export interface ImageVersion {
  // tag - must be given and distinct for each version -- this typically identifies the image to docker
  tag: string;
  // version -- defaults to tag if not given; usually the upstream version
  version?: string;
  // label -- defaults to the tag; this is to display to the user
  label?: string;
  // tested -- if this is not set to true, then this version should not be shown by default.
  // If not tested, only show to users who explicitly really want this (e.g., admins).
  tested?: boolean;
}

interface ProxyRoute {
  path: string;
  target: string;
  ws?: boolean;
}

export interface Image {
  // What we show the user to describe this image, e.g., in the image select menu.
  label: string;
  // The name of the package on npmjs or dockerhub:
  package: string;
  // In case there is a different package name for ARM64, the name of it.
  package_arm64?: string;
  // Root filesystem image must be at least this big in GB.
  minDiskSizeGb?: number;
  // Description in MARKDOWN to show user of this image.  Can include links.
  // Rough estimate of compressed size of Docker image; useful
  // to get a sense of how long it will take to download image
  // on clouds without pregenerated images.
  dockerSizeGb?: number;
  description?: string;
  // Upstream URL for this image, e.g., https://julialang.org/ for the Julia image.
  url: string;
  // Icon to show next to the label for this image.
  icon: string;
  // Link to a URL with the source for building this image.
  source: string;
  // optional list of links to videos about this image, ordered from lowest to highest priority.
  videos?: string[];
  // The versions of this image that we claim to have built.
  // The ones with role='prod' (or not specified) are shown
  // to users as options.
  versions: ImageVersion[];
  // If true, then a GPU is required to use this image.
  gpu?: boolean;
  // If true, then the microk8s snap is required to use this image.
  microk8s?: boolean;
  // authToken: if true, image has web interface that supports configurable auth token
  authToken?: boolean;
  // jupyterKernels: if false, no jupyter kernels included. If true or a list of
  // names, there are kernels available – used in frontend/jupyter/select-kernel.tsx
  jupyterKernels?: false | true | string[];
  // If set to true, do not allow creating this compute server with a DNS subdomain.
  // Some images only make sense to use over the web, and the web server just won't
  // work without DNS setup properly (e.g., VS Code with LEAN).  Ignored for on prem.
  requireDns?: boolean;
  // system: if true, this is a system container that is not for user compute
  system?: boolean;
  // disabled: if true, this image is completely disabled, so will not be used in any way.
  disabled?: boolean;
  // priority -- optional integer used for sorting options to display to user. The bigger the higher.
  priority?: number;
  // proxy: if false, do NOT run https proxy server on host VM
  //        if nothing given, runs proxy server with no default config (so does nothing)
  //        if given, is array of proxy config.
  proxy?: false | ProxyRoute[];
  apps?: {
    [name: string]: {
      icon: string;
      label: string;
      url: string;
      path: string;
      launch: string;
      requiresDns?: boolean;
    };
  };
}

export type Images = { [name: string]: Image };

export interface GoogleCloudImage {
  labels: { [name: string]: string };
  diskSizeGb: number;
  creationTimestamp: string;
}
export type GoogleCloudImages = { [name: string]: GoogleCloudImage };

// valid for google cloud -- probably not sufficient
export function makeValidGoogleName(s: string): string {
  return s.replace(/[._]/g, "-").toLowerCase().slice(0, 63);
}

export type State =
  | "off"
  | "starting"
  | "running"
  | "stopping"
  | "deprovisioned"
  | "suspending"
  | "suspended"
  | "unknown";

export type Action =
  | "start"
  | "resume"
  | "stop"
  | "suspend"
  | "deprovision"
  | "reboot";

export const ACTION_INFO: {
  [action: string]: {
    label: string;
    icon: string;
    tip: string;
    description: string;
    confirm?: boolean;
    confirmMessage?: string;
    danger?: boolean;
    target: State; // target stable state after doing this action.
    clouds?: Cloud[];
  };
} = {
  start: {
    label: "Start",
    icon: "play",
    tip: "Start",
    description: "Start the compute server running.",
    target: "running",
  },
  resume: {
    label: "Resume",
    icon: "play",
    clouds: ["google-cloud"],
    tip: "Resume",
    description: "Resume the compute server from suspend.",
    target: "running",
  },
  stop: {
    label: "Stop",
    icon: "stop",
    tip: "Turn off",
    description:
      "Turn the compute server off. No data on disk is lost, but any data and state in memory will be lost. This is like turning your laptop off.",
    confirm: true,
    target: "off",
  },
  deprovision: {
    label: "Deprovision",
    icon: "trash",
    tip: "Deprovision the virtual machine",
    description:
      "Deprovisioning DELETES THE VIRTUAL MACHINE BOOT DISK, but keeps the compute server parameters.   There are no costs associated with a deprovisioned compute server, and you can move it to a different region or zone.  Any files in the home directory of your project are not affected.",
    confirm: true,
    confirmMessage:
      "I understand that my compute server disks will be deleted.",
    danger: true,
    target: "deprovisioned",
  },
  reboot: {
    label: "Hard Reboot",
    icon: "refresh",
    tip: "Hard reboot the virtual machine.",
    description:
      "Perform a HARD reset on the virtual machine, which wipes the memory contents and resets the virtual machine to its initial state. This should not delete data from the disk, but can lead to filesystem corruption.",
    confirm: true,
    confirmMessage:
      "I understand that this can lead to filesystem corruption and is slightly dangerous.",
    danger: true,
    target: "running",
    clouds: ["google-cloud", "hyperstack"],
  },
  suspend: {
    label: "Suspend",
    icon: "pause",
    clouds: ["google-cloud"],
    tip: "Suspend disk and memory state",
    confirm: true,
    description:
      "Suspend the compute server.  No data on disk or memory is lost, and you are only charged for storing disk and memory. This is like closing your laptop screen.  You can leave a compute server suspended for up to 60 days before it automatically shuts off.",
    target: "suspended",
  },
};

export const STATE_INFO: {
  [state: string]: {
    label: string;
    actions: Action[];
    icon: string;
    color?: string;
    stable?: boolean;
    target?: State; // if not stable, this is the target state it is heading to
  };
} = {
  off: {
    label: "Off",
    color: "#ff4b00",
    actions: ["start", "deprovision"],
    icon: "stop",
    stable: true,
  },
  suspended: {
    label: "Suspended",
    actions: ["resume", "deprovision", "stop"],
    icon: "pause",
    color: "#0097a7",
    stable: true,
  },
  suspending: {
    label: "Suspending",
    actions: ["suspend"],
    icon: "pause",
    color: "#00bcd4",
    stable: false,
    target: "suspended",
  },
  starting: {
    label: "Starting",
    color: "#388e3c",
    actions: ["start"],
    icon: "bolt",
    stable: false,
    target: "running",
  },
  running: {
    label: "Running",
    color: COLORS.RUN,
    actions: ["stop", "deprovision", "reboot", "suspend"],
    icon: "run",
    stable: true,
  },
  stopping: {
    label: "Stopping",
    color: "#ff9800",
    actions: ["stop"],
    icon: "hand",
    stable: false,
    target: "off",
  },
  unknown: {
    label: "Unknown (click to refresh)",
    actions: [],
    icon: "question-circle",
    stable: true,
  },
  deprovisioned: {
    label: "Deprovisioned",
    actions: ["start"],
    color: "#888",
    icon: "minus-square",
    stable: true,
  },
};

export function getTargetState(x: State | Action): State {
  if (ACTION_INFO[x] != null) {
    return ACTION_INFO[x].target;
  }
  if (STATE_INFO[x] != null) {
    if (!STATE_INFO[x]?.stable) {
      return (STATE_INFO[x].target ?? x) as State;
    }
    return x as State;
  }
  throw Error(`x =${x} must be a state or action`);
}

export type Architecture = "x86_64" | "arm64";

// Convention is used in cocalc-compute-docker for making
// the npm packages @cocalc/compute-server.  Don't mess with it!
export function getImageField(arch: Architecture) {
  return arch == "x86_64" ? "package" : "package_arm64";
}

export type Cloud =
  | "any"
  | "onprem"
  | "core-weave"
  | "hyperstack"
  | "lambda-cloud"
  | "google-cloud"
  | "aws"
  | "fluid-stack"
  | "test";

export function getMinDiskSizeGb({
  configuration,
  IMAGES,
}: {
  configuration;
  IMAGES: Images;
}) {
  if (configuration?.image) {
    const { minDiskSizeGb } = IMAGES[configuration.image] ?? {};
    if (minDiskSizeGb) {
      return minDiskSizeGb;
    }
  }
  // TODO: will have to do something based on actual image size,
  // maybe, unless I come up with a clever trick involving
  // one PD mounted on many machines (?).
  if (configuration?.acceleratorType) {
    return CUDA_DISK_SIZE;
  } else {
    return STANDARD_DISK_SIZE;
  }
}

interface BaseConfiguration {
  // image: name of the image to use, e.g. 'python' or 'pytorch'.
  // images are managed in src/packages/server/compute/images.ts
  image: string;
  // tag: tag for the image to use when starting the compute server.
  // this references the versions field of the image.
  // If the tag is not given or not available, we use the latest
  // available tag.
  tag?: string;
  // tag_filesystem: tag for the filesystem container
  tag_filesystem?: string;
  // tag_cocalc: tag for the @cocalc/compute-server package.
  tag_cocalc?: string;
  // dns - If the string is set and the VM has an external ip address
  // and dns is configured, then point https://{dns}....
  // with ssl proxying to this compute server when it is running.
  dns?: string;
  // Array of top level directories to exclude from sync.
  // These can't have "|" in them, since we use that as a separator.
  // Use "~" to completely disable sync.
  excludeFromSync?: readonly string[];
  // If true, view data on the compute server as ephemeral.
  // Currently this is only meant to impact the user interface.
  ephemeral?: boolean;
  // Token used for authentication at https://compute-server...
  authToken?: string;
  // Configuration of the https proxy server.
  proxy?: ProxyRoute[];
  // If this compute server stops pinging us, e.g., due to being preempted or
  // just crashing due to out of memory (etc) should we automatically do a
  // forced restart.  Note that currently for on prem this isn't possible.
  autoRestart?: boolean;
  autoRestartDisabled?: boolean; // used to temporarily disable it to avoid accidentally triggering it.
  // Allow collaborators to control the state of the compute server.
  // They cannot change any other configuration.  User still pays for everything and owns compute server.
  allowCollaboratorControl?: boolean;
}

interface LambdaConfiguration extends BaseConfiguration {
  cloud: "lambda-cloud";
  instance_type_name: string;
  region_name: string;
}

export interface HyperstackConfiguration extends BaseConfiguration {
  cloud: "hyperstack";
  flavor_name: string;
  region_name: HyperstackRegion;
  // diskSizeGb is an integer >= 1.  It defaults to 10.
  // It's the size of the /data partition.  It's implemented
  // using 1 or more hyperstack (=ceph) volumes, which are combined
  // together as a ZFS pool.  If the compute server is
  // named "foo", the volumes are named "foo-1", "foo-2",
  // "foo-3", etc.
  // There is also always a separate 50GB root volume, which
  // is named "foo-0", and whose size is not configurable.
  // NOTE: users install packages "systemwide" inside of
  // a docker container and we configure docker to store
  // its data in the zpool, so that's in here too.
  diskSizeGb: number;
}

const COREWEAVE_CPU_TYPES = [
  "amd-epyc-rome",
  "amd-epyc-milan",
  "intel-xeon-v1",
  "intel-xeon-v2",
  "intel-xeon-v3",
  "intel-xeon-v4",
  "intel-xeon-scalable",
] as const;

const COREWEAVE_GPU_TYPES = [
  "Quadro_RTX_4000",
  "Quadro_RTX_5000",
  "RTX_A4000",
  "RTX_A5000",
  "RTX_A6000",
  "A40",
  "Tesla_V100_PCIE",
  "Tesla_V100_NVLINK",
  "A100_PCIE_40GB",
  "A100_PCIE_80GB",
  "A100_NVLINK_40GB",
  "A100_NVLINK_80GB",
] as const;

interface CoreWeaveConfiguration extends BaseConfiguration {
  cloud: "core-weave";
  gpu: {
    type: (typeof COREWEAVE_GPU_TYPES)[number];
    count: number;
  };
  cpu: {
    count: number;
    type?: (typeof COREWEAVE_CPU_TYPES)[number];
  };
  memory: string; // e.g., "12Gi"
  storage?: {
    root: {
      size: string; // e.g., '40Gi'
    };
  };
}

interface FluidStackConfiguration extends BaseConfiguration {
  cloud: "fluid-stack";
  plan: string;
  region: string;
  os: string;
}

const GOOGLE_CLOUD_ACCELERATOR_TYPES = [
  "nvidia-a100-80gb",
  "nvidia-tesla-a100",
  "nvidia-l4",
  "nvidia-tesla-t4",
  "nvidia-tesla-v100",
  "nvidia-tesla-p4",
  "nvidia-tesla-p100",
];

const GOOGLE_CLOUD_DISK_TYPES = [
  "pd-standard",
  "pd-balanced",
  "pd-ssd",
  // NOTE: hyperdisks are complicated and multidimensional, but for cocalc
  // we just hardcode options for the iops and bandwidth, and allow the
  // user to adjust the size.  Also, "hyperdisk-balanced" means hyperdisk
  // with the defaults for iops and bandwidth defined in
  // src/packages/util/compute/cloud/google-cloud/compute-cost.ts
  "hyperdisk-balanced",
];

export interface GoogleCloudConfiguration extends BaseConfiguration {
  cloud: "google-cloud";
  region: string;
  zone: string;
  machineType: string;
  // Ues a spot instance if spot is true.
  spot?: boolean;
  // The boot disk:
  // diskSizeGb is an integer >= 10.  It defaults to 10. It's the size of the boot disk.
  diskSizeGb?: number;
  hyperdiskBalancedIops?: number;
  hyperdiskBalancedThroughput?: number;
  diskType?: (typeof GOOGLE_CLOUD_DISK_TYPES)[number];
  acceleratorType?: (typeof GOOGLE_CLOUD_ACCELERATOR_TYPES)[number];
  // the allowed number depends on the accelerator; it defaults to 1.
  acceleratorCount?: number;
  // minCpuPlatform
  terminationTime?: Date;
  maxRunDurationSeconds?: number;
  // if true, use newest image, whether or not it is labeled with prod=true.
  test?: boolean;
  // an image name of the form "2023-09-13-063355-test", i.e., a timestamp in that format
  // followed by an optional string.  Whether or not to use cuda and and the arch are
  // determined by parameters above.  This is meant to be used for two purposes (1) testing
  // before deploying to production, and (2) stability, so a given compute server has the
  // exact same base image every time it is started, instead of being updated. Regarding (2),
  // this might not be needed, but we'll see.  If image is not set, we use the newest
  // image that is tagged prod:true, or its an error if no such image exists.  This is
  // all about Google Cloud images, not the IMAGES object defined elsewhere in this file.
  sourceImage?: string;
  // If true, then we have an external ip address
  externalIp?: boolean;
  // If true, can run full VM's inside of the machine, but there is 10% performance penalty.
  // This will only work for Intel non-e2 non-a3 instance types. No AMD and no ARM64.
  enableNestedVirtualization?: boolean;
}

export interface OnPremCloudConfiguration extends BaseConfiguration {
  cloud: "onprem";
  arch?: Architecture;
  gpu?: boolean;
}

export type Configuration =
  | LambdaConfiguration
  | HyperstackConfiguration
  | CoreWeaveConfiguration
  | FluidStackConfiguration
  | GoogleCloudConfiguration
  | OnPremCloudConfiguration;

interface BaseData {
  cloudflareId?: string;
  externalIp?: string;
  internalIp?: string;
}

export interface LambdaCloudData extends BaseData {
  cloud: "lambda-cloud";
  instance_id: string;
}

export interface HyperstackData extends BaseData {
  cloud: "hyperstack";
  // name we are using for the vm
  name?: string;
  // hyperstack description of this vm.
  vm?: HyperstackVirtualMachine;
  // id's of persistent storage, with first id the boot disk.
  // disks are named {name}-0, {name}-1, {name}-2, etc.,
  // with {name}-0 being the boot disk.
  disks?: number[];
  creationTimestamp?: Date;
}

export interface GoogleCloudData extends BaseData {
  cloud: "google-cloud";
  name?: string;
  state?: State;
  cpuPlatform?: string;
  creationTimestamp?: Date;
  lastStartTimestamp?: Date;
}

export type Data = GoogleCloudData | LambdaCloudData | HyperstackData;

export interface ComponentState {
  state: string;
  time: number;
  expire?: number;
}

export interface ComputeServerTemplate {
  enabled?: boolean;
  priority?: number;
}

export interface ComputeServerUserInfo {
  id: number;
  account_id: string;
  project_id: string;
  title?: string;
  color?: string;
  cost_per_hour?: number;
  deleted?: boolean;
  state_changed?: Date;
  started_by?: string;
  error?: string;
  state?: State;
  idle_timeout?: number;
  // google-cloud has a new "Time limit" either by hour or by date, which seems like a great idea!
  // time_limit
  autorestart?: boolean;
  cloud: Cloud;
  configuration: Configuration;
  provisioned_configuration?: Configuration;
  data?: Data;
  purchase_id?: number;
  last_edited?: Date;
  position?: number; // used for UI sorting.
  detailed_state?: { [name: string]: ComponentState };
  update_purchase?: boolean;
  last_purchase_update?: Date;
  template?: ComputeServerTemplate;
}

export interface ComputeServer extends ComputeServerUserInfo {
  api_key?: string; // project level api key for the project
  api_key_id?: number; // id of the api key (needed so we can delete it from database).
}

Table({
  name: "compute_servers",
  rules: {
    primary_key: "id",
    user_query: {
      get: {
        pg_where: [{ "project_id = $::UUID": "project_id" }],
        throttle_changes: 0, // do not make this bigger; UI really feels off if throttled
        fields: {
          id: null,
          account_id: null,
          created: null,
          title: null,
          color: null,
          cost_per_hour: null,
          deleted: null,
          project_id: null,
          state_changed: null,
          error: null,
          state: null,
          idle_timeout: null,
          autorestart: null,
          cloud: null,
          configuration: null,
          data: null,
          provisioned_configuration: null,
          avatar_image_tiny: null,
          last_edited: null,
          purchase_id: null,
          position: null,
          detailed_state: null,
          template: null,
          notes: null,
        },
      },
      set: {
        // ATTN: It's assumed that users can't set the data field.  Doing so would be very bad and could allow
        // them to maybe abuse the system and not pay for something.
        // Most fields, e.g., configuration, get set via api calls, which ensures consistency in terms of valid
        // data and what is actively deployed.
        fields: {
          project_id: "project_write",
          id: true,
          position: true,
          error: true, // easily clear the error
          notes: true,
        },
      },
    },
  },
  fields: {
    id: ID,
    account_id: {
      type: "uuid",
      desc: "User that owns this compute server.",
      render: { type: "account" },
    },
    created: {
      type: "timestamp",
      desc: "When the compute server was created.",
    },
    title: {
      type: "string",
      pg_type: "VARCHAR(254)",
      desc: "Title of this computer server.  Used purely to make it easier for the user to keep track of it.",
      render: { type: "text", maxLength: 254, editable: true },
    },
    color: {
      type: "string",
      desc: "A user configurable color, which is used for tags and UI to indicate where a tab is running.",
      pg_type: "VARCHAR(30)",
      render: { type: "color", editable: true },
    },
    cost_per_hour: {
      title: "Cost per Hour",
      desc: "The cost in US dollars per hour that this compute server cost us when it is provisioned. Any time the state is changed, this is set by the server to the proper cost.",
      type: "number",
      pg_type: "real",
    },
    deleted: {
      type: "boolean",
      desc: "True if the compute server has been deleted.",
    },
    project_id: {
      type: "uuid",
      desc: "The project id that this compute server provides compute for.",
      render: { type: "project_link" },
    },
    api_key: {
      type: "string",
      pg_type: "VARCHAR(128)",
      desc: "api key to connect to the project.  This is created by the system right when we are going to create the VM, and gets deleted when we stop it.  It's not set by the user and should not be revealed to the user.",
    },
    api_key_id: {
      type: "number",
      desc: "id of the api key; needed so we can delete it from database",
    },
    state_changed: {
      type: "timestamp",
      desc: "When the state last changed.",
    },
    error: {
      type: "string",
      desc: "In case something went wrong, e.g., in starting this compute server, this field will get set with a string error message to show the user. It's also cleared right when we try to start server.",
    },
    state: {
      type: "string",
      desc: "One of - 'off', 'starting', 'running', 'stopping'.  This is the underlying VM's state.",
      pg_type: "VARCHAR(16)",
    },
    idle_timeout: {
      type: "number",
      desc: "The idle timeout in seconds of this compute server. If set to 0, never turn it off automatically.  The compute server idle timeouts if none of the tabs it is providing are actively touched through the web UI.",
    },
    autorestart: {
      type: "boolean",
      desc: "If true and the compute server stops for any reason, then it will be automatically started again.  This is primarily useful for stop instances.",
    },
    cloud: {
      type: "string",
      pg_type: "varchar(30)",
      desc: "The cloud where this compute server runs: 'user', 'coreweave', 'lambda', 'google-cloud', 'aws', 'fluidstack'.",
    },
    configuration: {
      type: "map",
      pg_type: "jsonb",
      desc: "Cloud specific configuration of the computer at the cloud host. The format depends on the cloud",
    },
    provisioned_configuration: {
      type: "map",
      pg_type: "jsonb",
      desc: "Same as configuration, but this is the one we actually used last time we provisioned a VM in a cloud.",
    },
    data: {
      type: "map",
      pg_type: "jsonb",
      desc: "Arbitrary data about this server that is cloud provider specific.  Store data here to facilitate working with the virtual machine, e.g., the id of the server when it is running, etc.  This *IS* returned to the user.",
    },
    avatar_image_tiny: {
      title: "Image",
      type: "string",
      desc: "tiny (32x32) visual image associated with the compute server. Suitable to include as part of changefeed, since about 3kb. Derived from avatar_image_full.",
      render: { type: "image" },
    },
    avatar_image_full: {
      title: "Image",
      type: "string",
      desc: "User configurable visual image associated with the compute server.  Could be 150kb.  NOT include as part of changefeed of projects, since potentially big (e.g., 200kb x 1000 projects = 200MB!).",
      render: { type: "image" },
    },
    purchase_id: {
      type: "number",
      desc: "if there is a current active purchase related to this compute server, this is the id of that purchase in the purchases table",
    },
    update_purchase: {
      type: "boolean",
      desc: "This is set to true if activity with this server is happening that warrants creating/ending a purchase.",
    },
    last_purchase_update: {
      type: "timestamp",
      desc: "Last time we requested an update to the purchase info about this compute server.",
    },
    position: {
      type: "number",
      desc: "Used for sorting a list of compute servers in the UI.",
    },
    last_edited: {
      type: "timestamp",
      desc: "Last time the configuration, state, etc., changed.",
    },
    detailed_state: {
      type: "map",
      pg_type: "jsonb",
      desc: "Map from component name to something like {state:'running',time:Date.now()}, e.g., {vm: {state:'running', time:393939938484}}, filesystem: {state:'updating', time:939398484892}, uptime:{state:'22:56:33 up 3 days,  9:28,  0 users,  load average: 0.93, 0.73, 0.56', time:?}}.  This is used to provide users with insight into what's currently happening on their compute server.",
    },
    notes: NOTES,
    template: {
      type: "map",
      pg_type: "jsonb",
      desc: "Use this compute server configuration as a public template.  Only admins can set this field for now. The exact structure of this jsonb is yet to be determined.",
    },
  },
});

Table({
  name: "crm_compute_servers",
  fields: schema.compute_servers.fields,
  rules: {
    primary_key: schema.compute_servers.primary_key,
    virtual: "compute_servers",
    user_query: {
      get: {
        admin: true, // only admins can do get queries on this table
        // (without this, users who have read access could read)
        pg_where: [],
        fields: {
          ...schema.compute_servers.user_query?.get?.fields,
          notes: null,
          template: null,
        },
      },
      set: {
        admin: true,
        fields: {
          id: true,
          title: true,
          color: true,
          deleted: true,
          notes: true,
          template: true,
        },
      },
    },
  },
});

Table({
  name: "compute_servers_cache",
  fields: {
    cloud: {
      type: "string",
      desc: "The cloud that we're caching information about",
    },
    key: {
      type: "string",
      desc: "The key for whatever we're caching.",
    },
    value: {
      type: "string",
      desc: "The cached data.",
    },
    expire: {
      type: "timestamp",
      desc: "When this action should be expired.",
    },
  },
  rules: {
    durability: "soft", // it's just a cache
    desc: "Cache data about what's going on in various clouds that are used to implement compute servers.",
    primary_key: ["cloud", "key"],
  },
});
