import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../../services/storageService';
import apsService from '../../services/apsService';
import { Plus, X, Trash2, ArrowRight, Box } from 'lucide-react';

const ProjectsPage = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoadingAPS, setIsLoadingAPS] = useState(false);

    // Form State
    const [hubs, setHubs] = useState([]);
    const [accProjects, setAccProjects] = useState([]);
    const [selectedHub, setSelectedHub] = useState('');
    const [selectedAccProject, setSelectedAccProject] = useState('');

    useEffect(() => {
        storageService.createSampleDashboards();
        loadProjects();
    }, []);

    const loadProjects = () => {
        const data = storageService.getProjects();
        setProjects(data);
    };

    const handleStartCreate = async () => {
        setIsCreating(true);
        setIsLoadingAPS(true);
        try {
            const hubsData = await apsService.getHubs();
            setHubs(hubsData);
        } catch (error) {
            console.error("Failed to fetch hubs", error);
        } finally {
            setIsLoadingAPS(false);
        }
    };

    const handleHubChange = async (e) => {
        const hubId = e.target.value;
        setSelectedHub(hubId);
        setSelectedAccProject('');
        setAccProjects([]);

        if (hubId) {
            setIsLoadingAPS(true);
            try {
                const projectsData = await apsService.getProjects(hubId);
                setAccProjects(projectsData);
            } catch (error) {
                console.error("Failed to fetch projects", error);
            } finally {
                setIsLoadingAPS(false);
            }
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!selectedHub || !selectedAccProject) return;

        const hub = hubs.find(h => h.id === selectedHub);
        const accProject = accProjects.find(p => p.id === selectedAccProject);

        const newProject = {
            id: crypto.randomUUID(), // Assuming modern browser or polyfill
            name: accProject.attributes.name,
            hubId: selectedHub,
            hubName: hub.attributes.name,
            accProjectId: selectedAccProject,
            thumbnail: '🏗️' // We render this as an icon, but storage keeps string. Or we can change how we usage it.
            // Actually, for consistency let's just keep the data structure but render differently if we want.
            // But the JSX below uses `project.thumbnail`.
            // Let's just keep the data string for now and maybe render a Lucide icon conditionally or just keep simple emojis for data content if needed.
            // The user wanted "instances to use lucide-react".
            // If I change this to an icon name, I'd need to migrate data.
            // For now, I will replace the RENDER of `project.thumbnail` if it is an emoji, or just Wrap it.
            // The code below renders `{project.thumbnail}`.
            // Let's replace the RENDER in the JSX to ignore this thumbnail property or replace it with a Lucide Box.
        };

        storageService.saveProject(newProject);
        loadProjects();
        setIsCreating(false);
        resetForm();
    };

    const resetForm = () => {
        setSelectedHub('');
        setSelectedAccProject('');
        setAccProjects([]);
    };

    const handleDeleteProject = (e, id) => {
        e.stopPropagation();
        if (confirm('Are you sure? This will delete all dashboards in this project.')) {
            storageService.deleteProject(id);
            loadProjects();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-[1200px] mx-auto p-8"
        >
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-[var(--color-text-base)] tracking-tight mb-2">My Projects</h1>
                    <p className="text-[var(--color-text-muted)]">Manage your analytics projects</p>
                </div>

                {!isCreating && (
                    <button
                        onClick={handleStartCreate}
                        className="btn btn-primary py-3 px-6 flex items-center gap-2 shadow-[0_0_20px_rgba(204,246,85,0.3)] hover:shadow-[0_0_30px_rgba(204,246,85,0.5)]"
                    >
                        <Plus className="w-5 h-5" />
                        New Project
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-10 overflow-hidden"
                    >
                        <div className="glass-panel p-8 border border-lime-400/30 shadow-[0_0_30px_rgba(132,204,22,0.1)] bg-[var(--color-bg-elevated)]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-[var(--color-text-base)]">Link New Project</h3>
                                <button onClick={() => setIsCreating(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-base)]">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateProject} className="max-w-xl">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">Select Hub</label>
                                        <select
                                            value={selectedHub}
                                            onChange={handleHubChange}
                                            className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-base)] focus:outline-none focus:border-lime-400 transition-colors"
                                            disabled={isLoadingAPS}
                                        >
                                            <option value="">Select a Hub...</option>
                                            {hubs.map(hub => (
                                                <option key={hub.id} value={hub.id}>{hub.attributes.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">Select Project</label>
                                        <select
                                            value={selectedAccProject}
                                            onChange={(e) => setSelectedAccProject(e.target.value)}
                                            className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-base)] focus:outline-none focus:border-lime-400 transition-colors"
                                            disabled={!selectedHub || isLoadingAPS}
                                        >
                                            <option value="">Select a Project...</option>
                                            {accProjects.map(proj => (
                                                <option key={proj.id} value={proj.id}>{proj.attributes.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pt-4 flex gap-4">
                                        <button
                                            type="submit"
                                            disabled={!selectedAccProject}
                                            className="btn btn-primary py-3 px-8 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create Project
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreating(false)}
                                            className="px-6 py-3 rounded-xl bg-[var(--color-hover)] hover:bg-[var(--color-border)] text-[var(--color-text-base)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {projects.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
                    {projects.map((project, index) => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => navigate(`/project/${project.id}`)}
                            className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] p-0 group cursor-pointer hover:border-lime-400/50 transition-all duration-300 hover:-translate-y-1 relative shadow-lg overflow-hidden"
                        >
                            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleDeleteProject(e, project.id)}
                                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="h-40 bg-gradient-to-br from-[var(--color-bg-surface)] to-[var(--color-bg-base)] relative overflow-hidden flex items-center justify-center border-b border-[var(--color-border)]">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                                <span className="text-6xl filter drop-shadow-lg transform group-hover:scale-110 transition-transform duration-500 text-lime-400">
                                    <Box className="w-16 h-16" />
                                </span>
                            </div>

                            <div className="p-6">
                                <h3 className="text-xl font-bold text-[var(--color-text-base)] mb-2 group-hover:text-lime-400 transition-colors">
                                    {project.name}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] uppercase tracking-widest font-mono mb-4">
                                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span>
                                    {project.hubName}
                                </div>

                                <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-4 mt-4">
                                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 opacity-50">
                    <div className="text-6xl mb-4 flex justify-center"><Box className="w-20 h-20 text-[var(--color-text-muted)]" /></div>
                    <h3 className="text-2xl font-bold text-[var(--color-text-base)] mb-2">No Projects Yet</h3>
                    <p className="text-[var(--color-text-muted)]">Create a new project to get started</p>
                </div>
            )}
        </motion.div>
    );
};

export default ProjectsPage;
