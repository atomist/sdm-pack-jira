/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Configuration } from "@atomist/automation-client";
import {
    flushCache,
    getStats,
} from "./manage";

export const jiraCacheProcessor = async (config: Configuration) => {
    config.http.customizers.push(
        c => {
            c.get("/jiracache", async (req, res) => {
                res.send(await getStats());
            });

            c.post("/jiracache/purge", async (req, res) => {
                if (req.body.hasOwnProperty("auth")) {
                    try {
                        if (req.body.auth === config.apiKey) {
                            await flushCache();
                            res.send({success: true});
                        }
                    } catch (e) {
                        res.send({success: false, error: e});
                    }
                } else {
                    res.send({success: false, error: "Must supply authentication (API Key for this SDM)"});
                }
            });
        },
    );

    return config;
};
