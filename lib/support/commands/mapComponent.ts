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
import { JiraConfig } from "../../jira";
import { getJiraDetails } from "../jiraDataLookup";
import { Component } from "../jiraDefs";
import {
    JiraHandlerParam,
    prepComponentSelect,
    prepProjectSelect,
    submitMappingPayload,
} from "./shared";

@Parameters()
class MapComponentToChannelParams extends JiraHandlerParam {
    @Parameter({
        displayName: "Please enter a search term to find your project",
        description: "Please enter a search term to find your project",
    })
    public projectSearch: string;
}

export async function mapComponentToChannel(ci: CommandListenerInvocation<MapComponentToChannelParams>): Promise<HandlerResult> {
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
    const projectValues = await prepProjectSelect(ci.parameters.projectSearch, ci);
    let project: { project: string };
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

    // Present list of components
    const componentValues = await prepComponentSelect(project.project, ci);
    let component: {component: string};
    if (componentValues) {
       component = await ci.promptFor<{component: string}>({
           component: {
               description: `Please select a component`,
               displayName: `Please select a component`,
               type: {
                   kind: "single",
                   options: componentValues,
               },
           },
       });
    } else {
        await ci.addressChannels(slackErrorMessage(
            `Error: No components found within project [${project.project}]`,
            `Please try this command again with a different project`,
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
                componentId: component.component,
            },
        );

        const componentDetails =
            await getJiraDetails<Component>(`${jiraConfig.url}/rest/api/2/component/${component.component}`, true, undefined, ci);

        await ci.addressChannels(slackSuccessMessage(
            `New JIRA Component mapping created successfully!`,
            `Added new mapping from Component *${componentDetails.name}* to *${ci.parameters.slackChannelName}*`,
        ), {
            ttl: 15000,
            id: `component_or_project_mapping-${ci.parameters.slackChannelName}`,
        });

        return {code: 0};
    } catch (e) {
        const msg = `JIRA mapComponentToChannel: Failed to create channel mapping! Error => ${e}`;
        logger.error(msg);
        throw new Error(msg);
    }
}

export const mapComponentToChannelReg: CommandHandlerRegistration<MapComponentToChannelParams> = {
    name: "mapComponentToChannel",
    paramsMaker: MapComponentToChannelParams,
    intent: "jira map component",
    listener: mapComponentToChannel,
    autoSubmit: true,
};
