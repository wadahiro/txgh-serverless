'use strict';

module.exports.github = (event, context, callback) => {
  console.log(event)
  console.log(event.body)
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    },
    body: JSON.stringify({
      message: 'github',
      input: event,
    }),
  };

  callback(null, response);
};
