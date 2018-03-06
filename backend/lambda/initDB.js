const { Pool } = require('pg');

const pool = new Pool({
    max: 1,
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000
});

const setupPostGISQuery = `
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

ALTER SCHEMA tiger OWNER TO rds_superuser;
ALTER SCHEMA tiger_data OWNER TO rds_superuser;
ALTER SCHEMA topology OWNER TO rds_superuser;

CREATE OR REPLACE FUNCTION exec(text) returns text language plpgsql volatile AS $f$ BEGIN EXECUTE $1; RETURN $1; END; $f$;

SELECT exec('ALTER TABLE ' || quote_ident(s.nspname) || '.' || quote_ident(s.relname) || ' OWNER TO rds_superuser;')
  FROM (
    SELECT nspname, relname
    FROM pg_class c JOIN pg_namespace n ON (c.relnamespace = n.oid)
    WHERE nspname in ('tiger','topology') AND
    relkind IN ('r','S','v') ORDER BY relkind = 'S') AS s;
COMMIT;
`;

const createTablesQuery = `
BEGIN;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS campaigns;

CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  admin_email VARCHAR(255) NOT NULL,
  admin_token VARCHAR(32) NOT NULL,
  center GEOGRAPHY NOT NULL,
  zoom SMALLINT NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(32) NOT NULL,
  location GEOGRAPHY NOT NULL,
  zoom SMALLINT NOT NULL,
  campaign INTEGER NOT NULL REFERENCES campaigns (id)
);

COMMIT;
`;

function initDBQuery(query, params, callback) {
  pool.query(query, params)
    .then(result => {
      let response = { result: 'success' };
      callback(null, response);
    })
    .catch(err => {
      let result = new Error(err.message);

      callback(result);
  })
}

exports.setupPostGISHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  initDBQuery(setupPostGISQuery, [], callback);
};

exports.createTablesHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  initDBQuery(createTablesQuery, [], callback);
};
