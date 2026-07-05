export declare class N8nService {
    private getBaseUrl;
    checkHealth(): Promise<boolean>;
    emitEvent(eventName: string, payload: any): Promise<boolean>;
}
