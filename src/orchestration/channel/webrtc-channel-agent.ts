/**
 * WebRTC Channel Agent
 * Handles peer-to-peer WebRTC connections as part of the orchestration system
 */

import { ChannelAgent } from "../types";
import { AppMessage, SysMessage, UIMessage } from "../types";
import { Logger } from "../../utils/logger";
import { Subject, Observable, merge, fromEvent, EMPTY } from "rxjs";
import { takeUntil, filter, map, catchError, tap } from "rxjs/operators";

export interface WebRTCConfiguration {
    iceServers: RTCIceServer[];
    enableVideo?: boolean;
    enableAudio?: boolean;
    enableDataChannel?: boolean;
    stunServers?: string[];
    turnServers?: Array<{
        urls: string;
        username?: string;
        credential?: string;
    }>;
}

export interface WebRTCPeer {
    id: string;
    connection: RTCPeerConnection;
    dataChannel?: RTCDataChannel;
    localStream?: MediaStream;
    remoteStream?: MediaStream;
    state: RTCPeerConnectionState;
    isInitiator: boolean;
}

export interface WebRTCSignalingMessage {
    type: "offer" | "answer" | "ice-candidate" | "peer-request" | "peer-response";
    peerId: string;
    data: any;
}

/**
 * WebRTC Channel Agent for orchestration system
 */
export class WebRTCChannelAgent implements ChannelAgent {
    readonly name = "webrtc";
    readonly version = "1.0.0";
    readonly id = `webrtc-${Date.now()}`;
    
    private destroy$ = new Subject<void>();
    private peers = new Map<string, WebRTCPeer>();
    private localStream?: MediaStream;
    private config: WebRTCConfiguration;
    
    // Event streams
    private connectionEvents$ = new Subject<{
        type: "peer-connected" | "peer-disconnected" | "data-received" | "stream-received";
        peerId: string;
        data?: any;
    }>();
    
    private errorEvents$ = new Subject<{
        type: "connection-failed" | "media-error" | "signaling-error";
        peerId?: string;
        error: Error;
    }>();

    constructor(config: Partial<WebRTCConfiguration> = {}) {
        this.config = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ],
            enableVideo: true,
            enableAudio: true,
            enableDataChannel: true,
            ...config
        };
        
        Logger.info(`[WebRTCChannelAgent] Initialized with config`, this.config);
    }

    /**
     * Start the WebRTC agent
     */
    async start(): Promise<void> {
        return this.initialize();
    }

    /**
     * Initialize the WebRTC agent (ChannelAgent interface)
     */
    async initialize(): Promise<void> {
        Logger.info(`[WebRTCChannelAgent] Initializing...`);
        
        try {
            // Initialize local media stream if video/audio enabled
            if (this.config.enableVideo || this.config.enableAudio) {
                await this.initializeLocalStream();
            }
            
            Logger.info(`[WebRTCChannelAgent] Initialized successfully`);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            Logger.error(`[WebRTCChannelAgent] Failed to start:`, err);
            throw error;
        }
    }

    /**
     * Stop the WebRTC agent
     */
    async stop(): Promise<void> {
        return this.shutdown();
    }

    /**
     * Shutdown the WebRTC agent (ChannelAgent interface)
     */
    async shutdown(): Promise<void> {
        Logger.info(`[WebRTCChannelAgent] Shutting down...`);
        
        // Close all peer connections
        for (const [peerId, peer] of this.peers) {
            await this.disconnectPeer(peerId);
        }
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = undefined;
        }
        
        this.destroy$.next();
        this.destroy$.complete();
        
        Logger.info(`[WebRTCChannelAgent] Shut down`);
    }

    /**
     * Initialize local media stream
     */
    private async initializeLocalStream(): Promise<void> {
        try {
            const constraints: MediaStreamConstraints = {
                video: this.config.enableVideo,
                audio: this.config.enableAudio
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            Logger.info(`[WebRTCChannelAgent] Local stream initialized`);
            
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            Logger.error(`[WebRTCChannelAgent] Failed to get local stream:`, err);
            this.errorEvents$.next({
                type: "media-error",
                error: err
            });
            throw error;
        }
    }

    /**
     * Create connection to a peer
     */
    async connectToPeer(peerId: string, isInitiator = false): Promise<WebRTCPeer> {
        Logger.info(`[WebRTCChannelAgent] Connecting to peer ${peerId} (initiator: ${isInitiator})`);
        
        if (this.peers.has(peerId)) {
            throw new Error(`Already connected to peer ${peerId}`);
        }

        const connection = new RTCPeerConnection({
            iceServers: this.config.iceServers
        });

        const peer: WebRTCPeer = {
            id: peerId,
            connection,
            state: connection.connectionState,
            isInitiator
        };

        // Setup connection event handlers
        this.setupPeerConnectionHandlers(peer);

        // Add local stream to connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                connection.addTrack(track, this.localStream!);
            });
        }

        // Create data channel if enabled and we're the initiator
        if (this.config.enableDataChannel && isInitiator) {
            peer.dataChannel = connection.createDataChannel("gameData", {
                ordered: true
            });
            this.setupDataChannelHandlers(peer);
        }

        this.peers.set(peerId, peer);

        // If we're the initiator, create and send offer
        if (isInitiator) {
            await this.createAndSendOffer(peer);
        }

        return peer;
    }

    /**
     * Disconnect from a peer
     */
    async disconnectPeer(peerId: string): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) {
            Logger.warn(`[WebRTCChannelAgent] Peer ${peerId} not found for disconnection`);
            return;
        }

        Logger.info(`[WebRTCChannelAgent] Disconnecting from peer ${peerId}`);

        // Close data channel
        if (peer.dataChannel) {
            peer.dataChannel.close();
        }

        // Close connection
        peer.connection.close();

        this.peers.delete(peerId);

        this.connectionEvents$.next({
            type: "peer-disconnected",
            peerId
        });
    }

    /**
     * Handle incoming signaling message
     */
    async handleSignalingMessage(message: WebRTCSignalingMessage): Promise<void> {
        const { type, peerId, data } = message;
        
        Logger.debug(`[WebRTCChannelAgent] Handling signaling message: ${type} from ${peerId}`);

        try {
            switch (type) {
                case "offer":
                    await this.handleOffer(peerId, data);
                    break;
                case "answer":
                    await this.handleAnswer(peerId, data);
                    break;
                case "ice-candidate":
                    await this.handleIceCandidate(peerId, data);
                    break;
                case "peer-request":
                    await this.handlePeerRequest(peerId, data);
                    break;
                default:
                    Logger.warn(`[WebRTCChannelAgent] Unknown signaling message type: ${type}`);
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            Logger.error(`[WebRTCChannelAgent] Error handling signaling message:`, err);
            this.errorEvents$.next({
                type: "signaling-error",
                peerId,
                error: err
            });
        }
    }

    /**
     * Send data to a peer
     */
    async sendDataToPeer(peerId: string, data: any): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== "open") {
            throw new Error(`Cannot send data to peer ${peerId}: not connected or no data channel`);
        }

        try {
            const message = JSON.stringify(data);
            peer.dataChannel.send(message);
            Logger.debug(`[WebRTCChannelAgent] Sent data to peer ${peerId}:`, data);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            Logger.error(`[WebRTCChannelAgent] Failed to send data to peer ${peerId}:`, err);
            throw err;
        }
    }

    /**
     * Broadcast data to all connected peers
     */
    async broadcastData(data: any): Promise<void> {
        const connectedPeers = Array.from(this.peers.values()).filter(
            peer => peer.dataChannel?.readyState === "open"
        );

        await Promise.all(
            connectedPeers.map(peer => this.sendDataToPeer(peer.id, data))
        );
    }

    /**
     * Get local stream for UI components
     */
    getLocalStream(): MediaStream | undefined {
        return this.localStream;
    }

    /**
     * Get remote stream for a peer
     */
    getRemoteStream(peerId: string): MediaStream | undefined {
        return this.peers.get(peerId)?.remoteStream;
    }

    /**
     * Get all connected peers
     */
    getConnectedPeers(): WebRTCPeer[] {
        return Array.from(this.peers.values()).filter(
            peer => peer.state === "connected"
        );
    }

    /**
     * Observable for connection events
     */
    get connectionEvents(): Observable<any> {
        return this.connectionEvents$.asObservable();
    }

    /**
     * Observable for error events
     */
    get errorEvents(): Observable<any> {
        return this.errorEvents$.asObservable();
    }

    // Private methods for WebRTC handling

    private setupPeerConnectionHandlers(peer: WebRTCPeer): void {
        const { connection } = peer;

        // ICE candidate handling
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                Logger.debug(`[WebRTCChannelAgent] ICE candidate for peer ${peer.id}`);
                // This would be sent through the signaling channel (AlephScript)
                this.sendSignalingMessage({
                    type: "ice-candidate",
                    peerId: peer.id,
                    data: event.candidate
                });
            }
        };

        // Connection state changes
        connection.onconnectionstatechange = () => {
            peer.state = connection.connectionState;
            Logger.info(`[WebRTCChannelAgent] Peer ${peer.id} state: ${peer.state}`);
            
            if (peer.state === "connected") {
                this.connectionEvents$.next({
                    type: "peer-connected",
                    peerId: peer.id
                });
            } else if (peer.state === "disconnected" || peer.state === "failed") {
                this.connectionEvents$.next({
                    type: "peer-disconnected",
                    peerId: peer.id
                });
            }
        };

        // Remote stream handling
        connection.ontrack = (event) => {
            Logger.info(`[WebRTCChannelAgent] Received remote stream from peer ${peer.id}`);
            peer.remoteStream = event.streams[0];
            this.connectionEvents$.next({
                type: "stream-received",
                peerId: peer.id,
                data: peer.remoteStream
            });
        };

        // Data channel handling (for non-initiators)
        connection.ondatachannel = (event) => {
            peer.dataChannel = event.channel;
            this.setupDataChannelHandlers(peer);
        };
    }

    private setupDataChannelHandlers(peer: WebRTCPeer): void {
        if (!peer.dataChannel) return;

        peer.dataChannel.onopen = () => {
            Logger.info(`[WebRTCChannelAgent] Data channel opened for peer ${peer.id}`);
        };

        peer.dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                Logger.debug(`[WebRTCChannelAgent] Received data from peer ${peer.id}:`, data);
                
                this.connectionEvents$.next({
                    type: "data-received",
                    peerId: peer.id,
                    data
                });
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                Logger.error(`[WebRTCChannelAgent] Failed to parse data from peer ${peer.id}:`, err);
            }
        };

        peer.dataChannel.onclose = () => {
            Logger.info(`[WebRTCChannelAgent] Data channel closed for peer ${peer.id}`);
        };

        peer.dataChannel.onerror = (error: any) => {
            Logger.error(`[WebRTCChannelAgent] Data channel error for peer ${peer.id}:`, error);
        };
    }

    private async createAndSendOffer(peer: WebRTCPeer): Promise<void> {
        try {
            const offer = await peer.connection.createOffer();
            await peer.connection.setLocalDescription(offer);
            
            this.sendSignalingMessage({
                type: "offer",
                peerId: peer.id,
                data: offer
            });
        } catch (error: any) {
            Logger.error(`[WebRTCChannelAgent] Failed to create offer for peer ${peer.id}:`, error);
            throw error;
        }
    }

    private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
        // Create peer connection if it doesn't exist
        let peer = this.peers.get(peerId);
        if (!peer) {
            peer = await this.connectToPeer(peerId, false);
        }

        await peer.connection.setRemoteDescription(offer);
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);

        this.sendSignalingMessage({
            type: "answer",
            peerId,
            data: answer
        });
    }

    private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`Peer ${peerId} not found for answer`);
        }

        await peer.connection.setRemoteDescription(answer);
    }

    private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
        const peer = this.peers.get(peerId);
        if (!peer) {
            Logger.warn(`[WebRTCChannelAgent] Peer ${peerId} not found for ICE candidate`);
            return;
        }

        await peer.connection.addIceCandidate(candidate);
    }

    private async handlePeerRequest(peerId: string, data: any): Promise<void> {
        // Handle incoming peer connection request
        Logger.info(`[WebRTCChannelAgent] Peer request from ${peerId}`);
        
        // Auto-accept for now, could be made configurable
        await this.connectToPeer(peerId, false);
        
        this.sendSignalingMessage({
            type: "peer-response",
            peerId,
            data: { accepted: true }
        });
    }

    /**
     * Send signaling message (to be overridden by implementations)
     * This would typically go through AlephScriptClient
     */
    protected sendSignalingMessage(message: WebRTCSignalingMessage): void {
        // This method should be overridden to send through the appropriate channel
        // For now, just log it
        Logger.debug(`[WebRTCChannelAgent] Would send signaling message:`, message);
    }

    // ChannelAgent interface implementation
    async processAppMessage(message: AppMessage): Promise<void> {
        // Handle app-level WebRTC commands
        if (message.type === "agent_command" && message.payload.command?.type === "webrtc") {
            const { action, peerId, data } = message.payload.command;
            
            switch (action) {
                case "connect":
                    await this.connectToPeer(peerId, true);
                    break;
                case "disconnect":
                    await this.disconnectPeer(peerId);
                    break;
                case "send-data":
                    await this.sendDataToPeer(peerId, data);
                    break;
                case "broadcast":
                    await this.broadcastData(data);
                    break;
            }
        }
    }

    async processSysMessage(message: SysMessage): Promise<void> {
        // Handle system-level messages (health checks, etc.)
        if (message.type === "health_check") {
            const connectedCount = this.getConnectedPeers().length;
            Logger.debug(`[WebRTCChannelAgent] Health check - ${connectedCount} peers connected`);
        }
    }

    async processUIMessage(message: UIMessage): Promise<void> {
        // Handle UI-level messages (signaling, etc.)
        if (message.type === "ui_event" && message.payload.command === "webrtc-signaling") {
            if (message?.payload.args) {
                const payload: WebRTCSignalingMessage = JSON.parse(message?.payload.args[0]);
                await this.handleSignalingMessage(payload);
            }

        }
    }
}

export default WebRTCChannelAgent;
