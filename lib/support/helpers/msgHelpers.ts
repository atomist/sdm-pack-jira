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
    logger,
} from "@atomist/automation-client";
import * as slack from "@atomist/slack-messages";
import jira2slack = require("jira2slack");
import { JiraConfig } from "../../jira";
import { OnJiraIssueEvent } from "../../typings/types";
import { getJiraDetails } from "../jiraDataLookup";
import * as jiraTypes from "../jiraDefs";

export const upperCaseFirstLetter = (word: string): string => {
    return word.charAt(0).toUpperCase() + word.slice(1);
};

export const prepareIssueCommentedMessage = async (
    event: OnJiraIssueEvent.JiraIssue,
    issueDetail: jiraTypes.Issue,
): Promise<slack.Attachment[]> => {
    if (
        event.issue &&
        event.issue.hasOwnProperty("self") &&
        event.issue.self &&
        event.hasOwnProperty("comment") &&
        event.comment !== null &&
        event.comment.self !== null
    ) {
        const comment = await getJiraDetails<jiraTypes.Comment>(event.comment.self, true, 30);
        const title = event.issue_event_type_name === "issue_comment_edited" ? `New Comment (edited)` : `New Comment`;
        return [
            {
                pretext: slack.bold(title),
                color: "#45B254",
                author_name: `@${comment.author.name}`,
                author_icon: comment.author.avatarUrls["48x48"],
                fallback: `New comment on issue ${issueDetail.key} by ${comment.author.name}`,
                text: jira2slack.toSlack(comment.body),
            },
        ];
    } else {
        return [];
    }
};

export const prepareStateChangeMessage = async (
    event: OnJiraIssueEvent.JiraIssue,
): Promise<slack.Attachment[]> => {
    if (
        event.hasOwnProperty("changelog") &&
        event.changelog !== null &&
        event.webhookEvent !== "jira:issue_created"
    ) {
        const fields: slack.Field[] = [];
        event.changelog.items.forEach(c => {
            if (c.field === "description") {
                fields.push(
                    {
                        title: `Description Updated`,
                        value: jira2slack.toSlack(c.toString),
                        short: false,
                    },
                );
            } else if (c.field === "Component") {
                if (c.toString === null) {
                    fields.push({
                        title: `Component: [${c.fromString}]`,
                        value: `\u{274C} Removed`,
                        short: true,
                    });
                } else {
                    fields.push({
                        title: `Component: [${c.toString}]`,
                        value: `\u{2705} Added`,
                        short: true,
                    });
                }
            } else {
                fields.push(
                    {
                        title: `${upperCaseFirstLetter(c.field)} Change`,
                        value: `${c.fromString !== null ? c.fromString : "Not set"} => ${c.toString !== null ? c.toString : "Not set"}`,
                        short: true,
                    },
                );
            }
        });

        return [{
            fallback: `New state change on issue ${event.issue.key}`,
            fields,
        }];
    } else {
        return [];
    }
};

export const prepareIssueDeletedMessage = async (
    event: OnJiraIssueEvent.JiraIssue): Promise<slack.Attachment[]> => {
    if (event.webhookEvent === "jira:issue_deleted") {
        const userDetail = await getJiraDetails<jiraTypes.User>(event.user.self, true);
        return [
            {
                color: "#45B254",
                author_name: `@${userDetail.name}`,
                author_icon: userDetail.avatarUrls["48x48"],
                fallback: `Issue deleted ${event.issue.key} by ${userDetail.name}`,
            },
        ];
    } else {
        return [];
    }

};

export const prepareNewIssueMessage = async (
    webHookEvent: string,
    issueDetail: jiraTypes.Issue,
): Promise<slack.Attachment[]> => {

    if (webHookEvent === "jira:issue_created") {
        return [
            {
                color: "#45B254",
                author_name: `@${issueDetail.fields.reporter.name}`,
                author_icon: issueDetail.fields.reporter.avatarUrls["48x48"],
                fallback: `New issue ${issueDetail.key} by ${issueDetail.fields.reporter.name}`,
                fields: [
                    {
                        title: "Issue Type",
                        value: issueDetail.fields.issuetype.name,
                        short: true,
                    },
                    {
                        title: "Priority",
                        value: issueDetail.fields.priority.name,
                        short: true,
                    },
                    {
                        title: "Assignee",
                        value: issueDetail.fields.assignee !== null ?
                            `\u{1F464} ${issueDetail.fields.assignee.name}` :
                            `\u{1F464} Unassigned`,
                        short: true,
                    },
                    {
                        title: "Components",
                        value: issueDetail.fields.components.map(c => c.name).join(","),
                        short: true,
                    },
                    {
                        title: "Reporter",
                        value: issueDetail.fields.reporter.name,
                        short: true,
                    },
                    {
                        title: "Status",
                        value: issueDetail.fields.status.name,
                        short: true,
                    },
                    {
                        title: "Description",
                        value: `${issueDetail.fields.description ? jira2slack.toSlack(issueDetail.fields.description) : ""}`,
                    },
                ],
            },
        ];
    } else {
        return [];
    }
};

export function buildJiraFooter(issueDetail: jiraTypes.Issue): string {
    return jiraSlackFooter(
    issueDetail && issueDetail.hasOwnProperty("fields") ? issueDetail.fields.project.name : undefined,
    issueDetail && issueDetail.hasOwnProperty("fields") ? issueDetail.fields.project.key : undefined,
    issueDetail && issueDetail.hasOwnProperty("fields") ? issueDetail.fields.labels : undefined,
    issueDetail && issueDetail.hasOwnProperty("fields") ? issueDetail.fields.issuetype.name : undefined,
    issueDetail
        && issueDetail.hasOwnProperty("fields")
        && issueDetail.fields.hasOwnProperty("assignee")
        && issueDetail.fields.assignee ? issueDetail.fields.assignee.name : "Unassigned",
    issueDetail && issueDetail.hasOwnProperty("fields") ? issueDetail.fields.priority.name : undefined,
    issueDetail && issueDetail.hasOwnProperty("fields") ? issueDetail.fields.status.name : undefined,
    );
}

function jiraSlackFooter(
    projectName: string,
    projectKey: string,
    labels: string[],
    type?: string,
    assignee?: string,
    priority?: string,
    status?: string,
): string {
    const jiraConfig = configurationValue<JiraConfig>("sdm.jira");
    let footer = "JIRA ";
    footer += slack.url(`${jiraConfig.url}/projects/${projectKey}`, ` / ${projectName.toUpperCase()}`);
    if (type) {
        footer += ` / ${type}`;
    }
    if (priority) {
        footer += ` / ${priority}`;
    }
    if (status) {
        footer += ` / ${status}`;
    }
    if (assignee) {
        footer += " / " + `\u{1F464} ${assignee}`;
    }

    // Labels
    logger.debug(`JIRA jiraSlackFooter: Labels found => ${JSON.stringify(labels)}`);
    if (labels !== undefined && labels.length > 0) {
        footer += " - " + labels.map(l => `\u{1F3F7} ${l}`).join(" ");
    }
    return footer;
}
