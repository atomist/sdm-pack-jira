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
    MappedParameter,
    MappedParameters,
    Parameters,
} from "@atomist/automation-client";
import { Option } from "@atomist/automation-client/lib/metadata/automationMetadata";
import {
    CommandHandlerRegistration,
    CommandListenerInvocation,
    slackErrorMessage,
} from "@atomist/sdm";
import * as slack from "@atomist/slack-messages";
import * as jira2slack from "jira2slack";
import { JiraConfig } from "../../jira";
import * as types from "../../typings/types";
import { getMappedComponentsbyChannel } from "../helpers/channelLookup";
import { getJiraDetails } from "../jiraDataLookup";
import { Project } from "../jiraDefs";
import { convertEmailtoJiraUser } from "../shared";
import {
    createJiraTicket,
    JiraHandlerParam,
} from "./shared";

@Parameters()
class JiraProjectLookup extends JiraHandlerParam {
    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;
}

export async function createBugIssue(ci: CommandListenerInvocation<JiraProjectLookup>): Promise<HandlerResult> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    const components = await getMappedComponentsbyChannel(ci.context, ci.parameters.slackChannelName);

    const componentOptions: Option[] = [];
    await Promise.all(
        components.map(async c => {
        // Get Search pattern for project lookup
        const lookupUrl = `${jiraConfig.url}/rest/api/2/project/${c.projectId}`;
        const project = await getJiraDetails<Project>(lookupUrl, true, 30, ci);
        const comp = project.components.filter(nc => nc.id === c.componentId)[0];
        componentOptions.push({description: `${project.name}/${comp.name}`, value: `${comp.id}:${project.id}`});
         }),
    );

    if (componentOptions.length === 0 ) {
        await ci.addressChannels(
            slackErrorMessage(
                `No components are linked to this channel!`,
                `Please link a component to this channel and try again`,
                ci.context,
            ),
        );
        return {code: 1, message: `No linked channels!`};
    } else {
        // Get current channel projects
        const scomp = await ci.promptFor<{ component: string }>({
            component: {
                description: `Please select a component`,
                displayName: `Please select a component`,
                type: {
                    kind: "single",
                    options: componentOptions,
                },
            },
        });

        // Get description
        const details = await ci.promptFor<{ description: string, summary: string }>({
            summary: {
                description: "Please enter Issue Summary",
                displayName: "Please enter Issue Summary",
                pattern: /[\s\S]*/,
                order: 1,
            },
            description: {
                description: "Please enter Issue Description",
                displayName: "Please enter Issue Description",
                pattern: /[\s\S]*/,
                order: 2,
            },
        });

        // We've got all the data, create issue
        let data: any;
        try {
            data = {
                description: jira2slack.toJira(details.description),
                project: {
                    id: scomp.component.split(":")[1],
                },
                components: [
                    {
                        id: scomp.component.split(":")[0],
                    },
                ],
                summary: details.summary,
                issuetype: {
                    name: "Bug",
                },
            };

            // Lookup requester
            let realRequester: string;
            const requester = await ci.context.graphClient.query<types.GetEmailByChatId.Query, types.GetEmailByChatId.Variables>({
                name: "GetEmailByChatId",
                variables: {screenName: ci.parameters.screenName},
            });

            if (requester &&
                requester.hasOwnProperty("ChatId") &&
                requester.ChatId.length > 0 &&
                requester.ChatId[0].person.emails.length > 0
            ) {
                // Try to find requester
                await Promise.all(requester.ChatId[0].person.emails.map(async e => {
                    const res = await convertEmailtoJiraUser(e.address);
                    if (res) {
                        realRequester = res;
                    }
                }));
            }

            if (realRequester) {
                data = {
                    ...data,
                    ...{
                        reporter: {
                            name: realRequester,
                        },
                    },
                };
            }
        } catch (e) {
            logger.error(e);
            await ci.addressChannels(
                slackErrorMessage(
                    `Error Creating JIRA Bug Issue`,
                    `Failed to lookup JIRA requester data; error => ${e}`,
                    ci.context,
                ), {
                    ttl: 60 * 1000,
                    id: `createJiraIssue-${ci.parameters.screenName}`,
                });
            return {code: 1, message: e};
        }

        // Submit new issue
        try {
            const res = await createJiraTicket({fields: data}, ci);
            await ci.addressChannels(`Created new JIRA Bug issue successfully!` +
                `Link: ${slack.url(jiraConfig.url + `/browse/` + res.key, res.key)}`, {
                ttl: 60 * 1000,
                id: `createJiraIssue-${ci.parameters.screenName}`,
            });
            return {code: 0};
        } catch (e) {
            logger.error(e);
            await ci.addressChannels(
                slackErrorMessage(
                    `Error Creating JIRA Bug Issue`,
                    `Failed to create JIRA issue; error => ${e}`,
                    ci.context,
                ), {
                    ttl: 60 * 1000,
                    id: `createJiraIssue-${ci.parameters.screenName}`,
                });
            return {
                code: 1,
                message: e,
            };
        }
    }
}

export const createBugIssueReg: CommandHandlerRegistration<JiraProjectLookup> = {
    name: "CreateBugIssue",
    paramsMaker: JiraProjectLookup,
    intent: "jira file bug",
    listener: createBugIssue,
    autoSubmit: true,
};
