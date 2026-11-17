import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Controls, Background, EdgeLabelRenderer, useEdgesState, useNodesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ScrybeApiClient } from './apiClient';
import { ScrybeEventsClient } from './eventsClient';
import { DEFAULT_API_BASE, normalizeStatusPayload } from './contracts';
import './PipelineView.css';

// --- Pipeline node definitions ---
// Ordre logique du traitement : Micro/Device -> Recorder -> Whisper Engine -> Transcription -> Injection texte -> Historique

const NODES_CONFIG = [
    { id: 'device', label: 'Micro / Device', icon: '🎙️' },
    { id: 'recorder', label: 'Recorder', icon: '🔴' },
    { id: 'whisper', label: 'Whisper Engine', icon: '🧠' },
    { id: 'transcription', label: 'Transcription', icon: '📝' },
    { id: 'injection', label: 'Injection texte', icon: '⌨️' },
    { id: 'history', label: 'Historique', icon: '📚' }
];

const EDGES_CONFIG = [
    { id: 'e1-2', source: 'device', target: 'recorder' },
    { id: 'e2-3', source: 'recorder', target: 'whisper' },
    { id: 'e3-4', source: 'whisper', target: 'transcription' },
    { id: 'e4-5', source: 'transcription', target: 'injection' },
    { id: 'e5-6', source: 'injection', target: 'history' }
];

function usePipelineSnapshot() {
    const [snapshot, setSnapshot] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let disposeEvents;
        const api = new ScrybeApiClient();
        const eventsClient = new ScrybeEventsClient(api.baseUrl || DEFAULT_API_BASE);

        const load = async () => {
            try {
                const current = await api.getStatus();
                setSnapshot(normalizeStatusPayload(current));
                setConnected(true);
            } catch {
                setConnected(false);
            }

            disposeEvents = eventsClient.start({
                onStatus: (next) => {
                    setSnapshot(next);
                    setConnected(true);
                },
                pollStatus: () => api.getStatus()
            });
        };
        load();
        return () => disposeEvents?.();
    }, []);

    return { snapshot, connected };
}

function getNodeState(nodeId, snapshot) {
    if (!snapshot) return 'idle';

    // Le noeud Recorder est actif lors de l'enregistrement
    if (nodeId === 'recorder') {
        return snapshot.isRecording ? 'recording' : 'idle';
    }
    // Le noeud Whisper / Transcription est actif lors de la transcription
    if (nodeId === 'whisper' || nodeId === 'transcription') {
        return snapshot.isTranscribing ? 'transcribing' : 'idle';
    }
    // Historique reçoit les éléments quand le pipeline est connecté
    if (nodeId === 'history') {
        return snapshot.status === 'Prêt' ? 'idle' : 'active';
    }
    return 'idle';
}

export default function PipelineView() {
    const { snapshot, connected } = usePipelineSnapshot();

    const initialNodes = useMemo(() =>
        NODES_CONFIG.map((n) => ({
            id: n.id,
            type: 'default',
            data: {
                label: (
                    <div className="scrybe-node" data-testid={`node-${n.id}`}>
                        <span className="node-icon">{n.icon}</span>
                        <div className="node-label">{n.label}</div>
                    </div>
                )
            },
            position: { x: 0, y: 0 },
            className: `scrybe-node ${getNodeState(n.id, snapshot)}`
        })), [snapshot]
    );

    const initialEdges = useMemo(() =>
        EDGES_CONFIG.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            animated: true,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#6366f1'
            },
            className: 'scrybe-edge'
        })), []);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [, , onEdgesChange] = useEdgesState(initialEdges);

    // Reactive reposition — grid layout horizontal
    const nodePositions = useMemo(() => {
        const spacing = 240;
        return NODES_CONFIG.reduce((acc, n, i) => {
            acc[n.id] = { x: i * spacing, y: 0 };
            return acc;
        }, {});
    }, []);

    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => ({
                ...node,
                position: nodePositions[node.id] || node.position,
                className: `scrybe-node ${getNodeState(node.id, snapshot)}`
            }))
        );
    }, [snapshot, nodePositions, setNodes]);

    // Viewport centré
    const fitViewOptions = useMemo(() => ({ padding: 0.2, minZoom: 0.6, maxZoom: 1.2 }), []);

    return (
        <div className="pipeline-view-bg">
            <header className="pipeline-view-header">
                <h1>Scrybe — Pipeline de Traitement</h1>
                <p className="subtitle">
                    {connected
                        ? `Connecté au backend — ${snapshot?.status || 'Prêt'}`
                        : 'Déconnexion du backend'}
                </p>
            </header>

            <div style={{ height: 'calc(100vh - 110px)', width: '100%' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={initialEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    fitViewOptions={fitViewOptions}
                    nodeOrigin={[0.5, 0.5]}
                    colorMode="dark"
                >
                    <Controls />
                    <Background
                        color="#475569"
                        gap={16}
                        variant="dots"
                    />
                    <EdgeLabelRenderer>
                        {EDGES_CONFIG.map((edge) => (
                            <div
                                key={edge.id}
                                style={{
                                    position: 'absolute',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    fontSize: 11,
                                    color: '#94a3b8'
                                }}
                            />
                        ))}
                    </EdgeLabelRenderer>
                </ReactFlow>
            </div>

            <footer className="pipeline-legend">
                <span className="legend-item">
                    <span className="legend-dot idle" /> Idle
                </span>
                <span className="legend-item">
                    <span className="legend-dot active" /> Actif
                </span>
                <span className="legend-item">
                    <span className="legend-dot recording" /> Enregistrement
                </span>
                <span className="legend-item">
                    <span className="legend-dot transcribing" /> Transcription
                </span>
            </footer>
        </div>
    );
}
