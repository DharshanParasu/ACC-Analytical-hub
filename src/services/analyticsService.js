import apsService from './apsService';

/**
 * Analytics Service for extracting and aggregating data from the APS Viewer
 */
class AnalyticsService {
    constructor() {
        this.apsService = apsService;
    }

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
    async aggregateByProperty(viewer, propertyName, conditions = [], logicalOperator = 'AND', sumProperty = null, scopeDbIds = null, joinedData = null) {
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
                // ALWAYS add 'Name' to ensure the viewer returns the element even if other properties are missing (external only)
                attrsToFetch.push('Name');
                const uniqueAttrs = Array.from(new Set(attrsToFetch));

                viewer.model.getBulkProperties(targetDbIds, uniqueAttrs, (results) => {
                    const aggregation = {};
                    if (!results) return resolve({});

                    results.forEach(res => {
                        let passed = true;
                        if (conditions.length > 0) {
                            const conditionResults = conditions.map(condition => {
                                const prop = res.properties.find(p => p.displayName === condition.attribute);
                                let val = prop ? String(prop.displayValue) : null;
                                // Fallback to joined data
                                if (val === null && joinedData && joinedData[res.dbId] && joinedData[res.dbId][condition.attribute] !== undefined) {
                                    val = String(joinedData[res.dbId][condition.attribute]);
                                }
                                if (val === null) val = 'Undefined';

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
                            let value = targetProp ? targetProp.displayValue : null;
                            // Fallback to joined data
                            if (value === null && joinedData && joinedData[res.dbId] && joinedData[res.dbId][propertyName] !== undefined) {
                                value = joinedData[res.dbId][propertyName];
                            }

                            if (value !== null) {
                                if (!aggregation[value]) {
                                    aggregation[value] = { dbIds: [], sum: 0, count: 0 };
                                }
                                aggregation[value].dbIds.push(res.dbId);
                                aggregation[value].count++;

                                if (sumProperty) {
                                    const valProp = res.properties.find(p => p.displayName === sumProperty);
                                    let sumVal = valProp ? parseFloat(valProp.displayValue) : null;
                                    // Fallback to joined data
                                    if (sumVal === null && joinedData && joinedData[res.dbId] && joinedData[res.dbId][sumProperty] !== undefined) {
                                        sumVal = parseFloat(joinedData[res.dbId][sumProperty]);
                                    }

                                    if (sumVal !== null && !isNaN(sumVal)) {
                                        aggregation[value].sum += sumVal;
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

    async aggregateByMultipleProperties(viewer, propertyNames = [], conditions = [], logicalOperator = 'AND', scopeDbIds = null, joinedData = null) {
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
                                let val = prop ? String(prop.displayValue) : null;
                                if (val === null && joinedData && joinedData[res.dbId] && joinedData[res.dbId][condition.attribute] !== undefined) {
                                    val = String(joinedData[res.dbId][condition.attribute]);
                                }
                                if (val === null) val = 'Undefined';
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
                                if (prop) return prop.displayValue;
                                if (joinedData && joinedData[res.dbId] && joinedData[res.dbId][name] !== undefined) {
                                    return joinedData[res.dbId][name];
                                }
                                return 'Undefined';
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

    async searchElements(viewer, filters, joinedData = null) {
        return new Promise((resolve) => {
            if (!viewer || !viewer.model || !filters || filters.length === 0) return resolve([]);
            const instanceTree = viewer.model.getInstanceTree();
            if (!instanceTree) return resolve([]);

            const allDbIds = [];
            instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                if (instanceTree.getChildCount(dbId) === 0) allDbIds.push(dbId);
            }, true);

            const filterProps = filters.map(f => f.attribute);
            // Ensure we fetch the property we are filtering by, plus Name to ensure element returned
            const propsToFetch = [...new Set([...filterProps, 'Name'])];

            viewer.model.getBulkProperties(allDbIds, propsToFetch, (results) => {
                const matchedDbIds = [];
                results.forEach(res => {
                    let passed = filters.every(filter => {
                        const targetAttr = filter.attribute.toLowerCase();
                        const targetValue = String(filter.value).toLowerCase();

                        // Check Model Prop
                        let foundProp = res.properties.find(p => {
                            const pName = p.displayName.toLowerCase();
                            return pName === targetAttr || pName.includes(targetAttr) || (targetAttr === 'category' && (pName.includes('category') || pName === 'type'));
                        });

                        // Check Joined Data Prop
                        let pValue = null;
                        if (foundProp) {
                            pValue = String(foundProp.displayValue).toLowerCase();
                        } else if (joinedData && joinedData[res.dbId] && joinedData[res.dbId][filter.attribute]) {
                            pValue = String(joinedData[res.dbId][filter.attribute]).toLowerCase();
                        }

                        if (pValue === null) return false;

                        if (filter.operator === 'contains') return pValue.includes(targetValue);
                        if (filter.operator === 'not_equals') return pValue !== targetValue;
                        return pValue === targetValue || pValue.includes(targetValue);
                    });
                    if (passed) matchedDbIds.push(res.dbId);
                });
                resolve(matchedDbIds);
            }, (err) => resolve([]));
        });
    }

    /**
     * Joins Model Data with External Data (Excel) based on a common key.
     * @param {Object} viewer - APS Viewer instance
     * @param {string} modelKey - The property name in the model (e.g. "Activity ID")
     * @param {Array} externalData - Array of objects from Excel
     * @param {string} externalKey - The column name in Excel to match (e.g. "Activity ID")
     * @returns {Promise<Object>} Map of dbId -> { ...externalRowData }
     */
    async joinExternalData(viewer, modelKey, externalData, externalKey) {
        return new Promise((resolve, reject) => {
            if (!viewer || !viewer.model || !modelKey || !externalData || !externalKey) {
                return resolve({});
            }

            console.log(`[Analytics] Joining on: Model[${modelKey}] <-> Ext[${externalKey}]`);

            // Index external data for O(1) lookup
            const externalIndex = new Map();
            externalData.forEach(row => {
                const keyVal = String(row[externalKey] || '').trim().toLowerCase();
                if (keyVal) {
                    externalIndex.set(keyVal, row);
                }
            });

            // Get all model elements with the modelKey property
            const instanceTree = viewer.model.getInstanceTree();
            if (!instanceTree) return resolve({});

            const leafIds = [];
            instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                if (instanceTree.getChildCount(dbId) === 0) leafIds.push(dbId);
            }, true);

            viewer.model.getBulkProperties(leafIds, [modelKey], (results) => {
                const dbIdToJoinedData = {};
                let matchCount = 0;

                results.forEach(res => {
                    const prop = res.properties.find(p => p.displayName === modelKey);
                    if (prop) {
                        const modelVal = String(prop.displayValue).trim().toLowerCase();
                        if (externalIndex.has(modelVal)) {
                            dbIdToJoinedData[res.dbId] = externalIndex.get(modelVal);
                            matchCount++;
                        }
                    }
                });

                console.log(`[Analytics] Join Complete. Matched ${matchCount} elements.`);
                resolve(dbIdToJoinedData);
            }, (err) => {
                console.error("[Analytics] Join failed during prop extraction", err);
                reject(err);
            });
        });
    }

    /**
     * Returns a combined list of property names from the model and all linked external sources.
     */
    async getUnifiedPropertyNames(viewer, projectData) {
        // 1. Get Model Properties
        const modelProps = await this.getModelPropertyNames(viewer);

        // 2. Get External Data Headers
        const externalProps = new Set();
        if (projectData && projectData.sources) {
            Object.values(projectData.sources).forEach(source => {
                if (source.headers) {
                    source.headers.forEach(h => externalProps.add(h));
                }
            });
        }

        // 3. Get Calculated Columns
        if (projectData && projectData.calculations) {
            projectData.calculations.forEach(calc => {
                if (calc.name) externalProps.add(calc.name);
            });
        }

        // 4. Merge and Sort
        const combined = new Set([...modelProps, ...externalProps]);
        return Array.from(combined).sort();
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
    /**
     * MASTER DATA FETCH
     * Fetches ALL properties for ALL elements and merges with external data sources.
     * @returns {Promise<Array>} Array of unified data objects for each object in the model.
     */
    async getAllData(viewer, projectData) {
        return new Promise((resolve) => {
            if (!viewer || !viewer.model) return resolve({ results: [], sourceStats: {}, error: 'Viewer or Model not ready' });

            console.log('[Analytics] Starting Master Data Fetch...');
            const instanceTree = viewer.model.getInstanceTree();
            if (!instanceTree) return resolve({ results: [], sourceStats: {}, error: 'Model instance tree not available' });

            // 1. Get all Leaf Node DBIDs
            const allDbIds = [];
            instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                if (instanceTree.getChildCount(dbId) === 0) {
                    allDbIds.push(dbId);
                }
            }, true);

            if (allDbIds.length === 0) return resolve({ results: [], sourceStats: {}, error: 'No elements found in model' });
            console.log(`[Analytics] Found ${allDbIds.length} elements. Fetching properties...`);

            // 2. Prepare External Data Indices
            const externalIndices = {};
            const sourceConfigs = [];

            if (projectData && projectData.sources) {
                Object.entries(projectData.sources).forEach(([key, source]) => {
                    if (source.data && source.mapping && source.mapping.modelKey && source.mapping.fileKey) {
                        const index = new Map();
                        source.data.forEach(row => {
                            const keyVal = String(row[source.mapping.fileKey] || '').trim().toLowerCase();
                            if (keyVal) index.set(keyVal, row);
                        });

                        sourceConfigs.push({
                            modelKey: source.mapping.modelKey,
                            index: index,
                            config: source,
                            sourceKey: key
                        });
                    }
                });
            }

            // 3. Fetch ALL Properties for ALL Nodes
            // We pass null to getBulkProperties to request ALL properties.
            viewer.model.getBulkProperties(allDbIds, null, (results) => {
                const masterData = [];

                results.forEach(res => {
                    const dataObject = { dbId: res.dbId, name: res.name };

                    // Map Model Properties
                    res.properties.forEach(p => {
                        // Store by DisplayName (e.g. "Category", "Material")
                        dataObject[p.displayName] = p.displayValue;
                    });

                    // Merge External Data
                    sourceConfigs.forEach(src => {
                        const modelVal = String(dataObject[src.modelKey] || '').trim().toLowerCase();
                        if (src.index.has(modelVal)) {
                            const externalRow = src.index.get(modelVal);
                            // Spread external row into data object
                            Object.assign(dataObject, externalRow);
                            src.matchCount = (src.matchCount || 0) + 1;
                        }
                    });

                    masterData.push(dataObject);
                });

                // Apply Calculated Columns
                if (projectData.calculations && projectData.calculations.length > 0) {
                    console.log(`[Analytics] Processing ${projectData.calculations.length} calculated columns...`);

                    masterData.forEach(item => {
                        projectData.calculations.forEach(calc => {
                            try {
                                // Replace [ColumnName] with actual values
                                let formula = calc.formula;
                                const columnRefs = formula.match(/\[(.*?)\]/g);

                                if (columnRefs) {
                                    columnRefs.forEach(ref => {
                                        const colName = ref.replace('[', '').replace(']', '');
                                        const val = parseFloat(item[colName] || 0);
                                        formula = formula.replace(ref, isNaN(val) ? 0 : val);
                                    });
                                }

                                // Safe evaluation using Function constructor
                                // Only allow basic math characters to prevent injection
                                if (/^[\d+\-*/().\s]+$/.test(formula)) {
                                    // eslint-disable-next-line no-new-func
                                    const result = new Function('return ' + formula)();
                                    item[calc.name] = parseFloat(result.toFixed(2)); // Round to 2 decimals
                                } else {
                                    item[calc.name] = null; // Invalid characters
                                    // console.warn(`[Analytics] Invalid characters in formula for ${calc.name}: ${calc.formula}`);
                                }
                            } catch (err) {
                                item[calc.name] = null; // Error in calculation
                                // console.error(`[Analytics] Calc Error ${calc.name}:`, err);
                            }
                        });
                    });
                }

                // Log Match Results
                sourceConfigs.forEach(src => {
                    console.log(`[Analytics] Source "${src.config.fileName}": Matched ${src.matchCount || 0} / ${src.index.size} rows to model.`);
                    if ((src.matchCount || 0) === 0) {
                        console.warn(`[Analytics] WARNING: Source "${src.config.fileName}" had ZERO matches. Check mapping keys: Model[${src.modelKey}] vs File[${src.config?.mapping?.fileKey}]`);
                    }
                });

                // DEBUG: Check first 5 items for external data
                if (masterData.length > 0) {
                    console.log('[Analytics] Master Data Sample (First 3):', masterData.slice(0, 3));
                    const keys = Object.keys(masterData[0]);
                    console.log('[Analytics] Keys on first item:', keys);
                }

                console.log(`[Analytics] Master Data Built. ${masterData.length} records.`);

                // Collect stats for each source
                const sourceStats = {};
                sourceConfigs.forEach(src => {
                    sourceStats[src.sourceKey] = {
                        matchCount: src.matchCount || 0,
                        totalRows: src.index.size,
                        fileName: src.config.fileName
                    };
                });

                resolve({
                    results: masterData,
                    sourceStats: sourceStats,
                    error: null
                });

            }, (err) => {
                console.error('[Analytics] Failed to fetch bulk properties:', err);
                resolve({ results: [], sourceStats: {}, error: 'APS Bulk Property Fetch Error: ' + (err?.message || err || 'Unknown error') });
            });
        });
    }

    /**
     * Synchronous Aggregation from Master Data
     */
    aggregateFromMasterData(masterData, propertyName, conditions = [], logicalOperator = 'AND', sumProperty = null, scopeDbIds = null) {
        const aggregation = {};

        // Filter by Scope first if provided, otherwise use all
        let targetData = masterData;
        if (scopeDbIds && scopeDbIds.length > 0) {
            const scopeSet = new Set(scopeDbIds);
            targetData = masterData.filter(d => scopeSet.has(d.dbId));
        }

        targetData.forEach(item => {
            // Check Conditions
            let passed = true;
            if (conditions.length > 0) {
                const conditionResults = conditions.map(condition => {
                    let val = item[condition.attribute];
                    if (val === undefined || val === null) val = 'Undefined';
                    val = String(val);

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
                const value = item[propertyName] !== undefined ? item[propertyName] : 'Undefined';

                if (!aggregation[value]) {
                    aggregation[value] = { dbIds: [], sum: 0, count: 0 };
                }
                aggregation[value].dbIds.push(item.dbId);
                aggregation[value].count++;

                if (sumProperty) {
                    const rawVal = item[sumProperty];
                    const sumVal = parseFloat(rawVal);
                    // if (Math.random() < 0.001) console.log(`[Analytics] Aggregating ${sumProperty}:`, rawVal, '->', sumVal);

                    if (!isNaN(sumVal)) {
                        aggregation[value].sum += sumVal;
                    }
                }
            }
        });

        return aggregation;
    }

    /**
     * Calculates a single KPI value from the master dataset.
     */
    calculateKPI(masterData, propertyName, aggregationType = 'count', filters = [], logicalOperator = 'AND') {
        if (!masterData || !Array.isArray(masterData)) return 0;

        let filtered = masterData;
        if (filters && filters.length > 0) {
            filtered = masterData.filter(item => {
                const conditionResults = filters.map(condition => {
                    const val = item[condition.attribute] !== undefined ? String(item[condition.attribute]) : 'Undefined';
                    const target = String(condition.value);

                    switch (condition.operator) {
                        case 'equals': return val === target;
                        case 'contains': return val.toLowerCase().includes(target.toLowerCase());
                        case 'not_equals': return val !== target;
                        default: return true;
                    }
                });
                return logicalOperator === 'OR' ? conditionResults.some(r => r) : conditionResults.every(r => r);
            });
        }

        if (aggregationType === 'sum' && propertyName) {
            return filtered.reduce((acc, item) => {
                const val = parseFloat(item[propertyName]);
                return acc + (isNaN(val) ? 0 : val);
            }, 0);
        }

        return filtered.length;
    }

    /**
     * Extracts unique values for a property from the master dataset.
     */
    getUniqueValuesFromData(masterData, propertyName) {
        if (!masterData || !Array.isArray(masterData)) return [];
        const values = new Set();
        masterData.forEach(item => {
            const val = item[propertyName];
            if (val !== undefined && val !== null) {
                values.add(String(val));
            }
        });
        return Array.from(values).sort();
    }

    /**
     * Synchronous Table Data from Master Data
     */
    getTableDataFromMaster(masterData, propertyNames, conditions = [], logicalOperator = 'AND') {
        const aggregation = {}; // Key: JSON string of values, Value: Array of dbIds

        masterData.forEach(item => {
            // Check Conditions
            let passed = true;
            if (conditions.length > 0) {
                const conditionResults = conditions.map(condition => {
                    let val = item[condition.attribute];
                    if (val === undefined || val === null) val = 'Undefined';
                    val = String(val);

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
                    return item[name] !== undefined ? item[name] : 'Undefined';
                });
                const key = JSON.stringify(values);

                if (!aggregation[key]) aggregation[key] = [];
                aggregation[key].push(item.dbId);
            }
        });

        return this.getTableData(aggregation, propertyNames);
    }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
