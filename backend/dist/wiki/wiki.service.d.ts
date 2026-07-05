export declare class WikiService {
    private getBaseUrl;
    private getToken;
    private getHeaders;
    checkHealth(): Promise<boolean>;
    provisionCompanyDocumentation(companyName: string): Promise<{
        spaceUrl: string;
        pageUrl: string;
    }>;
}
