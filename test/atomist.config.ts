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

import {
    Configuration,
} from "@atomist/automation-client";
import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    configureSdm,
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";
import { onJiraIssueEventApproval } from "../lib/event/onJiraIssueEventApproval";
import { JiraApproval } from "../lib/goals/JiraApproval";
import { jiraSupport } from "../lib/jira";
import { getJiraStats } from "../lib/support/cache/manage";
import { jiraCacheProcessor } from "../lib/support/cache/postProcessor";
import { createBugIssueReg } from "../lib/support/commands/createBugIssue";
import {
    jiraCreateProjectBranchReg,
    jiraFindAndAssignReg,
} from "../lib/support/commands/findAndAssign";

export function machineMaker(config: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine(
        {
            name: `${configuration.name}-test`,
            configuration: config,
        },
    );

    sdm.addExtensionPacks(
        jiraSupport(),
    );
    sdm.addEvent(onJiraIssueEventApproval(JiraApproval));
    sdm.addCommand(getJiraStats);
    sdm.addCommand(createBugIssueReg);
    sdm.addCommand(jiraFindAndAssignReg);
    sdm.addCommand(jiraCreateProjectBranchReg);

    return sdm;
}

export const configuration: Configuration = {
    sdm: {
      // credentialsResolver: new ConfigurationBasedBasicCredentialsResolver(),
    },
    postProcessors: [
        configureSdm(machineMaker),
        jiraCacheProcessor,
    ],
};
