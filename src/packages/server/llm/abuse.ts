/*
We initially just implement some very simple rate limitations to prevent very
blatant abuse.

- at most $10^5$ tokens per signed in user per hour \(that's \$0.20\); that allows for major usage...
  but if somebody tried to do something really abusive, it would stop it.  Nobody
  would hit this in practice unless they are really trying to abuse cocalc...
  WRONG: it's very easy to hit this due to large inputs, e.g., analyzing a paper.
- at most $10^6$ tokens per hour across all users \-\- that's \$2/hour. That would
  come out to a bit more if sustained than my budget, but allows for bursts.

See https://help.openai.com/en/articles/7039783-chatgpt-api-faq for the upstream rate limits,
where they limit per minute, not per hour (like below):

    What's the rate limits for the ChatGPT API?

    Free trial users: 20 RPM 40000 TPM
    Pay-as-you-go users (first 48 hours): 60 RPM 60000 TPM
    Pay-as-you-go users (after 48 hours): 3500 RPM 90000 TPM

    RPM = requests per minute
    TPM = tokens per minute
*/

import { newCounter, newHistogram } from "@cocalc/backend/metrics";
import { process_env_int } from "@cocalc/backend/misc";
import getPool, { CacheTime } from "@cocalc/database/pool";
import { getServerSettings } from "@cocalc/database/settings";
import { assertPurchaseAllowed } from "@cocalc/server/purchases/is-purchase-allowed";
import {
  LanguageModel,
  LanguageServiceCore,
  fromOllamaModel,
  isFreeModel,
  isLanguageModel,
  isOllamaLLM,
  model2service,
} from "@cocalc/util/db-schema/llm-utils";
import { KUCALC_COCALC_COM } from "@cocalc/util/db-schema/site-defaults";
import { isValidUUID } from "@cocalc/util/misc";
import { isObject } from "lodash";

// These are tokens over a given period of time – summed by account/analytics_cookie or global.
const QUOTAS = {
  noAccount: process_env_int("COCALC_LLM_QUOTA_NO_ACCOUNT", 0),
  account: process_env_int("COCALC_LLM_QUOTA_ACCOUNT", 10 ** 5),
  global: process_env_int("COCALC_LLM_QUOTA_GLOBAL", 10 ** 6),
} as const;

const prom_quotas = newHistogram(
  "llm",
  "abuse_usage",
  "Language model abuse usage",
  {
    buckets:
      // 10 buckets evenly spaced from 0 to QUOTAS.global
      Array.from({ length: 10 }, (_, i) =>
        Math.floor((i * QUOTAS.global) / 10),
      ),
    labels: ["usage"],
  },
);

const prom_rejected = newCounter(
  "llm",
  "abuse_rejected_total",
  "Language model requests rejected",
  ["quota"],
);

// Throws an exception if the request should not be allowed.
export async function checkForAbuse({
  account_id,
  analytics_cookie,
  model,
}: {
  account_id?: string;
  analytics_cookie?: string;
  model: LanguageModel;
}): Promise<void> {
  if (!account_id) {
    // Due to assholes like gpt4free, which is why "we can't have nice things".
    // https://github.com/xtekky/gpt4free/tree/main/gpt4free/cocalc
    throw Error("You must create an account.");
  }
  if (!isValidUUID(account_id) && !isValidUUID(analytics_cookie)) {
    // at least some amount of tracking.
    throw Error("at least one of account_id or analytics_cookie must be set");
  }

  if (!isLanguageModel(model)) {
    throw Error(`Invalid model "${model}"`);
  }

  // it's a valid model name, but maybe not enabled by the admin (by default, all are enabled)
  if (!(await isUserSelectableLanguageModel(model))) {
    throw new Error(`Model "${model}" is disabled.`);
  }

  const is_cocalc_com =
    (await getServerSettings()).kucalc === KUCALC_COCALC_COM;

  if (!isFreeModel(model, is_cocalc_com)) {
    // we exclude Ollama (string), because it is free.
    const service = model2service(model) as LanguageServiceCore;
    // This is a for-pay product, so let's make sure user can purchase it.
    await assertPurchaseAllowed({ account_id, service });
    // We always allow usage of for pay models, since the user is paying for
    // them.  Only free models need to be throttled.
    return;
  }

  // Below, we are only concerned with free models.

  const usage = await recentUsage({
    cache: "short",
    period: "1 hour",
    account_id,
    analytics_cookie,
  });

  prom_quotas.labels("recent").observe(usage);

  // console.log("usage = ", usage);
  if (account_id) {
    if (usage > QUOTAS.account) {
      prom_rejected.labels("account").inc();
      throw new Error(
        `You may use at most ${
          QUOTAS.account
        } tokens per hour. Please try again later${
          is_cocalc_com ? " or use a non-free language model such as GPT-4" : ""
        }.`,
      );
    }
  } else if (usage > QUOTAS.noAccount) {
    prom_rejected.labels("no_account").inc();
    throw new Error(
      `You may use at most ${QUOTAS.noAccount} tokens per hour. Sign in to increase your quota.`,
    );
  }

  // Prevent more sophisticated abuse, e.g., changing analytics_cookie or account frequently,
  // or just a general huge surge in usage.
  const overallUsage = await recentUsage({ cache: "long", period: "1 hour" });
  prom_quotas.labels("global").observe(overallUsage);
  // console.log("overallUsage = ", usage);
  if (overallUsage > QUOTAS.global) {
    prom_rejected.labels("global").inc();
    throw new Error(
      `There is too much usage of language models right now.  Please try again later ${
        is_cocalc_com ? " or use a non-free language model such as GPT-4" : ""
      }.`,
    );
  }
}

async function recentUsage({
  period,
  account_id,
  analytics_cookie,
  cache,
}: {
  period: string;
  account_id?: string;
  analytics_cookie?: string;
  // some caching so if user is hitting us a lot, we don't hit the database to
  // decide they are abusive -- at the same time, short enough that we notice.
  // Recommendation: "short"
  cache?: CacheTime;
}): Promise<number> {
  const pool = getPool(cache);
  let query, args;
  if (account_id) {
    const { rows } = await pool.query(
      "SELECT COUNT(*) FROM accounts WHERE account_id=$1",
      [account_id],
    );
    if (rows.length == 0) {
      throw Error(`invalid account_id ${account_id}`);
    }
    query = `SELECT SUM(total_tokens) AS usage FROM openai_chatgpt_log WHERE account_id=$1 AND time >= NOW() - INTERVAL '${period}'`;
    args = [account_id];
  } else if (analytics_cookie) {
    query = `SELECT SUM(total_tokens) AS usage FROM openai_chatgpt_log WHERE analytics_cookie=$1 AND time >= NOW() - INTERVAL '${period}'`;
    args = [analytics_cookie];
  } else {
    query = `SELECT SUM(total_tokens) AS usage FROM openai_chatgpt_log WHERE time >= NOW() - INTERVAL '${period}'`;
    args = [];
  }
  const { rows } = await pool.query(query, args);
  // console.log("rows = ", rows);
  return parseInt(rows[0]?.["usage"] ?? 0); // undefined = no results in above select,
}

async function isUserSelectableLanguageModel(
  model: LanguageModel,
): Promise<boolean> {
  const { selectable_llms, ollama_configuration, ollama_enabled } =
    await getServerSettings();

  if (isOllamaLLM(model)) {
    if (ollama_enabled && isObject(ollama_configuration)) {
      const om = fromOllamaModel(model);
      const oc = ollama_configuration[om];
      return oc?.enabled ?? true;
    }
  } else if (selectable_llms.includes(model)) {
    return true;
  }
  return false;
}
