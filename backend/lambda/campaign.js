const { Pool } = require('pg');
const randtoken = require('rand-token');

const mailgun_sender = process.env.MAILGUN_SENDER;
const mailgun_sender_name = process.env.MAILGUN_SENDER_NAME;
const mailgun_domain = process.env.MAILGUN_DOMAIN;
const mailgun_apikey = process.env.MAILGUN_APIKEY;

const mailgun = require('mailgun-js')(
  {
    apiKey: mailgun_apikey,
    domain: mailgun_domain,
    timeout: 1000
});

const pool = new Pool({
    max: 1,
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000
});

const createCampaignQuery = `
INSERT INTO campaigns (
  name,
  description,
  admin_email,
  admin_token,
  center,
  zoom)
VALUES (
  $1::VARCHAR(255),
  $2::TEXT,
  $3::VARCHAR(255),
  $4::VARCHAR(32),
  ST_MAKEPOINT($5, $6)::GEOGRAPHY,
  $7::SMALLINT)
RETURNING
  id,
  name,
  description,
  admin_email,
  admin_token,
  ST_X(center::geometry) AS lng,
  ST_Y(center::geometry) AS lat,
  zoom
`;

const getCampaignQuery = `
SELECT
  id,
  name,
  description,
  admin_email,
  admin_token,
  ST_X(center::geometry) AS lng,
  ST_Y(center::geometry) AS lat,
  zoom
 FROM campaigns
WHERE id = $1
`;

const updateCampaignQuery = `
UPDATE campaigns SET
  name = $3::VARCHAR(255),
  description = $4::TEXT,
  admin_email = $5::VARCHAR(255),
  center = ST_MAKEPOINT($6, $7)::GEOGRAPHY,
  zoom = $8::SMALLINT
WHERE id = $1
  AND admin_token = $2
RETURNING
  id,
  name,
  description,
  admin_email,
  admin_token,
  ST_X(center::geometry) AS lng,
  ST_Y(center::geometry) AS lat,
  zoom
`;

const getTargetUsersQuery = `
SELECT id, email
  FROM users
 WHERE users.campaign = $1
   AND EXISTS (SELECT 1 FROM campaigns c WHERE id = $2 AND admin_token = $3)
   AND ST_DISTANCE(users.location, ST_MAKEPOINT($4, $5)::GEOGRAPHY) < $6;
`;

function getResponse() {
  return {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    statusCode: 200,
    body: ''
  };
}

function getErrorResponse(msg) {
  return {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    statusCode: 500,
    body: JSON.stringify({ error: msg })
  };
}

exports.getCampaignHandler = (event,context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  let id = parseInt(event.pathParameters.id);
  let token = '';
  if (event.queryStringParameters) {
    token = event.queryStringParameters.admin_token;
  }

  pool.query(getCampaignQuery, [id])
    .then(result => {
      let campaign = result.rows[0];
      let response = getResponse();

      if (campaign) {
        if (token != campaign.admin_token) {
          delete campaign.admin_token; //Not an admin
        }

        campaign.center = { 'lng': campaign.lng, 'lat': campaign.lat };
        delete campaign.lng;
        delete campaign.lat;

        response.body = JSON.stringify({campaign: campaign});
      }
      else {
        response.body = JSON.stringify({error: "Campaign not found"});
        response.statusCode = 404;
      }

      callback(null, response);
    })
    .catch(err => {
      console.error(err.stack);
      let response = getErrorResponse("Database Error");

      callback(null, response);
  })
}

exports.createCampaignHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  let data = JSON.parse(event.body);
  let response = getResponse();

  let token = randtoken.generate(32);

  pool.query(createCampaignQuery,
    [data.name, data.description, data.admin_email, token, data.center.lng, data.center.lat, data.zoom])
    .then(result => {

      let campaign = result.rows[0];
      campaign.center = { 'lng': campaign.lng, 'lat': campaign.lat };
      delete campaign.lng;
      delete campaign.lat;

      response.body = JSON.stringify({campaign: campaign});

      callback(null, response);
    })
    .catch(err => {
      console.error(err.stack);
      let response = getErrorResponse("Database Error");

      callback(null, response);
  })
};

exports.updateCampaignHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let data = JSON.parse(event.body);

  let id = parseInt(event.pathParameters.id);
  let token = event.queryStringParameters.admin_token;

  let response = getResponse();

  pool.query(updateCampaignQuery,
    [id, token, data.name, data.description, data.admin_email, data.center.lng, data.center.lat, data.zoom])
    .then(result => {

      let campaign = result.rows[0];
      campaign.center = { 'lng': campaign.lng, 'lat': campaign.lat };
      delete campaign.lng;
      delete campaign.lat;

      response.body = JSON.stringify({campaign: campaign});

      callback(null, response);
    })
    .catch(err => {
      console.error(err.stack);
      let response = getErrorResponse("Database Error");

      callback(null, response);
  })
};

exports.notifyHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  let data = JSON.parse(event.body);
  let response = getResponse();

  pool.query(getTargetUsersQuery,
    [data.campaign.id, data.campaign.id, data.campaign.admin_token, data.lng, data.lat, data.distance])
    .then(result => {
      response.body = JSON.stringify({users: result.rows});

      let notifications = generateNotifications(data.campaign, result.rows);
      Promise.all(notifications).then(() => {
        callback(null, response);
      })
      .catch((err) => {
        console.error("Error sending notifications:", err);
        let response = getErrorResponse("Error Sending Notifications");

        callback(null, response);
      });

    })
    .catch(err => {
      console.error(err.stack);
      let response = getErrorResponse("Database Error");

      callback(null, response);
  })
};

function generateNotifications(campaign, rows) {
  return rows.map( (row) => sendMail({
    from: `${mailgun_sender_name} <${mailgun_sender}@${mailgun_domain}>`,
    to: row.email,
    subject: "Notification from " + campaign.admin_email + ": " + campaign.name,
    text: campaign.description || "No description"
  }));
}

function sendMail(mail) {
  return new Promise(function(resolve, reject) {
    mailgun.messages().send(mail, (err, res) => {
      if (err) {
        return reject(err);
      }
      else {
        resolve(res);
      }
    });

  });
}
