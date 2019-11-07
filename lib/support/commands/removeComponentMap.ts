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
import * as objectHash from "object-hash";
import { JiraConfig } from "../../jira";
import { getMappedComponentsbyChannel } from "../helpers/channelLookup";
import { getJiraDetails } from "../jiraDataLookup";
import { Component } from "../jiraDefs";
import {
    findRequiredProjects,
    lookupJiraProjectDetails,
} from "./getCurrentChannelMappings";
import {
    buildJiraHashKey,
    JiraHandlerParam,
    submitMappingPayload,
} from "./shared";

export async function removeComponentMapFromChannel(ci: CommandListenerInvocation<JiraHandlerParam>): Promise<HandlerResult> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    // Get linked component ids, project ids
    // Resolve ids to names
    // Present dropdown of components to remove
    // Remove and notify
    const components = await getMappedComponentsbyChannel(ci.context, ci.parameters.slackChannelName);
    logger.debug(`JIRA removeComponentMapFromChannel: components found for channel => ${JSON.stringify(components)}`);

    const projectsToLookup = await findRequiredProjects(components, []);
    const projectDetails = await lookupJiraProjectDetails(projectsToLookup, ci);

    const componentDetails: Option[] = [];

    components.forEach(c => {
        try {
            const thisProject = projectDetails.filter(p => p.id === c.projectId)[0];
            const thisComponent = thisProject.components.filter(comp => comp.id === c.componentId)[0];
            const display = `${thisProject.name}/${thisComponent.name}`;
            componentDetails.push({description: display, value: `${c.projectId}:${c.componentId}`});
        } catch {
            // You can end up here if a previously mapped project or component no longer exists
            logger.warn(`JIRA removeComponentMapFromChannel: Failed to find details for project ${c.projectId} and component ${c.componentId}`);
            return;
        }
    });

    const component = await ci.promptFor<{component: string}>({
           component: {
               description: "Please select a component mapping to remove",
               displayName: "Please select a component mapping to remove",
               type: {
                   kind: "single",
                   options: componentDetails,
               },
           },
    });

    try {
        await submitMappingPayload(
            ci,
            {
                channel: ci.parameters.slackChannelName,
                projectId: component.component.split(":")[0],
                componentId: component.component.split(":")[1],
            },
            false,
        );

        const compInfo =
            await getJiraDetails<Component>(
                `${jiraConfig.url}/rest/api/2/component/${component.component.split(":")[1]}`, undefined, undefined, ci);

        await ci.addressChannels(slackSuccessMessage(
            `Removed JIRA Component mapping successfully!`,
            `Removed mapping from Component *${compInfo.name}* to *${ci.parameters.slackChannelName}*`,
        ));

        return { code: 0 };
    } catch (e) {
        logger.error(`JIRA removeComponentMapFromChannel: Error removing component mapping => ${e}`);
        throw new Error(e);
    }
}

export const removeComponentMapFromChannelReg: CommandHandlerRegistration<JiraHandlerParam> = {
    name: "removeComponentMapFromChannel",
    paramsMaker: JiraHandlerParam,
    intent: "jira disable component map",
    listener: removeComponentMapFromChannel,
    autoSubmit: true,
};
