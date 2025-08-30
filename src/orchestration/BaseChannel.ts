/**
 * RxJS Channel Implementation
 * Base channel class that provides message passing capabilities using RxJS
 */

import { Subject, Observable, BehaviorSubject, ReplaySubject } from 'rxjs';
import { filter, map, share, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from './types';

/**
 * Base RxJS Channel implementation
 */
export abstract class BaseChannel<T extends BaseMessage> {
  protected _messages$ = new Subject<T>();
  protected _replaySubject?: ReplaySubject<T>;
  protected _isActive = new BehaviorSubject<boolean>(false);
  
  public readonly messages$: Observable<T>;
  public readonly isActive$: Observable<boolean>;
  
  protected messageCount = 0;
  protected errorCount = 0;
  
  constructor(
    protected channelName: string,
    protected enableReplay = false,
    protected replayBufferSize = 100,
    protected enableLogging = true
  ) {
    // Setup replay if enabled
    if (enableReplay) {
      this._replaySubject = new ReplaySubject<T>(replayBufferSize);
      this._messages$.subscribe(this._replaySubject);
      this.messages$ = this._replaySubject.asObservable().pipe(share());
    } else {
      this.messages$ = this._messages$.asObservable().pipe(share());
    }
    
    this.isActive$ = this._isActive.asObservable();
    
    // Setup logging if enabled
    if (enableLogging) {
      this.messages$.pipe(
        tap(message => this.logMessage(message))
      ).subscribe();
    }
  }
  
  /**
   * Send a message to the channel
   */
  public send(message: Omit<T, 'id' | 'timestamp'>): void {
    if (!this._isActive.value) {
      console.warn(`Channel ${this.channelName} is not active, message discarded`);
      return;
    }
    
    try {
      const fullMessage = this.enrichMessage(message as T);
      this._messages$.next(fullMessage);
      this.messageCount++;
    } catch (error) {
      this.errorCount++;
      console.error(`Error sending message to ${this.channelName}:`, error);
      this.handleError(error as Error, message as Partial<T>);
    }
  }
  
  /**
   * Subscribe to channel messages
   */
  public subscribe(handler: (message: T) => void): () => void {
    const subscription = this.messages$.subscribe({
      next: handler,
      error: (error) => {
        this.errorCount++;
        console.error(`Error in ${this.channelName} subscription:`, error);
      }
    });
    
    return () => subscription.unsubscribe();
  }
  
  /**
   * Filter messages by type
   */
  public filter<K extends T['type']>(type: K): Observable<T & { type: K }> {
    return this.messages$.pipe(
      filter((message): message is T & { type: K } => message.type === type)
    );
  }
  
  /**
   * Filter messages by source
   */
  public filterBySource(source: string): Observable<T> {
    return this.messages$.pipe(
      filter(message => message.source === source)
    );
  }
  
  /**
   * Map messages to extract payload
   */
  public mapToPayload<P = any>(): Observable<P> {
    return this.messages$.pipe(
      map(message => message.payload as P)
    );
  }
  
  /**
   * Start the channel
   */
  public start(): void {
    if (this._isActive.value) return;
    
    this._isActive.next(true);
    this.onStart();
    
    if (this.enableLogging) {
      console.log(`📡 Channel ${this.channelName} started`);
    }
  }
  
  /**
   * Stop the channel
   */
  public stop(): void {
    if (!this._isActive.value) return;
    
    this._isActive.next(false);
    this.onStop();
    
    if (this.enableLogging) {
      console.log(`📡 Channel ${this.channelName} stopped`);
    }
  }
  
  /**
   * Destroy the channel and clean up resources
   */
  public destroy(): void {
    this.stop();
    this._messages$.complete();
    this._replaySubject?.complete();
    this._isActive.complete();
    
    if (this.enableLogging) {
      console.log(`🗑️ Channel ${this.channelName} destroyed`);
    }
  }
  
  /**
   * Get channel statistics
   */
  public getStats(): ChannelStats {
    return {
      channelName: this.channelName,
      isActive: this._isActive.value,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      hasReplay: !!this._replaySubject,
      replayBufferSize: this.replayBufferSize,
      enableLogging: this.enableLogging
    };
  }
  
  // ===== Protected Methods =====
  
  protected enrichMessage(message: T): T {
    return {
      ...message,
      id: uuidv4(),
      timestamp: Date.now()
    } as T;
  }
  
  protected logMessage(message: T): void {
    const logPrefix = `[${this.channelName}]`;
    const messageInfo = `${message.type} from ${message.source}`;
    
    if (message.type.includes('error')) {
      console.error(`${logPrefix} ❌ ${messageInfo}`, message.payload);
    } else if (message.type.includes('warning') || message.type.includes('warn')) {
      console.warn(`${logPrefix} ⚠️ ${messageInfo}`, message.payload);
    } else {
      console.log(`${logPrefix} 📨 ${messageInfo}`, message.payload);
    }
  }
  
  protected handleError(error: Error, message: Partial<T>): void {
    // Override in subclasses for custom error handling
    console.error(`Channel ${this.channelName} error:`, error, message);
  }
  
  protected onStart(): void {
    // Override in subclasses for custom start behavior
  }
  
  protected onStop(): void {
    // Override in subclasses for custom stop behavior
  }
}

/**
 * Channel statistics interface
 */
export interface ChannelStats {
  channelName: string;
  isActive: boolean;
  messageCount: number;
  errorCount: number;
  hasReplay: boolean;
  replayBufferSize: number;
  enableLogging: boolean;
}
