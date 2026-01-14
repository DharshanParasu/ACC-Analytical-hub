import apsService from './apsService';

/**
 * Analytics Service for extracting and aggregating data from the APS Viewer
 */
class AnalyticsService {
    /**
     * Extracts all properties from the model using a multi-layered approach:
     * 1. AEC Data Model (GraphQL) - Direct cloud-to-cloud BIM data
     * 2. Viewer PDB enumAttributes - Standard viewer-side DB scan
     * 3. Viewer getBulkProperties Deep Scan - Last resort sample scan
     * 4. Direct Element Sampling - Ultimate fallback
     */
    async getModelPropertyNames(viewer) {
        if (!viewer || !viewer.model) {
            console.warn('[Analytics] Discovery failed: No viewer or model.');
            return [];
        }

        console.log('[Analytics] Starting ultra-robust property discovery...');

        // Layer 1: AEC Data Model
        try {
            const urn = viewer.model.getData().urn;
            let base64Urn = urn.replace(/-/g, '+').replace(/_/g, '/');
            while (base64Urn.length % 4 !== 0) base64Urn += '=';
            const decodedUrn = atob(base64Urn);
            const versionId = decodedUrn.split('?')[0];

            if (versionId.startsWith('urn:adsk.wipprod:fs.file:vf.') || versionId.startsWith('urn:adsk.wipprod:dm.lineage:')) {
                console.log('[Analytics] Layer 1: AEC Data Model query...');
                const aecProps = await this.getModelPropertyNamesAEC(versionId);
                if (aecProps && aecProps.length > 0) {
                    console.log('[Analytics] Success: AEC Data Model return', aecProps.length, 'props');
                    return aecProps;
                }
            }
        } catch (e) {
            console.warn('[Analytics] AEC Data Model layer skipped:', e.message);
        }

        // Layer 2 & 3: Race or Sequential Fallback
        console.log('[Analytics] Layer 2: Starting PDB Scan...');
        const pdbProps = await this.fetchPropertiesFromPDB(viewer, 45000);
        if (pdbProps && pdbProps.length > 0) return pdbProps;

        console.log('[Analytics] Layer 3: PDB failed, trying Deep Scan fallback...');
        const deepProps = await this.fetchPropertiesDeepScan(viewer);
        if (deepProps && deepProps.length > 0) return deepProps;

        // Last Resort: Sample a few arbitrary dbIds
        console.log('[Analytics] Layer 4: Final attempt - direct sampling...');
        return await this.samplePropertiesDirectly(viewer);
    }

    async fetchPropertiesFromPDB(viewer, timeoutMs = 30000) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('[Analytics] PDB Scan Timed Out');
                resolve([]);
            }, timeoutMs);

            const model = viewer.model;
            if (!model) return resolve([]);

            const executePdbScan = () => {
                try {
                    const pdb = model.getPropertyDb();
                    if (!pdb) {
                        console.warn('[Analytics] PDB object missing from model.');
                        return resolve([]);
                    }

                    // executeUserFunction automatically queues the function if the DB is not yet loaded
                    pdb.executeUserFunction(function (pdbInside) {
                        const propertyNames = new Set();
                        pdbInside.enumAttributes(function (attrId, attrDef) {
                            propertyNames.add(attrDef.name);
                        });
                        return Array.from(propertyNames).sort();
                    }, (result) => {
                        clearTimeout(timeout);
                        console.log('[Analytics] PDB Scan Success:', result?.length || 0, 'props');
                        resolve(result || []);
                    }, (err) => {
                        clearTimeout(timeout);
                        console.warn('[Analytics] PDB Execution Failed:', err);
                        resolve([]);
                    });
                } catch (e) {
                    clearTimeout(timeout);
                    console.error('[Analytics] PDB Access Error:', e);
                    resolve([]);
                }
            };

            // Start scan immediately - it will queue if necessary
            executePdbScan();
        });
    }

    async fetchPropertiesDeepScan(viewer) {
        return new Promise((resolve) => {
            if (!viewer || !viewer.model) return resolve([]);

            const tree = viewer.model.getInstanceTree();
            if (tree) {
                const rootId = tree.getRootId();
                const leafIds = [];
                tree.enumNodeChildren(rootId, (dbId) => {
                    if (tree.getChildCount(dbId) === 0 && leafIds.length < 100) {
                        leafIds.push(dbId);
                    }
                }, true);

                if (leafIds.length > 0) {
                    console.log('[Analytics] Deep Scan sampling', leafIds.length, 'nodes');
                    viewer.model.getBulkProperties(leafIds, {}, (results) => {
                        const names = new Set();
                        results.forEach(res => {
                            if (res.properties) {
                                res.properties.forEach(p => names.add(p.displayName));
                            }
                        });
                        resolve(Array.from(names).sort());
                    }, () => resolve([]));
                } else {
                    resolve([]);
                }
            } else {
                resolve([]);
            }
        });
    }

    async samplePropertiesDirectly(viewer) {
        return new Promise((resolve) => {
            // Try common IDs if tree isn't ready
            const sampleIds = [1, 2, 3, 4, 5, 10, 20, 50, 100, 200, 500];
            viewer.model.getBulkProperties(sampleIds, {}, (results) => {
                const names = new Set();
                results.forEach(res => {
                    if (res.properties) {
                        res.properties.forEach(p => names.add(p.displayName));
                    }
                });
                const final = Array.from(names).sort();
                console.log('[Analytics] Direct sample found', final.length, 'props');
                resolve(final);
            }, () => resolve([]));
        });
    }

    async getModelPropertyNamesAEC(versionId) {
        const query = `
            query GetAECProperties($id: ID!) {
                designVersion(id: $id) {
                    propertyDefinitions(pagination: {limit: 500}) {
                        results { name }
                    }
                    elementGroups {
                        results {
                            propertyDefinitions(pagination: {limit: 500}) {
                                results { name }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const result = await apsService.queryAECDataModel(query, { id: versionId });
            const propertyNames = new Set();
            const dv = result.data?.designVersion;

            if (dv) {
                if (dv.propertyDefinitions?.results) {
                    dv.propertyDefinitions.results.forEach(p => propertyNames.add(p.name));
                }
                if (dv.elementGroups?.results) {
                    dv.elementGroups.results.forEach(eg => {
                        if (eg.propertyDefinitions?.results) {
                            eg.propertyDefinitions.results.forEach(p => propertyNames.add(p.name));
                        }
                    });
                }
            }

            // Fallback for direct elementGroup query
            if (propertyNames.size === 0) {
                const egQuery = `
                    query GetEGProps($id: ID!) {
                        elementGroup(id: $id) {
                            propertyDefinitions { results { name } }
                        }
                    }
                `;
                const egRes = await apsService.queryAECDataModel(egQuery, { id: versionId });
                if (egRes.data?.elementGroup?.propertyDefinitions?.results) {
                    egRes.data.elementGroup.propertyDefinitions.results.forEach(p => propertyNames.add(p.name));
                }
            }

            return Array.from(propertyNames).sort();
        } catch (err) {
            console.error('[Analytics] AEC DM Query failed:', err);
            return [];
        }
    }

    /**
     * Aggregates model data by a specific property, optionally filtered by conditions
     */
    async aggregateByProperty(viewer, propertyName, conditions = [], logicalOperator = 'AND', sumProperty = null, scopeDbIds = null) {
        return new Promise((resolve) => {
            if (!viewer || !viewer.model) return resolve({});

            const executeAggregation = () => {
                let targetDbIds = [];

                if (scopeDbIds && scopeDbIds.length > 0) {
                    targetDbIds = scopeDbIds;
                } else {
                    const instanceTree = viewer.model.getInstanceTree();
                    if (!instanceTree) return resolve({});

                    instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                        if (instanceTree.getChildCount(dbId) === 0) {
                            targetDbIds.push(dbId);
                        }
                    }, true);
                }

                const attrsToFetch = [propertyName, ...conditions.map(c => c.attribute)];
                if (sumProperty) attrsToFetch.push(sumProperty);
                const uniqueAttrs = Array.from(new Set(attrsToFetch));

                viewer.model.getBulkProperties(targetDbIds, uniqueAttrs, (results) => {
                    const aggregation = {};
                    if (!results) return resolve({});

                    results.forEach(res => {
                        let passed = true;
                        if (conditions.length > 0) {
                            const conditionResults = conditions.map(condition => {
                                const prop = res.properties.find(p => p.displayName === condition.attribute);
                                const val = prop ? String(prop.displayValue) : 'Undefined';

                                switch (condition.operator) {
                                    case 'equals': return val === condition.value;
                                    case 'contains': return val.toLowerCase().includes(condition.value.toLowerCase());
                                    case 'not_equals': return val !== condition.value;
                                    default: return true;
                                }
                            });
                            passed = logicalOperator === 'OR' ? conditionResults.some(r => r === true) : conditionResults.every(r => r === true);
                        }

                        if (passed) {
                            const targetProp = res.properties.find(p => p.displayName === propertyName);
                            if (targetProp) {
                                const value = targetProp.displayValue;
                                if (!aggregation[value]) {
                                    aggregation[value] = { dbIds: [], sum: 0, count: 0 };
                                }
                                aggregation[value].dbIds.push(res.dbId);
                                aggregation[value].count++;

                                if (sumProperty) {
                                    const valProp = res.properties.find(p => p.displayName === sumProperty);
                                    if (valProp && !isNaN(parseFloat(valProp.displayValue))) {
                                        aggregation[value].sum += parseFloat(valProp.displayValue);
                                    }
                                }
                            }
                        }
                    });

                    resolve(aggregation);
                }, (err) => {
                    console.error("[Analytics] Bulk properties failed", err);
                    resolve({});
                });
            };

            // executeUserFunction will queue if needed, but for bulk properties we just check model state
            if (viewer.model && viewer.model.getPropertyDb()) {
                executeAggregation();
            } else {
                console.warn('[Analytics] Waiting for Property DB...');
                setTimeout(executeAggregation, 2000);
            }
        });
    }

    async aggregateByMultipleProperties(viewer, propertyNames = [], conditions = [], logicalOperator = 'AND', scopeDbIds = null) {
        return new Promise((resolve) => {
            if (!viewer || !viewer.model || propertyNames.length === 0) return resolve({});

            const executeAggregation = () => {
                let targetDbIds = [];
                if (scopeDbIds && scopeDbIds.length > 0) {
                    targetDbIds = scopeDbIds;
                } else {
                    const instanceTree = viewer.model.getInstanceTree();
                    if (!instanceTree) return resolve({});
                    instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                        if (instanceTree.getChildCount(dbId) === 0) {
                            targetDbIds.push(dbId);
                        }
                    }, true);
                }

                const attrsToFetch = [...propertyNames, ...conditions.map(c => c.attribute)];
                const uniqueAttrs = Array.from(new Set(attrsToFetch));

                viewer.model.getBulkProperties(targetDbIds, uniqueAttrs, (results) => {
                    const aggregation = {};
                    results.forEach(res => {
                        let passed = true;
                        if (conditions.length > 0) {
                            const conditionResults = conditions.map(condition => {
                                const prop = res.properties.find(p => p.displayName === condition.attribute);
                                const val = prop ? String(prop.displayValue) : 'Undefined';
                                switch (condition.operator) {
                                    case 'equals': return val === condition.value;
                                    case 'contains': return val.toLowerCase().includes(condition.value.toLowerCase());
                                    case 'not_equals': return val !== condition.value;
                                    default: return true;
                                }
                            });
                            passed = logicalOperator === 'OR' ? conditionResults.some(r => r) : conditionResults.every(r => r);
                        }

                        if (passed) {
                            const values = propertyNames.map(name => {
                                const prop = res.properties.find(p => p.displayName === name);
                                return prop ? prop.displayValue : 'Undefined';
                            });
                            const key = JSON.stringify(values);
                            if (!aggregation[key]) aggregation[key] = [];
                            aggregation[key].push(res.dbId);
                        }
                    });
                    resolve(aggregation);
                }, () => resolve({}));
            };

            if (viewer.model && viewer.model.getPropertyDb()) {
                executeAggregation();
            } else {
                setTimeout(executeAggregation, 2000);
            }
        });
    }

    getTableData(aggregation, propertyNames) {
        return Object.keys(aggregation).map(key => {
            const values = JSON.parse(key);
            const rowData = {};
            propertyNames.forEach((name, i) => {
                rowData[name] = values[i];
            });
            return { ...rowData, count: aggregation[key].length, dbIds: aggregation[key] };
        });
    }

    getChartData(aggregation, propertyName, label = 'Count', type = 'bar', aggregationType = 'count') {
        const labels = Object.keys(aggregation);
        const useSum = aggregationType === 'sum' && labels.length > 0 && aggregation[labels[0]].sum !== undefined;
        const data = labels.map(key => useSum ? aggregation[key].sum : (aggregation[key].dbIds?.length || aggregation[key].length || 0));

        const colors = [
            '#1db954', '#2e77d0', '#8b5cf6', '#ec4899', '#f59e0b',
            '#10b981', '#3b82f6', '#6366f1', '#a855f7', '#d946ef',
            '#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4',
            '#14b8a6', '#f43f5e', '#8b5cf6', '#facc15', '#64748b'
        ];

        return {
            labels,
            datasets: [{
                label: useSum ? 'Total' : 'Count',
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: type === 'pie' ? 2 : 1
            }]
        };
    }

    async searchElements(viewer, filters) {
        return new Promise((resolve) => {
            if (!viewer || !viewer.model || !filters || filters.length === 0) return resolve([]);
            const instanceTree = viewer.model.getInstanceTree();
            if (!instanceTree) return resolve([]);

            const allDbIds = [];
            instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                if (instanceTree.getChildCount(dbId) === 0) allDbIds.push(dbId);
            }, true);

            viewer.model.getBulkProperties(allDbIds, [], (results) => {
                const matchedDbIds = [];
                results.forEach(res => {
                    let passed = filters.every(filter => {
                        const targetAttr = filter.attribute.toLowerCase();
                        const targetValue = String(filter.value).toLowerCase();
                        const foundProp = res.properties.find(p => {
                            const pName = p.displayName.toLowerCase();
                            const isNameMatch = pName === targetAttr || pName.includes(targetAttr) || (targetAttr === 'category' && (pName.includes('category') || pName === 'type'));
                            if (!isNameMatch) return false;
                            const pValue = String(p.displayValue).toLowerCase();
                            if (filter.operator === 'contains') return pValue.includes(targetValue);
                            if (filter.operator === 'not_equals') return pValue !== targetValue;
                            return pValue === targetValue || pValue.includes(targetValue);
                        });
                        return !!foundProp;
                    });
                    if (passed) matchedDbIds.push(res.dbId);
                });
                resolve(matchedDbIds);
            }, (err) => resolve([]));
        });
    }

    async getUniquePropertyValues(viewer, propertyName) {
        return new Promise((resolve) => {
            if (!viewer || !viewer.model) return resolve([]);
            const executeDiscovery = () => {
                const instanceTree = viewer.model.getInstanceTree();
                if (!instanceTree) return resolve([]);

                const allDbIds = [];
                instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                    if (instanceTree.getChildCount(dbId) === 0) allDbIds.push(dbId);
                }, true);

                viewer.model.getBulkProperties(allDbIds, [propertyName], (results) => {
                    const values = new Set();
                    results.forEach(res => {
                        const prop = res.properties.find(p => p.displayName === propertyName);
                        if (prop) values.add(String(prop.displayValue));
                    });
                    resolve(Array.from(values).sort());
                }, (err) => resolve([]));
            };

            if (viewer.model && viewer.model.getPropertyDb()) {
                executeDiscovery();
            } else {
                setTimeout(executeDiscovery, 2000);
            }
        });
    }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
