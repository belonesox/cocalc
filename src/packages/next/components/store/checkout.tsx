/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Checkout -- finalize purchase and pay.
*/
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Col,
  Row,
  Spin,
  Table,
} from "antd";
import { useContext, useEffect, useState } from "react";
import { Icon } from "@cocalc/frontend/components/icon";
import { money } from "@cocalc/util/licenses/purchase/utils";
import { copy_without as copyWithout, isValidUUID } from "@cocalc/util/misc";
import A from "components/misc/A";
import SiteName from "components/share/site-name";
import useIsMounted from "lib/hooks/mounted";
import { useRouter } from "next/router";
import { describeItem, DisplayCost } from "./site-license-cost";
import { useProfileWithReload } from "lib/hooks/profile";
import { Paragraph, Title, Text } from "components/misc";
import { COLORS } from "@cocalc/util/theme";
import { ChangeEmailAddress } from "components/account/config/account/email";
import * as purchasesApi from "@cocalc/frontend/purchases/api";
import { currency, round2up, round2down } from "@cocalc/util/misc";
import type { CheckoutParams } from "@cocalc/server/purchases/shopping-cart-checkout";
import { ProductColumn } from "./cart";
import ShowError from "@cocalc/frontend/components/error";
import { StoreBalanceContext } from "../../lib/balance";

enum PaymentIntent {
  PAY_TOTAL,
  APPLY_BALANCE,
}

export default function Checkout() {
  const router = useRouter();
  const isMounted = useIsMounted();
  const [completingPurchase, setCompletingPurchase] = useState<boolean>(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent>(
    PaymentIntent.APPLY_BALANCE,
  );
  const [totalCost, setTotalCost] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const { profile, reload: reloadProfile } = useProfileWithReload({
    noCache: true,
  });
  const { refreshBalance } = useContext(StoreBalanceContext);
  const [session, setSession] = useState<{ id: string; url: string } | null>(
    null,
  );
  const updateSession = async () => {
    const session = await purchasesApi.getCurrentCheckoutSession();
    setSession(session);
    return session;
  };

  const [paymentAmount, setPaymentAmount0] = useState<number>(0);
  const setPaymentAmount = (amount: number) => {
    // no matter how this is set, always round it up to nearest penny.
    setPaymentAmount0(round2up(amount));
  };
  const [params, setParams] = useState<CheckoutParams | null>(null);
  const updateParams = async (intent?) => {
    try {
      const params = await purchasesApi.getShoppingCartCheckoutParams({
        ignoreBalance: (intent ?? paymentIntent) == PaymentIntent.PAY_TOTAL,
      });
      const cost = params.total;
      setParams(params);
      setTotalCost(round2up(cost));

      if ((intent ?? paymentIntent) === PaymentIntent.APPLY_BALANCE) {
        setPaymentAmount(params.chargeAmount ?? 0);
      } else {
        setPaymentAmount(
          Math.max(Math.max(params.minPayment, cost), params.chargeAmount ?? 0),
        );
      }
    } catch (err) {
      setError(`${err}`);
    }
  };

  useEffect(() => {
    // on load, check for existing payent session.
    updateSession();
    // on load also get current price, cart, etc.
    updateParams();
  }, []);

  // handle ?complete -- i.e., what happens after successfully paying
  // for a purchase - we do ANOTHER completePurchase, and for the second
  // one no additional payment is required, so in this case user actually
  // gets the items and goes to the congrats page.  Unless, of course,
  // they try to be sneaky and add something to their cart right *after*
  // paying... in which case they will just get asked for additional
  // money for that last thing. :-)
  useEffect(() => {
    if (router.query.complete == null) {
      // nothing to handle
      return;
    }
    (async () => {
      // in case webhooks aren't configured, get the payment via sync:
      try {
        setCompletingPurchase(true);
        await purchasesApi.syncPaidInvoices();
      } catch (err) {
        console.warn("syncPaidInvoices buying licenses -- issue", err);
      } finally {
        setCompletingPurchase(false);
      }
      // now do the purchase flow again with money available.
      completePurchase(false);
    })();
  }, []);

  if (error) {
    return <ShowError error={error} setError={setError} />;
  }
  async function completePurchase(ignoreBalance: boolean) {
    try {
      setError("");
      setCompletingPurchase(true);
      const curSession = await updateSession();
      if (curSession != null || !isMounted.current) {
        // there is already a stripe checkout session that hasn't been finished, so let's
        // not cause confusion by creating another one.
        // User will see a big alert with a link to finish this one, since updateSession
        // sets the session state.
        return;
      }
      // This api call tells the backend, "make a session that, when successfully finished, results in
      // buying everything in my shopping cart", or, if it returns {done:true}, then
      // It succeeds if the purchase goes through.
      const currentUrl = window.location.href.split("?")[0];
      const success_url = `${currentUrl}?complete=true`;
      const result = await purchasesApi.shoppingCartCheckout({
        success_url,
        cancel_url: currentUrl,
        paymentAmount,
        ignoreBalance,
      });
      if (result.done) {
        // done -- nothing further to do!
        if (isMounted.current) {
          router.push("/store/congrats");
        }
        return;
      }
      // payment is required to complete the purchase, since user doesn't
      // have enough credit.
      window.location = result.session.url as any;
    } catch (err) {
      // The purchase failed.
      setError(err.message);
    } finally {
      refreshBalance();
      if (!isMounted.current) return;
      setCompletingPurchase(false);
    }
  }

  const cancelPurchaseInProgress = async () => {
    try {
      await purchasesApi.cancelCurrentCheckoutSession();
      updateSession();
      updateParams();
    } catch (err) {
      setError(err.message);
    }
  };

  if (params == null) {
    return (
      <div style={{ textAlign: "center" }}>
        <Spin size="large" tip="Loading" />
      </div>
    );
  }

  const columns = getColumns();

  return (
    <>
      {session != null && (
        <div style={{ textAlign: "center" }}>
          <Alert
            style={{ margin: "30px", display: "inline-block" }}
            type="warning"
            message={<h2>Purchase in Progress</h2>}
            description={
              <div style={{ fontSize: "14pt", width: "450px" }}>
                <Divider />
                <p>
                  <Button href={session.url} type="primary" size="large">
                    Complete Purchase
                  </Button>
                </p>
                or
                <p style={{ marginTop: "15px" }}>
                  <Button onClick={cancelPurchaseInProgress}>Cancel</Button>
                </p>
              </div>
            }
          />
        </div>
      )}
      <div style={session != null ? { opacity: 0.4 } : undefined}>
        <RequireEmailAddress profile={profile} reloadProfile={reloadProfile} />
        {params.cart.length == 0 && (
          <div style={{ maxWidth: "800px", margin: "auto" }}>
            <h3>
              <Icon name={"shopping-cart"} style={{ marginRight: "5px" }} />
              {params.cart.length > 0 && (
                <>
                  Nothing in Your <SiteName />{" "}
                  <A href="/store/cart">Shopping Cart</A> is Selected
                </>
              )}
              {(params.cart.length ?? 0) == 0 && (
                <>
                  Your <SiteName /> <A href="/store/cart">Shopping Cart</A> is
                  Empty
                </>
              )}
            </h3>
            <br />
            <br />
            You must have at least one item in{" "}
            <A href="/store/cart">your cart</A> to checkout. Shop for{" "}
            <A href="/store/site-license">upgrades</A>, a{" "}
            <A href="/store/boost">license boost</A>, or a{" "}
            <A href="/dedicated">dedicated VM or disk</A>.
          </div>
        )}
        {params.cart.length > 0 && (
          <>
            <ShowError error={error} setError={setError} />
            <Card title={<>1. Review Items ({params.cart.length})</>}>
              <Table
                showHeader={false}
                columns={columns}
                dataSource={params.cart}
                rowKey={"id"}
                pagination={{ hideOnSinglePage: true }}
              />
              <GetAQuote items={params.cart} />
            </Card>

            <div style={{ height: "30px" }} />

            <Card title={<>2. Place Your Order</>}>
              <Row>
                <Col sm={12} style={{ textAlign: "center" }}>
                  {round2down(
                    (params.balance ?? 0) - (params.minBalance ?? 0),
                  ) > 0 && (
                    <Checkbox
                      style={{ marginTop: "38px" }}
                      checked={paymentIntent == PaymentIntent.APPLY_BALANCE}
                      onChange={async (e) => {
                        let intent;
                        if (e.target.checked) {
                          intent = PaymentIntent.APPLY_BALANCE;
                        } else {
                          intent = PaymentIntent.PAY_TOTAL;
                        }
                        setPaymentIntent(intent);
                        await updateParams(intent);
                      }}
                    >
                      Apply Account Balance Toward Purchase
                    </Checkbox>
                  )}
                </Col>
                <Col sm={12}>
                  <div style={{ fontSize: "15pt" }}>
                    <TotalCost totalCost={totalCost} />
                    <br />
                    <Terms />
                  </div>
                </Col>
              </Row>

              <ExplainPaymentSituation
                params={params}
                style={{ margin: "15px 0" }}
              />
              <div style={{ textAlign: "center" }}>
                <Divider />
                <Button
                  disabled={
                    params?.total == 0 ||
                    completingPurchase ||
                    !profile?.email_address ||
                    session != null
                  }
                  style={{ marginTop: "7px", marginBottom: "15px" }}
                  size="large"
                  type="primary"
                  onClick={() =>
                    completePurchase(paymentIntent === PaymentIntent.PAY_TOTAL)
                  }
                >
                  <Icon name="credit-card" />{" "}
                  {completingPurchase ? (
                    <>
                      Completing Purchase
                      <Spin style={{ marginLeft: "10px" }} />
                    </>
                  ) : params == null || paymentAmount == 0 ? (
                    `Complete Purchase${
                      session != null ? " (finish payment first)" : ""
                    }`
                  ) : (
                    `Add ${currency(paymentAmount)} credit to your account`
                  )}
                </Button>
              </div>
              {completingPurchase ||
              params == null ||
              paymentAmount != params.minPayment ? null : (
                <div style={{ color: "#666", marginTop: "15px" }}>
                  NOTE: There is a minimum transaction amount of{" "}
                  {currency(params.minPayment)}.
                </div>
              )}
            </Card>
          </>
        )}
        <ShowError error={error} setError={setError} />
      </div>
    </>
  );
}

export function fullCost(items) {
  let full_cost = 0;
  for (const { cost, checked } of items) {
    if (checked) {
      full_cost += cost.cost_sub_first_period ?? cost.cost;
    }
  }
  return full_cost;
}

function TotalCost({ totalCost }) {
  return (
    <>
      Total:{" "}
      <b style={{ float: "right", color: "darkred" }}>{money(totalCost)}</b>
    </>
  );
}

function Terms() {
  return (
    <Paragraph
      style={{ color: COLORS.GRAY, fontSize: "10pt", marginTop: "8px" }}
    >
      By placing your order, you agree to{" "}
      <A href="/policies/terms" external>
        our terms of service
      </A>{" "}
      regarding refunds and subscriptions.
    </Paragraph>
  );
}

export function DescriptionColumn({ cost, description, voucherPeriod }) {
  const { input } = cost;
  return (
    <>
      <div style={{ fontSize: "12pt" }}>
        {description.title && (
          <div>
            <b>{description.title}</b>
          </div>
        )}
        {description.description && <div>{description.description}</div>}
        {describeItem({ info: input, voucherPeriod })}
      </div>
    </>
  );
}

const MIN_AMOUNT = 100;

function GetAQuote({ items }) {
  const router = useRouter();
  const [more, setMore] = useState<boolean>(false);
  let isSub;
  for (const item of items) {
    if (item.description.period != "range") {
      isSub = true;
      break;
    }
  }

  function createSupportRequest() {
    const x: any[] = [];
    for (const item of items) {
      x.push({
        cost: money(item.cost.cost),
        ...copyWithout(item, [
          "account_id",
          "added",
          "removed",
          "purchased",
          "checked",
          "cost",
        ]),
      });
    }
    const body = `Hello,\n\nI would like to request a quote.  I filled out the online form with the\ndetails listed below:\n\n\`\`\`\n${JSON.stringify(
      x,
      undefined,
      2,
    )}\n\`\`\``;
    router.push({
      pathname: "/support/new",
      query: {
        hideExtra: true,
        subject: "Request for a quote",
        body,
        type: "question",
      },
    });
  }

  return (
    <Paragraph style={{ paddingTop: "15px" }}>
      <A onClick={() => setMore(!more)}>
        Need to obtain a quote, invoice, modified terms, a purchase order, or
        pay via wire transfer, etc.?
      </A>
      {more && (
        <Paragraph>
          {fullCost(items) <= MIN_AMOUNT || isSub ? (
            <Alert
              showIcon
              style={{
                margin: "15px 0",
                fontSize: "12pt",
                borderRadius: "5px",
              }}
              type="warning"
              message={
                <>
                  Customized payment is available only for{" "}
                  <b>non-subscription purchases over ${MIN_AMOUNT}</b>. Make
                  sure your cost before discounts is over ${MIN_AMOUNT} and{" "}
                  <A href="/store/cart">convert</A> any subscriptions in your
                  cart to explicit date ranges, then try again. If this is
                  confusing, <A href="/support/new">make a support request</A>.
                </>
              }
            />
          ) : (
            <Alert
              showIcon
              style={{
                margin: "15px 0",
                fontSize: "12pt",
                borderRadius: "5px",
              }}
              type="info"
              message={
                <>
                  Click the button below to copy your shopping cart contents to
                  a support request, and we will take if from there. Note that
                  the 25% self-service discount is <b>only available</b> when
                  you purchase from this page.
                  <div style={{ textAlign: "center", marginTop: "5px" }}>
                    <Button onClick={createSupportRequest}>
                      <Icon name="medkit" /> Copy cart to support request
                    </Button>
                  </div>
                </>
              }
            />
          )}
        </Paragraph>
      )}
    </Paragraph>
  );
}

function RequireEmailAddressDescr({
  emailSuccess,
  onSuccess,
  profile,
}): JSX.Element {
  if (emailSuccess) {
    return (
      <Paragraph>
        Your email address is now:{" "}
        <Text code>{profile?.email_address ?? ""}</Text>.
      </Paragraph>
    );
  } else {
    return (
      <Paragraph
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "10px",
        }}
      >
        <ChangeEmailAddress embedded={true} onSuccess={onSuccess} />
      </Paragraph>
    );
  }
}

function RequireEmailAddressMesg({ emailSuccess }): JSX.Element {
  return (
    <>
      <Title level={2}>
        <Icon name="envelope" />{" "}
        {!emailSuccess ? "Missing Email Address" : "Email Address Saved"}
      </Title>
      {!emailSuccess && (
        <Paragraph>
          To place an order, we need to know an email address of yours. Please
          save it to your profile:
        </Paragraph>
      )}
    </>
  );
}

export function RequireEmailAddress({ profile, reloadProfile }) {
  const [emailSuccess, setEmailSuccess] = useState<boolean>(false);

  if (profile == null) {
    // profile not yet loaded.
    // there was a bug where it would flash the alert below while
    // loading the user's profile, which looks really dumb.
    return null;
  }
  if (profile?.email_address != null && !emailSuccess) {
    // address is defined, and they didn't just set it (so we don't
    // have to show a message confirming that), then nothing to do.
    return null;
  }

  return (
    <Alert
      style={{ marginBottom: "30px" }}
      type={emailSuccess ? "success" : "error"}
      message={<RequireEmailAddressMesg emailSuccess={emailSuccess} />}
      description={
        <RequireEmailAddressDescr
          emailSuccess={emailSuccess}
          profile={profile}
          onSuccess={() => {
            reloadProfile();
            setEmailSuccess(true);
          }}
        />
      }
    />
  );
}

export function getColumns({
  noDiscount,
  voucherPeriod,
}: { noDiscount?: boolean; voucherPeriod?: boolean } = {}) {
  return [
    {
      responsive: ["xs" as "xs"],
      render: ({ cost, description, project_id }) => {
        return (
          <div>
            <DescriptionColumn
              cost={cost}
              description={description}
              voucherPeriod={voucherPeriod}
            />
            <ProjectID project_id={project_id} />
            <div>
              <b style={{ fontSize: "11pt" }}>
                <DisplayCost
                  cost={cost}
                  simple
                  oneLine
                  noDiscount={noDiscount}
                />
              </b>
            </div>
          </div>
        );
      },
    },
    {
      responsive: ["sm" as "sm"],
      title: "Product",
      align: "center" as "center",
      render: (_, { product }) => <ProductColumn product={product} />,
    },
    {
      responsive: ["sm" as "sm"],
      width: "60%",
      render: (_, { cost, description, project_id }) => (
        <>
          <DescriptionColumn
            cost={cost}
            description={description}
            voucherPeriod={voucherPeriod}
          />{" "}
          <ProjectID project_id={project_id} />
        </>
      ),
    },
    {
      responsive: ["sm" as "sm"],
      title: "Price",
      align: "right" as "right",
      render: (_, { cost }) => (
        <b style={{ fontSize: "11pt" }}>
          <DisplayCost cost={cost} simple noDiscount={noDiscount} />
        </b>
      ),
    },
  ] as any;
}

function ProjectID({ project_id }: { project_id: string }): JSX.Element | null {
  if (!project_id || !isValidUUID(project_id)) return null;
  return (
    <div>
      For project: <code>{project_id}</code>
    </div>
  );
}

export function ExplainPaymentSituation({
  params,
  style,
}: {
  params: CheckoutParams | null;
  style?;
}) {
  if (params == null) {
    return <Spin />;
  }
  const { balance, chargeAmount, total, minBalance } = params;
  const curBalance = (
    <div style={{ float: "right", marginLeft: "30px", fontWeight: "bold" }}>
      Account Balance: {currency(round2down(balance))}
      {minBalance ? `, Minimum allowed balance: ${currency(minBalance)}` : ""}
    </div>
  );

  if (chargeAmount == 0) {
    return (
      <Alert
        showIcon
        type="info"
        style={style}
        description={
          <>
            {curBalance}
            Complete this purchase without adding credit to your account.
          </>
        }
      />
    );
  }
  return (
    <Alert
      showIcon
      type="info"
      style={style}
      description={
        <>
          {curBalance}
          Complete this purchase by adding {currency(chargeAmount)} to your
          account.{" "}
          {chargeAmount > total && (
            <>
              Your account balance must always be at least{" "}
              {currency(params.minBalance)}.
            </>
          )}
        </>
      }
    />
  );
}
