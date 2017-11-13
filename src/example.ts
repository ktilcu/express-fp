import * as bodyParser from 'body-parser';
import * as express from 'express';
import { BadRequest, JsValue, jsValueWriteable, Ok } from 'express-result-types/target/result';
import * as session from 'express-session';
import * as http from 'http';
import * as t from 'io-ts';

import { NumberFromString, validationErrorsToBadRequest } from './helpers/example';
import { wrap } from './index';

const app = express();
app.use(session({ secret: 'foo' }));
// Don't parse body using middleware. Body parsing is instead handled in the request handler.
app.use(bodyParser.text({ type: 'application/json' }));

const QueryParams = t.interface({
    age: NumberFromString,
    gender: t.union([t.literal('male'), t.literal('female')]),
});

const requestHandler = wrap(req => {
    const maybeQueryParams = req.query
        .get('age')
        .chain(age => req.query.get('gender').map(gender => ({ age, gender })));

    return maybeQueryParams.fold(
        () =>
            BadRequest.apply(
                new JsValue(["Expecting query parameters 'age' and 'gender'."]),
                jsValueWriteable,
            ),
        queryParams =>
            t
                .validate(queryParams, QueryParams)
                .fold(validationErrorsToBadRequest('query params'), validatedQueryParams =>
                    Ok.apply(new JsValue(validatedQueryParams), jsValueWriteable),
                ),
    );
});

const sessionRequestHandler = wrap(req => {
    const maybeUserId = req.session.get('userId');

    return maybeUserId.fold(
        () => Ok.apply(new JsValue({}), jsValueWriteable).withSession(new Map([['userId', 'foo']])),
        userId => Ok.apply(new JsValue({ userId }), jsValueWriteable),
    );
});

app.post('/', requestHandler);
app.get('/session', sessionRequestHandler);

const onListen = (server: http.Server) => {
    const { port } = server.address();

    console.log(`Server running on port ${port}`);
};

const httpServer = http.createServer(
    // TODO: Investigate bug in Express/Node typings
    // @ts-ignore
    app,
);
httpServer.listen(8080, () => {
    onListen(httpServer);
});

// ❯ curl --request POST --silent --header 'Content-Type: application/json' \
//     --data '{ "name": 1 }' "localhost:8080/" | jq '.'
// [
//   "Expecting query parameter 'age', but instead got none."
// ]

// ❯ curl --request POST --silent --header 'Content-Type: invalid' \
//     --data '{ "name": 1 }' "localhost:8080/" | jq '.'
// [
//   "Expecting request header 'Content-Type' to equal 'application/json', but instead got 'invalid'."
// ]

// ❯ curl --request POST --silent --header 'Content-Type: application/json' \
//     --data 'invalid' "localhost:8080/" | jq '.'
// [
//   "JSON parsing error: Unexpected token i in JSON at position 0"
// ]

// ❯ curl --request POST --silent --header 'Content-Type: application/json' \
//     --data '{ "name": "bob" }' "localhost:8080/?age=foo" | jq '.'
// [
//   "Validation errors for age: Expecting NumberFromString but instead got: \"foo\"."
// ]

// ❯ curl --request POST --silent --header 'Content-Type: application/json' \
//     --data '{ "name": "bob" }' "localhost:8080/?age=5" | jq '.'
// {
//   "name": "bob",
//   "age": 5
// }
