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
    Failure,
    HandlerResult,
    logger,
    NoParameters,
    Success,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    CommandListenerInvocation,
    slackSuccessMessage,
} from "@atomist/sdm";
import {
    JiraCache,
    JiraCacheStats,
} from "./jiraCache";

/**
 * Flush Cache is used to complete delete the JIRA Cache.
 *
 * @returns {void}
 */
export async function flushCache(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        try {
            const cache = configurationValue<JiraCache>("sdm.jiraCache");
            cache.flushAll();
            logger.info(`JIRA flushCache: Successfully purged JIRA cache entries`);
            resolve();
        } catch (e) {
            logger.error(`JIRA flushCache: Failed to purge cache.  Error => ${e}`);
            reject(e);
        }
    });
}

/**
 * PurgeCacheEntry is used to purge individual items from the JIRA cache.
 *
 * @param {string} key name to purge
 * @returns {void}
 */
export async function purgeCacheEntry(key: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        try {
            const cache = configurationValue<JiraCache>("sdm.jiraCache");
            const deleted = cache.del(key);
            logger.info(`JIRA purgeCacheEntry: Successfully purged key ${key} from JIRA cache. Deleted ${deleted} entries`);
            resolve();
        } catch (e) {
            logger.error(`JIRA purgeCacheEntry: Failed to purge entry ${key}.  Error => ${e}`);
            reject(e);
        }
    });
}

/**
 * getStats returns the usage information from the JIRA cache
 */
export async function getStats(): Promise<JiraCacheStats> {
    return new Promise<JiraCacheStats>((resolve, reject) => {
        try {
            const cache = configurationValue<JiraCache>("sdm.jiraCache");
            resolve(cache.getStats());
        } catch (e) {
            logger.error(`JIRA getStats: Failed to retrieve JIRA cache stats.  Error => ${e}`);
            reject(e);
        }
    });
}

export const getJiraStatsHandler = async (cli: CommandListenerInvocation<NoParameters>): Promise<HandlerResult> => {
    try {
        const stats = await getStats();
        await cli.addressChannels(slackSuccessMessage(`JIRA Cache Status`, `Stats: ${JSON.stringify(stats)}`));
        return Success;
    } catch (e) {
        logger.error(`JIRA getJiraStatsHandler: Failed to retrieve stats. Error => ${e}`);
        return Failure;
    }
};

export const getJiraStats: CommandHandlerRegistration<NoParameters> = {
    name: "GetJiraStats",
    intent: "jira cache-stats",
    listener: getJiraStatsHandler,
};
