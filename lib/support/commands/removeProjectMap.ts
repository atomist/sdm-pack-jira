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
    configurationValue,
    HandlerResult,
    logger,
} from "@atomist/automation-client";
import { Option } from "@atomist/automation-client/lib/metadata/automationMetadata";
import {
    CommandHandlerRegistration,
    CommandListenerInvocation,
    slackSuccessMessage,
} from "@atomist/sdm";
import { JiraConfig } from "../../jira";
import { getMappedProjectsbyChannel } from "../helpers/channelLookup";
import { getJiraDetails } from "../jiraDataLookup";
import { Project } from "../jiraDefs";
import { lookupJiraProjectDetails } from "./getCurrentChannelMappings";
import {
    JiraHandlerParam,
    submitMappingPayload,
} from "./shared";

export async function removeProjectMapFromChannel(ci: CommandListenerInvocation<JiraHandlerParam>): Promise<HandlerResult> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;

    // Get current channel projects
    const projects = await getMappedProjectsbyChannel(ci.context, ci.parameters.slackChannelName);
    const projectDetails = await lookupJiraProjectDetails(projects, ci);

    const projectValues: Option[] = [];

    projectDetails.forEach(p => {
        projectValues.push({description: p.name, value: p.id});
    });

    const project = await ci.promptFor<{ project: string }>({
        project: {
            displayName: `Please select a project`,
            description: `Please select a project`,
            type: {
                kind: "single",
                options: projectValues,
            },
        },
    });

    try {
        await submitMappingPayload(
            ci,
            {
                channel: ci.parameters.slackChannelName,
                projectId: project.project,
            },
            false,
        );

        const projectDetail =
            await getJiraDetails<Project>(`${jiraConfig.url}/rest/api/2/project/${project.project}`, true, undefined, ci);
        const subject = `JIRA Project mapping removed successfully!`;
        const message = `Removed mapping from Project *${projectDetail.name}* to *${ci.parameters.slackChannelName}*`;

        await ci.addressChannels(slackSuccessMessage(
            subject,
            message,
        ));

        return { code: 0 };
    } catch (error) {
        logger.error(`JIRA removeProjectMapFromChannel: Error completing command => ${error}`);
        throw new Error(error);
    }
}

export const removeProjectMapFromChannelReg: CommandHandlerRegistration<JiraHandlerParam> = {
    name: "removeProjectMapFromChannel",
    paramsMaker: JiraHandlerParam,
    intent: "jira disable project map",
    listener: removeProjectMapFromChannel,
    autoSubmit: true,
};
