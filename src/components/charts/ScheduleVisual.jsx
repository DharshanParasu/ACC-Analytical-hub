import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import analyticsService from '../../services/analyticsService';

const ScheduleVisual = ({ config, viewer, onDataClick, scopedDbIds, joinedData }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // Days per tick
    const [currentDate, setCurrentDate] = useState(null);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);

    // Config properties (Legacy)
    const activityNameProp = config.attribute || 'Activity Name';
    const startDateProp = config.startAttribute || 'Start Date';
    const endDateProp = config.endAttribute || 'End Date';

    // Excel Params
    const excelParams = config.excelParams;

    const requestRef = useRef();
    const lastTimeRef = useRef();

    // Fetch and parse model data
    useEffect(() => {
        if (!viewer || !viewer.model) return;

        const fetchScheduleData = async () => {
            setLoading(true);
            try {
                // Get all leaf nodes
                const instanceTree = viewer.model.getInstanceTree();
                if (!instanceTree) return;

                const leafIds = [];
                instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                    leafIds.push(dbId);
                }, true);

                if (excelParams && excelParams.urn && excelParams.modelKey && excelParams.excelKey) {
                    // --- EXCEL MODE --- (Logic Unchanged)
                    console.log('[ScheduleVisual] Using Excel Mode', excelParams);

                    // 1. Map Model Keys -> dbIds
                    viewer.model.getBulkProperties(leafIds, [excelParams.modelKey], async (results) => {
                        const modelMap = {}; // Key -> [dbIds]
                        results.forEach(res => {
                            const val = res.properties.find(p => p.displayName === excelParams.modelKey)?.displayValue;
                            if (val) {
                                // Convert to string for consistent mapping
                                const strVal = String(val).trim();
                                if (!modelMap[strVal]) modelMap[strVal] = [];
                                modelMap[strVal].push(res.dbId);
                            }
                        });
                        console.log(`[ScheduleVisual] Model mapped: ${Object.keys(modelMap).length} unique keys over ${results.length} items`);

                        // 2. Fetch Excel File
                        try {
                            const buffer = await analyticsService.apsService.getFileContent(excelParams.projectId, excelParams.urn);
                            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true }); // cellDates: true for date parsing
                            const sheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json(worksheet); // Array of objects

                            const parsedActivities = [];
                            let minDate = new Date(8640000000000000);
                            let maxDate = new Date(-8640000000000000);

                            jsonData.forEach((row, idx) => {
                                const key = row[excelParams.excelKey];
                                const name = row[excelParams.excelName];
                                const startRaw = row[excelParams.excelStart];
                                const endRaw = row[excelParams.excelEnd];

                                if (key && startRaw && endRaw) {
                                    // Parse dates (XLSX cellDates:true should give Date objects, but fallback to string parsing)
                                    const start = startRaw instanceof Date ? startRaw : new Date(startRaw);
                                    const end = endRaw instanceof Date ? endRaw : new Date(endRaw);

                                    if (!isNaN(start) && !isNaN(end)) {
                                        if (start < minDate) minDate = start;
                                        if (end > maxDate) maxDate = end;

                                        // Find matching model elements
                                        // Excel keys might need trimming/string conversion
                                        const matchKey = String(key).trim();
                                        const dbIds = modelMap[matchKey] || [];

                                        parsedActivities.push({
                                            id: `act-${idx}`,
                                            dbIds: dbIds, // Can be empty if no geometry matches (ghost task)
                                            name: name || `Activity ${idx}`,
                                            start,
                                            end,
                                            duration: (end - start) / (1000 * 60 * 60 * 24),
                                            hasModel: dbIds.length > 0
                                        });
                                    }
                                }
                            });

                            // Sort by Start Date
                            parsedActivities.sort((a, b) => a.start - b.start);

                            if (parsedActivities.length > 0) {
                                setStartDate(minDate);
                                setEndDate(maxDate);
                                setCurrentDate(minDate);
                                setActivities(parsedActivities);
                            } else {
                                console.warn('[ScheduleVisual] No valid activities parsed from Excel.');
                            }

                        } catch (excelErr) {
                            console.error("Error fetching/parsing Excel:", excelErr);
                        } finally {
                            setLoading(false);
                        }
                    });

                } else {
                    // --- MAPPED PROPERTY MODE (Model + External) ---
                    // Always fetch 'Name' to ensure the viewer returns the element even if specific props are missing on the model (external only)
                    const propsToFetch = [activityNameProp, startDateProp, endDateProp, 'Name'];
                    const uniqueProps = [...new Set(propsToFetch)];

                    viewer.model.getBulkProperties(leafIds, uniqueProps, (results) => {
                        const parsedActivities = [];
                        let minDate = new Date(8640000000000000);
                        let maxDate = new Date(-8640000000000000);

                        results.forEach(res => {
                            // Helper to get value from Model OR Joined Data
                            const getValue = (propName) => {
                                const modelProp = res.properties.find(p => p.displayName === propName);
                                if (modelProp) return modelProp.displayValue;
                                if (joinedData && joinedData[res.dbId] && joinedData[res.dbId][propName] !== undefined) {
                                    return joinedData[res.dbId][propName];
                                }
                                return null;
                            };

                            const name = getValue(activityNameProp);
                            const startVal = getValue(startDateProp);
                            const endVal = getValue(endDateProp);

                            if (name && startVal && endVal) {
                                const start = new Date(startVal);
                                const end = new Date(endVal);

                                if (!isNaN(start) && !isNaN(end)) {
                                    if (start < minDate) minDate = start;
                                    if (end > maxDate) maxDate = end;

                                    parsedActivities.push({
                                        id: `act-${res.dbId}`,
                                        dbIds: [res.dbId], // Normalize to array
                                        name,
                                        start,
                                        end,
                                        duration: (end - start) / (1000 * 60 * 60 * 24),
                                        hasModel: true
                                    });
                                }
                            }
                        });

                        // Sort by start date
                        parsedActivities.sort((a, b) => a.start - b.start);

                        if (parsedActivities.length > 0) {
                            setStartDate(minDate);
                            setEndDate(maxDate);
                            setCurrentDate(minDate); // Reset to start
                            setActivities(parsedActivities);
                        }
                        setLoading(false);
                    });
                }

            } catch (err) {
                console.error("Error fetching schedule data:", err);
                setLoading(false);
            }
        };

        fetchScheduleData();
    }, [viewer, activityNameProp, startDateProp, endDateProp, excelParams, joinedData]);

    // Playback Loop
    const animate = (time) => {
        if (lastTimeRef.current != undefined) {
            // Update current date
            setCurrentDate(prevDate => {
                if (!prevDate || !endDate) return prevDate;

                const nextDate = new Date(prevDate);
                nextDate.setDate(nextDate.getDate() + playbackSpeed);

                if (nextDate >= endDate) {
                    setIsPlaying(false);
                    return endDate;
                }
                return nextDate;
            });
        }
        lastTimeRef.current = time;
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(requestRef.current);
            lastTimeRef.current = undefined;
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [isPlaying, endDate, playbackSpeed]);


    // Update Viewer Colors based on Time
    useEffect(() => {
        if (!viewer || !currentDate || activities.length === 0) return;

        const notStarted = [];
        const inProgress = [];
        const completed = [];

        activities.forEach(act => {
            if (!act.hasModel) return;

            if (currentDate < act.start) {
                notStarted.push(...act.dbIds);
            } else if (currentDate >= act.start && currentDate <= act.end) {
                inProgress.push(...act.dbIds);
            } else {
                completed.push(...act.dbIds);
            }
        });

        viewer.clearThemingColors();

        // Hide not started
        if (notStarted.length > 0) viewer.hide(notStarted);

        // Show others
        if (inProgress.length > 0) {
            viewer.show(inProgress);
            const progressColor = new window.THREE.Vector4(0, 1, 0, 0.7); // Green
            inProgress.forEach(id => viewer.setThemingColor(id, progressColor));
        }

        if (completed.length > 0) {
            viewer.show(completed);
            // Restore Completed to original (no theming color needed as clearThemingColors handled it)
        }

    }, [currentDate, activities, viewer]);

    // Handle Slider Change
    const handleSliderChange = (e) => {
        if (!startDate || !endDate) return;
        const totalDuration = endDate.getTime() - startDate.getTime();
        const percent = parseFloat(e.target.value);
        const newTime = startDate.getTime() + (totalDuration * (percent / 100));
        setCurrentDate(new Date(newTime));
    };

    const getProgressPercent = () => {
        if (!startDate || !endDate || !currentDate) return 0;
        const total = endDate.getTime() - startDate.getTime();
        const current = currentDate.getTime() - startDate.getTime();
        return Math.min(100, Math.max(0, (current / total) * 100));
    };

    if (loading) return <div className="spinner"></div>;
    if (activities.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-subdued)' }}>No schedule data found. Link an Excel file or configure properties.</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {/* Header Controls */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>4D Construction Timeline</h3>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        {currentDate?.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="btn-icon" onClick={() => { setIsPlaying(false); setCurrentDate(startDate); }}>⏮️</button>
                    <button className="btn btn-primary" onClick={() => setIsPlaying(!isPlaying)} style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}>
                        {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <select
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                        style={{ background: 'var(--color-bg-base)', color: 'white', border: '1px solid var(--color-border)', padding: '4px', borderRadius: '4px' }}
                    >
                        <option value={1}>1x (1 day/frame)</option>
                        <option value={7}>7x (1 week/frame)</option>
                        <option value={30}>30x (1 month/frame)</option>
                    </select>
                </div>
            </div>

            {/* Timeline Slider */}
            <div style={{ padding: '0 16px' }}>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={getProgressPercent()}
                    onChange={handleSliderChange}
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-subdued)' }}>
                    <span>{startDate?.toLocaleDateString()}</span>
                    <span>{endDate?.toLocaleDateString()}</span>
                </div>
            </div>

            {/* Gantt List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {activities.map(act => {
                    const isActive = currentDate >= act.start && currentDate <= act.end;
                    const isCompleted = currentDate > act.end;

                    return (
                        <div key={act.id} style={{ // Use unique ID
                            display: 'grid',
                            gridTemplateColumns: '150px 1fr',
                            gap: '16px',
                            alignItems: 'center',
                            opacity: isCompleted || isActive ? 1 : 0.3
                        }}>
                            <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={act.name}>
                                {act.name} {act.hasModel ? '' : '(No Model)'}
                            </div>
                            <div style={{ height: '24px', background: 'var(--color-bg-base)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                                {/* Progress Bar Background */}
                                <div style={{
                                    position: 'absolute',
                                    left: '0%',
                                    width: '100%',
                                    height: '100%',
                                    background: isActive ? 'var(--color-primary)' : (isCompleted ? 'var(--color-text-subdued)' : 'transparent'),
                                    opacity: isActive ? 0.8 : 0.5
                                }}></div>
                                {isActive && <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', fontWeight: 'bold' }}>ACTIVE</div>}
                                {isCompleted && <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px' }}>✓</div>}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default ScheduleVisual;
