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

import { configurationValue } from "@atomist/automation-client";
import { JiraConfig } from "../jira";
import { getJiraDetails } from "./jiraDataLookup";
import * as jiraTypes from "./jiraDefs";

export async function convertEmailtoJiraUser(address: string): Promise<string> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    const res = await getJiraDetails<jiraTypes.User[]>(`${jiraConfig.url}/rest/api/2/user/search?username=${address}`);

    if (res.length > 0) {
        return res[0].key;
    } else {
        return undefined;
    }
}
