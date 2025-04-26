// server/src/mcp/sessionManager.ts
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

interface ToolCredential {
  toolName: string;
  serverId: string;
  data: string; // Encrypted credentials
}

interface Session {
  id: string;
  anthropicApiKey?: string;
  credentials: ToolCredential[];
  createdAt: Date;
  lastActive: Date;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private encryptionKey: Buffer;

  // Session cleanup interval in milliseconds (1 hour)
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;

  constructor() {
    // Set up session cleanup
    setInterval(() => this.cleanupSessions(), this.CLEANUP_INTERVAL);
    
    // Generate or load encryption key (in production, this should be loaded from a secure source)
    this.encryptionKey = Buffer.from(
      process.env.CREDENTIAL_ENCRYPTION_KEY || 
      crypto.randomBytes(32).toString('hex'), 
      'hex'
    );
  }

  createSession(): string {
    const sessionId = uuidv4();
    const now = new Date();

    this.sessions.set(sessionId, {
      id: sessionId,
      credentials: [],
      createdAt: now,
      lastActive: now,
    });

    return sessionId;
  }

  // Get an existing session or create a new one if it doesn't exist
  getOrCreateSession(sessionId: string): Session {
    // Try to get existing session first
    let session = this.sessions.get(sessionId);
    
    // If session exists, update last active time and return it
    if (session) {
      console.log(`Using existing session: ${sessionId}`);
      session.lastActive = new Date();
      this.sessions.set(sessionId, session);
      return session;
    }
    
    // If session doesn't exist, create a new one with the requested ID
    console.log(`Creating new session with provided ID: ${sessionId}`);
    const now = new Date();
    
    session = {
      id: sessionId,
      credentials: [],
      createdAt: now,
      lastActive: now,
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  setAnthropicApiKey(sessionId: string, apiKey: string): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.anthropicApiKey = apiKey;
      session.lastActive = new Date();
      this.sessions.set(sessionId, session);
    }
  }

  getAnthropicApiKey(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.anthropicApiKey;
  }

  // Store credentials for a tool
  setToolCredentials(
    sessionId: string, 
    toolName: string, 
    serverId: string, 
    credentials: Record<string, string>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Cannot store credentials: Session ${sessionId} not found`);
      return;
    }

    // Log the credentials being stored (key names only for security)
    console.log(`🔐 Storing credentials for tool: ${toolName}, server: ${serverId}`);
    console.log(`🔑 Credential keys: ${JSON.stringify(Object.keys(credentials))}`);

    // Remove any existing credentials for this tool
    session.credentials = session.credentials.filter(
      cred => !(cred.toolName === toolName && cred.serverId === serverId)
    );

    // Encrypt the credentials
    const encrypted = this.encryptData(JSON.stringify(credentials));
    
    // Add the new credentials
    session.credentials.push({
      toolName,
      serverId,
      data: encrypted
    });

    console.log(`✅ Credentials stored successfully for ${toolName}`);

    session.lastActive = new Date();
    this.sessions.set(sessionId, session);
  }

  // Get credentials for a tool
  getToolCredentials(
    sessionId: string,
    toolName: string,
    serverId: string
  ): Record<string, string> | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`❌ Cannot retrieve credentials: Session ${sessionId} not found`);
      return null;
    }

    const credential = session.credentials.find(
      cred => cred.toolName === toolName && cred.serverId === serverId
    );

    if (!credential) {
      console.log(`❌ No credentials found for tool ${toolName}, server ${serverId}`);
      return null;
    }

    try {
      // Decrypt the credentials
      const decrypted = this.decryptData(credential.data);
      const parsedCredentials = JSON.parse(decrypted);
      
      console.log(`✅ Credentials retrieved successfully for ${toolName}, server ${serverId}`);
      console.log(`🔑 Retrieved credential keys: ${JSON.stringify(Object.keys(parsedCredentials))}`);
      
      return parsedCredentials;
    } catch (error) {
      console.error(`Error decrypting credentials for tool ${toolName}:`, error);
      return null;
    }
  }

  // Encrypt data using AES-256-GCM
  private encryptData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Return IV + AuthTag + Encrypted data as base64 string
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  // Decrypt data using AES-256-GCM
  private decryptData(encryptedBase64: string): string {
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
    
    // Extract IV, AuthTag, and encrypted data
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const encrypted = encryptedBuffer.subarray(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

  private cleanupSessions(): void {
    const now = new Date();
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActive.getTime();

      if (inactiveTime > SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);

    if (session) {
      // Update last active time
      session.lastActive = new Date();
      this.sessions.set(sessionId, session);
    }

    return session;
  }
}
