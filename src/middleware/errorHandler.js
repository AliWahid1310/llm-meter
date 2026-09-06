/**
 * Error Handler Middleware — catches all errors and returns clean responses.
 * 
 * Bad input → 4xx with clear message, NEVER a 500.
 * Unexpected errors → 500 with generic message (details logged server-side).
 */

function errorHandler(err, req, res, next) {
    // Log the full error server-side
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // For 4xx errors, return the error message (it's safe for clients)
    if (statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({
            error: true,
            statusCode,
            message: err.message,
            ...(err.details && { details: err.details }),
        });
    }

    // For 5xx errors, return a generic message (don't leak internals)
    return res.status(500).json({
        error: true,
        statusCode: 500,
        message: 'Internal server error. Please try again later.',
    });
}

module.exports = errorHandler;
