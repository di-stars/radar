var redisLib = require('redis'),
    Tracker = require('callback_tracker'),
    sentinelLib = require('redis-sentinel-client'),
    logging = require('minilog')('connection');

function redisConnect(config) {
  var client = redisLib.createClient(config.redis_port, config.redis_host);
  if (config.redis_auth) {
    client.auth(config.redis_auth);
  }

  logging.info('Created a new Redis client.');
  return client;
}

function sentinelConnect(config) {
  var client,
      redisAuth = config.redis_auth,
      sentinelMaster = config.id,
      sentinels = config.sentinels,
      index, sentinelHost, sentinelPort;

  if(!sentinels || !sentinels.length) {
    throw new Error("Provide a valid sentinel cluster configuration ");
  }

  //Pick a random sentinel for now.
  //Only one is supported by redis-sentinel-client,
  //if it's down, let's hope the next round catches the right one.
  index = Math.floor(Math.random()*sentinels.length);
  sentinelHost = sentinels[index].host;
  sentinelPort = sentinels[index].port;

  if(!sentinelPort || !sentinelHost) {
    throw new Error("Provide a valid sentinel cluster configuration ");
  }

  client = sentinelLib.createClient(sentinelPort, sentinelHost, {
    auth_pass: redisAuth,
    masterName: sentinelMaster
  });

  logging.info('Created a new Redis client.');
  return client;
}

function selectMethod(config) {
  var method = redisConnect;
  if(config.id || config.sentinels) {
    method = sentinelConnect;
  }
  return method;
}

var connections = {};

function establishConnection(name, config, done) {
  if(connections[name]) {
    if(done) done(null, connections[name]);
    return;
  }

  var connection = {
    client: null,
    subscriber: null,
  };
  var tracker = Tracker.create('establish :' + name , function() {
    if(done) done(null, connection);
  });

  connections[name] = connection;
  method = selectMethod(config);

  //create a client (read/write)
  connection.client = method(config);
  logging.info('Created a new client.');
  connection.client.once('ready', tracker('client ready :'+ name));

  //create a pubsub client
  connection.subscriber = method(config);
  logging.info('Created a new subscriber.');
  connection.subscriber.once('ready', tracker('subscriber ready :'+ name));
}

function teardownConnection(name, done) {
  var connection = connections[name];
  if(!connection) {
    if(done) done();
    return;
  }

  var finished = function() {
    delete connections[name];
    done();
  };

  var tracker = Tracker.create('teardown :' + name , finished);

  if(connection.client) {
    if(connection.client.connected) {
      connection.client.quit(tracker('quit client :'+ name, function() {
        connection.client = null;
      }));
    } else {
      connection.client = null;
    }
  }

  if(connection.subscriber) {
    if(connection.subscriber.connected) {
      connection.subscriber.quit(tracker('quit subscriber :'+ name, function() {
        connection.subscriber = null;
      }));
    } else {
      connection.subscriber = null;
    }
  }
  if(!connection.client && !connection.subscriber) {
    finished();
  }
}

module.exports = {
  establishConnection: establishConnection,
  teardownConnection: teardownConnection
};
