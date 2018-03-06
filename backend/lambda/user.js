const { Pool } = require('pg');
const randtoken = require('rand-token');

const pool = new Pool({
    max: 1,
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000
});

const createUserQuery = `
INSERT INTO users (
  email,
  token,
  location,
  zoom,
  campaign)
VALUES (
  $1::VARCHAR(255),
  $2::VARCHAR(32),
  ST_MAKEPOINT($3, $4)::GEOGRAPHY,
  $5::SMALLINT,
  $6::INTEGER)
RETURNING
  id,
  email,
  token,
  ST_X(location::geometry) AS lng,
  ST_Y(location::geometry) AS lat,
  zoom,
  campaign AS campaign_id;
`;

const getUserQuery = `
SELECT
  id,
  email,
  token,
  ST_X(location::geometry) AS lng,
  ST_Y(location::geometry) AS lat,
  zoom,
  campaign AS campaign_id
 FROM users
WHERE id = $1
  AND token = $2
LIMIT 1;
`;

const updateUserQuery = `
UPDATE users
   SET email = $3,
       location = ST_MAKEPOINT($4, $5)::GEOGRAPHY,
       zoom = $6
 WHERE id = $1::INTEGER
   AND token = $2::VARCHAR(32)
RETURNING
     id,
     email,
     token,
     ST_X(location::geometry) AS lng,
     ST_Y(location::geometry) AS lat,
     zoom,
     campaign AS campaign_id;
`;

const deleteUserQuery = `
DELETE
  FROM users
 WHERE id = $1
   AND token = $2;
`;

function userDBQuery(query, params, callback) {
  let response = {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    statusCode: 200,
    body: ''
  };

  let errorResponse = {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    statusCode: 500,
    body: ''
  };

  pool.query(query, params)
    .then(result => {
      let user = result.rows[0];
      if (user) {
        user.location = { 'lng': user.lng, 'lat': user.lat };
        delete user.lng;
        delete user.lat;
      }

      response.body = JSON.stringify({user: user});

      callback(null, response);
    })
    .catch(error => {
      console.error(error.stack);
      errorResponse.body = JSON.stringify({error: "Database Error"});

      callback(null, errorResponse);
    });
}

exports.createUserHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let data = JSON.parse(event.body);
  let token = randtoken.generate(32);

  userDBQuery(
    createUserQuery,
    [data.email,
     token,
     data.location.lng,
     data.location.lat,
     data.zoom,
     data.campaign_id
    ],
    callback
  );
};

exports.updateUserHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let data = JSON.parse(event.body);
  let id = parseInt(event.pathParameters.id);

  userDBQuery(
    updateUserQuery,
    [id,
     data.token,
     data.email,
     data.location.lng,
     data.location.lat,
     data.zoom],
    callback
  );
};

exports.getUserHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  let id = parseInt(event.pathParameters.id);
  let token = event.queryStringParameters.token;

  userDBQuery(getUserQuery, [id, token], callback);
};

exports.deleteUserHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  let id = parseInt(event.pathParameters.id);
  let token = '';
  if (event.queryStringParameters) {
    token = event.queryStringParameters.token;
  }

  userDBQuery(
    deleteUserQuery,
    [id, token],
    callback
  );
};
