import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Play, Pause, RotateCcw, SkipBack } from 'lucide-react';
import analyticsService from '../../services/analyticsService';

const ScheduleVisual = (props) => {
    const { config, viewer, onDataClick, scopedDbIds, joinedData, masterData } = props;
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // Days per tick
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);

    // Internal state if global not provided (fallback)
    const [localCurrentDate, setLocalCurrentDate] = useState(null);

    // Effective current date
    const currentDate = (props.globalSync && props.timelineDate) ? props.timelineDate : localCurrentDate;
    const setCurrentDate = (props.globalSync && props.onTimelineDateChange) ? props.onTimelineDateChange : setLocalCurrentDate;

    // Config properties
    const activityNameProp = config.activityNameAttribute || config.attribute || 'Activity Name';
    const startDateProp = config.startDateAttribute || config.startAttribute || 'Start Date';
    const endDateProp = config.endDateAttribute || config.endAttribute || 'End Date';

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
                if (excelParams && excelParams.urn && excelParams.modelKey && excelParams.excelKey) {
                    // --- EXCEL MODE --- (Direct connection to Excel)
                    console.log('[ScheduleVisual] Using Excel Mode', excelParams);
                    const instanceTree = viewer.model.getInstanceTree();
                    if (!instanceTree) return;

                    const leafIds = [];
                    instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                        leafIds.push(dbId);
                    }, true);

                    viewer.model.getBulkProperties(leafIds, [excelParams.modelKey], async (results) => {
                        const modelMap = {}; // Key -> [dbIds]
                        results.forEach(res => {
                            const val = res.properties.find(p => p.displayName === excelParams.modelKey)?.displayValue;
                            if (val) {
                                const strVal = String(val).trim();
                                if (!modelMap[strVal]) modelMap[strVal] = [];
                                modelMap[strVal].push(res.dbId);
                            }
                        });

                        try {
                            const buffer = await analyticsService.apsService.getFileContent(excelParams.projectId, excelParams.urn);
                            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
                            const sheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json(worksheet);

                            const parsedActivities = [];
                            let minDate = new Date(8640000000000000);
                            let maxDate = new Date(-8640000000000000);

                            jsonData.forEach((row, idx) => {
                                const key = row[excelParams.excelKey];
                                const name = row[excelParams.excelName];
                                const startRaw = row[excelParams.excelStart];
                                const endRaw = row[excelParams.excelEnd];

                                if (key && startRaw && endRaw) {
                                    const start = startRaw instanceof Date ? startRaw : new Date(startRaw);
                                    const end = endRaw instanceof Date ? endRaw : new Date(endRaw);

                                    if (!isNaN(start) && !isNaN(end)) {
                                        if (start < minDate) minDate = start;
                                        if (end > maxDate) maxDate = end;

                                        const matchKey = String(key).trim();
                                        const dbIds = modelMap[matchKey] || [];

                                        parsedActivities.push({
                                            id: `act-${idx}`,
                                            dbIds: dbIds,
                                            name: name || `Activity ${idx}`,
                                            start,
                                            end,
                                            duration: (end - start) / (1000 * 60 * 60 * 24),
                                            hasModel: dbIds.length > 0
                                        });
                                    }
                                }
                            });

                            parsedActivities.sort((a, b) => a.start - b.start);
                            if (parsedActivities.length > 0) {
                                setStartDate(minDate);
                                setEndDate(maxDate);
                                // if (!props.timelineDate) setCurrentDate(minDate); // DO NOT SET INITIAL DATE - Wait for interaction
                                setActivities(parsedActivities);
                            }
                        } catch (excelErr) {
                            console.error("Error fetching/parsing Excel:", excelErr);
                        } finally {
                            setLoading(false);
                        }
                    });

                } else if (masterData && masterData.length > 0) {
                    // --- MASTER DATA MODE (Synced & Filtered) ---
                    // GROUPING LOGIC: Multiple dbIds often belong to the same named activity
                    console.log('[ScheduleVisual] Processing Master Data with grouping');
                    const activitiesMap = {}; // Key: Name + Start + End
                    let minDate = new Date(8640000000000000);
                    let maxDate = new Date(-8640000000000000);

                    masterData.forEach(item => {
                        const name = item[activityNameProp];
                        const startVal = item[startDateProp];
                        const endVal = item[endDateProp];

                        if (name && startVal && endVal) {
                            const start = new Date(startVal);
                            const end = new Date(endVal);

                            if (!isNaN(start) && !isNaN(end)) {
                                if (start < minDate) minDate = start;
                                if (end > maxDate) maxDate = end;

                                // Unique key for an activity: Name + Dates
                                const key = `${name}_${start.getTime()}_${end.getTime()}`;

                                if (!activitiesMap[key]) {
                                    activitiesMap[key] = {
                                        id: `act-${item.dbId}`,
                                        dbIds: [],
                                        name: String(name),
                                        start,
                                        end,
                                        duration: (end - start) / (1000 * 60 * 60 * 24),
                                        hasModel: true
                                    };
                                }
                                activitiesMap[key].dbIds.push(item.dbId);
                            }
                        }
                    });

                    const parsedActivities = Object.values(activitiesMap);
                    parsedActivities.sort((a, b) => a.start - b.start);

                    if (parsedActivities.length > 0) {
                        setStartDate(minDate);
                        setEndDate(maxDate);
                        // if (!props.timelineDate) setCurrentDate(minDate); // DO NOT SET INITIAL DATE - Wait for interaction
                        setActivities(parsedActivities);
                    }
                    setLoading(false);

                } else {
                    // --- VIEWER FALLBACK MODE ---
                    console.log('[ScheduleVisual] Using Viewer Query Fallback');
                    const instanceTree = viewer.model.getInstanceTree();
                    if (!instanceTree) return;

                    const leafIds = [];
                    instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
                        if (instanceTree.getChildCount(dbId) === 0) leafIds.push(dbId);
                    }, true);

                    const propsToFetch = [activityNameProp, startDateProp, endDateProp, 'Name'];
                    viewer.model.getBulkProperties(leafIds, propsToFetch, (results) => {
                        const activitiesMap = {};
                        let minDate = new Date(8640000000000000);
                        let maxDate = new Date(-8640000000000000);

                        results.forEach(res => {
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

                                    const key = `${name}_${start.getTime()}_${end.getTime()}`;
                                    if (!activitiesMap[key]) {
                                        activitiesMap[key] = {
                                            id: `act-${res.dbId}`,
                                            dbIds: [],
                                            name: String(name),
                                            start,
                                            end,
                                            duration: (end - start) / (1000 * 60 * 60 * 24),
                                            hasModel: true
                                        };
                                    }
                                    activitiesMap[key].dbIds.push(res.dbId);
                                }
                            }
                        });

                        const parsedActivities = Object.values(activitiesMap);
                        parsedActivities.sort((a, b) => a.start - b.start);

                        if (parsedActivities.length > 0) {
                            setStartDate(minDate);
                            setEndDate(maxDate);
                            if (!props.timelineDate) setCurrentDate(minDate); // Only set if not already set globally
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
    }, [viewer, activityNameProp, startDateProp, endDateProp, excelParams, joinedData, masterData]);

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
        if (!viewer || activities.length === 0) return;

        // If no current date is set (default state), show everything and clear colors
        if (!currentDate) {
            viewer.clearThemingColors();
            viewer.showAll();
            return;
        }

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

    const handleGanttClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        seekToX(x, rect.width);
    };

    const handleGanttMouseMove = (e) => {
        if (!isDraggingTimeline) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        seekToX(x, rect.width);
    };

    const seekToX = (x, totalWidth) => {
        const labelWidth = 150;
        const padding = 16;
        const availableWidth = totalWidth - labelWidth - padding - 32;

        const percent = (x - labelWidth - padding) / availableWidth;
        if (percent >= 0 && percent <= 1) {
            const total = endDate.getTime() - startDate.getTime();
            const newTime = startDate.getTime() + (total * percent);
            setCurrentDate(new Date(newTime));
        }
    };

    const filteredActivities = useMemo(() => {
        if (props.globalSync && scopedDbIds && scopedDbIds.length > 0) {
            const scopeSet = new Set(scopedDbIds);
            return activities.filter(act =>
                act.dbIds && act.dbIds.some(id => scopeSet.has(id))
            );
        }
        return activities;
    }, [activities, props.globalSync, JSON.stringify(scopedDbIds)]);

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
                    <button
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                        onClick={() => { setIsPlaying(false); setCurrentDate(startDate); }}
                        title="Reset"
                    >
                        <RotateCcw className="w-4 h-4 text-white" />
                    </button>
                    <button
                        className="w-10 h-10 flex items-center justify-center bg-lime-400 hover:bg-lime-500 text-black rounded-full transition-colors shadow-lg shadow-lime-400/20"
                        onClick={() => {
                            if (!isPlaying && !currentDate && startDate) {
                                setCurrentDate(startDate);
                            }
                            setIsPlaying(!isPlaying);
                        }}
                    >
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>
                    <select
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                        className="bg-white/5 border border-white/10 text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-lime-400/50 transition-colors"
                    >
                        <option value={1}>1x (1 day/frame)</option>
                        <option value={7}>7x (1 week/frame)</option>
                        <option value={30}>30x (1 month/frame)</option>
                    </select>
                </div>
            </div>

            {/* Timeline Slider & Progress */}
            <div style={{ padding: '0 16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.01"
                        value={getProgressPercent()}
                        onChange={handleSliderChange}
                        style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--color-primary)', zIndex: 2 }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-subdued)', marginTop: '4px' }}>
                    <span>{startDate?.toLocaleDateString()}</span>
                    <span>{endDate?.toLocaleDateString()}</span>
                </div>
            </div>

            {/* Gantt List Area */}
            <div
                style={{ flex: 1, overflowY: 'auto', padding: '16px', position: 'relative', cursor: isDraggingTimeline ? 'grabbing' : 'pointer' }}
                onClick={handleGanttClick}
                onMouseDown={() => { setIsPlaying(false); setIsDraggingTimeline(true); }}
                onMouseUp={() => setIsDraggingTimeline(false)}
                onMouseLeave={() => setIsDraggingTimeline(false)}
                onMouseMove={handleGanttMouseMove}
            >
                {/* Vertical "Now" Line */}
                {startDate && endDate && currentDate && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `calc(182px + (100% - 198px) * ${getProgressPercent() / 100})`,
                        width: '2px',
                        background: 'var(--color-primary)',
                        zIndex: 10,
                        pointerEvents: 'none',
                        boxShadow: '0 0 12px var(--color-primary)'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            boxShadow: '0 0 8px var(--color-primary)'
                        }} />
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredActivities.map(act => {
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
                                    {(() => {
                                        if (!startDate || !endDate || !act.start || !act.end) return null;
                                        const total = endDate.getTime() - startDate.getTime();
                                        if (total <= 0) return null;

                                        const left = Math.max(0, ((act.start.getTime() - startDate.getTime()) / total) * 100);
                                        const width = Math.min(100 - left, ((act.end.getTime() - act.start.getTime()) / total) * 100);

                                        return (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${left}%`,
                                                width: `${width}%`,
                                                height: '100%',
                                                background: isActive ? 'var(--color-primary)' : (isCompleted ? 'var(--color-text-subdued)' : 'var(--color-bg-highlight)'),
                                                opacity: isActive ? 0.8 : 0.3,
                                                borderRadius: '2px'
                                            }}></div>
                                        );
                                    })()}
                                    {isActive && (
                                        <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 1 }}>
                                            <motion.div
                                                animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                                style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)' }}
                                            />
                                        </div>
                                    )}
                                    {isCompleted && <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)', fontSize: '14px', fontWeight: 'bold', zIndex: 1 }}>✓</div>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

export default ScheduleVisual;
