import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: any): Promise<any>;
    register(body: any): Promise<any>;
    refresh(body: any): Promise<any>;
}
