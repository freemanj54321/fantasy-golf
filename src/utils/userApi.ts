import { getFunctions, httpsCallable, HttpsCallableResult, Functions } from "firebase/functions";
import { getApp } from "firebase/app";
import { UserData } from '../types/firebase';

const FUNCTIONS_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Silence unused warning — kept for documentation
type _Timeout = typeof FUNCTIONS_TIMEOUT_MS;

class Logger {
    private prefix = '[FirebaseFunctions]';
    info(message: string, ...args: unknown[]): void { console.log(`${this.prefix} ${message}`, ...args); }
    warn(message: string, ...args: unknown[]): void { console.warn(`${this.prefix} ${message}`, ...args); }
    error(message: string, ...args: unknown[]): void { console.error(`${this.prefix} ${message}`, ...args); }
}

const logger = new Logger();

const functions: Functions = getFunctions(getApp());

interface ListUsersResponse { users: UserData[]; }
type ListUsersResponseOrArray = ListUsersResponse | UserData[];

interface SetUserRoleRequest { uid: string; role: 'Administrator' | 'User'; }
interface DeleteUserRequest { uid: string; }
interface UpdateUserNameRequest { uid: string; displayName: string; }
interface ToggleUserDisabledRequest { uid: string; disabled: boolean; }

export interface CreateUserRequest {
    email: string;
    password: string;
    displayName?: string;
    role: 'Administrator' | 'User';
}

export interface CreateUserResponse {
    success: boolean;
    user: UserData;
}

interface FunctionResponse { success: boolean; message?: string; error?: string; }

export async function callWithRetry<T, R>(
    fn: () => Promise<HttpsCallableResult<R>>,
    operation: string,
    retries = MAX_RETRIES
): Promise<R> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.info(`${operation} (attempt ${attempt}/${retries})`);
            const result = await fn();
            logger.info(`${operation} succeeded`);
            return result.data;
        } catch (error: any) {
            const isLastAttempt = attempt === retries;

            if (isLastAttempt) {
                logger.error(`${operation} failed after ${retries} attempts:`, error);
                throw new Error(
                    `Failed to ${operation.toLowerCase()}: ${error.message || String(error)}`
                );
            }

            const isRetryable =
                error.code === 'unavailable' ||
                error.code === 'deadline-exceeded' ||
                error.code === 'internal';

            if (!isRetryable) {
                logger.error(`${operation} failed with non-retryable error:`, error);
                throw new Error(
                    `Failed to ${operation.toLowerCase()}: ${error.message || String(error)}`
                );
            }

            logger.warn(`${operation} failed, retrying in ${RETRY_DELAY_MS}ms...`, error.message);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
    }

    throw new Error(`Failed to ${operation.toLowerCase()} after ${retries} attempts`);
}

const listUsersCallable = httpsCallable<void, ListUsersResponseOrArray>(functions, 'listUsers');
const setUserRoleCallable = httpsCallable<SetUserRoleRequest, FunctionResponse>(functions, 'setUserRole');
const toggleUserDisabledCallable = httpsCallable<ToggleUserDisabledRequest, FunctionResponse>(functions, 'toggleUserDisabled');
const deleteUserCallable = httpsCallable<DeleteUserRequest, FunctionResponse>(functions, 'deleteUser');
const updateUserNameCallable = httpsCallable<UpdateUserNameRequest, FunctionResponse>(functions, 'updateUserName');
const createUserCallable = httpsCallable<CreateUserRequest, CreateUserResponse>(functions, 'createUser');

export const auth_get_users = async (): Promise<UserData[]> => {
    try {
        logger.info('Fetching users from Firebase Auth');
        const response = await callWithRetry<void, ListUsersResponseOrArray>(
            () => listUsersCallable(),
            'Fetch users'
        );
        let users: UserData[];
        if (Array.isArray(response)) {
            users = response;
        } else if (response && Array.isArray(response.users)) {
            users = response.users;
        } else {
            logger.warn('Invalid response format from listUsers function');
            return [];
        }
        logger.info(`Successfully fetched ${users.length} users`);
        return users;
    } catch (error) {
        logger.error('Error fetching users:', error);
        throw new Error(`Failed to fetch users: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const auth_update_user = async (
    uid: string,
    data: { customClaims?: { [key: string]: any }; disabled?: boolean; }
): Promise<void> => {
    if (!uid) throw new Error('User ID is required');
    try {
        const operations: Promise<any>[] = [];
        if (data.customClaims !== undefined) {
            const role = data.customClaims.admin ? 'Administrator' : 'User';
            logger.info(`Setting role for user ${uid} to ${role}`);
            operations.push(
                callWithRetry<SetUserRoleRequest, FunctionResponse>(
                    () => setUserRoleCallable({ uid, role }),
                    `Set user role to ${role}`
                )
            );
        }
        if (data.disabled !== undefined) {
            const action = data.disabled ? 'Disabling' : 'Enabling';
            logger.info(`${action} user ${uid}`);
            operations.push(
                callWithRetry<ToggleUserDisabledRequest, FunctionResponse>(
                    () => toggleUserDisabledCallable({ uid, disabled: data.disabled! }),
                    `${action} user`
                )
            );
        }
        if (operations.length === 0) { logger.warn('No update operations specified'); return; }
        await Promise.all(operations);
        logger.info(`Successfully updated user ${uid}`);
    } catch (error) {
        logger.error(`Error updating user ${uid}:`, error);
        throw new Error(`Failed to update user: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const auth_create_user = async (data: {
    email: string;
    password: string;
    displayName?: string;
    role: 'Administrator' | 'User';
}): Promise<UserData> => {
    if (!data.email || !data.password) throw new Error('Email and password are required');
    try {
        logger.info(`Creating user with email: ${data.email}`);
        const response = await callWithRetry<CreateUserRequest, CreateUserResponse>(
            () => createUserCallable(data),
            'Create user'
        );
        logger.info(`Successfully created user: ${response.user.uid}`);
        return response.user;
    } catch (error) {
        logger.error('Error creating user:', error);
        throw new Error(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const auth_delete_user = async (uid: string): Promise<void> => {
    if (!uid) throw new Error('User ID is required for deletion');
    try {
        logger.info(`Deleting user: ${uid}`);
        await callWithRetry<DeleteUserRequest, FunctionResponse>(
            () => deleteUserCallable({ uid }),
            'Delete user'
        );
        logger.info(`Successfully deleted user: ${uid}`);
    } catch (error) {
        logger.error(`Error deleting user ${uid}:`, error);
        throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const auth_update_user_name = async (uid: string, displayName: string): Promise<void> => {
    if (!uid) throw new Error('User ID is required to update name');
    try {
        logger.info(`Updating name for user: ${uid} to ${displayName}`);
        await callWithRetry<UpdateUserNameRequest, FunctionResponse>(
            () => updateUserNameCallable({ uid, displayName }),
            'Update user name'
        );
        logger.info(`Successfully updated name for user: ${uid}`);
    } catch (error) {
        logger.error(`Error updating name for user ${uid}:`, error);
        throw new Error(`Failed to update user name: ${error instanceof Error ? error.message : String(error)}`);
    }
};
