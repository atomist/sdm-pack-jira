import { GraphQL } from "@atomist/automation-client";
import { ExtensionPack, metadata } from "@atomist/sdm";
import { onJiraIssueEvent } from "./event/onJiraIssueEvent";

export const jiraSupport = (): ExtensionPack => {
    return {
        ...metadata(),
        requiredConfigurationValues: [
        ],
        configure: sdm => {
            sdm.addIngester(GraphQL.ingester({
                name: "jiraIssue",
            }));
            sdm.addEvent(onJiraIssueEvent());

            return sdm;
        },
    };
};

export interface JiraConfig {
    url: string;
    vcstype: string;
    user: string;
    password: string;
}