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
    GraphQL,
    logger,
    OnEvent,
    Success,
} from "@atomist/automation-client";
import { EventHandlerRegistration } from "@atomist/sdm";
import { JiraConfig } from "../jira";
import { purgeCacheEntry } from "../support/cache/manage";
import * as types from "../typings/types";

/**
 * This event handler is used to trigger cache purge events.  If the incoming event is a project change event (created, updated, or
 * deleted) this will cause the project endpoint to be purged from the cache.
 */
function onJiraIssueEventCacheHandler():
    OnEvent<types.OnJiraIssueEvent.Subscription> {
    return async e => {
        if (["project_created", "project_updated", "project_deleted"].includes(e.data.JiraIssue[0].webhookEvent)) {
            const jiraConfig = configurationValue<JiraConfig>("sdm.jira");
            logger.info(`JIRA onJiraIssueEventCacheHandler Flushing JIRA project cache, configuration changes have been made`);
            await purgeCacheEntry(`${jiraConfig.url}/rest/api/2/project`);
            logger.info(`JIRA onJiraIssueEventCacheHandler Successfully flushed project cache`);
        }
        return Success;
    };
}

export const onJiraIssueEventCache: EventHandlerRegistration<types.OnJiraIssueEvent.Subscription> = {
    name: "OnJiraIssueEventCache",
    subscription: GraphQL.subscription("OnJiraIssueEvent"),
    listener: onJiraIssueEventCacheHandler(),
};
