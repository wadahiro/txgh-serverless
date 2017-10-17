'use strict';

module.exports.github = (event, context, callback) => {
  console.log(event)
  console.log(event.body)
  const response = {
    statusCode: 404
  };

  callback(null, response);
};
