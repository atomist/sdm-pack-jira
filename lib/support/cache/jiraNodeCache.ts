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

import NodeCache = require("node-cache");
import {
    JiraCache,
    JiraCacheStats,
} from "./jiraCache";

export class JiraNodeCache implements JiraCache {
    private readonly cache: NodeCache;
    constructor(options: NodeCache.Options) {
        this.cache = new NodeCache(options);
    }

    public get<T>(key: string | number): T | undefined {
        return this.cache.get(key);
    }

    public set<T>(key: string | number, value: T, ttl?: number | string): boolean {
        return this.cache.set(key, value, ttl);
    }

    public del(key: string | number): number {
        return this.cache.del(key);
    }

    public flushAll(): void {
        return this.cache.flushAll();
    }

    public getStats(): JiraCacheStats {
        return this.cache.getStats();
    }

}
