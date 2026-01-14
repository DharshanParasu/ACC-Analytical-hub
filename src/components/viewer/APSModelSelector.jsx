import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const APSModelSelector = ({ onSelect, onClose }) => {
    const [step, setStep] = useState('projects'); // 'projects' or 'models'
    const [selectedProject, setSelectedProject] = useState(null);

    // Sample projects - in production, fetch from APS API
    const sampleProjects = [
        {
            id: 'project-1',
            name: 'Downtown Office Complex',
            description: 'Commercial building project',
            icon: '🏢'
        },
        {
            id: 'project-2',
            name: 'Residential Tower',
            description: 'High-rise residential development',
            icon: '🏗️'
        },
        {
            id: 'project-3',
            name: 'Shopping Mall Renovation',
            description: 'Retail space modernization',
            icon: '🏬'
        }
    ];

    // Sample models - in production, fetch based on selected project
    const sampleModels = [
        {
            id: 'model-1',
            name: 'Architectural Model - Level 1-5',
            version: 'v2.3',
            lastModified: '2 days ago',
            size: '45 MB',
            thumbnail: '🏛️'
        },
        {
            id: 'model-2',
            name: 'Structural Model - Complete',
            version: 'v1.8',
            lastModified: '1 week ago',
            size: '78 MB',
            thumbnail: '⚙️'
        },
        {
            id: 'model-3',
            name: 'MEP Model - HVAC Systems',
            version: 'v1.2',
            lastModified: '3 days ago',
            size: '32 MB',
            thumbnail: '🔧'
        }
    ];

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        setStep('models');
    };

    const handleModelSelect = (model) => {
        onSelect({
            project: selectedProject,
            model: model,
            modelUrn: `urn:sample:${model.id}` // In production, use real URN
        });
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 'var(--z-modal)',
                padding: 'var(--spacing-xl)'
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-lg)',
                    width: '100%',
                    maxWidth: '700px',
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: 'var(--spacing-lg)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h2 style={{
                            fontSize: 'var(--font-size-xl)',
                            fontWeight: 'var(--font-weight-bold)',
                            color: 'var(--color-text-base)',
                            marginBottom: '4px'
                        }}>
                            {step === 'projects' ? 'Select Project' : 'Select 3D Model'}
                        </h2>
                        {step === 'models' && selectedProject && (
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-subdued)'
                            }}>
                                {selectedProject.icon} {selectedProject.name}
                            </p>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        {step === 'models' && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setStep('projects')}
                                className="btn-icon"
                                title="Back to projects"
                            >
                                ←
                            </motion.button>
                        )}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onClose}
                            className="btn-icon"
                            title="Close"
                        >
                            ×
                        </motion.button>
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: 'var(--spacing-lg)'
                }}>
                    <AnimatePresence mode="wait">
                        {step === 'projects' ? (
                            <motion.div
                                key="projects"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                style={{
                                    display: 'grid',
                                    gap: 'var(--spacing-md)'
                                }}
                            >
                                {sampleProjects.map((project, index) => (
                                    <motion.div
                                        key={project.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => handleProjectSelect(project)}
                                        style={{
                                            background: 'var(--color-bg-highlight)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-lg)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-md)',
                                            transition: 'all var(--transition-base)'
                                        }}
                                    >
                                        <div style={{ fontSize: '48px' }}>
                                            {project.icon}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{
                                                fontSize: 'var(--font-size-lg)',
                                                fontWeight: 'var(--font-weight-semibold)',
                                                color: 'var(--color-text-base)',
                                                marginBottom: '4px'
                                            }}>
                                                {project.name}
                                            </h3>
                                            <p style={{
                                                fontSize: 'var(--font-size-sm)',
                                                color: 'var(--color-text-subdued)'
                                            }}>
                                                {project.description}
                                            </p>
                                        </div>
                                        <div style={{
                                            fontSize: 'var(--font-size-xl)',
                                            color: 'var(--color-text-subdued)'
                                        }}>
                                            →
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="models"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                style={{
                                    display: 'grid',
                                    gap: 'var(--spacing-md)'
                                }}
                            >
                                {sampleModels.map((model, index) => (
                                    <motion.div
                                        key={model.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => handleModelSelect(model)}
                                        style={{
                                            background: 'var(--color-bg-highlight)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-lg)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-base)'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 'var(--spacing-md)',
                                            marginBottom: 'var(--spacing-sm)'
                                        }}>
                                            <div style={{ fontSize: '40px' }}>
                                                {model.thumbnail}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{
                                                    fontSize: 'var(--font-size-lg)',
                                                    fontWeight: 'var(--font-weight-semibold)',
                                                    color: 'var(--color-text-base)',
                                                    marginBottom: '4px'
                                                }}>
                                                    {model.name}
                                                </h3>
                                                <div style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    color: 'var(--color-text-subdued)',
                                                    display: 'flex',
                                                    gap: 'var(--spacing-md)'
                                                }}>
                                                    <span>Version {model.version}</span>
                                                    <span>•</span>
                                                    <span>{model.size}</span>
                                                    <span>•</span>
                                                    <span>Updated {model.lastModified}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div style={{
                    padding: 'var(--spacing-lg)',
                    borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)'
                }}>
                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-subdued)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)'
                    }}>
                        <span>💡</span>
                        <span>
                            {step === 'projects'
                                ? 'Select a project to view available 3D models'
                                : 'Click a model to load it in the viewer'
                            }
                        </span>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default APSModelSelector;
