/**
 * State Machine MCP Driver - Validation Utilities
 * Provides validation functions for various data types and structures
 */


/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}

/**
 * Validation options
 */
export interface ValidationOptions {
    /** Include warnings in validation */
    includeWarnings?: boolean;
    /** Skip certain validation checks */
    skipChecks?: string[];
    /** Maximum allowed depth for recursive validation */
    maxDepth?: number;
}

/**
 * Common validation utilities
 */
export class Validators {
    /**
     * Validate if a string is a valid ID (alphanumeric, dashes, underscores)
     */
    static isValidId(id: string): boolean {
        return /^[a-zA-Z0-9_-]+$/.test(id);
    }

    /**
     * Validate if a string is a valid URL
     */
    static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate if a value is a non-empty string
     */
    static isNonEmptyString(value: any): boolean {
        return typeof value === "string" && value.trim().length > 0;
    }

    /**
     * Validate if a value is a positive number
     */
    static isPositiveNumber(value: any): boolean {
        return typeof value === "number" && value > 0 && !isNaN(value);
    }

    /**
     * Validate if a value is a valid timestamp
     */
    static isValidTimestamp(value: any): boolean {
        return (
            typeof value === "number" &&
            value > 0 &&
            value <= Date.now() + 86400000
        ); // Max 1 day in future
    }

    /**
     * Validate if an object has required properties
     */
    static hasRequiredProperties(obj: any, requiredProps: string[]): string[] {
        const missing: string[] = [];
        requiredProps.forEach((prop) => {
            if (
                !(prop in obj) ||
                obj[prop] === undefined ||
                obj[prop] === null
            ) {
                missing.push(prop);
            }
        });
        return missing;
    }
}


