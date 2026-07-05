export declare class BookstackService {
    private getBaseUrl;
    private getTokenId;
    private getTokenSecret;
    private getHeaders;
    private hasBookStack;
    checkHealth(): Promise<boolean>;
    createShelf(name: string, description?: string): Promise<any>;
    createBook(name: string, description?: string): Promise<any>;
    associateBookToShelf(shelfId: number, bookId: number): Promise<boolean>;
    createPage(bookId: number, name: string, htmlContent: string): Promise<any>;
    provisionCompanyDocumentation(companyName: string): Promise<{
        bookUrl: string;
        shelfUrl: string;
    }>;
}
