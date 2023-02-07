/*
 *  This file is part of CoCalc: Copyright © 2022 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

// This adds the generalized "userProfile" callback for OAuth2 processing
// OAuth2 userinfoURL: next to /authorize
// https://github.com/passport-next/passport-oauth2/blob/master/lib/strategy.js#L276

const safeJsonStringify = require("safe-json-stringify");
import { parseOpenIdProfile } from "@cocalc/server/auth/sso/openid-parser";
import { UserProfileCallbackOpts } from "./types";
import jwt_decode from "jwt-decode";
export function addUserProfileCallback(opts: UserProfileCallbackOpts) {
  const { strategy_instance, userinfoURL, L2, type } = opts;
  if (userinfoURL == null) throw new Error(`the userinfoURL is required`);
  strategy_instance.userProfile = function userProfile(accessToken, tokenSecret, params, done) {
    L2(`userinfoURL=${userinfoURL}, accessToken=${accessToken}, tokenSecret=${tokenSecret} `); 
    L2(params); 

    let oauth = this._oauth;
    if (this._oauth2) {
      oauth = this._oauth2;
      oauth.useAuthorizationHeaderforGET(true);
    }
    oauth.get(userinfoURL, accessToken, (err, body) => {
      // L2(`get->body = ${safeJsonStringify(body)}`); // Disable logging, becase body can be non-JSON-parseable

      let json;

      if (err) {
        L2(
          `InternalOAuthError: Failed to fetch user profile -- ${safeJsonStringify(
            err
          )}`
        );

        if (err.data) {
          try {
            json = safeJsonStringify(err.data);
          } catch (_) {
            json = {};
          }
        }

        if (json && json.error && json.error_description) {
          return done(
            new Error(`UserInfoError: ${json.error_description}, ${json.error}`)
          );
        }
        return done(
          new Error(
            `InternalOAuthError: Failed to fetch user profile -- ${safeJsonStringify(
              err
            )}`
          )
        );
      }

      try {
        json = JSON.parse(body);
      } catch (ex) {
        try { // OAuth1 body, need base64-like decoding
            json = jwt_decode(body);
        }
        catch(ex){
            return done(new Error(`Failed to parse user profile -- ${body}`));
        }
      }

      const profile = parseOpenIdProfile(type, json);
      L2(`profile = ${safeJsonStringify(profile)}`);
      return done(null, profile);
    });
  };
}
