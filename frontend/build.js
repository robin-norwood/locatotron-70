const Metalsmith = require('metalsmith');
const layouts = require('metalsmith-layouts');
const assets = require('metalsmith-assets');

const config = require('../config.dev.json');

Metalsmith(__dirname)
  .source('./src/')
  .destination('./dist/')
  .use(layouts({
    engine: 'handlebars',
    pattern: '*.html'
  }))
  .metadata(config.frontend)
  .use(assets({
    source: './assets',
    destination: './'
    }))
  .clean(true)
  .build(function(err) {
    if (err) throw err;
  });
