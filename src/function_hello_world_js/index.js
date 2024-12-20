exports.handler = async (event) => {
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello World! From function_hello_world_js main!'),
    };
    return response;
};
