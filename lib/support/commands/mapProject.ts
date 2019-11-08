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
    Parameter,
    Parameters,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    CommandListenerInvocation,
    slackErrorMessage,
    slackSuccessMessage,
} from "@atomist/sdm";
import objectHash = require("object-hash");
import { JiraConfig } from "../../jira";
import { getJiraDetails } from "../jiraDataLookup";
import { Project } from "../jiraDefs";
import {
    JiraHandlerParam,
    prepProjectSelect,
    submitMappingPayload,
} from "./shared";

@Parameters()
class MapProjectToChannelParams extends JiraHandlerParam {
    @Parameter({
        displayName: "Please enter a search term to find your project",
        description: "Please enter a search term to find your project",
    })
    public projectSearch: string;
}

async function mapProjectToChannel(ci: CommandListenerInvocation<MapProjectToChannelParams>): Promise<HandlerResult> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;

    if (ci.parameters.slackChannel === ci.parameters.slackChannelName) {
        await ci.addressChannels(slackErrorMessage(
            `Cannot Setup Mapping to Individual Account`,
            `You cannot setup a jira mapping to your own user, must setup mappings to channels only.`,
            ci.context,
        ));
        return {code: 0};
    }

    // Present list of projects
    let project: { project: string };
    const projectValues = await prepProjectSelect(ci.parameters.projectSearch, ci);
    if (projectValues) {
         project = await ci.promptFor<{ project: string }>({
            project: {
                displayName: `Please select a project`,
                description: `Please select a project`,
                type: {
                    kind: "single",
                    options: projectValues,
                },
            },
        });
    } else {
        await ci.addressChannels(slackErrorMessage(
            `Error: No projects found with search term [${ci.parameters.projectSearch}]`,
            `Please try this command again`,
            ci.context,
        ));
        return {code: 0};
    }

    try {
        await submitMappingPayload(
            ci,
            {
                channel: ci.parameters.slackChannelName,
                projectId: project.project,
            },
        );

        const projectDetails =
            await getJiraDetails<Project>(`${jiraConfig.url}/rest/api/2/project/${project.project}`, true, undefined, ci);
        const subject = `New JIRA Project mapping created successfully!`;
        const message = `Added new mapping from Project *${projectDetails.name}* to *${ci.parameters.slackChannelName}*`;

        await ci.addressChannels(slackSuccessMessage(
            subject,
            message,
        ));

        return { code: 0 };
    } catch (error) {
        logger.error(`JIRA mapProjectToChannel: Error completing command => ${error}`);
        return {
            code: 1,
            message: error,
        };
    }
}

export const mapProjectToChannelReg: CommandHandlerRegistration<MapProjectToChannelParams> = {
    name: "MapProjectToChannelPrompt",
    paramsMaker: MapProjectToChannelParams,
    intent: "jira map project",
    listener: mapProjectToChannel,
    autoSubmit: true,
};
