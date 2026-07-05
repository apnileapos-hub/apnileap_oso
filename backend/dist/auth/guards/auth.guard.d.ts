import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class AuthGuard implements CanActivate {
    private publicKeys;
    canActivate(context: ExecutionContext): Promise<boolean>;
    private getSigningKey;
}
