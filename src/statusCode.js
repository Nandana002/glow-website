
const HttpStatus = Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    CONFLICT: 409
});

export{HttpStatus}
//res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "An error occurred while adding the category" });
