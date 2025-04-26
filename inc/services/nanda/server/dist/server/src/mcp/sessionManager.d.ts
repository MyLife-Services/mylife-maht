interface ToolCredential {
    toolName: string;
    serverId: string;
    data: string;
}
interface Session {
    id: string;
    anthropicApiKey?: string;
    credentials: ToolCredential[];
    createdAt: Date;
    lastActive: Date;
}
export declare class SessionManager {
    private sessions;
    private encryptionKey;
    private readonly CLEANUP_INTERVAL;
    constructor();
    createSession(): string;
    getOrCreateSession(sessionId: string): Session;
    setAnthropicApiKey(sessionId: string, apiKey: string): void;
    getAnthropicApiKey(sessionId: string): string | undefined;
    setToolCredentials(sessionId: string, toolName: string, serverId: string, credentials: Record<string, string>): void;
    getToolCredentials(sessionId: string, toolName: string, serverId: string): Record<string, string> | null;
    private encryptData;
    private decryptData;
    private cleanupSessions;
    getSession(sessionId: string): Session | undefined;
}
export {};
