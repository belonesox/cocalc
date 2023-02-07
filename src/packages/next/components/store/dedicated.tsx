/*
 *  This file is part of CoCalc: Copyright © 2022 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Create a new site license.
*/

import { Divider, Form, Input, Radio, Select, Typography } from "antd";
import { sortBy } from "lodash";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@cocalc/frontend/components/icon";
import { get_local_storage } from "@cocalc/frontend/misc/local-storage";
import { HOME_PREFIX, ROOT } from "@cocalc/util/consts/dedicated";
import { DOC_CLOUD_STORAGE_URL } from "@cocalc/util/consts/project";
import { testDedicatedDiskNameBasic } from "@cocalc/util/licenses/check-disk-name-basics";
import { CostInputPeriod } from "@cocalc/util/licenses/purchase/types";
import { money } from "@cocalc/util/licenses/purchase/utils";
import {
  DedicatedDiskSpeedNames,
  DISK_NAMES,
  VMsType,
} from "@cocalc/util/types/dedicated";
import {
  DEDICATED_DISK_SIZE_INCREMENT,
  DEFAULT_DEDICATED_DISK_SIZE,
  DEFAULT_DEDICATED_DISK_SPEED,
  getDedicatedDiskKey,
  MAX_DEDICATED_DISK_SIZE,
  MIN_DEDICATED_DISK_SIZE,
  PRICES,
} from "@cocalc/util/upgrades/dedicated";
import { DateRange } from "@cocalc/util/upgrades/shopping";
import { Paragraph, Text, Title } from "components/misc";
import A from "components/misc/A";
import IntegerSlider from "components/misc/integer-slider";
import Loading from "components/share/loading";
import SiteName from "components/share/site-name";
import apiPost from "lib/api/post";
import { useScrollY } from "lib/use-scroll-y";
import { AddBox } from "./add-box";
import { ApplyLicenseToProject } from "./apply-license-to-project";
import { computeCost } from "./compute-cost";
import { InfoBar } from "./cost-info-bar";
import { SignInToPurchase } from "./sign-in-to-purchase";
import { TitleDescription } from "./title-description";
import { ToggleExplanations } from "./toggle-explanations";
import { UsageAndDuration } from "./usage-and-duration";
import { getType, loadDateRange } from "./util";

const GCP_DISK_URL =
  "https://cloud.google.com/compute/docs/disks/performance#performance_by_disk_size";

interface Props {
  noAccount: boolean;
}

export default function DedicatedResource(props: Props) {
  const { noAccount } = props;
  const router = useRouter();
  const headerRef = useRef<HTMLHeadingElement>(null);

  // most likely, user will go to the cart next
  useEffect(() => {
    router.prefetch("/store/cart");
  }, []);

  const [offsetHeader, setOffsetHeader] = useState(0);
  const scrollY = useScrollY();

  useEffect(() => {
    if (headerRef.current) {
      setOffsetHeader(headerRef.current.offsetTop);
    }
  }, []);

  return (
    <>
      <Title level={3} ref={headerRef}>
        <Icon name={"dedicated"} style={{ marginRight: "5px" }} />{" "}
        {router.query.id != null
          ? "Edit Dedicated Resources License in Shopping Cart"
          : "Buy a Dedicated Resources License"}
      </Title>
      {router.query.id == null && (
        <>
          <Paragraph>
            A{" "}
            <A href="https://doc.cocalc.com/licenses.html">
              <SiteName /> dedicated resource license
            </A>{" "}
            can be used to outfit your project either with additional disk
            storage or moves your project to a much more powerful virtual
            machine. Create a dedicated resources license below then add it to
            your <A href="/store/cart">shopping cart</A>.
          </Paragraph>
          <Paragraph>
            It is also possible to run <SiteName /> on your own hardware. Check
            out the{" "}
            <Text strong>
              <A href={"/pricing/onprem"}>on-premises offerings</A>
            </Text>{" "}
            to learn more about this.
          </Paragraph>
        </>
      )}
      <CreateDedicatedResource
        showInfoBar={scrollY > offsetHeader}
        noAccount={noAccount}
      />
    </>
  );
}

function CreateDedicatedResource({ showInfoBar = false, noAccount = false }) {
  // somehow this state is necessary to render the form properly
  const [formType, setFormType] = useState<"disk" | "vm" | null>(null);
  const [cost, setCost] = useState<CostInputPeriod | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [cartError, setCartError] = useState<string>("");
  const [showExplanations, setShowExplanations] = useState<boolean>(true);
  const [durationTypes, setDdurationTypes] = useState<"monthly" | "range">(
    "monthly"
  );
  const [vmMachine, setVmMachine] = useState<keyof VMsType | null>(null);
  const [diskNameValid, setDiskNameValid] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [form] = Form.useForm();
  const router = useRouter();

  // most likely, user will go to the cart next
  useEffect(() => {
    router.prefetch("/store/cart");
  }, []);

  function fixupDuration() {
    switch (form.getFieldValue("type")) {
      case "disk":
        setDdurationTypes("monthly");
        if (form.getFieldValue("period") === "range") {
          form.setFieldsValue({ period: "monthly" });
        }
        break;
      case "vm":
        setDdurationTypes("range");
        if (form.getFieldValue("period") !== "range") {
          form.setFieldsValue({ period: "range" });
        }
        break;
    }
  }

  function calcCost() {
    const data = form.getFieldsValue(true);

    try {
      switch (data.type) {
        case "disk":
          const size_gb = data["disk-size_gb"];
          const speed = data["disk-speed"];
          if (size_gb == null || speed == null) {
            return; // no data to compute price
          }
          setCost(
            computeCost({
              type: "disk",
              period: "monthly",
              dedicated_disk: {
                speed,
                size_gb,
                name: data["disk-name"],
              },
            })
          );
          break;
        case "vm":
          setCost(
            computeCost({
              type: "vm",
              period: "range",
              range: data.range,
              dedicated_vm: {
                machine: data["vm-machine"],
              },
            })
          );
          break;
      }
    } catch (err) {
      setCost(undefined);
    }
  }

  function onChange() {
    fixupDuration();
    calcCost();
  }

  async function loadItem(item: {
    id: number;
    product: string;
    description: {
      dedicated_disk?: any;
      dedicated_vm?: any;
      range?: DateRange;
      title?: string;
      description?: string;
    };
  }) {
    if (item.product !== "site-license") {
      throw new Error("not a site license");
    }
    const type = getType(item);
    if (type !== "disk" && type !== "vm") {
      throw new Error(`cannot deal with type ${type}`);
    }
    const conf = item.description;

    // restoring name/description
    form.setFieldsValue({
      title: conf.title,
      description: conf.description,
    });

    switch (type) {
      case "disk":
        const d = conf.dedicated_disk;
        form.setFieldsValue({
          type,
          "disk-size_gb": d.size_gb,
          "disk-speed": d.type,
          "disk-name": d.name,
        });
        // we have to re-validate the disk name, b/c name could be taken in the meantime
        // just calling the form to revalidate does not work.
        try {
          await testDedicatedDiskName(d.name);
          setDiskNameValid(true);
        } catch (err) {
          setDiskNameValid(false);
        }
        break;

      case "vm":
        const vm = conf.dedicated_vm?.machine;
        if (PRICES.vms[vm] == null) {
          console.warn(`VM type ${vm} not found`);
        } else {
          form.setFieldsValue({
            "vm-machine": vm,
          });
        }
        form.setFieldsValue({
          type,
          range: loadDateRange(conf.range),
        });
        break;
    }
    // unpacking and configuring the form worked, now we do the type selection to show it
    setFormType(type);
  }

  useEffect(() => {
    const store_site_license_show_explanations = get_local_storage(
      "store_site_license_show_explanations"
    );
    if (store_site_license_show_explanations != null) {
      setShowExplanations(!!store_site_license_show_explanations);
    }
    const { id } = router.query;
    if (!noAccount && id != null) {
      // editing something in the shopping cart
      (async () => {
        try {
          setLoading(true);
          const item = await apiPost("/shopping/cart/get", { id });
          await loadItem(item);
        } catch (err) {
          setCartError(err.message);
        } finally {
          setLoading(false);
        }
        onChange();
      })();
    }
    onChange();
  }, []);

  useEffect(() => {
    const { type } = router.query;
    if (typeof type === "string") {
      setType(type);
    }
  }, []);

  useEffect(() => {
    form.validateFields();
  }, [form.getFieldValue("type")]);

  if (loading) {
    return <Loading large center />;
  }

  function setType(type: string) {
    if (type === "vm" || type === "disk") {
      form.resetFields();
      form.setFieldsValue({ type });
      setFormType(type);
      setCost(undefined);
      setCartError("");
      onChange();
    } else {
      console.log(`unable to setType to ${type}`);
    }
  }

  function renderTypeSelection() {
    return (
      <Form.Item
        name="type"
        label="Dedicated"
        rules={[{ required: true, message: "Please select a type" }]}
        extra={
          showExplanations && (
            <>Select if you want to get a Dedicate Disk or a Virtual Machine.</>
          )
        }
      >
        <Radio.Group
          onChange={(e) => {
            // Clear error whenever changing this selection to something.
            // See comment in validateDedicatedDiskName about how this
            // isn't great.
            setCartError("");
            setType(e.target.value);
          }}
        >
          <Radio.Button key={"disk"} value={"disk"}>
            Disk
          </Radio.Button>
          <Radio.Button key={"vm"} value={"vm"}>
            Virtual Machine
          </Radio.Button>
        </Radio.Group>
      </Form.Item>
    );
  }

  function renderAdditionalInfoContent() {
    switch (formType) {
      case "disk":
        return (
          <>
            <Typography.Paragraph
              ellipsis={{
                expandable: true,
                rows: 2,
                symbol: "more",
                onExpand: () => setShowInfo(true),
              }}
            >
              This license attaches a disk to your project. When the license is
              valid and activated by adding to a project, a disk will be created
              on the fly. It will be formatted and mounted into your project.
              You'll be able to access it via a symlink in your project's home
              directory – i.e. <code>~/{HOME_PREFIX}/&lt;name&gt;</code> will be
              pointing to <code>{ROOT}/&lt;name&gt;</code>.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ display: showInfo ? "" : "none" }}>
              Once you cancel the subscription, the subscription will end at the
              end of the billing period. Then, the disk and all the data it
              contains <strong>will be deleted</strong>!
            </Typography.Paragraph>
            <Typography.Paragraph style={{ display: showInfo ? "" : "none" }}>
              It's also possible to move a disk from one project to another one.
              First, remove the license from the project, restart the project to
              unmount the disk. Then, add the license to another project and
              restart that project as well.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ display: showInfo ? "" : "none" }}>
              Note: it is also possible to mount external data storage to a
              project:{" "}
              <A href={DOC_CLOUD_STORAGE_URL}>
                cloud storage & remote file systems
              </A>
              . This could help transferring data in and out of <SiteName />.
            </Typography.Paragraph>
          </>
        );
      case "vm":
        return (
          <>
            <Typography.Paragraph
              ellipsis={{
                expandable: true,
                rows: 2,
                symbol: "more",
                onExpand: () => setShowInfo(true),
              }}
            >
              For the specified period of time, a virtual machine is provisioned
              and started inside of <SiteName />
              's cluster. You have to add the license to one of your projects in
              order to tell it to move to this virtual machine. This happens
              when the project is started or restarted.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ display: showInfo ? "" : "none" }}>
              Once your project has moved over, the usual quota upgrades will be
              ineffective – instead, your project runs with the quota limits
              implied by the performance of the underlying virtual machine. The
              files/data in your project will be exactly the same as before.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ display: showInfo ? "" : "none" }}>
              Once the license period is over, the virtual machine will be shut
              down. At that point your project will be stopped as well. The next
              time it starts, it will run under the usual quota regime on a
              shared node in the cluster.
            </Typography.Paragraph>
          </>
        );
    }
  }

  function renderAdditionalInfo() {
    return (
      <Form.Item label="How does it work?">
        <div style={{ paddingTop: "5px" }}>{renderAdditionalInfoContent()}</div>
      </Form.Item>
    );
  }

  function renderDurationExplanation() {
    if (!showExplanations) return;
    switch (durationTypes) {
      case "monthly":
        return (
          <>
            Currently, disk can be only be rented on a monthly basis only. Note:
            you can cancel the subscription any time and at the end of the
            billing period the disk – and the data it holds – will be destroyed.
          </>
        );
      case "range":
        return (
          <>
            Dedicated VMs can only be rented for a specific period of time. At
            its end, the node will be stopped and removed, and your project
            moves back to the usual upgrade schema.
          </>
        );
    }
  }

  function renderUsageAndDuration() {
    return (
      <UsageAndDuration
        extraDuration={renderDurationExplanation()}
        form={form}
        onChange={onChange}
        showUsage={false}
        duration={durationTypes}
        discount={false}
      />
    );
  }

  async function testDedicatedDiskName(name): Promise<void> {
    testDedicatedDiskNameBasic(name);
    // if the above passes, then we can check if the name is available.
    const serverCheck = await apiPost("licenses/check-disk-name", { name }, 60);
    if (serverCheck?.available === true) {
      return;
    } else {
      throw new Error("Please choose a different disk name.");
    }
  }

  /**
   * The disk name will get a prefix like "kucalc-[cluster id]-pd-[namespace]-dedicated-..."
   * It's impossible to know the prefix, since the properties of the cluster can change.
   * The maximum total length of the disk name is 63, according to the GCE documentation.
   * https://cloud.google.com/compute/docs/naming-resources#resource-name-format
   * I hope a max length of 20 is sufficiently restrictive.
   */
  function validateDedicatedDiskName() {
    return {
      validator: async (_, name) => {
        try {
          await testDedicatedDiskName(name);
          setDiskNameValid(true);
          // WARNING! This is obviously not good code in general, since we're clearing all
          // errors if the disk name happens to be valid.
          // It's OK for now since this is the only field we do validation with, and
          // any other error would  be, e.g., in submission of the form to the backend.
          setCartError("");
        } catch (err) {
          setCartError(err.message);
          setDiskNameValid(false);
          throw err;
        }
      },
    };
  }

  function renderDedicatedDiskInfo() {
    if (!showExplanations) return;
    return (
      <p>
        More information about Dedicated Disks can be found at{" "}
        <A href={GCP_DISK_URL}>GCP: Performance by disk size</A>.
      </p>
    );
  }

  function renderDiskPerformance() {
    const size_gb = form.getFieldValue("disk-size_gb");
    const speed = form.getFieldValue("disk-speed");
    if (size_gb == null || speed == null) return;
    const diskID = getDedicatedDiskKey({ size_gb, speed });
    const di = PRICES.disks[diskID];
    if (di == null) {
      return (
        <p style={{ marginTop: "5px" }}>
          Unknown disk with ID <code>{diskID}</code>.
        </p>
      );
    }
    return (
      <p style={{ marginTop: "5px" }}>
        Estimated speed: {di.mbps} MB/s sustained throughput and {di.iops} IOPS
        read/write. For more detailed information:{" "}
        <A href={GCP_DISK_URL}>GCP disk performance</A> information.
      </p>
    );
  }

  function renderDiskExtra() {
    if (!showExplanations) return;
    const formName = form.getFieldValue("disk-name");
    const name = formName ? formName : <>&lt;name&gt;</>;
    return (
      <p>
        Give your disk a name. It must be unique and will be used as part of the
        directory name. The mount point will be{" "}
        <code>
          {ROOT}/{name}
        </code>{" "}
        and if the name isn't already taken. For your convenience, if possible
        there will be a symlink named{" "}
        <code>
          ~/{HOME_PREFIX}/{name}
        </code>{" "}
        pointing from your home directory to your disk for your convenience.
      </p>
    );
  }

  // ATTN: the IntegerSlider must be kept in sync with DEDICATED_DISK_SIZES in
  // src/packages/util/upgrades/dedicated.ts
  function renderDedicatedDisk() {
    return (
      <>
        <Form.Item
          name="disk-name"
          label="Name"
          hasFeedback
          extra={renderDiskExtra()}
          rules={[validateDedicatedDiskName]}
        >
          <Input style={{ width: "15em" }} />
        </Form.Item>

        <Form.Item
          label="Size"
          name="disk-size_gb"
          initialValue={DEFAULT_DEDICATED_DISK_SIZE}
          extra={
            showExplanations && <>Select the size of the dedicated disk.</>
          }
        >
          <IntegerSlider
            min={MIN_DEDICATED_DISK_SIZE}
            max={MAX_DEDICATED_DISK_SIZE}
            step={DEDICATED_DISK_SIZE_INCREMENT}
            onChange={(val) => {
              form.setFieldsValue({ "disk-size_gb": val });
              onChange();
            }}
            units={"G"}
            presets={[32, 64, 128, 256, 512, 1024]}
          />
        </Form.Item>

        <Form.Item
          name="disk-speed"
          label="Speed"
          initialValue={DEFAULT_DEDICATED_DISK_SPEED}
          extra={renderDedicatedDiskInfo()}
        >
          <Radio.Group
            onChange={(e) => {
              form.setFieldsValue({ "disk-speed": e.target.value });
              onChange();
            }}
          >
            {DedicatedDiskSpeedNames.map((type) => (
              <Radio.Button key={type} value={type}>
                {DISK_NAMES[type]}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item label="Performance">{renderDiskPerformance()}</Form.Item>
      </>
    );
  }

  function renderDedicatedVmInfo() {
    if (!showExplanations) return;
    return (
      <>
        More information about VM types can be found at{" "}
        <A href={"https://cloud.google.com/compute/docs/machine-types"}>
          GCP: machine families
        </A>
        .
      </>
    );
  }

  function renderVmPerformance() {
    if (vmMachine == null) return;
    const { spec } = PRICES.vms?.[vmMachine] ?? {};
    if (spec == null) {
      return (
        <p>
          Problem: the specifications of <code>{vmMachine}</code> are not known
        </p>
      );
    }
    return (
      <p>
        Restarting your project while this license is active, will move your
        project on a virtual machine in <SiteName />
        's cluster. This machine will allow you to use up to {spec.cpu} CPU
        cores and {spec.mem} G memory.
      </p>
    );
  }

  function dedicatedVmOptions() {
    return sortBy(
      Object.entries(PRICES.vms),
      ([_, vm]) => `${1000 + (vm?.spec.cpu ?? 0)}:${1000 + (vm?.spec.mem ?? 0)}`
    ).map(([id, vm]: [string, NonNullable<VMsType[string]>]) => {
      return (
        <Select.Option key={id} value={id}>
          <Text>{vm.title ?? vm.spec}</Text>
          <Text style={{ paddingLeft: "1em" }} type="secondary">
            ({money(vm.price_day)} per day)
          </Text>
        </Select.Option>
      );
    });
  }

  function renderDedicatedVM() {
    return (
      <>
        <Form.Item
          label="Type"
          name="vm-machine"
          initialValue={null}
          extra={renderDedicatedVmInfo()}
          rules={[{ required: true, message: "Please select a VM type." }]}
        >
          <Select
            onChange={(val) => {
              form.setFieldsValue({ "vm-machine": val });
              setVmMachine(val);
              onChange();
            }}
          >
            {dedicatedVmOptions()}
          </Select>
        </Form.Item>
        <Form.Item label="Performance">
          <div style={{ paddingTop: "5px" }}>{renderVmPerformance()}</div>
        </Form.Item>
      </>
    );
  }

  function renderConfiguration() {
    switch (formType) {
      case "disk":
        return renderDedicatedDisk();
      case "vm":
        return renderDedicatedVM();
    }
  }

  function renderCost() {
    const input = cost?.input;
    const disabled =
      cost == null ||
      input == null ||
      (input.type === "vm" && (input.start == null || input.end == null)) ||
      (input.type === "disk" && !diskNameValid);

    return (
      <Form.Item wrapperCol={{ offset: 0, span: 24 }}>
        <AddBox
          cost={cost}
          form={form}
          cartError={cartError}
          setCartError={setCartError}
          router={router}
          dedicatedItem={true}
          disabled={disabled}
          noAccount={noAccount}
        />
      </Form.Item>
    );
  }

  return (
    <div>
      <InfoBar
        show={showInfoBar}
        cost={cost}
        router={router}
        form={form}
        cartError={cartError}
        setCartError={setCartError}
        noAccount={noAccount}
      />
      <ApplyLicenseToProject router={router} />
      <SignInToPurchase noAccount={noAccount} />
      <Form
        form={form}
        style={{
          marginTop: "15px",
          margin: "auto",
          border: "1px solid #ddd",
          padding: "15px",
        }}
        name="basic"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        autoComplete="off"
        onValuesChange={onChange}
      >
        <ToggleExplanations
          showExplanations={showExplanations}
          setShowExplanations={setShowExplanations}
        />

        {renderTypeSelection()}

        {formType != null && (
          <>
            {renderAdditionalInfo()}
            {renderUsageAndDuration()}

            <Divider plain>Configuration</Divider>
            {renderConfiguration()}

            <TitleDescription showExplanations={showExplanations} />
            {renderCost()}
          </>
        )}
      </Form>
    </div>
  );
}
