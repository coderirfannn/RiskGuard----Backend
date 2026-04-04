export const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    // Mongoose casting err handles
    if(err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404;
        err.message = 'Resource not found';
    }

    // Validation handling
    if(err.name === 'ValidationError') {
        statusCode = 400;
        err.message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    res.status(statusCode).json({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};
