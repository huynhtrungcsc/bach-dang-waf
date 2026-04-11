/**
 * Base application error class
 */
export class WafException extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, WafException.prototype);
  }
}

export class RequestException extends WafException {
  constructor(message: string = 'Validation failed') {
    super(message, 400);
    Object.setPrototypeOf(this, RequestException.prototype);
  }
}

export class NotFoundException extends WafException {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}

export class UnauthorizedException extends WafException {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    Object.setPrototypeOf(this, UnauthorizedException.prototype);
  }
}

export class ForbiddenException extends WafException {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenException.prototype);
  }
}

export class DuplicateException extends WafException {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
    Object.setPrototypeOf(this, DuplicateException.prototype);
  }
}
