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
    HandlerContext,
    logger,
} from "@atomist/automation-client";
import { PreferenceStoreFactory } from "@atomist/sdm";
import {
    buildJiraHashKey,
    JiraMapping,
} from "../commands/shared";
import { JiraCache } from "./jiraCache";

export interface JiraPreference {
    channel: string;
    issueComment: boolean;
    issueDeleted: boolean;
    issueCreated: boolean;
    issueState: boolean;
    issueStatus: boolean;
    bug: boolean;
    task: boolean;
    epic: boolean;
    story: boolean;
    subtask: boolean;
}

/**
 * Lookup JiraPreferences for the supplied channel
 * @param {HandlerContext} ctx
 * @param {string} channel
 * @returns {JiraPreference}
 */
export async function cachedJiraPreferenceLookup(
    ctx: HandlerContext,
    channel: string,
): Promise<JiraPreference> {
    const enable = configurationValue<boolean>("sdm.jira.useCache", false);
    const hashKey = `${ctx.workspaceId}-preferences-${channel}`;

    return new Promise<JiraPreference>( async (resolve, reject) => {
        const jiraCache = configurationValue<JiraCache>("sdm.jiraCache");
        const result = jiraCache.get<JiraPreference>(hashKey);

        if (result !== undefined && enable) {
            logger.debug(`JIRA cachedJiraPreferenceLookup => ${hashKey}: Cache-hit, re-using value...`);
            resolve(result);
        } else {
            logger.debug(`JIRA cachedJiraPreferenceLookup => ${hashKey}: Cache ${enable ? "miss" : "disabled"}, querying...`);
            const prefStore = configurationValue<PreferenceStoreFactory>("sdm.preferenceStoreFactory")(ctx);
            const preferences = await prefStore.get<JiraPreference>(hashKey, {scope: "JIRAPreferences"});
            if (enable) {
                jiraCache.set(hashKey, preferences);
            }
            resolve(preferences);
        }
    });
}

interface JiraMappingLookupSearch {
    projectId?: string;
    componentId?: string;
    channel?: string;
}

/**
 * Query for JIRA Mappings using cache if available
 * @param {HandlerContext} ctx
 * @param {JiraMappingLookupSearch} search
 * @returns {JiraMapping[]}
 */
export async function cachedJiraMappingLookup(
    ctx: HandlerContext,
    search?: JiraMappingLookupSearch,
): Promise<JiraMapping[]> {
    const hashKey = buildJiraHashKey(ctx.workspaceId, {projectId: search.projectId, componentId: search.componentId, channel: search.channel});
    const enable = configurationValue<boolean>("sdm.jira.useCache", false);
    return new Promise<JiraMapping[]>(async (resolve, reject) => {
        const jiraCache = configurationValue<JiraCache>("sdm.jiraCache");
        const result = jiraCache.get<JiraMapping[]>(hashKey);

        if (result !== undefined && enable) {
            logger.debug(`JIRA cachedJiraMappingLookup => ${hashKey}: Cache hit, re-using value...`);
            resolve(result);
        } else {
            logger.debug(`JIRA cachedJiraMappingLookup => ${hashKey}: Cache ${enable ? "miss" : "disabled"}, querying...`);
            const mappings = configurationValue<PreferenceStoreFactory>("sdm.preferenceStoreFactory")(ctx);
            const allMaps = await mappings.list<JiraMapping>("JIRAMappings");

            const filteredMaps = allMaps.filter(m =>
                    (search.projectId   ? m.value.projectId   === search.projectId   : true) &&
                    (search.componentId ? m.value.componentId === search.componentId : true) &&
                    (search.channel     ? m.value.channel     === search.channel     : true),
            ).map(a => a.value);
            if (enable) {
                jiraCache.set(hashKey, filteredMaps);
            }
            resolve(filteredMaps);
        }
    });
}
